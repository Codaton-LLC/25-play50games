// Museum Guard: a fixed eye, a flashlight, statues that only walk in the dark.
// Pure and seeded. No three.js, React, DOM, Math.random or Date.now.
// One step = one played frame (the clock has already added dt). The Scene calls stepGame.
import { inViewCone } from "@/arcade3d/core/ai";
import type { ScoringRules } from "@/arcade3d/types";
import type { RunState } from "@/arcade3d/core/types";
import { rngNext, type RngState } from "@/arcade3d/core/math";

export const RING = {
   count: 8,
   pedestalR: 6,
   laneR: 5.2,
   inward: 0.8,
   /** foot y drops from the pedestal top to the floor over this much of the inward step */
   stepDrop: 0.4,
   pedestalTop: 0.8,
   /** half-width of a pedestal square; the inner face sits at pedestalR - this */
   pedestalHalf: 0.4,
   guardR: 0.45,
} as const;

export const EXITS = { pos: Math.PI / 2, neg: -Math.PI / 2 } as const;

export const BEAM = {
   /** half-angles in degrees, phases 0 / 1 / 2 */
   halfDeg: [16, 14, 12] as const,
   coarse: 1.2,
   coarseCapDeg: 17,
   range: 9,
   hold: 0.7,
   alarm: 0.45,
} as const;

export const FLASH = { half: Math.PI / 4, duration: 1.2, cooldown: 10 } as const;
export const COAST = 0.4;
export const RETURN_SPEED = 3;
export const TURN_RATE = Math.PI;
export const HOVER_DEAD = 0.15;
export const DRAG_PX_PER_TURN = 140;

export const PHASES = {
   /** phase i is active until this many seconds (the last is dawn) */
   ends: [30, 60, 90] as const,
   speed: [1, 1.15, 1.25] as const,
   cap: [2, 3, 3] as const,
   starts: [6, 7, 8] as const,
   gap: [4.2, 3.6, 3.2] as const,
   first: 3,
   dawn: 90,
} as const;

export const TYPES = {
   knight: { speed: 0.6, radius: 0.35 },
   robot: { speed: 0.8, radius: 0.28 },
   penguin: { speed: 1, radius: 0.25 },
   dino: { speed: 1.2, radius: 0.45 },
} as const;

export type ExhibitKind = keyof typeof TYPES;

export const SCORE = {
   perSecond: 5,
   returnBonus: 50,
   returnMinM: 2,
   dawn: 150,
   /** 6 + 7 + 8 starts */
   maxReturns: 21,
   /** 5*90 + 50*21 + 150*3 */
   ceiling: 1950,
} as const;

/** Three short penguins the shipping roster never deals (it has two). Alarm geometry only. */
export const FIXTURE_STARTS = [3, 7.2, 11.4] as const;

/**
 * Proposed server limits (Claude copies these into meta.ts and arcade-games.json at go-live).
 * meta.scoring on this branch stays the provisional 3900 / 3900.
 */
export const PROPOSED_LIMITS: ScoringRules = {
   kind: "points",
   maxScore: 2050,
   minDurationMs: 12000,
   maxDurationMs: 92000,
   base: 0,
   maxPointsPerSec: 25,
   unitLabel: "pts",
   display: "int",
};

const ORIGIN = { x: 0, y: 0, z: 0 };
const scratch = { x: 0, y: 0, z: 0 };
const KINDS: readonly ExhibitKind[] = ["knight", "knight", "robot", "robot", "penguin", "penguin", "dino", "dino"];

export type ExhibitMode = "still" | "sneaking" | "frozen" | "returning";

export interface Pedestal {
   index: number;
   angle: number;
   /** nearer exit, +π/2 on a tie */
   exit: number;
   /** signed short-arc from the pedestal angle to the exit (radians) */
   arc: number;
   length: number;
   x: number;
   z: number;
   exitX: number;
   exitZ: number;
}

export interface Exhibit {
   kind: ExhibitKind;
   pedestal: number;
   mode: ExhibitMode;
   /** metres along the path, 0 = pedestal centre, length = threshold */
   s: number;
   hold: number;
   coast: number;
   coastSpeed: number;
   wasSeen: boolean;
   /** this return pays +50 when it gets home */
   paid: boolean;
   x: number;
   z: number;
   foot: number;
   face: number;
   justFrozen: boolean;
   justAlarm: boolean;
   justHome: boolean;
}

/** The run the radar reads. The scene publishes it; nothing in the step loop reads it. */
export const liveRun: { current: Run | null } = { current: null };

export interface Run {
   seed: number;
   yaw: number;
   coarse: boolean;
   phase: 0 | 1 | 2;
   half: number;
   exhibits: Exhibit[];
   pedestals: Pedestal[];
   alarms: number;
   returns: number;
   /** whole seconds already paid */
   seconds: number;
   score: number;
   lastStart: number;
   starts: [number, number, number];
   flashLeft: number;
   flashYaw: number;
   cooldown: number;
   outcome: "win" | "lose" | null;
   /** third-alarm time of the penguin fixture; 0 in a normal run until a loss */
   alarmAt: number;
   pointAt: number;
   gainedSeconds: number;
   gainedReturns: number;
   dawnBonus: number;
   /** set only by createFixture: start times for exhibits 0..2, then the director stays quiet */
   fixture: boolean;
   fixtureIndex: number;
}

export interface GuardInput {
   /** held strafe, -1..1. Ignored while dragYaw is set. */
   moveX: number;
   /** fine-pointer hover, -1..1. Null on a coarse pointer. */
   pointerX: number | null;
   /** yaw the touch drag wants, already wrapped. Null when no drag is followed. */
   dragYaw: number | null;
   coarse: boolean;
   /** one press: actionPressed or jumpPressed, not both meanings */
   flash: boolean;
}

export interface StoreSink {
   addScore: (n: number) => void;
   setStat: (key: string, value: number) => void;
   end: (reason: "win" | "lose") => void;
}

export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export function phaseIndex(t: number): 0 | 1 | 2 {
   if (t < PHASES.ends[0]) return 0;
   if (t < PHASES.ends[1]) return 1;
   return 2;
}

export function beamHalf(phase: 0 | 1 | 2, coarse: boolean): number {
   const deg = BEAM.halfDeg[phase] * (coarse ? BEAM.coarse : 1);
   return (Math.min(deg, BEAM.coarseCapDeg) * Math.PI) / 180;
}

export function pedestalAngle(index: number): number {
   return (index + 0.5) * (Math.PI / 4);
}

/** Shorter arc to an exit. A tie (exactly between them) takes +π/2. */
export function nearerExit(angle: number): number {
   const pos = Math.abs(wrapAngle(EXITS.pos - angle));
   const neg = Math.abs(wrapAngle(EXITS.neg - angle));
   return pos <= neg ? EXITS.pos : EXITS.neg;
}

export function makePedestal(index: number): Pedestal {
   const angle = pedestalAngle(index);
   const exit = nearerExit(angle);
   const arc = wrapAngle(exit - angle);
   const length = RING.inward + RING.laneR * Math.abs(arc);
   return {
      index,
      angle,
      exit,
      arc,
      length,
      x: Math.sin(angle) * RING.pedestalR,
      z: Math.cos(angle) * RING.pedestalR,
      exitX: Math.sin(exit) * RING.laneR,
      exitZ: Math.cos(exit) * RING.laneR,
   };
}

/** World position of a centre `s` metres along its path. Writes `out` when given. */
export function pointOnPath(ped: Pedestal, s: number, out: { x: number; z: number } = { x: 0, z: 0 }): { x: number; z: number } {
   const clamped = s < 0 ? 0 : s > ped.length ? ped.length : s;
   if (clamped <= RING.inward) {
      const r = RING.pedestalR - clamped;
      out.x = Math.sin(ped.angle) * r;
      out.z = Math.cos(ped.angle) * r;
   } else {
      const ang = ped.angle + (ped.arc < 0 ? -1 : 1) * ((clamped - RING.inward) / RING.laneR);
      out.x = Math.sin(ang) * RING.laneR;
      out.z = Math.cos(ang) * RING.laneR;
   }
   return out;
}

/** Foot height: 0.8 on the pedestal, 0 after the first 0.4 m, climbing back over the last 0.4 m home. */
export function footHeight(s: number): number {
   if (s <= 0) return RING.pedestalTop;
   if (s >= RING.stepDrop) return 0;
   return RING.pedestalTop * (1 - s / RING.stepDrop);
}

export function runScore(seconds: number, returns: number, alarms: number, survived: boolean): number {
   const whole = Math.min(PHASES.dawn, Math.max(0, Math.floor(seconds)));
   return SCORE.perSecond * whole + SCORE.returnBonus * returns + (survived ? SCORE.dawn * alarms : 0);
}

export function finalScore(state: RunState): { score: number; durationMs: number } {
   const seconds = Math.min(PHASES.dawn, Math.floor(state.elapsedMs / 1000));
   return {
      score: runScore(seconds, state.stats.returns ?? 0, state.stats.alarms ?? 0, state.endReason === "win"),
      durationMs: state.elapsedMs,
   };
}

function shuffleKinds(seed: number): ExhibitKind[] {
   const kinds = KINDS.slice() as ExhibitKind[];
   const rng: RngState = { s: seed };
   for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rngNext(rng) * (i + 1));
      const swap = kinds[i];
      kinds[i] = kinds[j];
      kinds[j] = swap;
   }
   return kinds;
}

function makeExhibit(kind: ExhibitKind, pedestal: number, ped: Pedestal): Exhibit {
   return {
      kind,
      pedestal,
      mode: "still",
      s: 0,
      hold: 0,
      coast: 0,
      coastSpeed: 0,
      wasSeen: false,
      paid: false,
      x: ped.x,
      z: ped.z,
      foot: RING.pedestalTop,
      face: Math.atan2(-ped.x, -ped.z),
      justFrozen: false,
      justAlarm: false,
      justHome: false,
   };
}

export function createRun(seed: number): Run {
   const pedestals = Array.from({ length: RING.count }, (_, i) => makePedestal(i));
   const kinds = shuffleKinds(seed);
   return {
      seed,
      yaw: 0,
      coarse: false,
      phase: 0,
      half: beamHalf(0, false),
      exhibits: kinds.map((kind, i) => makeExhibit(kind, i, pedestals[i])),
      pedestals,
      alarms: 3,
      returns: 0,
      seconds: 0,
      score: 0,
      lastStart: -1,
      starts: [0, 0, 0],
      flashLeft: 0,
      flashYaw: 0,
      cooldown: 0,
      outcome: null,
      alarmAt: 0,
      pointAt: 0,
      gainedSeconds: 0,
      gainedReturns: 0,
      dawnBonus: 0,
      fixture: false,
      fixtureIndex: 0,
   };
}

/** Three short penguins forced out at 3 / 7.2 / 11.4 s. Not a layout the game deals. */
export function createFixture(): Run {
   const run = createRun(1);
   const shorts: number[] = [];
   for (let i = 0; i < run.pedestals.length && shorts.length < 3; i++) {
      if (run.pedestals[i].length < 5) shorts.push(i);
   }
   run.exhibits = shorts.map((index) => makeExhibit("penguin", index, run.pedestals[index]));
   while (run.exhibits.length < RING.count) run.exhibits.push(makeExhibit("knight", shorts[0], run.pedestals[shorts[0]]));
   run.fixture = true;
   run.alarms = 3;
   return run;
}

function liveCount(run: Run): number {
   return run.fixture ? 3 : run.exhibits.length;
}

function publish(ex: Exhibit, ped: Pedestal): void {
   const prevX = ex.x;
   const prevZ = ex.z;
   pointOnPath(ped, ex.s, ex);
   ex.foot = footHeight(ex.s);
   const dx = ex.x - prevX;
   const dz = ex.z - prevZ;
   if (dx * dx + dz * dz > 1e-8) ex.face = Math.atan2(dx, dz);
}

function distanceToExit(ex: Exhibit, ped: Pedestal): number {
   return Math.hypot(ex.x - ped.exitX, ex.z - ped.exitZ);
}

function seenAt(run: Run, x: number, z: number): boolean {
   scratch.x = x;
   scratch.y = 0;
   scratch.z = z;
   if (inViewCone(ORIGIN, run.yaw, run.half, BEAM.range, scratch)) return true;
   if (run.flashLeft > 0 && inViewCone(ORIGIN, run.flashYaw, FLASH.half, BEAM.range, scratch)) return true;
   return false;
}

function sneakSpeed(kind: ExhibitKind, phase: 0 | 1 | 2): number {
   return TYPES[kind].speed * PHASES.speed[phase];
}

function beginReturn(ex: Exhibit, ped: Pedestal): void {
   ex.paid = ped.length - ex.s > SCORE.returnMinM;
   ex.mode = "returning";
   ex.coast = 0;
   ex.hold = 0;
}

function triggerAlarm(run: Run, ex: Exhibit, at: number, sAtAlarm: number, speed: number, ped: Pedestal): void {
   ex.justAlarm = true;
   ex.mode = "still";
   ex.s = 0;
   ex.coast = 0;
   ex.hold = 0;
   ex.paid = false;
   ex.wasSeen = false;
   publish(ex, ped);
   run.alarms -= 1;
   if (run.alarms <= 0) {
      run.alarms = 0;
      run.outcome = "lose";
      run.alarmAt = at;
      run.pointAt = at + (ped.length - sAtAlarm) / speed;
   }
}

/**
 * Move one exhibit for `h` seconds ending at `t1`. A sneak that crosses the alarm radius
 * records the crossing time and stops the run on the third alarm.
 */
function moveExhibit(run: Run, index: number, h: number, t1: number): void {
   if (h <= 0 || run.outcome) return;
   const ex = run.exhibits[index];
   if (index >= liveCount(run)) return;
   const ped = run.pedestals[ex.pedestal];
   const t0 = t1 - h;

   if (ex.mode === "returning") {
      ex.s = Math.max(0, ex.s - RETURN_SPEED * h);
      publish(ex, ped);
      if (ex.s === 0) {
         if (ex.paid) {
            run.returns += 1;
            run.gainedReturns += 1;
            ex.justHome = true;
         }
         ex.paid = false;
         ex.mode = "still";
         ex.wasSeen = false;
         ex.hold = 0;
         ex.coast = 0;
         publish(ex, ped);
      }
      return;
   }

   if (ex.mode !== "sneaking" && ex.mode !== "frozen") return;

   const seen = seenAt(run, ex.x, ex.z);
   if (ex.mode === "frozen") {
      if (seen) {
         ex.hold += h;
         ex.wasSeen = true;
         if (ex.hold >= BEAM.hold - 1e-6) beginReturn(ex, ped);
         return;
      }
      ex.hold = 0;
      ex.mode = "sneaking";
      ex.wasSeen = false;
   }

   const phase = phaseIndex(t0);
   if (ex.kind === "penguin" && seen && !ex.wasSeen) {
      ex.coast = COAST;
      ex.coastSpeed = sneakSpeed(ex.kind, phase);
   }
   if (ex.kind !== "penguin" && seen) {
      ex.mode = "frozen";
      ex.justFrozen = true;
      ex.hold += h;
      ex.wasSeen = true;
      if (ex.hold >= BEAM.hold - 1e-6) beginReturn(ex, ped);
      return;
   }

   const speed = ex.coast > 0 ? ex.coastSpeed : sneakSpeed(ex.kind, phaseIndex(t0));
   const sBefore = ex.s;
   const dBefore = distanceToExit(ex, ped);
   ex.s = Math.min(ped.length, ex.s + speed * h);
   if (ex.coast > 0) ex.coast = ex.coast - h <= 1e-8 ? 0 : ex.coast - h;
   publish(ex, ped);
   const dAfter = distanceToExit(ex, ped);
   const seenAfter = seenAt(run, ex.x, ex.z);
   // entering the cone during the step starts a coast; the speed this step already matches it
   if (ex.kind === "penguin" && seenAfter && !seen) {
      ex.coast = COAST;
      ex.coastSpeed = speed;
   }

   if (dAfter <= BEAM.alarm) {
      const span = dBefore - dAfter;
      const frac = span > 1e-8 ? Math.min(1, Math.max(0, (dBefore - BEAM.alarm) / span)) : 1;
      const sAlarm = sBefore + (ex.s - sBefore) * frac;
      triggerAlarm(run, ex, t0 + frac * h, sAlarm, speed, ped);
      return;
   }

   if (ex.kind === "penguin") {
      ex.hold = seenAfter ? ex.hold + h : 0;
      if (ex.coast <= 0 && seenAfter) {
         ex.justFrozen = true;
         ex.mode = "frozen";
      }
   }
   ex.wasSeen = seenAfter;
   if (ex.hold >= BEAM.hold - 1e-6 && (ex.mode === "frozen" || ex.mode === "sneaking")) beginReturn(ex, ped);
}

function startExhibit(run: Run, index: number): void {
   const ex = run.exhibits[index];
   const ped = run.pedestals[ex.pedestal];
   ex.mode = "sneaking";
   ex.s = 0;
   ex.hold = 0;
   ex.coast = 0;
   ex.coastSpeed = 0;
   ex.wasSeen = false;
   ex.paid = false;
   publish(ex, ped);
   run.starts[run.phase] += 1;
}

function sneakingCount(run: Run, shortOnly: boolean): number {
   let n = 0;
   const live = liveCount(run);
   for (let i = 0; i < live; i++) {
      const ex = run.exhibits[i];
      if (ex.mode !== "sneaking") continue;
      if (shortOnly && run.pedestals[ex.pedestal].length >= 5) continue;
      n += 1;
   }
   return n;
}

function exitGap(ped: Pedestal, yaw: number): number {
   return Math.abs(wrapAngle(ped.exit - yaw));
}

/** True when `a` should start ahead of `b` (further exit, then longer path, then lower index). */
function prefer(run: Run, a: number, b: number): boolean {
   const pa = run.pedestals[run.exhibits[a].pedestal];
   const pb = run.pedestals[run.exhibits[b].pedestal];
   const ga = exitGap(pa, run.yaw);
   const gb = exitGap(pb, run.yaw);
   if (Math.abs(ga - gb) > 1e-9) return ga > gb;
   if (Math.abs(pa.length - pb.length) > 1e-9) return pa.length > pb.length;
   return pa.index < pb.index;
}

function legal(run: Run, index: number, t: number, shortSneaking: number): boolean {
   const ex = run.exhibits[index];
   if (ex.mode !== "still") return false;
   const ped = run.pedestals[ex.pedestal];
   if (ex.kind === "dino" && (t < PHASES.ends[0] || ped.length < 4)) return false;
   if (ped.length < 5 && shortSneaking >= 1) return false;
   if (seenAt(run, ped.x, ped.z)) return false;
   return true;
}

function tryStart(run: Run, t: number): void {
   const phase = run.phase;
   if (run.starts[phase] >= PHASES.starts[phase]) return;
   const gate = run.lastStart < 0 ? PHASES.first : run.lastStart + PHASES.gap[phase];
   if (t < gate) return;
   if (sneakingCount(run, false) >= PHASES.cap[phase]) return;
   const shortSneaking = sneakingCount(run, true);
   let best = -1;
   const live = liveCount(run);
   for (let i = 0; i < live; i++) {
      if (!legal(run, i, t, shortSneaking)) continue;
      if (best < 0 || prefer(run, i, best)) best = i;
   }
   if (best < 0) return;
   startExhibit(run, best);
   run.lastStart = t;
}

function tryFixture(run: Run, t0: number, t1: number): void {
   const when = FIXTURE_STARTS[run.fixtureIndex];
   if (when === undefined || !(t0 < when && t1 >= when)) return;
   const index = run.fixtureIndex;
   run.fixtureIndex += 1;
   startExhibit(run, index);
   run.lastStart = when;
   moveExhibit(run, index, t1 - when, t1);
}

function applyTurn(run: Run, input: GuardInput, dt: number): void {
   const max = TURN_RATE * dt;
   if (input.dragYaw !== null) {
      let delta = wrapAngle(input.dragYaw - run.yaw);
      if (delta > max) delta = max;
      else if (delta < -max) delta = -max;
      run.yaw = wrapAngle(run.yaw + delta);
      return;
   }
   let rate = 0;
   if (input.pointerX !== null) {
      const ax = Math.abs(input.pointerX);
      if (ax > HOVER_DEAD) rate += Math.sign(input.pointerX) * TURN_RATE * ((ax - HOVER_DEAD) / (1 - HOVER_DEAD));
   }
   rate += input.moveX * TURN_RATE;
   if (rate > TURN_RATE) rate = TURN_RATE;
   else if (rate < -TURN_RATE) rate = -TURN_RATE;
   run.yaw = wrapAngle(run.yaw + rate * dt);
}

function applyFlash(run: Run, input: GuardInput, dt: number): void {
   if (input.flash && run.cooldown <= 0 && run.flashLeft <= 0) {
      run.flashLeft = FLASH.duration;
      run.flashYaw = run.yaw;
      run.cooldown = FLASH.cooldown;
   }
   // the press frame counts, so a 1.2 s flash is gone 1.2 s after the press
   if (run.flashLeft > 0) run.flashLeft = Math.max(0, run.flashLeft - dt);
   if (run.cooldown > 0) run.cooldown = Math.max(0, run.cooldown - dt);
}

function award(run: Run, t: number): number {
   const whole = Math.min(PHASES.dawn, Math.max(0, Math.floor(t + 1e-9)));
   const gained = whole > run.seconds ? whole - run.seconds : 0;
   run.seconds = whole;
   run.gainedSeconds = gained;
   return gained;
}

function pushScore(run: Run, store: StoreSink): void {
   if (run.gainedSeconds) store.addScore(SCORE.perSecond * run.gainedSeconds);
   if (run.gainedReturns) store.addScore(SCORE.returnBonus * run.gainedReturns);
   run.score += SCORE.perSecond * run.gainedSeconds + SCORE.returnBonus * run.gainedReturns;
   store.setStat("returns", run.returns);
   store.setStat("alarms", run.alarms);
}

const noopSink: StoreSink = { addScore: () => {}, setStat: () => {}, end: () => {} };

/**
 * One played frame. `elapsedS` is the run clock at the end of the frame (already advanced).
 * A frame that begins at or past dawn does not move exhibits.
 */
export function stepGame(run: Run, input: GuardInput, dt: number, elapsedS: number, store: StoreSink = noopSink): void {
   if (run.outcome || !(dt > 0)) return;
   const live = liveCount(run);
   for (let i = 0; i < live; i++) {
      const ex = run.exhibits[i];
      ex.justFrozen = false;
      ex.justAlarm = false;
      ex.justHome = false;
   }
   run.gainedSeconds = 0;
   run.gainedReturns = 0;
   run.dawnBonus = 0;
   run.coarse = input.coarse;
   run.phase = phaseIndex(Math.min(elapsedS, PHASES.dawn));
   run.half = beamHalf(run.phase, run.coarse);

   if (elapsedS >= PHASES.dawn) {
      award(run, PHASES.dawn);
      run.dawnBonus = SCORE.dawn * run.alarms;
      run.outcome = "win";
      pushScore(run, store);
      if (run.dawnBonus) {
         store.addScore(run.dawnBonus);
         run.score += run.dawnBonus;
      }
      store.setStat("dawn", 0);
      store.setStat("flash", 0);
      store.end("win");
      return;
   }

   applyTurn(run, input, dt);
   applyFlash(run, input, dt);

   const t0 = elapsedS - dt;
   if (run.fixture) {
      // the scheduled penguin moves only after its start instant; the others move the whole frame
      const pending = FIXTURE_STARTS[run.fixtureIndex];
      const split = pending !== undefined && t0 < pending && elapsedS >= pending;
      for (let i = 0; i < 3; i++) {
         if (split && i === run.fixtureIndex) continue;
         if (run.exhibits[i].mode === "still") continue;
         moveExhibit(run, i, dt, elapsedS);
         if (run.outcome) break;
      }
      if (!run.outcome) tryFixture(run, t0, elapsedS);
   } else {
      const slices = Math.max(1, Math.ceil(dt / (1 / 60)));
      const h = dt / slices;
      let t = t0;
      for (let s = 0; s < slices && !run.outcome; s++) {
         t += h;
         for (let i = 0; i < live && !run.outcome; i++) moveExhibit(run, i, h, t);
      }
      if (!run.outcome) tryStart(run, elapsedS);
   }

   // Whole seconds follow the clock the server sees (elapsed), matching finalScore.
   award(run, elapsedS);
   pushScore(run, store);
   store.setStat("dawn", Math.max(0, Math.ceil(PHASES.dawn - elapsedS - 1e-9)));
   store.setStat("flash", Math.max(0, Math.round(run.cooldown * 10) / 10));
   if (run.outcome === "lose") store.end("lose");
}

/** A pedestal square (radial / tangential, half RING.pedestalHalf) contains this lane point? */
export function inPedestalSquare(ped: Pedestal, x: number, z: number): boolean {
   const dx = x - ped.x;
   const dz = z - ped.z;
   const radial = dx * Math.sin(ped.angle) + dz * Math.cos(ped.angle);
   const tangential = dx * Math.cos(ped.angle) - dz * Math.sin(ped.angle);
   return Math.abs(radial) <= RING.pedestalHalf + 1e-9 && Math.abs(tangential) <= RING.pedestalHalf + 1e-9;
}

export function centreRadius(ex: Exhibit): number {
   return Math.hypot(ex.x, ex.z);
}

/** Both exit thresholds inside one cone of this half-angle aimed at `yaw`? */
export function bothExitsInCone(yaw: number, half: number): boolean {
   const a = { x: Math.sin(EXITS.pos) * RING.laneR, y: 0, z: Math.cos(EXITS.pos) * RING.laneR };
   const b = { x: Math.sin(EXITS.neg) * RING.laneR, y: 0, z: Math.cos(EXITS.neg) * RING.laneR };
   return inViewCone(ORIGIN, yaw, half, BEAM.range, a) && inViewCone(ORIGIN, yaw, half, BEAM.range, b);
}
