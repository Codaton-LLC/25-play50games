// Mini Golf rules (README "Rules", "Scoring", "Run end"): the run's course, the fixed 120 Hz tick
// (two 240 Hz ball sub-steps each), putts, strokes and the par + 4 pick-up, water penalties, the
// hole-out pause, hole scores and the 10-minute run cap. Pure and deterministic: no three.js,
// React, DOM, Math.random or Date.now. Scene.tsx calls advanceRun once per frame and syncStore for
// the store; rules.test.ts drives the same two functions through the real store.
import { createFixedStep, fixedStep, type FixedStepState } from "@/arcade3d/core/kinematics";
import { HOLE_COUNT, WINDMILL, generateCourse, type Hole, type P2 } from "./course";
import { BALL, clearBallEvents, createBall, createBallEvents, inTunnel, launchBall, placeBall, stepBall, type Ball, type BallEvents } from "./physics";

/** Timing (README "Fixed tick", "Hole out", "Run cap"). */
export const TICK = {
   hz: 120,
   /** ball sub-steps per tick (240 Hz) */
   sub: 2,
   /** a putt is accepted this long after the previous stroke ended (s) */
   ready: 0.5,
   /** from the capture (or pick-up) to the next hole taking a putt (s): the drop, then the fly-over */
   holeOut: 2.0,
   drop: 0.6,
   /** a stroke still moving after this (s, pipe time excluded) ends at the last rest point */
   guard: 20,
} as const;
export const TICK_S = 1 / TICK.hz;
const SUB_S = TICK_S / TICK.sub;
const READY_TICKS = Math.round(TICK.ready * TICK.hz);
const HOLE_OUT_TICKS = Math.round(TICK.holeOut * TICK.hz);
const GUARD_TICKS = Math.round(TICK.guard * TICK.hz);

/** The run ends at this much play (s); the HUD shows the time left from RUN.warnAt. */
export const RUN = { capS: 600, warnAt: 540 } as const;
/** Strokes over par before the ball is picked up (README "Strokes"). */
export const PICK_UP_OVER = 4;
export const POWER_MIN = 0.1;

/** A hole's score: 100 per stroke under par + 3, +200 for a hole in one. */
export function holeScore(par: number, strokes: number): number {
   return 100 * Math.max(0, par + 3 - strokes) + (strokes === 1 ? 200 : 0);
}

export type RunPhase = "aim" | "moving" | "holeOut" | "done";

export interface RunEvents extends BallEvents {
   /** a putt started this frame: its power */
   putt: number;
   /** a stroke ended at rest or in the water */
   strokeEnded: boolean;
   /** a resting ball was put back (tunnel) or the 20 s guard ended a stroke */
   placedBack: boolean;
   /** a hole was finished this frame: its index, strokes and score */
   holeOut: number;
   holeStrokes: number;
   holeScore: number;
   pickedUp: boolean;
   /** the next hole opened (index), -1 = none */
   holeOpened: number;
   win: boolean;
   timeup: boolean;
}

export interface RunState {
   seed: number;
   course: Hole[];
   /** index of the hole being played (0-5) */
   hole: number;
   ball: Ball;
   phase: RunPhase;
   strokes: number;
   /** per hole: strokes taken and score (-1 = not finished) */
   card: number[];
   cardScores: number[];
   total: number;
   /** play time (s), the sum of the frames' dt */
   time: number;
   /** ticks since the current hole opened (the windmill's and the bar's clock) */
   holeTicks: number;
   /** ticks since the stroke ended (aim), since the capture (holeOut), of the stroke in play (moving, pipes excluded) */
   readyTicks: number;
   outTicks: number;
   strokeTicks: number;
   lastRest: { x: number; z: number; upper: boolean };
   pending: { on: boolean; psi: number; power: number };
   /** the tick a putt of this hole started on (tests) */
   puttTick: number;
   over: boolean;
   won: boolean;
   events: RunEvents;
   clock: FixedStepState;
   /** the fastest the ball went this run (tests) */
   topSpeed: number;
   tick: (dt: number) => void;
}

function createEvents(): RunEvents {
   return clearEvents({ ...createBallEvents() } as RunEvents);
}

function clearEvents(ev: RunEvents): RunEvents {
   clearBallEvents(ev);
   ev.putt = 0;
   ev.strokeEnded = false;
   ev.placedBack = false;
   ev.holeOut = -1;
   ev.holeStrokes = 0;
   ev.holeScore = 0;
   ev.pickedUp = false;
   ev.holeOpened = -1;
   ev.win = false;
   ev.timeup = false;
   return ev;
}

export const currentHole = (run: RunState): Hole => run.course[run.hole];
/** The hole's play time (s) the moving walls turn with. */
export const holeTime = (run: RunState): number => run.holeTicks * TICK_S;
/** Can a putt be taken now? */
export const canPutt = (run: RunState): boolean => run.phase === "aim" && run.readyTicks >= READY_TICKS && !run.pending.on && !run.over;
/** 0..1: how far the ready ring has filled. */
export const readiness = (run: RunState): number => (run.phase === "aim" ? Math.min(1, run.readyTicks / READY_TICKS) : 0);

export function createRun(seed: number, course: Hole[] = generateCourse(seed)): RunState {
   const first = course[0];
   const run: RunState = {
      seed,
      course,
      hole: 0,
      ball: createBall(first.tee, first.terrain === "tiers"),
      phase: "aim",
      strokes: 0,
      card: new Array<number>(HOLE_COUNT).fill(-1),
      cardScores: new Array<number>(HOLE_COUNT).fill(-1),
      total: 0,
      time: 0,
      holeTicks: 0,
      readyTicks: READY_TICKS,
      outTicks: 0,
      strokeTicks: 0,
      lastRest: { x: first.tee.x, z: first.tee.z, upper: first.terrain === "tiers" },
      pending: { on: false, psi: 0, power: 0 },
      puttTick: -1,
      over: false,
      won: false,
      events: createEvents(),
      clock: createFixedStep(TICK_S),
      topSpeed: 0,
      tick: () => undefined,
   };
   placeBall(first, run.ball, first.tee, run.lastRest.upper);
   run.tick = () => tick(run);
   return run;
}

/**
 * One frame: `dt` play seconds, the aim (world heading psi, power 0.1-1) and whether the player
 * released a putt this frame. The putt starts on the next tick; ticks run at a fixed 120 Hz (the
 * remainder carries to the next frame), so the outcome never depends on the frame rate.
 */
export function advanceRun(run: RunState, dt: number, psi: number, power: number, putt: boolean): void {
   clearEvents(run.events);
   if (run.over || !(dt > 0)) return;
   run.time += dt;
   if (putt && canPutt(run)) {
      run.pending.on = true;
      run.pending.psi = psi;
      run.pending.power = Math.max(POWER_MIN, Math.min(1, power));
   }
   fixedStep(run.clock, dt, run.tick);
   if (!run.over && run.time >= RUN.capS) {
      run.over = true;
      run.phase = "done";
      run.events.timeup = true;
   }
}

function tick(run: RunState): void {
   if (run.over) return;
   const hole = currentHole(run);
   const ev = run.events;
   if (run.phase === "aim" && run.pending.on) {
      run.pending.on = false;
      run.strokes += 1;
      run.strokeTicks = 0;
      run.puttTick = run.holeTicks;
      launchBall(run.ball, run.pending.psi, BALL.vMax * run.pending.power);
      run.phase = "moving";
      ev.putt = run.pending.power;
   }
   if (run.phase === "moving") {
      const b = run.ball;
      for (let k = 0; k < TICK.sub; k++) {
         const t = (run.holeTicks * TICK.sub + k) * SUB_S;
         const live = stepBall(hole, b, t, SUB_S, ev);
         const v = Math.hypot(b.vx, b.vz);
         if (v > run.topSpeed) run.topSpeed = v;
         if (!live) {
            endStroke(run, hole);
            break;
         }
      }
      if (run.phase === "moving" && b.mode !== "pipe" && ++run.strokeTicks >= GUARD_TICKS) {
         ev.placedBack = true;
         placeBall(hole, b, run.lastRest, run.lastRest.upper);
         strokeOver(run, hole);
      }
   } else if (run.phase === "aim") {
      run.readyTicks += 1;
   } else if (run.phase === "holeOut" && ++run.outTicks >= HOLE_OUT_TICKS) {
      openHole(run, run.hole + 1);
   }
   run.holeTicks += 1;
}

function endStroke(run: RunState, hole: Hole): void {
   const b = run.ball;
   const ev = run.events;
   if (ev.captured) {
      holeOut(run, hole, false);
      return;
   }
   if (ev.water) {
      run.strokes += 1;
      placeBall(hole, b, run.lastRest, run.lastRest.upper);
   } else {
      if (inTunnel(hole, b)) {
         placeBall(hole, b, { x: WINDMILL.entrance.x * hole.sx, z: WINDMILL.entrance.z }, false);
         ev.placedBack = true;
      }
      run.lastRest.x = b.x;
      run.lastRest.z = b.z;
      run.lastRest.upper = b.upper;
   }
   strokeOver(run, hole);
}

function strokeOver(run: RunState, hole: Hole): void {
   run.events.strokeEnded = true;
   const cap = hole.par + PICK_UP_OVER;
   if (run.strokes >= cap) {
      run.strokes = cap;
      holeOut(run, hole, true);
      return;
   }
   run.phase = "aim";
   run.readyTicks = 0;
}

function holeOut(run: RunState, hole: Hole, pickedUp: boolean): void {
   const ev = run.events;
   const score = holeScore(hole.par, run.strokes);
   run.card[run.hole] = run.strokes;
   run.cardScores[run.hole] = score;
   run.total += score;
   ev.holeOut = run.hole;
   ev.holeStrokes = run.strokes;
   ev.holeScore = score;
   ev.pickedUp = pickedUp;
   if (run.hole === HOLE_COUNT - 1) {
      run.over = true;
      run.won = true;
      run.phase = "done";
      ev.win = true;
      return;
   }
   run.phase = "holeOut";
   run.outTicks = 0;
}

function openHole(run: RunState, index: number): void {
   const hole = run.course[index];
   run.hole = index;
   run.strokes = 0;
   run.holeTicks = -1; // tick() adds one: the hole opens at tick 0
   run.readyTicks = READY_TICKS;
   run.phase = "aim";
   run.puttTick = -1;
   const upper = hole.terrain === "tiers";
   run.lastRest.x = hole.tee.x;
   run.lastRest.z = hole.tee.z;
   run.lastRest.upper = upper;
   placeBall(hole, run.ball, hole.tee, upper);
   run.events.holeOpened = index;
}

/** What GameShell's store needs from a run (the Scene and the bots call the same store actions). */
export interface StoreActions {
   addScore(points: number): void;
   setStat(key: string, value: number): void;
   end(reason: "win" | "lose" | "timeup"): void;
}

/** The store side of this frame's events: hole scores, the HUD stats, the run's end. */
export function syncStore(run: RunState, store: StoreActions): void {
   const ev = run.events;
   if (ev.holeOut >= 0) {
      store.addScore(ev.holeScore);
      store.setStat(`h${ev.holeOut + 1}`, ev.holeStrokes);
   }
   const hole = currentHole(run);
   store.setStat("hole", run.hole + 1);
   store.setStat("par", hole.par);
   store.setStat("strokes", run.strokes);
   if (run.time >= RUN.warnAt) store.setStat("timeLeft", Math.max(0, Math.ceil(RUN.capS - run.time)));
   if (ev.win) store.end("win");
   else if (ev.timeup) store.end("timeup");
}

/** Where the ball is in the world-free hole frame (for the camera follow and the preview). */
export function ballPoint(run: RunState, out: P2): P2 {
   out.x = run.ball.x;
   out.z = run.ball.z;
   return out;
}
