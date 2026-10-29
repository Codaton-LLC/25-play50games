// Plate Bounce Arena's rules: a deterministic toy pinball in the table plane (table.ts coordinates),
// stepped in fixed 8 ms substeps (125 Hz). The hero is the ball. Gravity's slope component pulls toward
// the drain (+z); flippers are rotating capsules whose contact point velocity throws the ball; bumpers,
// slingshots and kickers set the outgoing speed; ramps and the orbit carry the ball along their path;
// mushrooms throw it onto the orbit. The ball never moves faster than V_MAX (every substep, all
// transport included) except the respawn on the plunger: the proof (README "Scoring and the proof")
// rests on that.
//
// A table is a list of objectives (the card's sections, in order); each one's pieces count only while
// it is the current one. When all are done the exit hole opens: sink the ball to win. Level 5 is Rollo:
// his defeat is the win. Three balls per table: the last one drained ends the run "lose" (unranked).
import type { LevelId } from "@/arcade3d/types";
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboHit, comboMaxBonus, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_HOLD_MS, MAGNET_PULL, POWER_MS, V_DASH, V_HOP, V_MAGNET, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE_MS, ROLLO, SECRETS } from "./progression";
import {
   ATTIC, BALL_R, DECK, DECK_ZONE, DRAIN_Z, FLIPPER_LEN, FLIPPER_R, LANE_X, MUSHROOM_R, PLUNGER, buildTable, rampPoint,
   type Circle, type Seg, type Table,
} from "./table";

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const SUB_MS = 8;

/** the slope's pull toward the drain (m/s², the toy table's feel; the ice table is steeper) */
export const G_SLOPE = 5.2;
export const ICE_SLOPE = 1.15;
/** rolling drag (1/s); the ice table has 30 % less */
export const DRAG = 0.12;
export const ICE_DRAG = 0.084;
/** the hard speed cap (m/s): every substep, every kind of motion */
export const V_MAX = 18;
/** a light nudge (m/s²) along the camera-relative stick */
export const NUDGE = 2;
export const E_WALL = 0.45;
export const E_FLIP = 0.3;
export const V_BUMPER = 12;
/** slingshots: the outgoing speed is SLING_BASE + SLING_GAIN x the incoming normal speed, at most the kicker's own */
export const SLING_BASE = 1;
export const SLING_GAIN = 0.8;
export const V_MUSHROOM_BOUNCE = 9;
/** flipper angles (rad from the horizontal toward the centre; + toward the drain) and speeds */
export const FLIP_REST = 0.52;
export const FLIP_UP = -0.49;
export const FLIP_W_UP = 20;
export const FLIP_W_DOWN = 12;
/** the plunger: hold Jump to charge (full in 1 s), let go to launch at PLUNGE_MIN..MAX */
export const PLUNGE_FULL_MS = 1000;
export const PLUNGE_MIN = 12;
export const PLUNGE_MAX = 18;
/** the skill shot's gold band on the gauge */
export const SKILL_LO = 0.62;
export const SKILL_HI = 0.74;
/** a ramp takes the ball when it reaches the mouth moving along it this fast */
export const RAMP_MIN = 6.5;
export const RAMP_CATCH = 1.05;
/** flights (mushrooms, the deck): at most this fast along the ground */
export const V_FLIGHT = 12;
export const G_HOP = 20;
export const HOLE_SINK = 0.7;
export const HOLE_PULL = 2.6;
export const ORB_PICK = 0.85;
export const ORB = { bonusMs: 50 } as const;
export const BALL_SAVE_MS = 6000;
export const LOST_MS = 1000;
export const BALLS = 3;
export const STILL_MS = 2500;
export const ORBIT_STREAK_MS = 15_000;
export const GOLDEN_MS = 10_000;
export const JAM_MS = 8000;
/** the most bumper and ramp/orbit links a run's flow meter counts (later ones still chain, at no bonus) */
export const BUMPER_LINKS = 24;
export const RAMP_LINKS = 8;
/** cosmetic table points (the HUD's score reel; the ranked score is the time) */
export const POINTS = { bumper: 100, sling: 10, ramp: 1000, orbit: 750, lantern: 250, target: 250, orb: 100, coin: 50, jackpot: 5000, boss: 2500 } as const;

export type BallMode = "plunger" | "roll" | "flight" | "ramp" | "held" | "lost";

export interface Ball {
   x: number;
   z: number;
   vx: number;
   vz: number;
   h: number;
   vh: number;
   layer: 0 | 1;
   mode: BallMode;
   charge: number;
   /** flight: from, to, time, length, then (a ramp index, -2 the deck) */
   fx0: number;
   fz0: number;
   fh0: number;
   fx1: number;
   fz1: number;
   fh1: number;
   fT: number;
   fDur: number;
   fThen: number;
   /** ramp transport */
   ramp: number;
   rampS: number;
   rampV: number;
   /** magnet: the pad, ms held */
   pad: number;
   heldMs: number;
   timer: number;
   stillMs: number;
   /** where the stuck check anchored */
   sx: number;
   sz: number;
   hops: number;
}

export interface Marble {
   x: number;
   z: number;
   vx: number;
   vz: number;
   alive: boolean;
}

/** Objective progress (a separate object so co-op can share it). */
export interface Progress {
   stage: number;
   count: number;
   lit: Uint8Array;
   down: Uint8Array;
   cracked: number;
   streakAt: number;
}

export interface Rollo {
   x: number;
   z: number;
   theta: number;
   visible: boolean;
   /** the flipper he jams (phase 3): 0 left, 1 right, -1 none */
   jam: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   /** flippers held (A / ←, D / →, a touch on that half of the screen) */
   left: boolean;
   right: boolean;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
   actionHeld: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, left: false, right: false, jumpPressed: false, jumpHeld: false, actionPressed: false, actionHeld: false };
}

export interface StepEvents {
   flipped: number;
   bumpers: number;
   bumperList: number[];
   slings: number;
   rampIn: boolean;
   rampDone: boolean;
   orbitDone: boolean;
   mushroom: number;
   lantern: number;
   target: number;
   orbCount: number;
   orbList: number[];
   coins: number;
   secretCount: number;
   secretList: number[];
   stageDone: number;
   exitOpen: boolean;
   plunged: boolean;
   skill: boolean;
   saved: boolean;
   shieldSave: boolean;
   lost: boolean;
   respawned: boolean;
   gameOver: boolean;
   finished: boolean;
   timeup: boolean;
   powered: boolean;
   cracked: boolean;
   hop: boolean;
   deck: boolean;
   held: boolean;
   released: boolean;
   multiball: boolean;
   jackpot: boolean;
   golden: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossBump: boolean;
   comboBonus: number;
   points: number;
}

export interface PinRun {
   table: Table;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   remainder: number;
   ball: Ball;
   marbles: Marble[];
   /** flipper angle and angular speed, left then right */
   flip: Float64Array;
   flipW: Float64Array;
   ballsLeft: number;
   /** balls lost (the no-ball-lost badge) */
   hits: number;
   saveUntil: number;
   saveUsed: boolean;
   powerUsed: boolean;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   phaseUntil: number;
   shieldSaved: boolean;
   padCool: Float64Array;
   mushCool: number;
   prog: Progress;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   coins: number;
   bumperLinks: number;
   rampLinks: number;
   goldenUntil: number;
   points: number;
   mult: number;
   combo: ComboState;
   secrets: SecretTracker;
   finishMs: number;
   ended: "win" | "lose" | "timeup" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
   rollo: Rollo;
   multi: boolean;
   versus: boolean;
   seat: number;
}

function createEvents(): StepEvents {
   return {
      flipped: 0, bumpers: 0, bumperList: [0, 0, 0, 0, 0, 0, 0, 0], slings: 0, rampIn: false, rampDone: false, orbitDone: false, mushroom: NONE, lantern: NONE, target: NONE,
      orbCount: 0, orbList: new Array<number>(32).fill(0), coins: 0, secretCount: 0, secretList: [0, 0, 0, 0], stageDone: NONE, exitOpen: false,
      plunged: false, skill: false, saved: false, shieldSave: false, lost: false, respawned: false, gameOver: false, finished: false, timeup: false,
      powered: false, cracked: false, hop: false, deck: false, held: false, released: false, multiball: false, jackpot: false, golden: false,
      bossHit: false, bossPhase: false, bossDefeated: false, bossBump: false, comboBonus: 0, points: 0,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.flipped = ev.bumpers = ev.slings = ev.orbCount = ev.coins = ev.secretCount = ev.comboBonus = ev.points = 0;
   ev.mushroom = ev.lantern = ev.target = ev.stageDone = NONE;
   ev.rampIn = ev.rampDone = ev.orbitDone = ev.exitOpen = ev.plunged = ev.skill = ev.saved = ev.shieldSave = ev.lost = false;
   ev.respawned = ev.gameOver = ev.finished = ev.timeup = ev.powered = ev.cracked = ev.hop = ev.deck = ev.held = ev.released = false;
   ev.multiball = ev.jackpot = ev.golden = ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.bossBump = false;
}

function freshBall(): Ball {
   return {
      x: PLUNGER.x, z: PLUNGER.z, vx: 0, vz: 0, h: 0, vh: 0, layer: 0, mode: "plunger", charge: 0,
      fx0: 0, fz0: 0, fh0: 0, fx1: 0, fz1: 0, fh1: 0, fT: 0, fDur: 1, fThen: NONE, ramp: NONE, rampS: 0, rampV: 0, pad: NONE, heldMs: 0, timer: 0, stillMs: 0, sx: PLUNGER.x, sz: PLUNGER.z, hops: 0,
   };
}

export function courseFor(level: LevelId): Table {
   return buildTable(level);
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): PinRun {
   const table = courseFor(level);
   return {
      table, level, heroId, seed, simMs: 0, remainder: 0, ball: freshBall(), marbles: [],
      flip: Float64Array.of(FLIP_REST, FLIP_REST), flipW: new Float64Array(2),
      ballsLeft: BALLS, hits: 0, saveUntil: -1, saveUsed: false, powerUsed: false, powerReadyAt: 0, dashUntil: -1, shieldUntil: -1, phaseUntil: -1, shieldSaved: false,
      padCool: new Float64Array(table.magnets.length), mushCool: 0,
      prog: { stage: 0, count: 0, lit: new Uint8Array(table.lanterns.length), down: new Uint8Array(table.targets.length), cracked: 0, streakAt: -1e9 },
      collected: new Uint8Array(table.orbs.length), orbs: 0, mainOrbs: 0, coins: 0, bumperLinks: 0, rampLinks: 0, goldenUntil: -1, points: 0, mult: 1,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]), finishMs: 0, ended: null, events: createEvents(),
      boss: table.boss ? createBoss(ROLLO) : null, bossEv: createBossEvents(),
      rollo: { x: table.boss?.x ?? 0, z: table.boss?.z ?? -18, theta: 0, visible: !!table.boss, jam: NONE },
      multi: false, versus: false, seat: 0,
   };
}

/** A deep copy sharing only the immutable table (the bot's lookahead). */
export function cloneRun(r: PinRun): PinRun {
   return {
      ...r,
      ball: { ...r.ball },
      marbles: r.marbles.map((m) => ({ ...m })),
      flip: r.flip.slice(),
      flipW: r.flipW.slice(),
      padCool: r.padCool.slice(),
      prog: { ...r.prog, lit: r.prog.lit.slice(), down: r.prog.down.slice() },
      collected: r.collected.slice(),
      combo: { ...r.combo },
      secrets: { found: r.secrets.found.slice(), count: r.secrets.count },
      events: createEvents(),
      boss: r.boss ? { ...r.boss } : null,
      bossEv: { ...r.bossEv },
      rollo: { ...r.rollo },
   };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------------- queries ----------------

export function exitOpen(run: PinRun): boolean {
   return !run.table.boss && run.prog.stage >= run.table.objectives.length;
}

export function currentObjective(run: PinRun) {
   return run.table.objectives[run.prog.stage] ?? null;
}

/** Is segment i solid for the hero (or a marble) moving this way right now? */
export function segSolid(run: PinRun, s: Seg, hero: boolean, vx: number, vz: number): boolean {
   if (s.kind === "gate") return run.prog.stage < s.until;
   if (s.kind === "crack") return run.prog.cracked === 0;
   if (s.kind === "oneway") return vz > 0;
   if (s.kind === "ghost") return !(hero && run.phaseUntil >= run.simMs) && vx < 0;
   return true;
}

export function flipperHeld(run: PinRun, input: StepInput, side: 0 | 1): boolean {
   if (run.rollo.jam === side) return false;
   const both = input.jumpHeld && run.ball.mode !== "plunger";
   return (side === 0 ? input.left : input.right) || both;
}

/** The flipper's tip (table coordinates). */
export function flipperTip(run: PinRun, i: number, out: { x: number; z: number }): { x: number; z: number } {
   const f = run.table.flippers[i];
   const a = run.flip[i];
   out.x = f.px + f.side * Math.cos(a) * FLIPPER_LEN;
   out.z = f.pz + Math.sin(a) * FLIPPER_LEN;
   return out;
}

// ---------------- collisions ----------------

interface Body {
   x: number;
   z: number;
   vx: number;
   vz: number;
}

function hitSeg(run: PinRun, b: Body, s: Seg, hero: boolean, ev: StepEvents): boolean {
   const ex = s.bx - s.ax;
   const ez = s.bz - s.az;
   const len2 = ex * ex + ez * ez || 1;
   const t = clamp(((b.x - s.ax) * ex + (b.z - s.az) * ez) / len2, 0, 1);
   const cx = s.ax + ex * t;
   const cz = s.az + ez * t;
   let nx = b.x - cx;
   let nz = b.z - cz;
   const d = Math.hypot(nx, nz);
   const R = BALL_R + s.r;
   if (d >= R || d < 1e-9) return false;
   if (!segSolid(run, s, hero, b.vx, b.vz)) return false;
   if (s.kind === "oneway" && b.z > cz) return false;
   if (s.kind === "crack" && hero && run.dashUntil >= run.simMs) {
      run.prog.cracked = 1;
      ev.cracked = true;
      return false;
   }
   nx /= d;
   nz /= d;
   b.x = cx + nx * R;
   b.z = cz + nz * R;
   const vn = b.vx * nx + b.vz * nz;
   if (s.kind === "kick" || (s.kind === "gate" && s.kick > 0)) {
      if (vn < 1) {
         // a slingshot fires as hard as it is hit (a dribble dies out); the drain gate always kicks fully
         const out = s.kind === "gate" ? s.kick : Math.min(s.kick, SLING_BASE + SLING_GAIN * Math.max(0, -vn));
         b.vx += (out - vn) * nx;
         b.vz += (out - vn) * nz;
         if (hero) {
            ev.slings++;
            ev.points += POINTS.sling;
         }
      }
   } else if (vn < 0) {
      b.vx -= (1 + E_WALL) * vn * nx;
      b.vz -= (1 + E_WALL) * vn * nz;
   }
   return true;
}

/** A solid circle; `out` > 0 sets the outgoing normal speed (bumpers). True on a touch. */
function hitCircle(b: Body, c: Circle, out: number, e = E_WALL): boolean {
   let nx = b.x - c.x;
   let nz = b.z - c.z;
   const d = Math.hypot(nx, nz);
   const R = BALL_R + c.r;
   if (d >= R || d < 1e-9) return false;
   nx /= d;
   nz /= d;
   b.x = c.x + nx * R;
   b.z = c.z + nz * R;
   const vn = b.vx * nx + b.vz * nz;
   if (out > 0) {
      b.vx += (out - vn) * nx;
      b.vz += (out - vn) * nz;
   } else if (vn < 0) {
      b.vx -= (1 + e) * vn * nx;
      b.vz -= (1 + e) * vn * nz;
   }
   return true;
}

function hitFlippers(run: PinRun, b: Body): void {
   const fl = run.table.flippers;
   for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      const a = run.flip[i];
      const w = run.flipW[i];
      const dx = f.side * Math.cos(a);
      const dz = Math.sin(a);
      const t = clamp((b.x - f.px) * dx + (b.z - f.pz) * dz, 0, FLIPPER_LEN);
      const cx = f.px + dx * t;
      const cz = f.pz + dz * t;
      let nx = b.x - cx;
      let nz = b.z - cz;
      const d = Math.hypot(nx, nz);
      const R = BALL_R + FLIPPER_R;
      if (d >= R || d < 1e-9) continue;
      nx /= d;
      nz /= d;
      b.x = cx + nx * R;
      b.z = cz + nz * R;
      const px = t * w * -f.side * Math.sin(a);
      const pz = t * w * Math.cos(a);
      const rel = (b.vx - px) * nx + (b.vz - pz) * nz;
      if (rel < 0) {
         b.vx -= (1 + E_FLIP) * rel * nx;
         b.vz -= (1 + E_FLIP) * rel * nz;
      }
   }
}

function capSpeed(b: Body, cap = V_MAX): void {
   const s = Math.hypot(b.vx, b.vz);
   if (s > cap) {
      b.vx *= cap / s;
      b.vz *= cap / s;
   }
}

// ---------------- the hero ball ----------------

function link(run: PinRun, base: number, ev: StepEvents): void {
   ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
}

function addPoints(run: PinRun, p: number, ev: StepEvents): void {
   run.points += p * run.mult;
   ev.points += p * run.mult;
}

function advance(run: PinRun, ev: StepEvents): void {
   const p = run.prog;
   p.stage++;
   p.count = 0;
   ev.stageDone = p.stage - 1;
   if (run.table.multiballAt === p.stage) spawnMarbles(run, ev);
   if (exitOpen(run)) ev.exitOpen = true;
}

function spawnMarbles(run: PinRun, ev: StepEvents): void {
   run.marbles = [
      { x: -1.2, z: -26.4, vx: -2.5, vz: 3, alive: true },
      { x: 1.2, z: -26.4, vx: 2.5, vz: 3, alive: true },
   ];
   ev.multiball = true;
}

function noteBumper(run: PinRun, i: number, ev: StepEvents): void {
   if (ev.bumpers < ev.bumperList.length) ev.bumperList[ev.bumpers] = i;
   ev.bumpers++;
   addPoints(run, POINTS.bumper, ev);
   if (run.bumperLinks < BUMPER_LINKS) {
      run.bumperLinks++;
      link(run, COMBO_BASE_MS.bumper, ev);
   }
   const o = currentObjective(run);
   if (o?.kind === "bumpers") {
      run.prog.count++;
      if (run.prog.count >= o.n) advance(run, ev);
   }
}

function rampComplete(run: PinRun, ramp: number, ev: StepEvents): void {
   const r = run.table.ramps[ramp];
   const p = run.prog;
   const o = currentObjective(run);
   if (run.rampLinks < RAMP_LINKS) {
      run.rampLinks++;
      link(run, COMBO_BASE_MS.ramp, ev);
   }
   if (r.kind === "orbit") {
      ev.orbitDone = true;
      addPoints(run, POINTS.orbit, ev);
      if (o?.kind === "orbits") {
         if (run.simMs - p.streakAt > ORBIT_STREAK_MS) p.count = 0;
         p.streakAt = run.simMs;
         p.count++;
         if (p.count >= o.n) {
            run.mult = 2;
            advance(run, ev);
         }
      }
      return;
   }
   ev.rampDone = true;
   run.goldenUntil = run.simMs + GOLDEN_MS;
   ev.golden = true;
   const alive = run.marbles.length > 0 && run.marbles.every((m) => m.alive);
   if (alive) {
      ev.jackpot = true;
      addPoints(run, POINTS.jackpot * 3, ev);
   } else addPoints(run, POINTS.ramp, ev);
   if (o?.kind === "ramp") {
      p.count++;
      if (p.count >= o.n) advance(run, ev);
   }
   if (run.boss && run.boss.phase === 2 && run.boss.step === "vulnerable") bossHitNow(run, ev);
}

function startFlight(b: Ball, x: number, z: number, h: number, then: number): void {
   b.mode = "flight";
   b.fx0 = b.x;
   b.fz0 = b.z;
   b.fh0 = b.h;
   b.fx1 = x;
   b.fz1 = z;
   b.fh1 = h;
   b.fT = 0;
   b.fDur = Math.max(0.5, Math.hypot(x - b.x, z - b.z) / V_FLIGHT);
   b.fThen = then;
   b.vx = b.vz = 0;
}

function enterRamp(b: Ball, i: number, speed: number): void {
   b.mode = "ramp";
   b.ramp = i;
   b.rampS = 0;
   b.rampV = clamp(speed, 10, V_MAX * 0.9);
}

function respawn(run: PinRun, ev: StepEvents): void {
   const b = run.ball;
   const keepSave = b.mode === "lost" ? false : run.saveUsed;
   Object.assign(b, freshBall());
   run.saveUsed = keepSave;
   ev.respawned = true;
}

function newBall(run: PinRun): void {
   run.saveUsed = false;
   run.powerUsed = false;
   run.shieldSaved = false;
   run.saveUntil = -1;
}

function drain(run: PinRun, ev: StepEvents): void {
   const b = run.ball;
   if (run.shieldUntil >= run.simMs && !run.shieldSaved) {
      // Kiro: the shield bounces it back up the middle
      run.shieldSaved = true;
      b.z = DRAIN_Z - 0.02;
      b.vx = -b.x * 0.6;
      b.vz = -13;
      ev.shieldSave = true;
      return;
   }
   if (run.saveUntil >= run.simMs && !run.saveUsed) {
      run.saveUsed = true;
      Object.assign(b, freshBall());
      ev.saved = true;
      ev.respawned = true;
      return;
   }
   run.hits++;
   run.ballsLeft--;
   b.mode = "lost";
   b.timer = 0;
   b.vx = b.vz = 0;
   comboBreak(run.combo);
   if (currentObjective(run)?.kind === "orbits") run.prog.count = 0;
   ev.lost = true;
}

function firePower(run: PinRun, input: StepInput, ev: StepEvents): void {
   const hero = heroById(run.heroId);
   const b = run.ball;
   if (b.mode !== "roll") return;
   if (hero.perBall && run.powerUsed) return;
   if (run.powerReadyAt > run.simMs) return;
   if (hero.power === "dash") {
      const w = inputToWorld(input.moveX, input.moveZ, input.yaw);
      let dx = w.x;
      let dz = w.z;
      const m = Math.hypot(dx, dz);
      if (m < 0.3) {
         dx = 0;
         dz = -1;
      } else {
         dx /= m;
         dz /= m;
      }
      b.vx += dx * V_DASH;
      b.vz += dz * V_DASH;
      run.dashUntil = run.simMs + POWER_MS.dash;
   } else if (hero.power === "shield") run.shieldUntil = run.simMs + POWER_MS.shield;
   else if (hero.power === "phase") run.phaseUntil = run.simMs + POWER_MS.phase;
   else return;
   if (hero.perBall) run.powerUsed = true;
   run.powerReadyAt = run.simMs + hero.cooldownMs;
   ev.powered = true;
}

function hop(run: PinRun, ev: StepEvents): void {
   const b = run.ball;
   if (b.mode !== "roll") return;
   if (b.h <= (b.layer === 1 ? DECK.h : 0) && b.vh <= 0) {
      b.vh = V_HOP;
      b.hops = 1;
      ev.hop = true;
   } else if (b.hops === 1) {
      b.hops = 2;
      ev.hop = true;
      if (b.layer === 0 && b.x > DECK_ZONE.x0 && b.x < DECK_ZONE.x1 && b.z > DECK_ZONE.z0 && b.z < DECK_ZONE.z1) {
         startFlight(b, (DECK.x0 + DECK.x1) / 2, (DECK.z0 + DECK.z1) / 2, DECK.h, -2);
         ev.deck = true;
      } else b.vh = V_HOP;
   }
}

function pickup(run: PinRun, ev: StepEvents): void {
   const b = run.ball;
   const orbs = run.table.orbs;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      if (o.kind === "coin") continue;
      if (o.kind === "ramp") {
         if (b.mode !== "ramp" || b.ramp !== o.ramp) continue;
      } else if (o.kind === "deck") {
         if (b.layer !== 1) continue;
      } else if (b.layer !== 0 || b.h > 0.8 || b.mode !== "roll") continue;
      if (Math.hypot(b.x - o.x, b.z - o.z) > ORB_PICK) continue;
      collectOrb(run, i, ev);
   }
}

function collectOrb(run: PinRun, i: number, ev: StepEvents): void {
   run.collected[i] = 1;
   const o = run.table.orbs[i];
   run.orbs++;
   if (o.main) run.mainOrbs++;
   if (o.kind === "coin") {
      run.coins++;
      ev.coins++;
      addPoints(run, POINTS.coin, ev);
   } else addPoints(run, POINTS.orb, ev);
   if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount] = i;
   ev.orbCount++;
   link(run, COMBO_BASE_MS.orb, ev);
}

function secret(run: PinRun, i: number, ev: StepEvents): void {
   if (!collectSecret(run.secrets, i)) return;
   if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
   ev.secretCount++;
}

function rollStep(run: PinRun, dt: number, input: StepInput, ev: StepEvents): void {
   const b = run.ball;
   const t = run.table;
   const hero = run.heroId;
   // Zuno: stick to a magnet pad while Action is held
   if (hero === "zuno" && input.actionHeld && b.layer === 0 && b.h <= 0) {
      for (let i = 0; i < t.magnets.length; i++) {
         const m = t.magnets[i];
         if (run.padCool[i] > run.simMs) continue;
         if (Math.hypot(b.x - m.x, b.z - m.z) < m.r + 0.2) {
            b.mode = "held";
            b.pad = i;
            b.heldMs = 0;
            b.vx = b.vz = 0;
            ev.held = true;
            return;
         }
      }
   }
   const slope = G_SLOPE * (t.ice ? ICE_SLOPE : 1);
   const drag = t.ice ? ICE_DRAG : DRAG;
   const w = inputToWorld(input.moveX, input.moveZ, input.yaw);
   b.vx += w.x * NUDGE * dt;
   b.vz += (slope + w.z * NUDGE) * dt;
   const k = 1 - drag * dt;
   b.vx *= k;
   b.vz *= k;
   // hops
   const floor = b.layer === 1 ? DECK.h : 0;
   if (b.h > floor || b.vh > 0) {
      b.vh -= G_HOP * dt;
      b.h += b.vh * dt;
      if (b.h <= floor) {
         b.h = floor;
         b.vh = 0;
         b.hops = 0;
      }
   }
   b.x += b.vx * dt;
   b.z += b.vz * dt;
   const low = b.h - floor < 0.6;
   // walls
   for (const s of t.segs) {
      if (s.layer !== b.layer) continue;
      hitSeg(run, b, s, true, ev);
   }
   if (b.layer === 1) {
      for (let i = 0; i < t.bumpers.length; i++) if (t.bumpers[i].layer === 1 && hitCircle(b, t.bumpers[i], V_BUMPER * 0.8)) noteBumper(run, i, ev);
      // rolled off the deck's open edge: drop to the field
      if (b.z > DECK.z1 || b.x < DECK.x0 || b.x > DECK.x1 || b.z < DECK.z0) {
         b.layer = 0;
         b.h = DECK.h;
         b.vh = 0;
         b.hops = 2;
      }
      return;
   }
   if (low) {
      for (let i = 0; i < t.bumpers.length; i++) if (t.bumpers[i].layer === 0 && hitCircle(b, t.bumpers[i], V_BUMPER)) noteBumper(run, i, ev);
      for (const p of t.posts) hitCircle(b, p, 0);
      for (let i = 0; i < t.mushrooms.length; i++) {
         const m = t.mushrooms[i];
         const sp = Math.hypot(b.vx, b.vz);
         const touch = Math.hypot(b.x - m.x, b.z - m.z) < m.r + BALL_R;
         if (touch && t.orbit >= 0 && run.mushCool <= run.simMs && sp >= 3) {
            run.mushCool = run.simMs + 1200;
            const o = t.ramps[t.orbit];
            startFlight(b, o.ex, o.ez, 0.5, t.orbit);
            ev.mushroom = i;
            return;
         }
         hitCircle(b, m, V_MUSHROOM_BOUNCE);
      }
      const p = run.prog;
      const o = currentObjective(run);
      for (let i = 0; i < t.targets.length; i++) {
         if (p.down[i]) continue;
         const tg = t.targets[i];
         const vin = b.vx * (tg.x - b.x) + b.vz * (tg.z - b.z);
         if (!hitCircle(b, tg, 0)) continue;
         const live = tg.bank < 0 || (o?.kind === "bank" && o.bank === tg.bank);
         if (live && vin > 0) {
            p.down[i] = 1;
            ev.target = i;
            addPoints(run, POINTS.target, ev);
            link(run, COMBO_BASE_MS.target, ev);
            if (o?.kind === "bank" && tg.bank === o.bank) {
               let all = true;
               for (let j = 0; j < t.targets.length; j++) if (t.targets[j].bank === o.bank && !p.down[j]) all = false;
               if (all) advance(run, ev);
            }
         }
      }
      if (o?.kind === "lanterns") {
         for (let i = 0; i < t.lanterns.length; i++) {
            if (p.lit[i]) continue;
            const l = t.lanterns[i];
            if (Math.hypot(b.x - l.x, b.z - l.z) > l.r + BALL_R) continue;
            p.lit[i] = 1;
            ev.lantern = i;
            addPoints(run, POINTS.lantern, ev);
            link(run, COMBO_BASE_MS.lantern, ev);
            let n = 0;
            for (let j = 0; j < p.lit.length; j++) n += p.lit[j];
            if (n >= t.lanterns.length) advance(run, ev);
         }
      }
      // the exit hole: closed it is a cap; open it pulls and sinks
      const hole = t.hole;
      const dh = Math.hypot(b.x - hole.x, b.z - hole.z);
      if (exitOpen(run)) {
         if (dh < HOLE_PULL && dh > 1e-6) {
            b.vx += ((hole.x - b.x) / dh) * 10 * dt;
            b.vz += ((hole.z - b.z) / dh) * 10 * dt;
         }
         if (dh < HOLE_SINK) {
            win(run, ev);
            return;
         }
      } else hitCircle(b, hole, 0);
      // ramps: the mouth takes a fast ball, turns a slow one back
      for (let i = 0; i < t.ramps.length; i++) {
         const r = t.ramps[i];
         if (r.kind !== "ramp") continue;
         if (Math.hypot(b.x - r.ex, b.z - r.ez) > RAMP_CATCH) continue;
         const along = b.vx * r.dx + b.vz * r.dz;
         if (along >= RAMP_MIN) {
            enterRamp(b, i, Math.hypot(b.vx, b.vz));
            ev.rampIn = true;
            return;
         }
         if (along > 0) {
            b.vx -= 1.5 * along * r.dx;
            b.vz -= 1.5 * along * r.dz;
         }
      }
      // Rollo; while he jams a flipper a toy post guards that side of the drain
      if (run.boss && run.rollo.visible) bossTouch(run, ev);
      if (run.rollo.jam >= 0) hitCircle(b, guardPost(run.rollo.jam, GUARD), 0, 0.6);
      hitFlippers(run, b);
      // secrets: the sticker behind the lone penguin, the attic shard
      const lone = t.targets.findIndex((x) => x.bank < 0);
      if (lone >= 0 && p.down[lone] && Math.hypot(b.x - t.sticker.x, b.z - t.sticker.z) < t.sticker.r + BALL_R) secret(run, 1, ev);
      if (Math.hypot(b.x - t.shard.x, b.z - t.shard.z) < t.shard.r + BALL_R) secret(run, 2, ev);
   }
   // marbles
   for (const m of run.marbles) {
      if (!m.alive) continue;
      const dx = b.x - m.x;
      const dz = b.z - m.z;
      const d = Math.hypot(dx, dz);
      if (d < 2 * BALL_R && d > 1e-9) {
         const nx = dx / d;
         const nz = dz / d;
         const push = (2 * BALL_R - d) / 2;
         b.x += nx * push;
         b.z += nz * push;
         m.x -= nx * push;
         m.z -= nz * push;
         const rel = (b.vx - m.vx) * nx + (b.vz - m.vz) * nz;
         if (rel < 0) {
            const j = -(1 + 0.9) * rel * 0.5;
            b.vx += j * nx;
            b.vz += j * nz;
            m.vx -= j * nx;
            m.vz -= j * nz;
         }
      }
   }
   // the drain, and back on the plunger
   if (b.z > DRAIN_Z && b.x < LANE_X - 0.1) {
      drain(run, ev);
      return;
   }
   if (b.x > LANE_X && b.z > PLUNGER.z - 0.5 && Math.hypot(b.vx, b.vz) < 1.5) {
      b.mode = "plunger";
      b.vx = b.vz = 0;
      b.charge = 0;
   }
   // stuck: a ball search kick toward the middle of the table
   // stuck (wedged or rocking in one spot) unless a flipper cradles it: a ball search kick
   const held = input.left || input.right || input.jumpHeld;
   if (Math.hypot(b.x - b.sx, b.z - b.sz) > 0.6 || held || b.h > floor) {
      b.sx = b.x;
      b.sz = b.z;
      b.stillMs = 0;
   } else {
      b.stillMs += dt * 1000;
      if (b.stillMs > STILL_MS) {
         const dx = 0 - b.x;
         const dz = -14 - b.z;
         const d = Math.hypot(dx, dz) || 1;
         b.vx = (dx / d) * 7;
         b.vz = (dz / d) * 7;
         b.stillMs = 0;
      }
   }
}

function marbleStep(run: PinRun, m: Marble, dt: number, ev: StepEvents): void {
   const t = run.table;
   m.vz += G_SLOPE * dt;
   m.vx *= 1 - DRAG * dt;
   m.vz *= 1 - DRAG * dt;
   m.x += m.vx * dt;
   m.z += m.vz * dt;
   for (const s of t.segs) if (s.layer === 0) hitSeg(run, m, s, false, ev);
   for (const c of t.bumpers) if (c.layer === 0 && hitCircle(m, c, V_BUMPER)) addPoints(run, POINTS.bumper / 2, ev);
   for (const p of t.posts) hitCircle(m, p, 0);
   for (let i = 0; i < t.targets.length; i++) if (!run.prog.down[i]) hitCircle(m, t.targets[i], 0);
   if (!exitOpen(run)) hitCircle(m, t.hole, 0);
   hitFlippers(run, m);
   capSpeed(m);
   if (m.z > DRAIN_Z && m.x < LANE_X) m.alive = false;
   if (m.x > LANE_X && m.z > -2) {
      // a marble never sits in the lane: it is kicked back up to the field
      m.vz = -14;
   }
}

function win(run: PinRun, ev: StepEvents): void {
   if (run.ended) return;
   run.ended = "win";
   run.finishMs = run.simMs;
   ev.finished = true;
}

// ---------------- the boss: Rollo ----------------

function bossFrame(run: PinRun, dtMs: number, ev: StepEvents): void {
   const b = run.boss;
   const t = run.table.boss;
   if (!b || !t) return;
   const bev = stepBoss(b, ROLLO, dtMs, run.bossEv);
   if (bev.phaseChanged) ev.bossPhase = true;
   const r = run.rollo;
   r.visible = b.step !== "done";
   const fast = b.step === "attack" ? 2.4 : b.step === "vulnerable" ? 0.45 : 1;
   r.theta += (dtMs / 1000) * 0.9 * fast;
   r.x = t.x + t.ax * Math.sin(r.theta);
   r.z = t.z + t.az * Math.sin(2 * r.theta) * 0.8;
   r.jam = b.phase === 2 && b.step !== "defeat" && b.step !== "done" ? Math.floor(run.simMs / JAM_MS) % 2 : NONE;
}

const GUARD: Circle = { x: 0, z: 0, r: 0.25, layer: 0 };

/** The post over the drain on the jammed flipper's side (phase 3): only the working side can drain. */
export function guardPost(jam: number, out: Circle = { x: 0, z: 0, r: 0.25, layer: 0 }): Circle {
   out.x = jam === 0 ? -0.45 : 0.45;
   out.z = -1.0;
   out.r = 0.25;
   return out;
}

function bossTouch(run: PinRun, ev: StepEvents): void {
   const b = run.boss;
   const r = run.rollo;
   const t = run.table.boss;
   if (!b || !t) return;
   const ball = run.ball;
   const speed = Math.hypot(ball.vx, ball.vz);
   if (!hitCircle(ball, { x: r.x, z: r.z, r: t.r, layer: 0 }, 0, 0.85)) return;
   ev.bossBump = true;
   // he is a springy ball: never a dead stop
   const s = Math.hypot(ball.vx, ball.vz);
   if (s < 8 && s > 1e-6) {
      ball.vx *= 8 / s;
      ball.vz *= 8 / s;
   }
   if (b.step !== "vulnerable") return;
   if (b.phase === 0 && speed >= 9) bossHitNow(run, ev);
   else if (b.phase === 1 && run.goldenUntil >= run.simMs) bossHitNow(run, ev);
}

function bossHitNow(run: PinRun, ev: StepEvents): void {
   const b = run.boss;
   if (!b) return;
   const res = hitBoss(b, ROLLO, 1, run.bossEv);
   if (res === "ignored") return;
   ev.bossHit = true;
   addPoints(run, POINTS.boss, ev);
   link(run, COMBO_BASE_MS.boss, ev);
   if (res === "phase") ev.bossPhase = true;
   if (res === "defeated") {
      ev.bossDefeated = true;
      run.rollo.jam = NONE;
      win(run, ev);
   }
}

// ---------------- the step ----------------

function flippers(run: PinRun, dt: number, input: StepInput, ev: StepEvents): void {
   for (let i = 0; i < 2; i++) {
      const held = flipperHeld(run, input, i as 0 | 1);
      const target = held ? FLIP_UP : FLIP_REST;
      const a = run.flip[i];
      let na = a;
      if (a > target) na = Math.max(target, a - FLIP_W_UP * dt);
      else if (a < target) na = Math.min(target, a + FLIP_W_DOWN * dt);
      if (held && a === FLIP_REST && na < a) ev.flipped |= 1 << i;
      run.flipW[i] = (na - a) / dt;
      run.flip[i] = na;
   }
}

function substep(run: PinRun, dtMs: number, input: StepInput, ev: StepEvents): void {
   const b = run.ball;
   run.simMs += dtMs;
   const dt = dtMs / 1000;
   flippers(run, dt, input, ev);
   const x0 = b.x;
   const z0 = b.z;
   let teleport = false;
   if (b.mode === "lost") {
      b.timer += dtMs;
      if (b.timer >= LOST_MS) {
         if (run.ballsLeft <= 0) {
            run.ended = "lose";
            ev.gameOver = true;
         } else {
            newBall(run);
            respawn(run, ev);
            teleport = true;
         }
      }
   } else if (b.mode === "plunger") {
      if (input.jumpHeld) b.charge = Math.min(1, b.charge + dtMs / PLUNGE_FULL_MS);
      else if (b.charge > 0) {
         const c = b.charge;
         b.mode = "roll";
         b.vx = 0;
         b.vz = -(PLUNGE_MIN + (PLUNGE_MAX - PLUNGE_MIN) * c);
         b.charge = 0;
         ev.plunged = true;
         if (!run.saveUsed && run.saveUntil < run.simMs) run.saveUntil = run.simMs + BALL_SAVE_MS;
         if (c >= SKILL_LO && c <= SKILL_HI) {
            ev.skill = true;
            secret(run, 0, ev);
         }
      }
   } else if (b.mode === "flight") {
      b.fT += dt;
      const u = Math.min(1, b.fT / b.fDur);
      b.x = b.fx0 + (b.fx1 - b.fx0) * u;
      b.z = b.fz0 + (b.fz1 - b.fz0) * u;
      b.h = b.fh0 + (b.fh1 - b.fh0) * u + 2.4 * 4 * u * (1 - u);
      if (u >= 1) {
         if (b.fThen >= 0) enterRamp(b, b.fThen, V_FLIGHT);
         else {
            b.mode = "roll";
            b.layer = 1;
            b.h = DECK.h;
            b.vh = 0;
            b.hops = 0;
            b.vx = 0;
            b.vz = 0.5;
         }
      }
   } else if (b.mode === "ramp") {
      const r = run.table.ramps[b.ramp];
      b.rampS += b.rampV * dt;
      const p = rampPoint(r, b.rampS / r.length, P3);
      b.x = p.x;
      b.z = p.z;
      b.h = p.h;
      if (b.rampS >= r.length) {
         const n = r.path.length;
         const a = r.path[n - 2];
         const c = r.path[n - 1];
         const d = Math.hypot(c.x - a.x, c.z - a.z) || 1;
         b.mode = "roll";
         b.h = 0;
         b.vx = ((c.x - a.x) / d) * b.rampV * 0.75;
         b.vz = ((c.z - a.z) / d) * b.rampV * 0.75;
         rampComplete(run, b.ramp, ev);
      }
   } else if (b.mode === "held") {
      const m = run.table.magnets[b.pad];
      const dx = m.x - b.x;
      const dz = m.z - b.z;
      const d = Math.hypot(dx, dz);
      const st = Math.min(d, V_MAX * 0.5 * dt);
      if (d > 1e-9) {
         b.x += (dx / d) * st;
         b.z += (dz / d) * st;
      }
      b.heldMs += dtMs;
      // the coins under the glass fly to him
      const orbs = run.table.orbs;
      for (let i = 0; i < orbs.length; i++) {
         if (run.collected[i] || orbs[i].kind !== "coin") continue;
         if (Math.hypot(orbs[i].x - m.x, orbs[i].z - m.z) <= MAGNET_PULL) collectOrb(run, i, ev);
      }
      if (!input.actionHeld || b.heldMs >= MAGNET_HOLD_MS) {
         const w = inputToWorld(input.moveX, input.moveZ, input.yaw);
         let ax = w.x;
         let az = w.z;
         const k = Math.hypot(ax, az);
         if (k < 0.3) {
            ax = 0;
            az = -1;
         } else {
            ax /= k;
            az /= k;
         }
         b.vx = ax * V_MAGNET;
         b.vz = az * V_MAGNET;
         b.mode = "roll";
         run.padCool[b.pad] = run.simMs + 2500;
         b.pad = NONE;
         ev.released = true;
      }
   } else rollStep(run, dt, input, ev);
   if (b.mode === "roll" || b.mode === "plunger") capSpeed(b);
   // the hard cap on the ball's travel per substep (all motion but the respawn)
   if (!teleport && !ev.respawned) {
      const dx = b.x - x0;
      const dz = b.z - z0;
      const d = Math.hypot(dx, dz);
      const lim = V_MAX * dt;
      if (d > lim) {
         b.x = x0 + (dx * lim) / d;
         b.z = z0 + (dz * lim) / d;
      }
   }
   for (const m of run.marbles) if (m.alive) marbleStep(run, m, dt, ev);
}

const P3 = { x: 0, z: 0, h: 0 };

export function step(run: PinRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null || !(dtMs > 0)) return ev;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   if (whole <= 0) return ev;
   bossFrame(run, whole, ev);
   if (input.actionPressed) {
      if (run.heroId === "nami") hop(run, ev);
      else firePower(run, input, ev);
   }
   let left = whole;
   while (left > 0 && run.ended === null) {
      const d = Math.min(SUB_MS, left);
      substep(run, d, input, ev);
      left -= d;
      if (run.ball.mode === "roll" || run.ball.mode === "ramp") pickup(run, ev);
   }
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
   return ev;
}

// ---------------- the proof ----------------

let bossFloor = 0;

/** The least rules ms to land every Rollo hit, striking at the first moment of each window. */
export function bossMinMs(): number {
   if (bossFloor > 0) return bossFloor;
   const s = createBoss(ROLLO);
   const ev = createBossEvents();
   let ms = 0;
   while (s.hp > 0 && ms < 300_000) {
      stepBoss(s, ROLLO, 10, ev);
      ms += 10;
      if (s.step === "vulnerable") hitBoss(s, ROLLO, 1, ev);
   }
   bossFloor = ms;
   return ms;
}

interface Node {
   x: number;
   z: number;
   r: number;
   cost: number;
}

/** The least distance (m) from a contact on node s to a contact on c (radius rc): direct, or by a respawn on the plunger. */
function hop2(s: Node, cx: number, cz: number, rc: number): number {
   const direct = Math.hypot(s.x - cx, s.z - cz) - s.r;
   const viaPlunger = Math.hypot(PLUNGER.x - cx, PLUNGER.z - cz);
   return Math.max(0, Math.min(direct, viaPlunger) - rc);
}

function permutations<T>(xs: T[]): T[][] {
   if (xs.length <= 1) return [xs];
   const out: T[][] = [];
   xs.forEach((x, i) => {
      for (const p of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p]);
   });
   return out;
}

/**
 * The least distance the ball must travel to clear the table's objectives and sink the exit, in order:
 * every objective counts only while it is the current one, the ball touches each piece it needs, a
 * ramp or an orbit carries it its whole length, and a respawn puts it back on the plunger.
 */
export function chainFloorM(t: Table): number {
   let states: Node[] = [{ x: PLUNGER.x, z: PLUNGER.z, r: 0, cost: 0 }];
   const best = (cx: number, cz: number, rc: number) => states.reduce((m, s) => Math.min(m, s.cost + hop2(s, cx, cz, rc)), Infinity);
   for (const o of t.objectives) {
      if (o.kind === "boss") return 0;
      if (o.kind === "bumpers") {
         states = t.bumpers.map((c) => ({ x: c.x, z: c.z, r: c.r + BALL_R, cost: best(c.x, c.z, c.r + BALL_R) }));
      } else if (o.kind === "ramp") {
         const next: Node[] = [];
         for (const r of t.ramps) {
            if (r.kind !== "ramp") continue;
            const end = r.path[r.path.length - 1];
            let cost = best(r.ex, r.ez, RAMP_CATCH) + r.length;
            for (let k = 1; k < o.n; k++) cost += hop2({ x: end.x, z: end.z, r: 0, cost: 0 }, r.ex, r.ez, RAMP_CATCH) + r.length;
            next.push({ x: end.x, z: end.z, r: 0, cost });
         }
         states = next;
      } else if (o.kind === "orbits") {
         const orbit = t.ramps[t.orbit];
         const end = orbit.path[orbit.path.length - 1];
         const once = (from: Node[]) =>
            Math.min(...t.mushrooms.map((m) => {
               const rc = MUSHROOM_R + BALL_R;
               const reach = from.reduce((a, s) => Math.min(a, s.cost + hop2(s, m.x, m.z, rc)), Infinity);
               return reach + Math.max(0, Math.hypot(m.x - orbit.ex, m.z - orbit.ez) - rc) + orbit.length;
            }));
         let cost = once(states);
         for (let k = 1; k < o.n; k++) cost = once([{ x: end.x, z: end.z, r: 0, cost }]);
         states = [{ x: end.x, z: end.z, r: 0, cost }];
      } else {
         const set = o.kind === "lanterns" ? t.lanterns : t.targets.filter((x) => x.bank === o.bank);
         const next: Node[] = [];
         for (const perm of permutations(set)) {
            let cur = states;
            for (const c of perm) {
               const rc = c.r + BALL_R;
               const cost = cur.reduce((m, s) => Math.min(m, s.cost + hop2(s, c.x, c.z, rc)), Infinity);
               cur = [{ x: c.x, z: c.z, r: rc, cost }];
            }
            next.push(cur[0]);
         }
         states = next;
      }
   }
   return best(t.hole.x, t.hole.z, HOLE_SINK);
}

/** No ball travels faster than V_MAX (bar the respawn on the plunger): the least time to the win. */
export function travelFloorMs(t: Table): number {
   return (chainFloorM(t) / V_MAX) * 1000;
}

export function minFinishMs(t: Table): number {
   const travel = travelFloorMs(t);
   return t.boss ? Math.max(travel, bossMinMs()) : travel;
}

export function comboSpecOf(t: Table): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: t.orbs.length, base: COMBO_BASE_MS.orb },
         { count: BUMPER_LINKS, base: COMBO_BASE_MS.bumper },
         { count: RAMP_LINKS, base: COMBO_BASE_MS.ramp },
         { count: t.lanterns.length, base: COMBO_BASE_MS.lantern },
         { count: t.targets.length, base: COMBO_BASE_MS.target },
         { count: t.boss ? ROLLO.maxHp : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

export function minDurationMsOf(t: Table): number {
   return minFinishMs(t) - t.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(t));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(t: Table): LevelLimits {
   const lb = minDurationMsOf(t);
   if (!(lb > 200)) throw new Error(`plate-bounce-arena L${t.level} floor ${lb} is not positive`);
   const minDurationMs = Math.floor((lb * 0.95) / 100) * 100;
   const timeBaseMs = LEVELS[t.level].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   finishMs: "finishMs",
   balls: "balls",
   lost: "lost",
   points: "points",
   stage: "stage",
   count: "count",
   charge: "charge",
   hero: "hero",
   power: "power",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   golden: "golden",
   jam: "jam",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export function badgeHits(run: PinRun): number {
   return run.hits;
}

export { ATTIC };
