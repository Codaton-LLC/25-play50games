// Robot Factory Run rules (the card's CONVEYOR ROUTING). A live factory floor on a 2 m tile grid
// (factory.ts): belts carry power cells (and you) at 2.5 m/s; turntable junctions turn a quarter
// turn (0.35 s) whenever someone steps onto the red switch plate wired to them; the dispenser lets
// out a cell every 3.2 s (two at most on the line); a cell that runs off a belt end or under a
// slamming press is scrap; charge the charger with 2 (L1) or 3 cells and the exit opens. You are one
// moving piece on the board: you route with your body. Twists: L2 klaxon belts run backwards on a
// 6 s cycle, L3 robot arms lift what waits on their pad two belts over (you too), L4 plates also
// swap laser gates, L5 Overseer M-8 (menu2/boss).
//
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now; the same at 30, 60 or
// 144 fps (whole-ms clock, fraction carried, stepped 1 ms at a time). The score proof is bound.ts.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, FLICK_REACH, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { COMBO, COMBO_BASE_MS, OVERSEER, SECRETS } from "./progression";
import { LEVELS } from "./levels";
import { DC, DR, H, K, TILE, W, at, carries, colOf, floorFor, inside, rowOf, tileX, tileZ, type Dir, type Floor } from "./factory";

export { floorFor };
export type { Floor };

// ---------- tuning (1 unit = 1 m) ----------

export const NONE = -1;
export const MAX_STEP_MS = 50;
/** belts: cells (and a hero on them) ride at this */
export const BELT_V = 2.5;
/** a turntable's quarter turn; nothing leaves it meanwhile */
export const TURN_MS = 350;
/** the hero: walk speed, radius, jump, gravity, the roll-drop */
export const V_WALK = 5.2;
export const HERO_R = 0.35;
export const V_JUMP = 9;
export const G = 30;
export const V_DROP = 18;
/** a hit (press, tread bot, M-8): stunned this long, pushed back */
export const STUN_MS = 600;
/** the klaxon: klaxon belts run backwards every other 6 s */
export const KLAXON_MS = 6000;
/** a press: 1.6 s cycle; the shadow warns 0.5 s, the slam lasts 0.3 s */
export const PRESS_MS = 1600;
export const PRESS_WARN_MS = 500;
export const PRESS_SLAM_MS = 300;
/** a plate resets this long after a press */
export const PLATE_RESET_MS = 450;
/** a turntable jammed by M-8's punch (Riko's dash knocks it free at once) */
export const JAM_MS = 1500;
/** orbs: reach, the time each takes off */
export const ORB = { pickup: 0.8, bonusMs: 200 } as const;
export const SECRET_R = 1.0;
/** M-8's lane (P2): it walks east at this, a reversed lane drags it west at this */
export const BOSS_WALK = 1.0;
export const BOSS_DRAG = 2.2;
/** P3: a roll-drop this close to a vent hits */
export const VENT_R = 1.2;

// ---------- small helpers ----------

export function klaxonOn(floor: Floor, ms: number): boolean {
   return floor.spec.klaxon.length > 0 && Math.floor(ms / KLAXON_MS) % 2 === 1;
}

export type PressState = "up" | "warn" | "slam";

/** A press at rules ms (its phase offset from factory.ts). */
export function pressState(phaseMs: number, ms: number): PressState {
   const t = (((ms + phaseMs) % PRESS_MS) + PRESS_MS) % PRESS_MS;
   if (t >= PRESS_MS - PRESS_SLAM_MS) return "slam";
   if (t >= PRESS_MS - PRESS_SLAM_MS - PRESS_WARN_MS) return "warn";
   return "up";
}

/** A tread bot's place at rules ms: back and forth between its two tile centres. */
export function botPos(b: { a: [number, number]; b: [number, number]; periodMs: number }, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   const u = (ms % b.periodMs) / b.periodMs;
   const k = u < 0.5 ? 2 * u : 2 - 2 * u;
   const s = k * k * (3 - 2 * k);
   out.x = tileX(b.a[0]) + (tileX(b.b[0]) - tileX(b.a[0])) * s;
   out.z = tileZ(b.a[1]) + (tileZ(b.b[1]) - tileZ(b.a[1])) * s;
   return out;
}

// ---------- the run ----------

export interface Cell {
   live: boolean;
   /** the tile it left (or sits on) and where it heads */
   c: number;
   r: number;
   dir: Dir;
   /** metres travelled from the tile centre towards the next (0..2) */
   prog: number;
   /** waiting on a turntable's turn or an arm pad */
   holding: boolean;
   /** a one-belt hop already made by this magnet use (Zuno) */
   hopAt: number;
   x: number;
   z: number;
   /** where it went: for the Scene's juice */
   fate: "" | "charged" | "scrap" | "secret";
}

export interface Hero {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   airJumpUsed: boolean;
   dropping: boolean;
   facing: number;
   stunUntil: number;
   dashUntil: number;
   dashX: number;
   dashZ: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** the tile index the hero stands on (plates fire on entering) */
   tile: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   /** the orbit camera's drawn yaw (rad); 0 = world space */
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false };
}

export interface StepEvents {
   /** a turntable that started turning this step, NONE otherwise */
   turned: number;
   plate: number;
   emitted: boolean;
   charged: boolean;
   scrap: boolean;
   secretCharged: boolean;
   armLift: number;
   heroLifted: boolean;
   jumped: boolean;
   airJumped: boolean;
   dropped: boolean;
   landed: boolean;
   hurt: boolean;
   powered: boolean;
   dashed: boolean;
   flicked: boolean;
   crateBroken: boolean;
   unjammed: boolean;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   comboBonus: number;
   comboLinked: boolean;
   exitOpen: boolean;
   finished: boolean;
   timeup: boolean;
   klaxon: boolean;
   bossTelegraph: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   punched: number;
   slam: boolean;
}

function createEvents(): StepEvents {
   return {
      turned: NONE,
      plate: NONE,
      emitted: false,
      charged: false,
      scrap: false,
      secretCharged: false,
      armLift: NONE,
      heroLifted: false,
      jumped: false,
      airJumped: false,
      dropped: false,
      landed: false,
      hurt: false,
      powered: false,
      dashed: false,
      flicked: false,
      crateBroken: false,
      unjammed: false,
      orbCount: 0,
      orbList: new Array<number>(16).fill(0),
      secretCount: 0,
      secretList: [0, 0, 0],
      comboBonus: 0,
      comboLinked: false,
      exitOpen: false,
      finished: false,
      timeup: false,
      klaxon: false,
      bossTelegraph: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
      punched: NONE,
      slam: false,
   };
}

function resetEvents(e: StepEvents): void {
   e.turned = NONE;
   e.plate = NONE;
   e.emitted = false;
   e.charged = false;
   e.scrap = false;
   e.secretCharged = false;
   e.armLift = NONE;
   e.heroLifted = false;
   e.jumped = false;
   e.airJumped = false;
   e.dropped = false;
   e.landed = false;
   e.hurt = false;
   e.powered = false;
   e.dashed = false;
   e.flicked = false;
   e.crateBroken = false;
   e.unjammed = false;
   e.orbCount = 0;
   e.secretCount = 0;
   e.comboBonus = 0;
   e.comboLinked = false;
   e.exitOpen = false;
   e.finished = false;
   e.timeup = false;
   e.klaxon = false;
   e.bossTelegraph = false;
   e.bossHit = false;
   e.bossPhase = false;
   e.bossDefeated = false;
   e.punched = NONE;
   e.slam = false;
}

/** The factory's moving state: shared by every player in local multiplayer (one line). */
export interface Board {
   turns: Dir[];
   /** the ms a turntable's current turn ends (it holds cells until then) */
   turnUntil: Float64Array;
   jamUntil: Float64Array;
   lasers: Uint8Array;
   plateReadyAt: Float64Array;
   cells: Cell[];
   nextEmit: number;
   emitted: number;
   charged: number;
   scrapped: number;
   broken: Uint8Array;
   /** the arms' last cycle index (an arm acts once per cycle) */
   armCycle: Int32Array;
   /** L5 P2: M-8's place on its lane (m from the press), the lane's direction */
   laneS: number;
   laneReversed: boolean;
   /** the ms the board last stepped (multiplayer steps it once) */
   ms: number;
}

export interface FactoryRun {
   floor: Floor;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   board: Board;
   /** false for the extra players of a shared board (multiplayer): only the driver moves the line */
   driver: boolean;
   pressMs: number;
   actionMs: number;
   jumpHeld: boolean;
   powerReadyAt: number;
   collected: Uint8Array;
   orbs: number;
   mainOrbs: number;
   combo: ComboState;
   secrets: SecretTracker;
   hits: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
}

export function createBoard(floor: Floor): Board {
   const n = floor.turnAt.length;
   const cells: Cell[] = [];
   for (let i = 0; i < floor.spec.maxLive; i++) cells.push({ live: false, c: 0, r: 0, dir: 0, prog: 0, holding: false, hopAt: -1, x: 0, z: 0, fate: "" });
   return {
      turns: floor.spec.turns.slice() as Dir[],
      turnUntil: new Float64Array(n),
      jamUntil: new Float64Array(n),
      lasers: Uint8Array.from(floor.spec.lasersOn.map((v) => (v ? 1 : 0))),
      plateReadyAt: new Float64Array(floor.plateAt.length),
      cells,
      nextEmit: floor.spec.firstMs,
      emitted: 0,
      charged: 0,
      scrapped: 0,
      broken: new Uint8Array(W * H),
      armCycle: new Int32Array(floor.spec.arms.length).fill(-1),
      laneS: floor.spec.boss ? (floor.spec.boss.lane.length - 1) * TILE : 0,
      laneReversed: false,
      ms: 0,
   };
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO, board?: Board): FactoryRun {
   const floor = floorFor(level);
   const [sc, sr] = floor.spec.start;
   return {
      floor,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: {
         x: tileX(sc),
         y: 0,
         z: tileZ(sr),
         vx: 0,
         vy: 0,
         vz: 0,
         grounded: true,
         airJumpUsed: false,
         dropping: false,
         facing: 0,
         stunUntil: NONE,
         dashUntil: NONE,
         dashX: 0,
         dashZ: -1,
         shieldUntil: NONE,
         magnetUntil: NONE,
         phaseUntil: NONE,
         tile: at(sc, sr),
      },
      board: board ?? createBoard(floor),
      driver: !board,
      pressMs: NONE,
      actionMs: NONE,
      jumpHeld: false,
      powerReadyAt: 0,
      collected: new Uint8Array(floor.spec.orbs.length),
      orbs: 0,
      mainOrbs: 0,
      combo: createCombo(),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      finishMs: 0,
      ended: null,
      events: createEvents(),
      boss: floor.spec.boss ? createBoss(OVERSEER) : null,
      bossEv: createBossEvents(),
   };
}

/** How many orbs count for the all-orbs star (the hero-gated ones are extra). */
export function mainOrbTotal(floor: Floor): number {
   return floor.spec.orbs.filter((o) => o.hero === null).length;
}

export function advanceClock(run: FactoryRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
const WORLD = { x: 0, z: 0 };
const P = { x: 0, z: 0 };

export function step(run: FactoryRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (whole <= 0) return ev;
   if (input.jumpPressed) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   run.jumpHeld = !!input.jumpHeld || !!input.jumpPressed;
   let sx = finite(input.moveX);
   let sz = finite(input.moveZ);
   const sl = Math.hypot(sx, sz);
   if (sl > 1) {
      sx /= sl;
      sz /= sl;
   }
   inputToWorld(sx, sz, finite(input.yaw), WORLD);
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= LEVELS[run.level].durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run, WORLD.x, WORLD.z);
      if (run.ended !== null) return ev;
   }
   return ev;
}


function link(run: FactoryRun, base: number): void {
   run.events.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
   run.events.comboLinked = true;
}

function tick(run: FactoryRun, wx: number, wz: number): void {
   const ms = run.simMs;
   comboTick(run.combo, COMBO, ms);
   if (run.boss) {
      // one M-8 for everyone: only the driver runs its machine; anyone can be shoved
      if (run.driver) bossMs(run);
      bossShove(run);
   }
   if (run.ended !== null) return;
   if (run.driver && run.board.ms < ms) {
      run.board.ms = ms;
      boardMs(run);
   }
   heroMs(run, wx, wz);
   const b = run.board;
   const opened = b.charged >= run.floor.spec.cells;
   if (!run.boss && opened) {
      const [ec, er] = run.floor.exit;
      const h = run.hero;
      if (Math.abs(h.x - tileX(ec)) < 1 && Math.abs(h.z - tileZ(er)) < 1 && h.y < 0.6) win(run);
   }
}

// ---------- the line: cells, turntables, presses, arms ----------

function tileDir(run: FactoryRun, i: number): Dir {
   const t = run.floor.tiles[i];
   if (t.k === K.Turn) return run.board.turns[t.idx];
   let d = t.dir;
   if (run.floor.klaxonMask[i] && klaxonOn(run.floor, run.board.ms)) d = ((d + 2) % 4) as Dir;
   return d;
}

function emitCell(run: FactoryRun): void {
   const b = run.board;
   const [dc, dr] = run.floor.dispenser;
   for (const c of b.cells) {
      if (c.live) continue;
      c.live = true;
      c.c = dc;
      c.r = dr;
      c.dir = run.floor.spec.dispenserDir;
      c.prog = 0;
      c.holding = false;
      c.hopAt = -1;
      c.x = tileX(dc);
      c.z = tileZ(dr);
      c.fate = "";
      b.emitted += 1;
      run.events.emitted = true;
      return;
   }
}

function liveCells(b: Board): number {
   let n = 0;
   for (const c of b.cells) if (c.live) n++;
   return n;
}

function scrap(run: FactoryRun, c: Cell): void {
   c.live = false;
   c.fate = "scrap";
   run.board.scrapped += 1;
   run.events.scrap = true;
}

function boardMs(run: FactoryRun): void {
   const b = run.board;
   const f = run.floor;
   const spec = f.spec;
   const ms = b.ms;
   // the dispenser: one cell every cadence, while fewer than maxLive ride and the charger wants more
   if (ms >= b.nextEmit) {
      if (liveCells(b) < spec.maxLive && b.charged < spec.cells) emitCell(run);
      b.nextEmit += spec.cadenceMs;
   }
   if (spec.klaxon.length > 0 && ms % KLAXON_MS === 0) run.events.klaxon = true;
   // the arms: once a cycle, lift what waits on the pad to the drop tile
   for (let k = 0; k < spec.arms.length; k++) {
      const a = spec.arms[k];
      const cyc = Math.floor((ms + a.phaseMs) / a.periodMs);
      if (cyc === b.armCycle[k]) continue;
      b.armCycle[k] = cyc;
      if (b.armCycle[k] === 0 && ms < a.periodMs - a.phaseMs) continue;
      let lifted = false;
      for (const c of b.cells) {
         if (!c.live || !c.holding || c.c !== a.pad[0] || c.r !== a.pad[1]) continue;
         c.c = a.drop[0];
         c.r = a.drop[1];
         c.prog = 0;
         c.holding = false;
         c.dir = tileDir(run, at(c.c, c.r));
         c.x = tileX(c.c);
         c.z = tileZ(c.r);
         lifted = true;
      }
      const h = run.hero;
      if (h.grounded && h.y < 0.3 && colOf(h.x) === a.pad[0] && rowOf(h.z) === a.pad[1]) {
         h.x = tileX(a.drop[0]);
         h.z = tileZ(a.drop[1]);
         h.y = f.tiles[at(a.drop[0], a.drop[1])].top;
         h.vx = h.vz = h.vy = 0;
         h.grounded = true;
         h.tile = at(a.drop[0], a.drop[1]);
         run.events.heroLifted = true;
         lifted = true;
      }
      if (lifted) run.events.armLift = k;
   }
   for (const c of b.cells) if (c.live) cellMs(run, c);
}

function cellMs(run: FactoryRun, c: Cell): void {
   const b = run.board;
   const f = run.floor;
   const ms = b.ms;
   const here = at(c.c, c.r);
   const t = f.tiles[here];
   if (c.prog === 0) {
      // at a tile centre: hold on a turning table or an arm pad, else take the tile's direction
      if (t.k === K.Pad) {
         c.holding = true;
         return;
      }
      if (t.k === K.Turn) {
         if (ms < b.turnUntil[t.idx]) {
            c.holding = true;
            return;
         }
         c.dir = b.turns[t.idx];
      } else if (t.k === K.Belt || t.k === K.Disp) c.dir = tileDir(run, here);
      c.holding = false;
   } else if (t.k === K.Belt && f.klaxonMask[here]) {
      // a klaxon flip mid-belt turns the cell round
      const d = tileDir(run, here);
      if (d === (c.dir + 2) % 4) {
         const nc = c.c + DC[c.dir];
         const nr = c.r + DR[c.dir];
         if (inside(nc, nr)) {
            c.c = nc;
            c.r = nr;
            c.prog = TILE - c.prog;
         }
         c.dir = d;
      }
   }
   c.prog += BELT_V / 1000;
   if (c.prog >= TILE) {
      const nc = c.c + DC[c.dir];
      const nr = c.r + DR[c.dir];
      c.prog = 0;
      if (!inside(nc, nr)) return scrap(run, c);
      c.c = nc;
      c.r = nr;
      const n = f.tiles[at(nc, nr)];
      if (n.k === K.Charger) return deliver(run, c);
      if (n.k === K.Secret) return secretCharge(run, c);
      if (!carries(n.k) && n.k !== K.Pad) return scrap(run, c);
   }
   c.x = tileX(c.c) + DC[c.dir] * c.prog;
   c.z = tileZ(c.r) + DR[c.dir] * c.prog;
   // a press slamming on it
   const pi = f.pressMask[at(colOf(c.x), rowOf(c.z))];
   if (pi >= 0) {
      const [pc, pr, ph] = f.spec.presses[pi];
      if (Math.abs(c.x - tileX(pc)) < 0.6 && Math.abs(c.z - tileZ(pr)) < 0.6 && pressState(ph, ms) === "slam") scrap(run, c);
   }
}

function deliver(run: FactoryRun, c: Cell): void {
   const b = run.board;
   c.live = false;
   c.fate = "charged";
   if (run.boss) {
      // M-8's chest socket: a hit while it glows (P1), otherwise it shrugs the cell off
      if (run.boss.phase === 0) bossHitNow(run);
      return;
   }
   if (b.charged >= run.floor.spec.cells) return;
   b.charged += 1;
   run.events.charged = true;
   link(run, COMBO_BASE_MS.cell);
   if (b.charged >= run.floor.spec.cells) run.events.exitOpen = true;
}

function secretCharge(run: FactoryRun, c: Cell): void {
   c.live = false;
   c.fate = "secret";
   run.events.secretCharged = true;
   if (collectSecret(run.secrets, 0) && run.events.secretCount < run.events.secretList.length) run.events.secretList[run.events.secretCount++] = 0;
}

/** A plate stepped on: its turntables turn a quarter (jammed ones do not), its lasers swap, M-8's lane reverses. */
export function pressPlate(run: FactoryRun, p: number): void {
   const b = run.board;
   const spec = run.floor.spec.plates[p];
   const ms = run.simMs;
   // a plate clunks once, then needs a moment to reset (a foot jittering on its edge is one press)
   if (ms < b.plateReadyAt[p]) return;
   b.plateReadyAt[p] = ms + PLATE_RESET_MS;
   run.events.plate = p;
   for (const i of spec.turns) {
      if (ms < b.jamUntil[i] || ms < b.turnUntil[i]) continue;
      b.turns[i] = ((b.turns[i] + 1) % 4) as Dir;
      b.turnUntil[i] = ms + TURN_MS;
      run.events.turned = i;
   }
   if (spec.lasers) for (const l of spec.lasers) b.lasers[l] = b.lasers[l] ? 0 : 1;
   if (spec.bossLane) b.laneReversed = !b.laneReversed;
}

// ---------- the hero ----------

function solidFor(run: FactoryRun, i: number, feet: number): boolean {
   const t = run.floor.tiles[i];
   const h = run.hero;
   const ms = run.simMs;
   switch (t.k) {
      case K.Cracked:
         return !run.board.broken[i];
      case K.Ghost:
         return ms > h.phaseUntil;
      case K.Laser:
         return run.board.lasers[t.idx] === 1 && ms > h.shieldUntil;
      case K.Box:
      case K.Catwalk:
         return feet < t.top - 0.25;
      default:
         // machinery, chargers and M-8 stand taller than any jump
         return t.solid;
   }
}

/** The floor top under (x, z) the hero can stand on at height `feet`. */
export function groundAt(run: FactoryRun, x: number, z: number, feet: number): number {
   const c = colOf(x);
   const r = rowOf(z);
   if (!inside(c, r)) return 0;
   const t = run.floor.tiles[at(c, r)];
   if ((t.k === K.Box || t.k === K.Catwalk) && feet >= t.top - 0.25) return t.top;
   return 0;
}

function collide(run: FactoryRun): void {
   const h = run.hero;
   const c0 = colOf(h.x);
   const r0 = rowOf(h.z);
   for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
         const c = c0 + dc;
         const r = r0 + dr;
         if (!inside(c, r)) continue;
         const i = at(c, r);
         if (!solidFor(run, i, h.y)) continue;
         const cx = tileX(c);
         const cz = tileZ(r);
         const half = TILE / 2;
         const px = Math.max(cx - half, Math.min(h.x, cx + half));
         const pz = Math.max(cz - half, Math.min(h.z, cz + half));
         const dx = h.x - px;
         const dz = h.z - pz;
         const d2 = dx * dx + dz * dz;
         if (d2 >= HERO_R * HERO_R) continue;
         if (d2 > 1e-9) {
            const d = Math.sqrt(d2);
            h.x = px + (dx / d) * HERO_R;
            h.z = pz + (dz / d) * HERO_R;
         } else {
            // centre inside the box: out along the shortest axis
            const ox = half + HERO_R - Math.abs(h.x - cx);
            const oz = half + HERO_R - Math.abs(h.z - cz);
            if (ox < oz) h.x += Math.sign(h.x - cx || 1) * ox;
            else h.z += Math.sign(h.z - cz || 1) * oz;
         }
      }
   }
   const lim = (W / 2) * TILE - HERO_R;
   h.x = Math.max(-lim, Math.min(lim, h.x));
   h.z = Math.max(tileZ(0) - 1 + HERO_R, Math.min(tileZ(H - 1) + 1 - HERO_R, h.z));
}

function pressed(run: FactoryRun): boolean {
   return run.pressMs !== NONE && run.simMs - run.pressMs <= 130 && run.pressMs <= run.simMs;
}

function tryPower(run: FactoryRun, wx: number, wz: number): void {
   const ms = run.simMs;
   const h = run.hero;
   const def = heroById(run.heroId);
   const ev = run.events;
   if (def.power === "doubleJump") {
      if (h.grounded || h.airJumpUsed) return;
      h.vy = V_JUMP;
      h.airJumpUsed = true;
      h.dropping = false;
      ev.airJumped = true;
      ev.powered = true;
      return;
   }
   if (ms < run.powerReadyAt) return;
   if (def.power === "dash") {
      let dx = wx;
      let dz = wz;
      let len = Math.hypot(dx, dz);
      if (len < 0.2) {
         dx = -Math.sin(h.facing);
         dz = -Math.cos(h.facing);
         len = 1;
      }
      h.dashX = dx / len;
      h.dashZ = dz / len;
      h.dashUntil = ms + POWER_MS.dash;
      ev.dashed = true;
      // flick a cell beside him one belt over, in the dash's main axis
      const ax = Math.abs(h.dashX) >= Math.abs(h.dashZ);
      const sdc = ax ? Math.sign(h.dashX) : 0;
      const sdr = ax ? 0 : Math.sign(h.dashZ);
      for (const c of run.board.cells) {
         if (!c.live || Math.hypot(c.x - h.x, c.z - h.z) > FLICK_REACH) continue;
         if (hopCell(run, c, sdc, sdr)) ev.flicked = true;
      }
      // knock jammed turntables near him free
      for (let i = 0; i < run.floor.turnAt.length; i++) {
         const [tc, tr] = run.floor.turnAt[i];
         if (run.board.jamUntil[i] > ms && Math.hypot(tileX(tc) - h.x, tileZ(tr) - h.z) < 3) {
            run.board.jamUntil[i] = ms;
            ev.unjammed = true;
         }
      }
   } else if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   ev.powered = true;
}

/** Moves a cell one tile (dc, dr) onto a tile that carries; true if it moved. */
function hopCell(run: FactoryRun, c: Cell, dc: number, dr: number): boolean {
   if (dc === 0 && dr === 0) return false;
   const nc = c.c + dc;
   const nr = c.r + dr;
   if (!inside(nc, nr)) return false;
   const k = run.floor.tiles[at(nc, nr)].k;
   if (!carries(k) && k !== K.Pad) return false;
   c.c = nc;
   c.r = nr;
   c.prog = 0;
   c.holding = false;
   c.x = tileX(nc);
   c.z = tileZ(nr);
   return true;
}

function hurt(run: FactoryRun, fromX: number, fromZ: number): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms < h.stunUntil + 400 || ms <= h.shieldUntil) return;
   h.stunUntil = ms + STUN_MS;
   const dx = h.x - fromX;
   const dz = h.z - fromZ;
   const d = Math.hypot(dx, dz) || 1;
   h.vx = (dx / d) * 4;
   h.vz = (dz / d) * 4;
   run.hits += 1;
   comboBreak(run.combo);
   run.events.hurt = true;
}

function heroMs(run: FactoryRun, wx: number, wz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const f = run.floor;
   const ev = run.events;
   const stunned = ms < h.stunUntil;
   if (run.actionMs !== NONE && run.actionMs <= ms) {
      run.actionMs = NONE;
      if (!stunned) tryPower(run, wx, wz);
   }
   // jump on the ground, roll-drop in the air
   if (pressed(run) && !stunned) {
      if (h.grounded) {
         run.pressMs = NONE;
         h.vy = V_JUMP;
         h.grounded = false;
         h.airJumpUsed = false;
         h.dropping = false;
         ev.jumped = true;
      } else if (!h.dropping && h.vy < V_JUMP - 2) {
         run.pressMs = NONE;
         h.vy = -V_DROP;
         h.dropping = true;
         ev.dropped = true;
      }
   }
   const dashing = ms <= h.dashUntil;
   let vx: number;
   let vz: number;
   if (stunned) {
      vx = h.vx * 0.995;
      vz = h.vz * 0.995;
   } else if (dashing) {
      vx = h.dashX * V_DASH;
      vz = h.dashZ * V_DASH;
   } else {
      vx = wx * V_WALK;
      vz = wz * V_WALK;
   }
   // a belt under your feet carries you
   const ti = at(colOf(h.x), rowOf(h.z));
   const t = inside(colOf(h.x), rowOf(h.z)) ? f.tiles[ti] : null;
   if (t && h.grounded && h.y < 0.3 && (t.k === K.Belt || t.k === K.Disp)) {
      const d = tileDir(run, ti);
      vx += DC[d] * BELT_V;
      vz += DR[d] * BELT_V;
   }
   h.vx = vx;
   h.vz = vz;
   if (Math.abs(wx) + Math.abs(wz) > 0.1 && !stunned) h.facing = Math.atan2(-wx, -wz);
   h.x += vx / 1000;
   h.z += vz / 1000;
   // a dash breaks a cracked crate it meets
   if (dashing) {
      const c = colOf(h.x + h.dashX * (HERO_R + 0.2));
      const r = rowOf(h.z + h.dashZ * (HERO_R + 0.2));
      if (inside(c, r) && f.tiles[at(c, r)].k === K.Cracked && !run.board.broken[at(c, r)]) {
         run.board.broken[at(c, r)] = 1;
         ev.crateBroken = true;
      }
   }
   collide(run);
   // height
   const g = groundAt(run, h.x, h.z, h.y);
   if (!h.grounded) {
      h.vy -= G / 1000;
      h.y += h.vy / 1000;
      if (h.y <= g) {
         h.y = g;
         h.vy = 0;
         h.grounded = true;
         h.airJumpUsed = false;
         ev.landed = true;
         if (h.dropping && run.boss) ventCheck(run);
         h.dropping = false;
      }
   } else if (h.y > g + 0.01) {
      h.grounded = false;
      h.vy = 0;
   } else h.y = g;
   // plates: entering one on the floor fires it
   const now = at(colOf(h.x), rowOf(h.z));
   if (now !== h.tile) {
      h.tile = now;
      const nt = f.tiles[now];
      if (nt && nt.k === K.Plate && h.y < 0.4) pressPlate(run, nt.idx);
   }
   // hazards
   if (!stunned) {
      for (let i = 0; i < f.spec.presses.length; i++) {
         const [pc, pr, ph] = f.spec.presses[i];
         if (h.y < 1.2 && Math.abs(h.x - tileX(pc)) < 0.9 && Math.abs(h.z - tileZ(pr)) < 0.9 && pressState(ph, ms) === "slam") hurt(run, tileX(pc), tileZ(pr) + 1);
      }
      for (const bt of f.spec.bots) {
         botPos(bt, ms, P);
         if (h.y < 1 && Math.hypot(h.x - P.x, h.z - P.z) < 0.9) hurt(run, P.x, P.z);
      }
   }
   pickups(run);
}

function pickups(run: FactoryRun): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const spec = run.floor.spec;
   const magnet = ms <= h.magnetUntil;
   const reach = magnet ? MAGNET_REACH : ORB.pickup;
   for (let i = 0; i < spec.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = spec.orbs[i];
      const dx = o.x - h.x;
      const dy = o.y - (h.y + 0.6);
      const dz = o.z - h.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      run.collected[i] = 1;
      run.orbs += 1;
      if (o.hero === null) run.mainOrbs += 1;
      if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
      link(run, COMBO_BASE_MS.orb);
   }
   // Zuno's magnet: a cell within reach hops one belt towards him (once per magnet use)
   if (magnet) {
      for (const c of run.board.cells) {
         if (!c.live || c.hopAt === h.magnetUntil) continue;
         if (Math.hypot(c.x - h.x, c.z - h.z) > MAGNET_REACH) continue;
         const dx = h.x - c.x;
         const dz = h.z - c.z;
         const ax = Math.abs(dx) >= Math.abs(dz);
         if (hopCell(run, c, ax ? Math.sign(dx) : 0, ax ? 0 : Math.sign(dz))) {
            c.hopAt = h.magnetUntil;
            ev.flicked = true;
         } else c.hopAt = h.magnetUntil;
      }
   }
   // secrets placed in the world (the secret charger is fed by a cell instead)
   const list = spec.secrets;
   for (let i = 0; i < list.length; i++) {
      if (run.secrets.found[i]) continue;
      if (i === 0 && run.floor.secretCharger) continue;
      const [x, y, z] = list[i];
      const dx = x - h.x;
      const dy = y - (h.y + 0.6);
      const dz = z - h.z;
      if (dx * dx + dy * dy + dz * dz <= SECRET_R * SECRET_R && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }
}

function win(run: FactoryRun): void {
   run.finishMs = run.simMs;
   run.ended = "win";
   run.events.finished = true;
}

// ---------- Overseer M-8 (level 5) ----------

function bossMs(run: FactoryRun): void {
   const b = run.boss!;
   const ev = run.events;
   const bev = run.bossEv;
   stepBoss(b, OVERSEER, 1, bev);
   if (bev.telegraph) ev.bossTelegraph = true;
   const board = run.board;
   const spec = run.floor.spec.boss!;
   if (b.phase === 0 && bev.attack) {
      // the punch: the junctions in turn get knocked back a quarter turn (one plate press puts one
      // right) and jammed for a moment
      const i = (b.attack + b.hits) % run.floor.turnAt.length;
      board.turns[i] = ((board.turns[i] + 3) % 4) as Dir;
      board.jamUntil[i] = run.simMs + JAM_MS;
      board.turnUntil[i] = run.simMs + TURN_MS;
      ev.punched = i;
   }
   if (b.phase === 1) {
      // the lane walk: east on its own, dragged west into the press when the lane is reversed
      const len = (spec.lane.length - 1) * TILE;
      board.laneS += (board.laneReversed ? -BOSS_DRAG : BOSS_WALK) / 1000;
      if (board.laneS > len) board.laneS = len;
      if (board.laneS <= 0) {
         board.laneS = 0;
         if (b.step === "vulnerable" && bossHitNow(run)) {
            ev.slam = true;
            board.laneS = len;
            board.laneReversed = false;
         }
      }
   }
}

/** M-8's body on the lane shoves a hero it walks into. */
function bossShove(run: FactoryRun): void {
   const b = run.boss!;
   const spec = run.floor.spec.boss!;
   const board = run.board;
   if (b.phase === 1) {
      const [lc, lr] = spec.lane[0];
      const bx = tileX(lc) + board.laneS;
      const bz = tileZ(lr);
      const h = run.hero;
      if (h.y < 2 && Math.hypot(h.x - bx, h.z - bz) < 1.3 && run.simMs > h.stunUntil) hurt(run, bx, bz);
   }
}

/** M-8's body on the lane (P2) or at its gantry (the Scene and the bot). */
export function bossPos(run: FactoryRun, out: { x: number; z: number }): { x: number; z: number } {
   const spec = run.floor.spec.boss!;
   if (run.boss && run.boss.phase === 1) {
      out.x = tileX(spec.lane[0][0]) + run.board.laneS;
      out.z = tileZ(spec.lane[0][1]);
   } else {
      out.x = tileX(spec.at[0]);
      out.z = tileZ(spec.at[1]);
   }
   return out;
}

function ventCheck(run: FactoryRun): void {
   const b = run.boss;
   if (!b || b.phase !== 2 || b.step !== "vulnerable") return;
   const h = run.hero;
   for (const [vx, vy, vz] of run.floor.spec.boss!.vents) {
      if (Math.hypot(h.x - vx, h.z - vz) <= VENT_R && Math.abs(h.y - vy) < 1.0) {
         bossHitNow(run);
         return;
      }
   }
}

function bossHitNow(run: FactoryRun): boolean {
   const r = hitBoss(run.boss!, OVERSEER, 1, run.bossEv);
   if (r === "ignored") return false;
   run.events.bossHit = true;
   if (r === "phase") run.events.bossPhase = true;
   link(run, COMBO_BASE_MS.boss);
   if (r === "defeated") {
      run.events.bossDefeated = true;
      win(run);
   }
   return true;
}

export function bossVulnerable(run: FactoryRun): boolean {
   return !!run.boss && run.boss.step === "vulnerable";
}

// ---------- scoring ----------

export function comboSpecOf(floor: Floor): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: floor.spec.orbs.length, base: COMBO_BASE_MS.orb },
         { count: floor.spec.boss ? 0 : floor.spec.cells, base: COMBO_BASE_MS.cell },
         { count: floor.spec.boss ? OVERSEER.maxHp : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** Pinned (proof.test.ts recomputes each row from bound.ts proposeLimits). */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 8_280, minDurationMs: 7_200, maxDurationMs: 90_000, timeBaseMs: 90_000 },
   2: { kind: "time", maxScore: 9_650, minDurationMs: 13_500, maxDurationMs: 110_000, timeBaseMs: 110_000 },
   3: { kind: "time", maxScore: 11_170, minDurationMs: 8_300, maxDurationMs: 120_000, timeBaseMs: 120_000 },
   4: { kind: "time", maxScore: 12_910, minDurationMs: 10_900, maxDurationMs: 140_000, timeBaseMs: 140_000 },
   5: { kind: "time", maxScore: 22_490, minDurationMs: 15_100, maxDurationMs: 240_000, timeBaseMs: 240_000 },
};

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   finishMs: "finishMs",
   cells: "cells",
   scrap: "scrap",
   falls: "falls",
   hero: "hero",
   power: "power",
   klaxon: "klaxon",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
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

/** The no-hit badge: no hits and no scrapped cell (the card's "no lost cells"). */
export function badgeHits(run: FactoryRun): number {
   return run.hits + (run.boss ? 0 : run.board.scrapped);
}

/** A copy sharing the floor (the bot's look-ahead): the board is copied too. */
export function copyRun(src: FactoryRun): FactoryRun {
   const b = src.board;
   const board: Board = {
      ...b,
      turns: b.turns.slice() as Dir[],
      turnUntil: b.turnUntil.slice(),
      jamUntil: b.jamUntil.slice(),
      lasers: b.lasers.slice(),
      plateReadyAt: b.plateReadyAt.slice(),
      cells: b.cells.map((c) => ({ ...c })),
      broken: b.broken.slice(),
      armCycle: b.armCycle.slice(),
   };
   return {
      ...src,
      hero: { ...src.hero },
      board,
      collected: src.collected.slice(),
      combo: { ...src.combo },
      secrets: { ...src.secrets, found: src.secrets.found.slice() },
      events: createEvents(),
      boss: src.boss ? { ...src.boss } : null,
      bossEv: createBossEvents(),
   };
}

export const COURSE: Floor = floorFor(1);
export { V_DASH };
