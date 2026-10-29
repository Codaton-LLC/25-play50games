// Spin Pole Climb's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date).
// Scene.tsx calls step() from one useRunFrame; the same level + hero + inputs always give the same run at
// any frame rate (the simulation advances in fixed 1000/120 ms steps).
//
// The signature mechanic (card "Orbit to rise"): the hero is locked onto a spiral stair round a stone
// pole. Running round it (Left / Right, camera-relative) climbs one way and descends the other; one lap
// is 3 m. The pole's core turns and drags whoever stands on its stair: with you it is an escalator,
// against you a treadmill. Jump hops a sweeper bar, a spike collar or a gap; Jump while facing a
// neighbouring pole and pushing towards it hops across to it (the highest of its turns at or under your
// height: a hop never lifts you), and on the wide tower Jump while pushing in hops onto the next stair.
// Height only ever comes from running round a stair (the score proof rests on it: bound.ts).
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "../../types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboFlow, comboHit, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import {
   TAU, courseFor, dirTo, helixEnd, helixTop, isVeil, neighbours, sporeOn, spinOmega, stairY, stretchAt, sweeperAngle, turnUnder, wrapPi,
   type Course, type Helix,
} from "./course";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COILSTONE, COMBO, COMBO_BASE_MS, P3_DROP_LAPS, P3_SPIN, SECRETS, secretIndex, starSpecFor } from "./progression";

// ---------- tuning ----------

export const STEP_MS = 1000 / 120;
/** a frame longer than this is cut (the shell's own play dt cap is 50 ms) */
export const MAX_FRAME_MS = 50;
/** running speed round the stair (m/s) */
export const V_RUN = 4.6;
export const V_JUMP = 7.4;
/** Nami's second jump */
export const V_JUMP2 = 7.2;
export const GRAV = 22;
/** a hop from pole to pole (or stair to stair) takes this long */
export const HOP_MS = 550;
/** the hop needs the hero facing the target within this angle (rad) */
export const HOP_FACING = 0.5;
/** ... and the stick pushed that way at least this much */
export const HOP_PUSH = 0.45;
/** the hero's body: feet to head (m), and the half-width round the stair (m) */
export const BODY_H = 1.3;
export const BODY_W = 0.3;
export const STUN_MS = 600;
export const INVULN_MS = 1200;
/** a hit pushes the hero this far back down the stair (m along it) */
export const KNOCK_M = 1.2;
export const DISC_MS = 10_000;
export const ORB = { reach: 0.6, airReach: 0.8, bonusMs: 100 } as const;
/** Coilstone's sliding coil: its half-length along the stair (rad) and speed down it (rad/s) */
export const COIL_HALF = 0.5;
export const COIL_SPEED = 4.2;
/** the plated segment (phase 1): a landing within this of it (rad) is a stomp */
export const PLATE_HALF = 0.55;
/** the bite (phase 2): this wide round the angle it locked (rad), this high round the height */
export const BITE_HALF = 0.6;
export const BITE_H = 2.4;

// ---------- the run ----------

export interface Hop {
   active: boolean;
   t: number;
   fromX: number;
   fromY: number;
   fromZ: number;
   helix: number;
   a: number;
   cap: boolean;
   capA: number;
   toX: number;
   toY: number;
   toZ: number;
}

export interface Hero {
   /** the stair the hero is on */
   helix: number;
   /** the unwrapped world angle on it */
   a: number;
   /** on the stair's top cap: then capA is the world angle round the cap */
   cap: boolean;
   capA: number;
   /** height over the steps (m) and its speed (jumps, falls) */
   air: number;
   vAir: number;
   grounded: boolean;
   airJumped: boolean;
   /** the way the hero last ran: +1 up the stair, -1 down */
   dir: number;
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   hop: Hop;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   hopped: boolean;
   hopLanded: boolean;
   powered: boolean;
   orbCount: number;
   orbList: number[];
   secretCount: number;
   secretList: number[];
   laps: number;
   comboBonus: number;
   comboLinked: boolean;
   hurt: "" | "sweeper" | "spike" | "spore" | "fall" | "coil" | "bite";
   shielded: boolean;
   urn: number;
   disc: boolean;
   capReached: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossVulnerable: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   finished: boolean;
   timeup: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, hopped: false, hopLanded: false, powered: false, orbCount: 0, orbList: [], secretCount: 0, secretList: [],
      laps: 0, comboBonus: 0, comboLinked: false, hurt: "", shielded: false, urn: -1, disc: false, capReached: false,
      bossTelegraph: false, bossAttack: false, bossVulnerable: false, bossHit: false, bossPhase: false, bossDefeated: false, finished: false, timeup: false,
   };
}

export interface StepInput {
   /** the stick, -1..1 (up = -1) */
   moveX: number;
   moveZ: number;
   /** the camera's view yaw (menu2/camera orbit.viewYaw): the stick is camera-relative */
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface SpinRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   course: Course;
   simMs: number;
   acc: number;
   pendJump: boolean;
   pendAction: boolean;
   hero: Hero;
   orbTaken: boolean[];
   orbs: number;
   mainOrbs: number;
   /** per stair: the laps already counted for the flow meter */
   lapsDone: number[];
   combo: ComboState;
   secrets: SecretTracker;
   hits: number;
   stunUntil: number;
   invulnUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   dashUntil: number;
   dashDir: number;
   powerReadyAt: number;
   urnBroken: boolean[];
   discUntil: number;
   hops: number;
   /** Against the Grain: the stair entered at its foot against the spin, still clean */
   grain: number;
   boss: BossState | null;
   bossEvents: BossEvents;
   /** phase 1: the coil's centre on the central stair (unwrapped angle), NaN when none */
   coilA: number;
   plateA: number;
   biteA: number;
   biteY: number;
   /** phase 2: which side pole holds the crown (1 or 2) */
   crownPole: number;
   /** phase 3: the central pole spins at P3_SPIN */
   p3: boolean;
   bitten: number;
   ended: "win" | "timeup" | null;
   finishMs: number;
   ev: StepEvents;
}

const newHop = (): Hop => ({ active: false, t: 0, fromX: 0, fromY: 0, fromZ: 0, helix: 0, a: 0, cap: false, capA: 0, toX: 0, toY: 0, toZ: 0 });

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): SpinRun {
   const course = courseFor(level);
   const s = course.start;
   const run: SpinRun = {
      seed, level, heroId, course, simMs: 0, acc: 0, pendJump: false, pendAction: false,
      hero: { helix: s.helix, a: s.at, cap: false, capA: 0, air: 0, vAir: 0, grounded: true, airJumped: false, dir: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hop: newHop() },
      orbTaken: course.orbs.map(() => false), orbs: 0, mainOrbs: 0, lapsDone: course.helices.map(() => 0),
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      hits: 0, stunUntil: -1, invulnUntil: -1, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, dashUntil: -1, dashDir: 1, powerReadyAt: 0,
      urnBroken: course.urns.map(() => false), discUntil: -1, hops: 0, grain: -1,
      boss: course.cfg.boss ? createBoss(COILSTONE) : null, bossEvents: createBossEvents(),
      coilA: Number.NaN, plateA: Number.NaN, biteA: Number.NaN, biteY: 0, crownPole: 1, p3: false, bitten: 0,
      ended: null, finishMs: 0, ev: createEvents(),
   };
   placeHero(run);
   run.hero.vx = run.hero.vy = run.hero.vz = 0;
   return run;
}

// ---------- reads ----------

export const helixOf = (run: SpinRun): Helix => run.course.helices[run.hero.helix];

/** The hero's world angle round the pole (on the stair or round the cap). */
export function heroAngle(run: SpinRun): number {
   return run.hero.cap ? run.hero.capA : run.hero.a;
}

/** The steps' height under the hero (the stair at its angle, or the cap). */
export function floorY(run: SpinRun): number {
   const h = helixOf(run);
   return run.hero.cap ? helixTop(h) : stairY(h, run.hero.a);
}

/** The largest |spin| of any pole on the level, the checkpoint disc's spin and the proof's. */
export function maxSpin(course: Course): number {
   let m = 0;
   for (const p of course.poles) m = Math.max(m, Math.abs(p.spin.omega));
   return course.cfg.boss ? Math.max(m, P3_SPIN) : m;
}

/** A pole's spin now (rad/s, + = its stairs' climbing way): the disc and Coilstone's phase 3 override it. */
export function poleOmega(run: SpinRun, pole: number): number {
   if (run.simMs < run.discUntil) return maxSpin(run.course);
   if (run.p3 && pole === 0) return P3_SPIN;
   return spinOmega(run.course.poles[pole].spin, run.simMs);
}

export const shielded = (run: SpinRun): boolean => run.simMs < run.shieldUntil;
export const phasing = (run: SpinRun): boolean => run.simMs < run.phaseUntil;

/** The hop the hero could make right now with a stick pushing (wx, wz) (world), or -1. Writes the landing into out. */
export function hopTarget(run: SpinRun, wx: number, wz: number, out: Hop): boolean {
   const h = run.hero;
   const c = run.course;
   const from = helixOf(run);
   const pole = c.poles[from.pole];
   const a = heroAngle(run);
   const y = floorY(run);
   const push = Math.hypot(wx, wz);
   if (push < HOP_PUSH) return false;
   let best = -Infinity;
   const consider = (hx: Helix, dir: number) => {
      const turn = turnUnder(hx, dir, y);
      if (!Number.isNaN(turn) && stairY(hx, turn) > best) {
         best = stairY(hx, turn);
         out.helix = hx.id;
         out.a = turn;
         out.cap = false;
         out.capA = dir;
      }
      const top = helixTop(hx);
      if (top <= y + 1e-6 && top > best) {
         best = top;
         out.helix = hx.id;
         out.a = helixEnd(hx);
         out.cap = true;
         out.capA = dir;
      }
   };
   // a neighbouring pole the hero faces and pushes towards
   for (const q of neighbours(c, pole.id)) {
      const target = c.poles[q];
      if (target.ghost && !phasing(run)) continue;
      const d = dirTo(pole, target.x, target.z);
      if (Math.abs(wrapPi(a - d)) > HOP_FACING) continue;
      if ((wx * Math.sin(d) + wz * Math.cos(d)) / push < HOP_PUSH) continue;
      const backDir = dirTo(target, pole.x, pole.z);
      for (const hx of c.helices) if (hx.pole === q) consider(hx, backDir);
   }
   if (best > -Infinity) return true;
   // the wide tower: push in to hop onto the next stair round the same pole
   const inward = (-wx * Math.sin(a) - wz * Math.cos(a)) / push;
   if (!h.cap && inward >= HOP_PUSH) {
      const same = c.helices.filter((hx) => hx.pole === pole.id && hx.id !== from.id);
      if (same.length === 0) return false;
      const order = [...same].sort((p, q) => ((p.id - from.id + 100) % 100) - ((q.id - from.id + 100) % 100));
      for (const hx of order) {
         consider(hx, a);
         if (best > -Infinity) return true;
      }
   }
   return best > -Infinity;
}

// ---------- the step ----------

const SCRATCH_HOP = newHop();
const W = { x: 0, z: 0 };
const RANGE = { from: 0, to: 0 };

function placeHero(run: SpinRun): void {
   const h = run.hero;
   const c = run.course;
   const hx = helixOf(run);
   const p = c.poles[hx.pole];
   const a = heroAngle(run);
   h.x = p.x + p.walk * Math.sin(a);
   h.z = p.z + p.walk * Math.cos(a);
   h.y = floorY(run) + h.air;
}

function pushSecret(run: SpinRun, index: number): void {
   if (index < 0) return;
   if (!collectSecret(run.secrets, index)) return;
   run.ev.secretList[run.ev.secretCount++] = index;
}

function chain(run: SpinRun, base: number): void {
   const bonus = comboHit(run.combo, COMBO, run.simMs, base);
   run.ev.comboBonus += bonus;
   if (run.combo.chain > 1) run.ev.comboLinked = true;
}

function hurt(run: SpinRun, why: StepEvents["hurt"]): void {
   if (run.simMs < run.invulnUntil) return;
   if (shielded(run) && why !== "fall") {
      run.ev.shielded = true;
      return;
   }
   const h = run.hero;
   run.hits += 1;
   if (why === "coil" || why === "bite") run.bitten += 1;
   run.ev.hurt = why;
   run.stunUntil = run.simMs + STUN_MS;
   run.invulnUntil = run.simMs + INVULN_MS;
   comboBreak(run.combo);
   if (why === "fall") return;
   if (!h.cap) {
      const hx = helixOf(run);
      const p = run.course.poles[hx.pole];
      const before = stairY(hx, h.a) + h.air;
      h.a = Math.max(hx.a0, h.a - KNOCK_M / p.walk);
      h.air = Math.max(0, before - stairY(hx, h.a));
   }
   h.grounded = false;
   h.vAir = 3;
}

/** The hero walks off into a gap (or lands over one): he drops to the lap under it. */
function fallThrough(run: SpinRun): void {
   const h = run.hero;
   const hx = helixOf(run);
   const before = stairY(hx, h.a) + h.air;
   h.a = Math.max(hx.a0, h.a - TAU);
   h.air = Math.max(0, before - stairY(hx, h.a));
   if (h.grounded) h.vAir = 0;
   h.grounded = h.air <= 0;
   hurt(run, "fall");
}

function overGap(run: SpinRun): boolean {
   const h = run.hero;
   if (h.cap) return false;
   for (const g of run.course.gaps) if (g.helix === h.helix && h.a >= g.from && h.a <= g.to) return true;
   return false;
}

function reachCap(run: SpinRun): void {
   const h = run.hero;
   const hx = helixOf(run);
   h.cap = true;
   h.capA = h.a;
   h.a = helixEnd(hx);
   run.ev.capReached = true;
   countLaps(run);
   const c = run.course;
   if (c.poles[hx.pole].ghost) pushSecret(run, secretIndex(run.level, "ghost-pole"));
   if (run.grain === hx.id && poleOmega(run, hx.pole) < 0) pushSecret(run, secretIndex(run.level, "against-the-grain"));
   if (hx.goal && !c.cfg.boss) finish(run);
}

function finish(run: SpinRun): void {
   if (run.ended !== null) return;
   const hx = helixOf(run);
   if (run.level === 4 && hx.pitch >= 4.8) pushSecret(run, secretIndex(run.level, "steepest"));
   if (run.level === 5 && run.bitten === 0) pushSecret(run, secretIndex(run.level, "untouched"));
   run.ended = "win";
   run.finishMs = run.simMs;
   run.ev.finished = true;
}

function countLaps(run: SpinRun): void {
   const h = run.hero;
   const hx = helixOf(run);
   const done = Math.min(Math.floor(hx.laps), Math.floor((h.a - hx.a0) / TAU + 1e-9));
   while (run.lapsDone[hx.id] < done) {
      run.lapsDone[hx.id] += 1;
      run.ev.laps += 1;
      chain(run, COMBO_BASE_MS.lap);
   }
}

function bossHit(run: SpinRun): void {
   const b = run.boss;
   if (!b) return;
   const r = hitBoss(b, COILSTONE, 1, run.bossEvents);
   if (r === "ignored") return;
   run.ev.bossHit = true;
   chain(run, COMBO_BASE_MS.boss);
   if (r === "defeated") {
      run.ev.bossDefeated = true;
      finish(run);
   }
}

function useAction(run: SpinRun): void {
   const def = heroById(run.heroId);
   const ms = run.simMs;
   if (def.power === "doubleJump" || ms < run.powerReadyAt) return;
   run.powerReadyAt = ms + def.cooldownMs;
   run.ev.powered = true;
   if (def.power === "dash") {
      run.dashUntil = ms + POWER_MS.dash;
      run.dashDir = run.hero.dir;
   } else if (def.power === "shield") run.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") run.magnetUntil = ms + POWER_MS.magnet;
   else if (def.power === "phase") run.phaseUntil = ms + POWER_MS.phase;
}

/** One frame: cut into fixed steps, so a run is the same at any frame rate. Returns the (reused) events. */
export function step(run: SpinRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   ev.jumped = ev.airJumped = ev.landed = ev.hopped = ev.hopLanded = ev.powered = ev.shielded = ev.disc = ev.capReached = false;
   ev.bossTelegraph = ev.bossAttack = ev.bossVulnerable = ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.finished = ev.timeup = false;
   ev.orbCount = ev.secretCount = ev.laps = 0;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.urn = -1;
   ev.hurt = "";
   if (run.ended !== null || !(dtMs > 0)) return ev;
   run.acc += Math.min(MAX_FRAME_MS, dtMs);
   if (input.jumpPressed) run.pendJump = true;
   if (input.actionPressed) run.pendAction = true;
   while (run.acc >= STEP_MS - 1e-9 && run.ended === null) {
      run.acc -= STEP_MS;
      sub(run, input, run.pendJump, run.pendAction);
      run.pendJump = false;
      run.pendAction = false;
   }
   return ev;
}

function stepBossMachine(run: SpinRun): void {
   const b = run.boss;
   if (!b) return;
   const be = run.bossEvents;
   stepBoss(b, COILSTONE, STEP_MS, be);
   const ev = run.ev;
   const h = run.hero;
   const central = run.course.helices[0];
   if (be.telegraph) {
      ev.bossTelegraph = true;
      if (b.phase === 0) run.coilA = Math.min(helixEnd(central) + 1, (h.helix === 0 ? h.a : central.a0) + 3.2);
      if (b.phase === 1) {
         run.biteA = heroAngle(run);
         run.biteY = h.y;
      }
   }
   if (be.attack) {
      ev.bossAttack = true;
      if (b.phase === 1 && h.helix === 0 && !h.hop.active && Math.abs(wrapPi(heroAngle(run) - run.biteA)) < BITE_HALF && Math.abs(h.y - run.biteY) < BITE_H) hurt(run, "bite");
   }
   if (be.vulnerable) {
      ev.bossVulnerable = true;
      if (b.phase === 0) run.plateA = Math.min(helixEnd(central) - 0.3, (h.helix === 0 && !h.cap ? h.a : central.a0) + 1.9);
      if (b.phase === 1) run.crownPole = run.crownPole === 1 ? 2 : 1;
   }
   if (be.phaseChanged) {
      ev.bossPhase = true;
      run.coilA = Number.NaN;
      if (b.phase === 2) {
         run.p3 = true;
         // Coilstone shakes the pole: whoever is on the central stair drops to three laps under the gong
         if (h.helix === 0 && !h.hop.active) {
            const floor = helixEnd(central) - P3_DROP_LAPS * TAU;
            if (h.cap || h.a > floor) {
               h.cap = false;
               h.a = Math.max(central.a0, floor);
               h.air = 0;
               h.grounded = true;
            }
         }
      }
   }
   // the coil slides down the stair during the attack
   if (b.step === "attack" && b.phase === 0 && !Number.isNaN(run.coilA)) run.coilA -= (COIL_SPEED * STEP_MS) / 1000;
   if (b.step !== "attack" || b.phase !== 0) {
      if (b.phase === 0 && b.step !== "telegraph") run.coilA = Number.NaN;
   }
   if (b.step !== "vulnerable") run.plateA = b.phase === 0 ? Number.NaN : run.plateA;
   // phase 3: standing on the gong cap while it is open rings it
   if (b.phase === 2 && b.step === "vulnerable" && h.helix === 0 && h.cap && !h.hop.active) bossHit(run);
}

function sub(run: SpinRun, input: StepInput, jumpEdge: boolean, actionEdge: boolean): void {
   const ev = run.ev;
   const c = run.course;
   const h = run.hero;
   const dt = STEP_MS / 1000;
   const px = h.x;
   const py = h.y;
   const pz = h.z;

   if (run.boss) stepBossMachine(run);
   if (run.ended !== null) return;
   const ms = run.simMs;
   const stunned = ms < run.stunUntil;

   // the stick, camera-relative, projected on the stair's way round (and kept for a hop)
   inputToWorld(input.moveX, input.moveZ, input.yaw, W);
   const a = heroAngle(run);
   let tang = W.x * Math.cos(a) - W.z * Math.sin(a);
   if (Math.abs(tang) > 1) tang = Math.sign(tang);
   if (stunned || h.hop.active) tang = 0;
   let speed = tang * V_RUN;
   if (ms < run.dashUntil) speed = run.dashDir * V_DASH;
   else if (Math.abs(tang) > 0.15) h.dir = tang > 0 ? 1 : -1;

   if (actionEdge && !stunned && !h.hop.active) useAction(run);

   if (jumpEdge && !stunned && !h.hop.active) {
      if (h.grounded && hopTarget(run, W.x, W.z, SCRATCH_HOP)) {
         const hp = h.hop;
         hp.active = true;
         hp.t = 0;
         hp.fromX = h.x;
         hp.fromY = h.y;
         hp.fromZ = h.z;
         hp.helix = SCRATCH_HOP.helix;
         hp.a = SCRATCH_HOP.a;
         hp.cap = SCRATCH_HOP.cap;
         hp.capA = SCRATCH_HOP.capA;
         const thx = c.helices[hp.helix];
         const tp = c.poles[thx.pole];
         const la = hp.cap ? hp.capA : hp.a;
         hp.toX = tp.x + tp.walk * Math.sin(la);
         hp.toY = hp.cap ? helixTop(thx) : stairY(thx, hp.a);
         hp.toZ = tp.z + tp.walk * Math.cos(la);
         run.hops += 1;
         run.grain = -1;
         ev.hopped = true;
      } else if (h.grounded) {
         h.grounded = false;
         h.vAir = V_JUMP;
         ev.jumped = true;
      } else if (!h.airJumped && heroById(run.heroId).power === "doubleJump") {
         h.airJumped = true;
         h.vAir = V_JUMP2;
         ev.airJumped = true;
      }
   }

   const hx = helixOf(run);
   const pole = c.poles[hx.pole];
   if (h.hop.active) {
      const hp = h.hop;
      hp.t += STEP_MS;
      const k = Math.min(1, hp.t / HOP_MS);
      h.x = hp.fromX + (hp.toX - hp.fromX) * k;
      h.z = hp.fromZ + (hp.toZ - hp.fromZ) * k;
      h.y = hp.fromY + (hp.toY - hp.fromY) * k + 1.4 * Math.sin(Math.PI * k);
      if (k >= 1) {
         hp.active = false;
         h.helix = hp.helix;
         h.cap = hp.cap;
         h.a = hp.a;
         h.capA = hp.capA;
         h.air = 0;
         h.vAir = 0;
         h.grounded = true;
         h.airJumped = false;
         ev.hopLanded = true;
         ev.landed = true;
         const nh = helixOf(run);
         if (!h.cap && h.a <= nh.a0 + 0.3 && poleOmega(run, nh.pole) < 0) run.grain = nh.id;
         // phase 2: landing on the side pole that holds the crown strikes it
         const b = run.boss;
         if (b && b.phase === 1 && b.step === "vulnerable" && h.cap && nh.pole === run.crownPole) bossHit(run);
         if (h.cap && nh.goal && !c.cfg.boss) finish(run);
         placeHero(run);
      }
   } else {
      const omega = h.grounded ? poleOmega(run, hx.pole) : 0;
      if (h.cap) {
         h.capA += (speed / pole.walk + omega) * dt;
      } else {
         h.a += (speed / pole.walk + omega) * dt;
         if (h.a < hx.a0) h.a = hx.a0;
         if (run.grain === hx.id && h.grounded && poleOmega(run, hx.pole) >= 0) run.grain = -1;
         if (h.a >= helixEnd(hx)) reachCap(run);
         else countLaps(run);
      }
      if (run.ended !== null) {
         placeHero(run);
         return;
      }
      if (!h.grounded) {
         h.vAir -= GRAV * dt;
         h.air += h.vAir * dt;
         if (h.air <= 0) {
            if (overGap(run)) fallThrough(run);
            else {
               h.air = 0;
               h.vAir = 0;
               h.grounded = true;
               h.airJumped = false;
               ev.landed = true;
               // phase 1: a landing on the dark plated segment is a stomp
               const b = run.boss;
               if (b && b.phase === 0 && b.step === "vulnerable" && h.helix === 0 && !h.cap && Math.abs(h.a - run.plateA) < PLATE_HALF) bossHit(run);
            }
         }
      } else if (overGap(run)) fallThrough(run);
      placeHero(run);
      hazards(run);
   }

   collect(run);
   // the checkpoint disc on a mushroom cap
   const disc = c.disc;
   if (disc && h.cap && h.helix === disc.helix && !h.hop.active && Math.abs(wrapPi(h.capA - disc.at)) < 0.5 && run.discUntil < 0) {
      run.discUntil = ms + DISC_MS;
      ev.disc = true;
      pushSecret(run, secretIndex(run.level, "spin-disc"));
   }

   run.simMs += STEP_MS;
   h.vx = (h.x - px) / dt;
   h.vy = (h.y - py) / dt;
   h.vz = (h.z - pz) / dt;
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

function hazards(run: SpinRun): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   if (ms < run.invulnUntil) return;
   const hx = helixOf(run);
   const pole = c.poles[hx.pole];
   const a = heroAngle(run);
   const feet = h.y;
   for (const s of c.sweepers) {
      if (s.pole !== pole.id) continue;
      if (feet >= s.y + 0.14 || feet + BODY_H <= s.y - 0.14) continue;
      if (Math.abs(wrapPi(a - sweeperAngle(s, ms))) < 0.12 + BODY_W / pole.walk) {
         hurt(run, "sweeper");
         return;
      }
   }
   if (!h.cap) {
      for (const s of c.spikes) {
         if (s.helix !== hx.id || h.air > 0.15) continue;
         stretchAt(s, ms, RANGE);
         if (h.a >= RANGE.from && h.a <= RANGE.to) {
            hurt(run, "spike");
            return;
         }
      }
      for (const s of c.spores) {
         if (s.helix !== hx.id || isVeil(s) || !sporeOn(s, ms) || h.air > 1.5) continue;
         if (h.a >= s.from && h.a <= s.to) {
            hurt(run, "spore");
            return;
         }
      }
      const b = run.boss;
      if (b && b.phase === 0 && b.step === "attack" && hx.id === 0 && !Number.isNaN(run.coilA) && Math.abs(h.a - run.coilA) < COIL_HALF && h.air < 0.7) hurt(run, "coil");
   }
}

/** Is orb i inside a spore veil (only a shielded Kiro reaches it)? */
function veiled(run: SpinRun, i: number): boolean {
   const o = run.course.orbs[i];
   return o.gate === "kiro";
}

function collect(run: SpinRun): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   if (h.hop.active) return;
   const hx = helixOf(run);
   const pole = c.poles[hx.pole];
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.orbTaken[i]) continue;
      const o = c.orbs[i];
      let take = false;
      if (o.gate === "zuno") take = ms < run.magnetUntil && Math.hypot(h.x - o.x, h.y + 0.8 - o.y, h.z - o.z) <= MAGNET_REACH;
      else if (o.helix === h.helix && !h.cap) {
         const near = Math.abs(h.a - o.at) * pole.walk;
         if (o.gate === "riko") {
            const urn = c.urns.findIndex((u) => u.helix === o.helix && Math.abs(u.at - o.at) < 0.01);
            take = ms < run.dashUntil && near < ORB.reach + 0.3;
            if (take && urn >= 0 && !run.urnBroken[urn]) {
               run.urnBroken[urn] = true;
               run.ev.urn = urn;
            }
         } else if (veiled(run, i)) take = ms < run.shieldUntil && near < ORB.reach;
         else take = near < ORB.reach && Math.abs(h.air - o.air) < ORB.airReach;
      }
      if (!take) continue;
      run.orbTaken[i] = true;
      run.orbs += 1;
      if (i < c.mainOrbs) run.mainOrbs += 1;
      run.ev.orbList[run.ev.orbCount++] = i;
      chain(run, COMBO_BASE_MS.orb);
   }
}

// ---------- the boss reads (the scene) ----------

export const bossVulnerable = (run: SpinRun): boolean => run.boss !== null && run.boss.step === "vulnerable";

// ---------- the score ----------

/** The submitted time: the finish less 0.1 s an orb and the flow bonus. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export const submittedMs = (run: SpinRun): number => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** The run's stars (clear, the five main orbs, the target time) and the no-hit badge. */
export function runStars(run: SpinRun): StarResult {
   const cleared = run.ended === "win";
   return evaluateStars(starSpecFor(run.level, run.course.mainOrbs), { cleared, orbs: run.mainOrbs, goalValue: cleared ? submittedMs(run) : Number.NaN, hits: run.hits });
}

export function flowOf(run: SpinRun): number {
   return comboFlow(run.combo, COMBO, run.simMs);
}

// ---------- the limits (README "Server limits and why they hold"; bound.ts) ----------

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** The most the submitted time can be cut by orbs and the flow meter (ms). */
export function maxBonusMs(level: LevelId): number {
   const c = courseFor(level);
   let laps = 0;
   for (const h of c.helices) laps += Math.floor(h.laps);
   const bases = laps * COMBO_BASE_MS.lap + c.orbs.length * COMBO_BASE_MS.orb + (c.cfg.boss ? COILSTONE.maxHp * COMBO_BASE_MS.boss : 0);
   return c.orbs.length * ORB.bonusMs + bases * (COMBO.cap - 1);
}

export { SECRETS, COILSTONE };
export type { HeroId };

/** The shell's score for a win: the time game submits its submitted time. */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   height: "height",
   hero: "hero",
   power: "power",
   finishMs: "finishMs",
   hits: "hits",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   hopReady: "hopReady",
   spin: "spin",
   flip: "flip",
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

/** The level limits proven in proof.test.ts: bound.ts proposeLimits, pinned. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 14_150, minDurationMs: 8_500, maxDurationMs: 150_000, timeBaseMs: 150_000 },
   2: { kind: "time", maxScore: 16_810, minDurationMs: 11_900, maxDurationMs: 180_000, timeBaseMs: 180_000 },
   3: { kind: "time", maxScore: 19_550, minDurationMs: 14_500, maxDurationMs: 210_000, timeBaseMs: 210_000 },
   4: { kind: "time", maxScore: 22_020, minDurationMs: 19_800, maxDurationMs: 240_000, timeBaseMs: 240_000 },
   5: { kind: "time", maxScore: 28_340, minDurationMs: 16_600, maxDurationMs: 300_000, timeBaseMs: 300_000 },
};
