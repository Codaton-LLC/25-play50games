// Robot Factory Sorter: the pure, seeded rules (README "Rules", "Scoring", "Run end"). No three.js,
// React or DOM, no Math.random / Date.now. Scene.tsx calls stepRun once per useRunFrame and turns
// run.events into store calls, fx and sound; rules.test.ts drives the same step through the store.
// Levels: createRun(seed) is today's shift; createRun(seed, level) reads levels.ts. The module
// constants below stay level 1, so the existing tests keep calling them.
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { rngNext, type RngState } from "@/arcade3d/core/math";
import { createPath, pointAt } from "@/arcade3d/core/path";
import { LEVELS, type FactoryLevel } from "./levels";

// ---------- tuning (every gameplay number lives here) ----------

export const SHIFT = {
   /** s: the game's own clock (no durationMs, clockChip: false) */
   DURATION: 90,
   /** robots needed by the end of the shift for a win */
   WIN_QUOTA: 5,
   /** strikes (grabbed faulty parts) that end the run, = GameDefinition.lives */
   LIVES: 3,
   RESULT_DELAY_MS: 1400,
} as const;

export const BELT = {
   Y: 0.75,
   Z: 0.35,
   WIDTH: 0.8,
   FEEDER_WIDTH: 0.65,
   /** the grab zone on MAIN_BELT (arc length, m): x in [-0.90, 0.90] */
   GRAB_MIN: 1.9,
   GRAB_MAX: 3.7,
   /** the claw's rest point (x = 0) */
   CLAW_S: 2.8,
   /** where FEEDER_BELT joins MAIN_BELT (x = -1.20) */
   S_MERGE: 1.6,
   /** the feeder carries every other non-needed part from this time on (s) */
   FEEDER_T: 60,
   /** m/s: the first robot, then 1.60 x 1.04^(r - 1), capped */
   V0: 1.45,
   V1: 1.6,
   GROWTH: 1.04,
   V_MAX: 2.6,
} as const;

export const MAIN_BELT = createPath([
   { x: -2.8, y: BELT.Y, z: BELT.Z },
   { x: 2.8, y: BELT.Y, z: BELT.Z },
]);
export const FEEDER_BELT = createPath([
   { x: -2.6, y: BELT.Y, z: -0.55 },
   { x: -1.2, y: BELT.Y, z: BELT.Z },
]);
/** A feeder part at feeder arc length s sits at s - FEEDER_OFFSET on the main belt's scale. */
export const FEEDER_OFFSET = FEEDER_BELT.total - BELT.S_MERGE;

export const STREAM = {
   MAX_PARTS: 8,
   MIN_PART_GAP: 0.95,
   /** s: needed parts spawn on k * PERIOD, one non-needed part on k * PERIOD + HALF */
   PERIOD: 1.6,
   HALF: 0.8,
   /** m: needed part 1 starts here at t = 0 (enters the grab zone at 0.814 s) */
   FIRST_S: 0.72,
   FAULTY_CHANCE: 0.18,
   FIRST_FAULT_MIN_T: 2.6,
   FAULT_MIN_INTERVAL: 3.5,
   FAULT_MIN_INTERVAL_LATE: 2.5,
   LATE_T: 60,
} as const;

export const CLAW = {
   /**
    * s: a grab of a clean part the blueprint does not want (Decision 2026-10-24: 1.0 s lockout;
    * wrong grab drops part back and resets blueprint step to prevent spamming).
    */
   WRONG_LOCKOUT: 1.0,
   /** s: a clean part swept into the bin */
   SCRAP_LOCKOUT: 1.0,
   /** s: a faulty part grabbed (a strike) */
   FAULT_LOCKOUT: 0.5,
   /** s: a faulty part let through the sensor at the end of the grab zone */
   ZAP_LOCKOUT: 0.5,
   /** s: the visual bounce of a wrongly grabbed part */
   BOUNCE: 0.35,
} as const;

export const SCORING = {
   PART_BASE: 20,
   COMBO_STEP: 4,
   COMBO_MAX: 5,
   ROBOT_BONUS: 200,
} as const;

/** The finished robot's walk from the cradle to the exit door (visual; the next blueprint is live at once). */
export const WALK = {
   DURATION: 0.7,
   FROM: { x: 1.35, y: 0, z: -0.45 },
   TO: { x: 2.4, y: 0, z: -0.45 },
} as const;

export const CRADLE = WALK.FROM;
export const SCRAP_BIN = { x: 0, y: 0.2, z: 0.95 } as const;
export const BOARD = { x: 0, y: 1.45, z: -0.95, width: 2.6, height: 0.85 } as const;

// ---------- parts and blueprints ----------

export const KINDS = ["torso", "cell", "head", "arm"] as const;
export type KindName = (typeof KINDS)[number];
export const KIND = { torso: 0, cell: 1, head: 2, arm: 3 } as const;
export const COLOURS = ["sky", "amber", "coral", "lime"] as const;

/** The 9 silhouettes. Each (kind, colour) pair has exactly one, so the blueprint icon is the part. */
export const SHAPES = ["barrel", "crate", "battery", "dome", "boxHead", "antenna", "claw", "wrench", "drill"] as const;
export type ShapeName = (typeof SHAPES)[number];
export const SHAPE_OF: readonly (readonly number[])[] = [
   [0, 1, 0, 1], // torso: sky barrel, amber crate, coral barrel, lime crate
   [2, 2, 2, 2], // cell: battery
   [3, 4, 5, 3], // head: dome, box, antenna, dome
   [6, 7, 8, 6], // arm: claw, wrench, drill, claw
];
/** Part sizes (m, the tallest side): torso 0.50, the rest 0.45. */
export const SHAPE_SIZE = [0.5, 0.5, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45] as const;

const PLAN_3 = [KIND.torso, KIND.cell, KIND.head];
const PLAN_4 = [KIND.torso, KIND.cell, KIND.head, KIND.arm];
const PLAN_5 = [KIND.torso, KIND.cell, KIND.head, KIND.arm, KIND.arm];

/** Parts in robot r's blueprint: 3, 3, 4, 4, 4, then 5. */
export function blueprintSize(r: number): number {
   return r <= 1 ? 3 : r <= 4 ? 4 : 5;
}

/** m/s after r completed robots. Defaults to level 1 (BELT.V0 / V1 / GROWTH / V_MAX). */
export function beltSpeed(r: number, level: FactoryLevel = LEVELS[1]): number {
   if (r <= 0) return level.v0;
   return Math.min(level.vMax, level.v1 * Math.pow(level.growth, r - 1));
}

/** Points for an installed part with `combo` clean installs before it. */
export function partPoints(combo: number): number {
   return SCORING.PART_BASE + SCORING.COMBO_STEP * Math.min(SCORING.COMBO_MAX, Math.max(0, combo));
}

/** Blueprints generated per run; 90 s holds at most 12 robots (README proof), so 24 never runs out. */
export const MAX_ROBOTS = 24;

export interface Part {
   active: boolean;
   uid: number;
   kind: number;
   colour: number;
   shape: number;
   faulty: boolean;
   /** a needed-lattice part (the only kind that can ever be installed) */
   needed: boolean;
   /** the global blueprint step a needed part was spawned for, else -1 */
   step: number;
   feeder: boolean;
   /** arc length on its own belt */
   s: number;
   /** arc length on the main belt's scale (feeder parts: s - FEEDER_OFFSET) */
   sEq: number;
   /** beyond the grab zone: no longer grabbable */
   passed: boolean;
   /** s left of a wrong-grab bounce (visual) */
   hop: number;
   spawnT: number;
   x: number;
   y: number;
   z: number;
}

export type EventKind = "spawn" | "install" | "robot" | "wrong" | "strike" | "scrapFault" | "scrapClean" | "missed" | "zap" | "drop";

export interface RunEvent {
   kind: EventKind;
   x: number;
   y: number;
   z: number;
   points: number;
   uid: number;
   /** the part's kind (KIND) */
   part: number;
   shape: number;
   colour: number;
   /** install: the blueprint slot filled; robot: the robot's number (1-based) */
   slot: number;
   needed: boolean;
   faulty: boolean;
   t: number;
}

export interface FrameInput {
   grab: boolean;
   scrap: boolean;
   /** the part locked by the press (uid), or -1: the grab-zone part nearest the claw */
   target: number;
}

export const NO_INPUT: Readonly<FrameInput> = { grab: false, scrap: false, target: -1 };

export interface Run {
   seed: number;
   /** the shift this run plays (level 1 when createRun is called with a seed only) */
   level: FactoryLevel;
   rng: RngState;
   t: number;
   over: boolean;
   outcome: "win" | "lose" | null;
   parts: Part[];
   nextUid: number;
   /** robots completed (= the current blueprint's index) */
   robot: number;
   stepIndex: number;
   combo: number;
   lockout: number;
   /** what started the lockout (visual): wrong, strike, zap, scrap */
   lockoutKind: "none" | "wrong" | "strike" | "zap" | "scrap";
   score: number;
   partsInstalled: number;
   faultsScrapped: number;
   strikes: number;
   wrongGrabs: number;
   cleanScraps: number;
   neededMissed: number;
   skippedSpawns: number;
   /** next needed slot k (spawns at k * PERIOD) and next non-needed slot k (k * PERIOD + HALF) */
   neededSlot: number;
   otherSlot: number;
   lastFaultT: number;
   lateOthers: number;
   /** blueprints, flattened by global step */
   stepKind: Int8Array;
   stepColour: Int8Array;
   robotStart: Int16Array;
   /** (kind * 4 + colour) pairs a non-needed part may take now */
   allowed: Int8Array;
   allowedCount: number;
   /** s since the last robot was completed (Infinity before the first) */
   walkT: number;
   events: RunEvent[];
   eventCount: number;
}

const EVENT_CAP = 24;

function blankPart(): Part {
   return {
      active: false, uid: -1, kind: 0, colour: 0, shape: 0, faulty: false, needed: false, step: -1, feeder: false,
      s: 0, sEq: 0, passed: false, hop: 0, spawnT: 0, x: 0, y: 0, z: 0,
   };
}

function blankEvent(): RunEvent {
   return { kind: "spawn", x: 0, y: 0, z: 0, points: 0, uid: -1, part: 0, shape: 0, colour: 0, slot: 0, needed: false, faulty: false, t: 0 };
}

export function createRun(seed: number, level: FactoryLevel = LEVELS[1]): Run {
   const s = seed >>> 0;
   let total = 0;
   const robotStart = new Int16Array(MAX_ROBOTS + 1);
   for (let r = 0; r < MAX_ROBOTS; r++) {
      robotStart[r] = total;
      total += blueprintSize(r);
   }
   robotStart[MAX_ROBOTS] = total;
   const stepKind = new Int8Array(total);
   const stepColour = new Int8Array(total);
   // blueprints come from their own stream, so they do not depend on how the run is played
   const plan: RngState = { s: (s ^ 0x5bd1e995) >>> 0 };
   for (let r = 0; r < MAX_ROBOTS; r++) {
      const kinds = blueprintSize(r) === 3 ? PLAN_3 : blueprintSize(r) === 4 ? PLAN_4 : PLAN_5;
      let first = -1;
      for (let i = 0; i < kinds.length; i++) {
         let c = Math.floor(rngNext(plan) * 4);
         const roll = Math.floor(rngNext(plan) * 3);
         // the second arm never repeats the first one's colour (one pair, one slot)
         if (kinds[i] === KIND.arm) {
            if (first >= 0 && c === first) c = (c + 1 + roll) % 4;
            if (first < 0) first = c;
         }
         stepKind[robotStart[r] + i] = kinds[i];
         stepColour[robotStart[r] + i] = c;
      }
   }
   const run: Run = {
      seed: s,
      level,
      rng: { s },
      t: 0,
      over: false,
      outcome: null,
      parts: Array.from({ length: STREAM.MAX_PARTS }, blankPart),
      nextUid: 1,
      robot: 0,
      stepIndex: 0,
      combo: 0,
      lockout: 0,
      lockoutKind: "none",
      score: 0,
      partsInstalled: 0,
      faultsScrapped: 0,
      strikes: 0,
      wrongGrabs: 0,
      cleanScraps: 0,
      neededMissed: 0,
      skippedSpawns: 0,
      neededSlot: 1,
      otherSlot: 0,
      lastFaultT: -Infinity,
      lateOthers: 0,
      stepKind,
      stepColour,
      robotStart,
      allowed: new Int8Array(16),
      allowedCount: 0,
      walkT: Infinity,
      events: Array.from({ length: EVENT_CAP }, blankEvent),
      eventCount: 0,
   };
   rebuildAllowed(run);
   // needed part 1 is already on the belt when play starts
   spawnPart(run, 0, stepKind[0], stepColour[0], false, true, false, 0, STREAM.FIRST_S);
   run.eventCount = 0;
   return run;
}

// ---------- queries ----------

/** The global index of the step the player is on. */
export const progress = (run: Run): number => run.robotStart[Math.min(run.robot, MAX_ROBOTS - 1)] + run.stepIndex;
export const currentKind = (run: Run): number => run.stepKind[progress(run)];
export const currentColour = (run: Run): number => run.stepColour[progress(run)];

export function inZone(part: Part): boolean {
   return part.active && !part.passed && part.sEq >= BELT.GRAB_MIN && part.sEq <= BELT.GRAB_MAX;
}

/** Would grabbing this part install it now (the belt's highlight ring)? */
export function isWanted(run: Run, part: Part): boolean {
   return part.active && !part.faulty && part.kind === currentKind(run) && part.colour === currentColour(run);
}

/** The pair index (kind * 4 + colour) of global step g. */
const pairOf = (run: Run, g: number) => run.stepKind[g] * 4 + run.stepColour[g];

/** Non-needed parts never take a pair of the current or the next blueprint. */
function rebuildAllowed(run: Run): void {
   let banned = 0;
   const r = Math.min(run.robot, MAX_ROBOTS - 2);
   for (let g = run.robotStart[r]; g < run.robotStart[r + 2]; g++) banned |= 1 << pairOf(run, g);
   run.allowedCount = 0;
   for (let p = 0; p < 16; p++) if (!(banned & (1 << p))) run.allowed[run.allowedCount++] = p;
}

/** True if pair p (kind * 4 + colour) is in robot r's blueprint. */
export function blueprintHas(run: Run, r: number, pair: number): boolean {
   for (let g = run.robotStart[r]; g < run.robotStart[r + 1]; g++) if (pairOf(run, g) === pair) return true;
   return false;
}

function pushEvent(run: Run, kind: EventKind, part: Part | null, points = 0, slot = 0): void {
   if (run.eventCount >= EVENT_CAP) return;
   const e = run.events[run.eventCount++];
   e.kind = kind;
   e.points = points;
   e.slot = slot;
   e.t = run.t;
   if (part) {
      e.x = part.x;
      e.y = part.y;
      e.z = part.z;
      e.uid = part.uid;
      e.part = part.kind;
      e.shape = part.shape;
      e.colour = part.colour;
      e.needed = part.needed;
      e.faulty = part.faulty;
   } else {
      e.x = CRADLE.x;
      e.y = CRADLE.y;
      e.z = CRADLE.z;
      e.uid = -1;
      e.needed = false;
      e.faulty = false;
   }
}

function placeOn(part: Part, s: number): void {
   part.s = s;
   part.sEq = part.feeder ? s - FEEDER_OFFSET : s;
   pointAt(part.feeder ? FEEDER_BELT : MAIN_BELT, s, part);
}

function spawnPart(run: Run, slotT: number, kind: number, colour: number, faulty: boolean, needed: boolean, feeder: boolean, step: number, s: number): Part | null {
   let part: Part | null = null;
   for (const p of run.parts) {
      if (!p.active) {
         part = p;
         break;
      }
   }
   if (!part) {
      run.skippedSpawns++;
      return null;
   }
   part.active = true;
   part.uid = run.nextUid++;
   part.kind = kind;
   part.colour = colour;
   part.shape = SHAPE_OF[kind][colour];
   part.faulty = faulty;
   part.needed = needed;
   part.step = step;
   part.feeder = feeder;
   part.passed = false;
   part.hop = 0;
   part.spawnT = slotT;
   placeOn(part, s);
   pushEvent(run, "spawn", part);
   return part;
}

/** The first step from the player's progress that no live needed part is riding towards the claw for. */
export function nextNeededStep(run: Run): number {
   const last = run.robotStart[MAX_ROBOTS] - 1;
   for (let g = progress(run); g < last; g++) {
      let riding = false;
      for (const p of run.parts) {
         if (p.active && p.needed && !p.passed && p.step === g) {
            riding = true;
            break;
         }
      }
      if (!riding) return g;
   }
   return last;
}

function spawnNeeded(run: Run, slotT: number, v: number): void {
   const g = nextNeededStep(run);
   spawnPart(run, slotT, run.stepKind[g], run.stepColour[g], false, true, false, g, v * (run.t - slotT));
}

function spawnOther(run: Run, slotT: number, v: number): void {
   // a fixed number of draws per slot: the fault schedule does not depend on how the run is played
   const pick = rngNext(run.rng);
   const roll = rngNext(run.rng);
   const pair = run.allowed[Math.min(run.allowedCount - 1, Math.floor(pick * run.allowedCount))];
   const level = run.level;
   const late = slotT >= STREAM.LATE_T;
   const gap = late ? STREAM.FAULT_MIN_INTERVAL_LATE : level.faultMinInterval;
   const faulty = roll < level.faultyChance && slotT >= STREAM.FIRST_FAULT_MIN_T && slotT - run.lastFaultT >= gap;
   if (faulty) run.lastFaultT = slotT;
   let feeder = false;
   if (slotT >= level.feederT) feeder = run.lateOthers++ % 2 === 0;
   spawnPart(run, slotT, pair >> 2, pair & 3, faulty, false, feeder, -1, v * (run.t - slotT));
}

/** The part a press acts on: the locked uid if it is still in the grab zone, else the zone part nearest the claw. */
export function pickTarget(run: Run, uid: number): Part | null {
   if (uid >= 0) {
      for (const p of run.parts) if (p.uid === uid && inZone(p)) return p;
   }
   let best: Part | null = null;
   let bestD = Infinity;
   for (const p of run.parts) {
      if (!inZone(p)) continue;
      const d = Math.abs(p.sEq - BELT.CLAW_S);
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && best && p.sEq > best.sEq)) {
         best = p;
         bestD = d;
      }
   }
   return best;
}

function lock(run: Run, seconds: number, kind: Run["lockoutKind"]): void {
   if (seconds >= run.lockout) {
      run.lockout = seconds;
      run.lockoutKind = kind;
   }
}

function grab(run: Run, part: Part): void {
   if (part.faulty) {
      // the part shorts out on the claw and drops into the bin: one part, one strike
      part.active = false;
      run.strikes++;
      run.combo = 0;
      lock(run, CLAW.FAULT_LOCKOUT, "strike");
      pushEvent(run, "strike", part, 0, run.strikes);
      if (run.strikes >= SHIFT.LIVES) {
         run.over = true;
         run.outcome = "lose";
      }
      return;
   }
   if (!isWanted(run, part)) {
      run.wrongGrabs++;
      run.combo = 0;
      run.stepIndex = 0;
      part.hop = CLAW.BOUNCE;
      lock(run, CLAW.WRONG_LOCKOUT, "wrong");
      pushEvent(run, "wrong", part);
      return;
   }
   part.active = false;
   const points = partPoints(run.combo);
   run.combo = Math.min(SCORING.COMBO_MAX, run.combo + 1);
   run.score += points;
   run.partsInstalled++;
   pushEvent(run, "install", part, points, run.stepIndex);
   run.stepIndex++;
   if (run.stepIndex >= blueprintSize(run.robot)) {
      run.robot = Math.min(MAX_ROBOTS - 2, run.robot + 1);
      run.stepIndex = 0;
      run.score += SCORING.ROBOT_BONUS;
      run.walkT = 0;
      rebuildAllowed(run);
      pushEvent(run, "robot", null, SCORING.ROBOT_BONUS, run.robot);
   }
}

function scrap(run: Run, part: Part): void {
   part.active = false;
   if (part.faulty) {
      run.faultsScrapped++;
      pushEvent(run, "scrapFault", part);
      return;
   }
   run.cleanScraps++;
   run.combo = 0;
   lock(run, CLAW.SCRAP_LOCKOUT, "scrap");
   pushEvent(run, "scrapClean", part);
}

function advanceParts(run: Run, ds: number, dt: number): void {
   for (const p of run.parts) {
      if (!p.active) continue;
      if (p.hop > 0) p.hop = Math.max(0, p.hop - dt);
      let s = p.s + ds;
      if (p.feeder && s >= FEEDER_BELT.total) {
         p.feeder = false;
         s = BELT.S_MERGE + (s - FEEDER_BELT.total);
      }
      placeOn(p, s);
      if (!p.passed && p.sEq > BELT.GRAB_MAX) {
         p.passed = true;
         if (p.faulty) {
            run.combo = 0;
            lock(run, CLAW.ZAP_LOCKOUT, "zap");
            pushEvent(run, "zap", p);
         } else if (isWanted(run, p)) {
            run.combo = 0;
            run.neededMissed++;
            pushEvent(run, "missed", p);
         }
      }
      if (p.sEq >= MAIN_BELT.total) {
         p.active = false;
         pushEvent(run, "drop", p);
      }
   }
}

/**
 * One frame of play: the press (against what the player saw), then the belts, then the spawn
 * lattice, then the clock. `dt` is useRunFrame's played time; the last step is clamped to the
 * shift (level 1: 90 s). Events of this frame are in run.events[0 .. eventCount).
 */
export function stepRun(run: Run, input: Readonly<FrameInput>, dt: number): void {
   run.eventCount = 0;
   if (run.over) return;
   const level = run.level;
   const step = Math.min(dt, level.duration - run.t);
   if (!(step > 0)) {
      finish(run);
      return;
   }
   run.lockout = Math.max(0, run.lockout - step);
   if (run.lockout === 0) run.lockoutKind = "none";
   if (run.walkT < 10) run.walkT += step;

   if (run.lockout <= 0 && input.grab) {
      const part = pickTarget(run, input.target);
      if (part) grab(run, part);
   }
   if (!run.over && run.lockout <= 0 && input.scrap) {
      const part = pickTarget(run, input.target);
      if (part) scrap(run, part);
   }
   if (run.over) return;

   const v = beltSpeed(run.robot, level);
   advanceParts(run, v * step, step);
   run.t += step;
   // at most one slot of each kind per frame (dt <= 0.05 s < half, and half is at least 0.7), in time order
   const needT = run.neededSlot * level.period;
   const otherT = run.otherSlot * level.period + level.half;
   if (otherT <= needT) {
      if (otherT <= run.t + 1e-9) {
         spawnOther(run, otherT, v);
         run.otherSlot++;
      }
      if (needT <= run.t + 1e-9) {
         spawnNeeded(run, needT, v);
         run.neededSlot++;
      }
   } else {
      if (needT <= run.t + 1e-9) {
         spawnNeeded(run, needT, v);
         run.neededSlot++;
      }
      if (otherT <= run.t + 1e-9) {
         spawnOther(run, otherT, v);
         run.otherSlot++;
      }
   }
   if (run.t >= level.duration - 1e-9) finish(run);
}

function finish(run: Run): void {
   if (run.over) return;
   run.t = run.level.duration;
   run.over = true;
   run.outcome = run.robot >= run.level.winQuota ? "win" : "lose";
}

/** Seconds left on the shift clock. */
export const timeLeft = (run: Run): number => Math.max(0, run.level.duration - run.t);

/** The store calls a frame makes (the arcade store's actions; rules.test.ts passes a createArcadeStore()). */
export interface StoreActions {
   addScore(delta: number): void;
   setScore(value: number): void;
   setStat(key: string, value: number): void;
   setLevel(level: number): void;
   loseLife(): void;
   end(reason: "win" | "lose"): void;
}

/** What the HUD shows, so a stat is only written when it changes (no store update per frame). */
export interface ShownStats {
   robots: number;
   combo: number;
   time: number;
}

export const createShown = (): ShownStats => ({ robots: -1, combo: -1, time: -1 });

/**
 * After stepRun: points as they are earned, a life per strike (the 3rd ends the run in the store),
 * the HUD stats, and the end of the shift. Scene.tsx and the bot tests share it.
 */
export function syncStore(run: Run, store: StoreActions, shown: ShownStats): void {
   for (let i = 0; i < run.eventCount; i++) {
      const e = run.events[i];
      if (e.kind === "install" || e.kind === "robot") store.addScore(e.points);
      else if (e.kind === "strike") store.loseLife();
   }
   if (shown.robots !== run.robot) {
      shown.robots = run.robot;
      store.setStat("robots", run.robot);
      store.setLevel(run.robot + 1);
   }
   if (shown.combo !== run.combo) {
      shown.combo = run.combo;
      store.setStat("combo", run.combo);
   }
   const time = Math.ceil(timeLeft(run) - 1e-9);
   if (shown.time !== time) {
      shown.time = time;
      store.setStat("time", time);
   }
   if (run.over && run.outcome) {
      store.setScore(run.score);
      // a 3rd strike already ended the run through loseLife; end() is idempotent anyway
      store.end(run.outcome);
   }
}

// ---------- test and tooling helpers (pure) ----------

/** Puts a part on the main belt at sEq (tests): returns it, or null when the pool is full. */
export function placePart(run: Run, kind: number, colour: number, sEq: number, faulty = false): Part | null {
   const part = spawnPart(run, run.t, kind, colour, faulty, false, false, -1, sEq);
   run.eventCount = 0;
   return part;
}

/** Turns off the spawn lattice and clears the belt (tests that place their own parts). */
export function quietRun(seed = 1): Run {
   const run = createRun(seed);
   for (const p of run.parts) p.active = false;
   run.neededSlot = 1e9;
   run.otherSlot = 1e9;
   return run;
}

// ---------- scoring limits (README "Server limits and why they hold") ----------

/** The most points M installed parts and R robots can give: every part at the best combo it can have. */
export function perfectScore(m: number, r: number): number {
   let points = 0;
   for (let i = 0; i < m; i++) points += partPoints(i);
   return points + SCORING.ROBOT_BONUS * r;
}

/** Robots completed by M installed parts at best. */
export function robotsFor(m: number): number {
   let r = 0;
   let used = 0;
   while (r < MAX_ROBOTS && used + blueprintSize(r) <= m) used += blueprintSize(r++);
   return r;
}

/** The most needed parts that can reach the grab zone by time t (s): the lattice at the level's top speed. */
export function maxInstalls(t: number, level: FactoryLevel = LEVELS[1]): number {
   const first = (BELT.GRAB_MIN - STREAM.FIRST_S) / level.v0;
   if (t < first) return 0;
   const travel = BELT.GRAB_MIN / level.vMax;
   return 1 + Math.max(0, Math.floor((t - travel) / level.period + 1e-9));
}

/**
 * The 3rd faulty part never reaches the claw before this (s): the earliest a run can end.
 * Level 1 is the module constant below (rules.test.ts pins 10.331).
 */
export function earliestLossS(level: FactoryLevel = LEVELS[1]): number {
   return STREAM.FIRST_FAULT_MIN_T + 2 * level.faultMinInterval + BELT.GRAB_MIN / level.vMax;
}

/** Level 1's earliest loss (s). Kept as its own constant so the existing proof stays literal. */
export const EARLIEST_LOSS_S = STREAM.FIRST_FAULT_MIN_T + 2 * STREAM.FAULT_MIN_INTERVAL + BELT.GRAB_MIN / BELT.V_MAX;

/** Proposed tight limits for level 1 (Claude sets meta.scoring + arcade-games.json at merge). */
export const PROPOSED_LIMITS: ScoringRules = {
   kind: "points",
   maxScore: 4750,
   minDurationMs: 10_000,
   maxDurationMs: 92_000,
   base: 300,
   maxPointsPerSec: 52,
   unitLabel: "pts",
   display: "int",
};

const proposed = (
   maxScore: number,
   minDurationMs: number,
   maxDurationMs: number,
   maxPointsPerSec: number,
): ScoringRules => ({ ...PROPOSED_LIMITS, maxScore, minDurationMs, maxDurationMs, maxPointsPerSec });

/**
 * One proof per level (README "Levels"). Level 1 is PROPOSED_LIMITS. Claude copies levels 2-5 into
 * meta.ts (already there) and arcade-games.json at merge; level 1's meta.scoring stays the
 * provisional 6000 set until that copy.
 * - L2/L3: M(120) = 75, R = 16, perfectScore = 6140. Same period and V_MAX as L1, so B(t) <= 50 t + 264.
 * - L4: same 6140 (V_MAX 3.0 does not reach the next lattice part by 120 s). Earliest loss 8.833 s.
 * - L5: period 1.4 → M(120) = 86, R = 18, perfectScore = 6980. Rate 80/1.4 = 57.14 <= 60.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: PROPOSED_LIMITS,
   2: proposed(6370, 10_000, 122_000, 52),
   3: proposed(6370, 10_000, 122_000, 52),
   4: proposed(6370, 8_500, 122_000, 52),
   5: proposed(7260, 8_500, 122_000, 60),
};

export function withinServerLimits(score: number, durationMs: number, rules: ScoringRules = PROPOSED_LIMITS): boolean {
   return fitsLimits(score, durationMs, rules);
}

export function capScore(score: number, durationMs: number, rules: ScoringRules = PROPOSED_LIMITS): number {
   return capToLimits(score, durationMs, rules);
}

