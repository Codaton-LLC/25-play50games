import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { museumGuardMeta } from "./meta";
import {
   BEAM, COAST, EXITS, FIXTURE_STARTS, FLASH, PHASES, RING, SCORE, TURN_RATE, TYPES,
   beamHalf, bothExitsInCone, centreRadius, createFixture, createRun, finalScore, footHeight, inPedestalSquare,
   makePedestal, phaseIndex, pointOnPath, runScore, stepGame, wrapAngle,
   type Exhibit, type GuardInput, type Run,
} from "./rules";

const DT = 1 / 60;
const LIMITS = museumGuardMeta.scoring;
const ZERO: GuardInput = { moveX: 0, pointerX: null, dragYaw: null, coarse: false, flash: false };

function input(partial: Partial<GuardInput> = {}): GuardInput {
   return { ...ZERO, ...partial };
}

/** Step a fresh-clock run. `at` is the clock at the start (the first frame ends at at + dt). */
function stepUntil(run: Run, seconds: number, apply: (input: GuardInput, t: number) => void, at = 0, dt = DT): number {
   const live = input();
   let t = at;
   const end = at + seconds;
   while (t < end - 1e-9 && !run.outcome) {
      apply(live, t);
      const h = Math.min(dt, end - t);
      t += h;
      stepGame(run, live, h, t);
   }
   return t;
}

function sneak(run: Run, index: number, kind: Exhibit["kind"] = run.exhibits[index].kind): Exhibit {
   const ex = run.exhibits[index];
   ex.kind = kind;
   ex.mode = "sneaking";
   ex.s = 0;
   ex.hold = 0;
   ex.coast = 0;
   ex.wasSeen = false;
   return ex;
}

describe("museum-guard geometry", () => {
   it("puts four short paths at 2.842 m and four long ones at 6.926 m", () => {
      const lengths = Array.from({ length: 8 }, (_, i) => makePedestal(i).length);
      expect(lengths.filter((len) => Math.abs(len - 2.842) < 0.001)).toHaveLength(4);
      expect(lengths.filter((len) => Math.abs(len - 6.926) < 0.001)).toHaveLength(4);
      for (const ped of lengths.map((_, i) => makePedestal(i))) {
         const end = pointOnPath(ped, ped.length);
         expect(Math.hypot(end.x - ped.exitX, end.z - ped.exitZ)).toBeLessThan(1e-9);
         expect(Math.hypot(pointOnPath(ped, 0).x, pointOnPath(ped, 0).z)).toBeCloseTo(6, 6);
      }
   });

   it("keeps the inner lane off every pedestal square and the foot on the ramp", () => {
      for (let i = 0; i < 8; i++) {
         const ped = makePedestal(i);
         for (let s = RING.inward; s <= ped.length; s += 0.05) {
            const p = pointOnPath(ped, s);
            expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(5.2 - 1e-9);
            for (let k = 0; k < 8; k++) expect(inPedestalSquare(makePedestal(k), p.x, p.z)).toBe(false);
         }
      }
      expect(footHeight(0)).toBe(0.8);
      expect(footHeight(0.2)).toBeCloseTo(0.4, 6);
      expect(footHeight(0.4)).toBe(0);
      expect(footHeight(2)).toBe(0);
   });

   it("deals two of each statue, the same way for the same seed, over 1,000 seeds", () => {
      for (let seed = 0; seed < 1000; seed++) {
         const run = createRun(seed);
         const again = createRun(seed);
         const counts = { knight: 0, robot: 0, penguin: 0, dino: 0 };
         run.exhibits.forEach((ex, i) => {
            counts[ex.kind] += 1;
            expect(again.exhibits[i].kind).toBe(ex.kind);
            expect(ex.pedestal).toBe(i);
         });
         expect(counts).toEqual({ knight: 2, robot: 2, penguin: 2, dino: 2 });
      }
   });
});

describe("museum-guard cone, hold, flash", () => {
   it("freezes on the inclusive edge and not 0.01° outside", () => {
      const run = createRun(4);
      const ex = sneak(run, 0, "knight");
      const half = (16 * Math.PI) / 180;
      run.yaw = run.pedestals[0].angle - half;
      stepGame(run, ZERO, DT, DT);
      expect(ex.mode).toBe("frozen");
      expect(ex.s).toBe(0);

      const outside = createRun(4);
      const moving = sneak(outside, 0, "knight");
      outside.yaw = outside.pedestals[0].angle - half - (0.01 * Math.PI) / 180;
      stepGame(outside, ZERO, DT, DT);
      expect(moving.mode).toBe("sneaking");
      expect(moving.s).toBeGreaterThan(0);
   });

   it("resets a hold that the beam leaves, and finishes a return after the beam has gone", () => {
      const run = createRun(4);
      const ex = sneak(run, 0, "knight");
      run.yaw = run.pedestals[0].angle;
      stepUntil(run, 0.3, () => {});
      expect(ex.mode).toBe("frozen");
      expect(ex.hold).toBeGreaterThan(0.2);
      run.yaw = wrapAngle(run.yaw + Math.PI);
      stepUntil(run, 0.1, () => {}, 0.3);
      expect(ex.mode).toBe("sneaking");
      expect(ex.hold).toBe(0);
      expect(ex.s).toBeGreaterThan(0);

      const back = createRun(4);
      const knight = sneak(back, 0, "knight");
      back.yaw = back.pedestals[0].angle;
      stepUntil(back, 0.7, () => {});
      expect(knight.mode).toBe("returning");
      expect(knight.paid).toBe(true);
      back.yaw = wrapAngle(back.yaw + 2);
      stepUntil(back, 4, () => {}, 0.7);
      expect(knight.mode).toBe("still");
      expect(knight.s).toBe(0);
      expect(back.returns).toBe(1);
      expect(back.score).toBeGreaterThanOrEqual(50);
   });

   it("pays +50 only when more than 2 m remained as the return began", () => {
      for (const [left, paid] of [[2, false], [2.01, true]] as const) {
         const run = createRun(4);
         const ex = sneak(run, 0, "knight");
         const ped = run.pedestals[0];
         ex.s = ped.length - left;
         pointOnPath(ped, ex.s, ex);
         run.yaw = Math.atan2(ex.x, ex.z);
         stepUntil(run, 0.7, () => {});
         expect(ex.mode).toBe("returning");
         expect(ex.paid).toBe(paid);
      }
   });

   it("coasts a penguin 0.4 s per entry, resets the hold if the coast leaves, and still finishes the coast", () => {
      const run = createRun(4);
      const ex = sneak(run, 0, "penguin");
      run.yaw = run.pedestals[0].angle;
      stepUntil(run, COAST - DT, () => {});
      expect(ex.mode).toBe("sneaking");
      expect(ex.s).toBeCloseTo(COAST - DT, 2);
      stepUntil(run, DT, () => {}, COAST - DT);
      expect(ex.mode).toBe("frozen");
      expect(ex.s).toBeCloseTo(0.4, 2);
      stepUntil(run, 0.3, () => {}, COAST);
      expect(ex.mode).toBe("returning");

      const leave = createRun(4);
      const bird = sneak(leave, 0, "penguin");
      leave.yaw = leave.pedestals[0].angle;
      stepUntil(leave, 0.1, () => {});
      leave.yaw = wrapAngle(leave.yaw + Math.PI);
      stepUntil(leave, 0.2, () => {}, 0.1);
      expect(bird.mode).toBe("sneaking");
      expect(bird.hold).toBe(0);
      expect(bird.coast).toBeCloseTo(0.1, 2);
      expect(bird.s).toBeCloseTo(0.3, 2);
      stepUntil(leave, 0.15, () => {}, 0.3);
      expect(bird.s).toBeCloseTo(0.45, 2);
      expect(bird.coast).toBe(0);
   });

   it("locks the flash on the press yaw for 1.2 s and then rejects a press until 10 s", () => {
      const run = createRun(4);
      const ex = sneak(run, 0, "knight");
      const flashes: boolean[] = [];
      stepGame(run, input({ flash: true }), DT, DT);
      expect(run.flashYaw).toBe(0);
      expect(run.flashLeft).toBeCloseTo(1.2 - DT, 5);
      run.yaw = Math.PI / 2;
      stepUntil(run, 0.2, (live) => {
         live.flash = true;
         flashes.push(run.flashLeft > 0);
      }, DT);
      expect(ex.mode).toBe("frozen");
      expect(run.flashYaw).toBe(0);
      expect(flashes.every(Boolean)).toBe(true);
      run.starts = [6, 7, 8];
      run.yaw = run.pedestals[0].angle;
      stepUntil(run, 1.2, (live) => { live.flash = true; }, 0.3);
      expect(run.flashLeft).toBe(0);
      const before = run.cooldown;
      stepGame(run, input({ flash: true }), DT, 2);
      expect(run.flashLeft).toBe(0);
      expect(run.cooldown).toBeLessThan(before);
      stepUntil(run, 8.7, (live) => { live.flash = true; live.moveX = 0; }, 2);
      expect(run.outcome).toBeNull();
      expect(run.flashLeft).toBeGreaterThan(1);
      expect(run.flashYaw).toBeCloseTo(run.pedestals[0].angle, 5);
   });

   it("never puts both exit thresholds inside a 17° or a 45° cone", () => {
      for (let deg = 0; deg < 360; deg++) {
         const yaw = (deg * Math.PI) / 180;
         expect(bothExitsInCone(yaw, (17 * Math.PI) / 180)).toBe(false);
         expect(bothExitsInCone(yaw, FLASH.half)).toBe(false);
      }
      expect(Math.abs(wrapAngle(EXITS.pos - EXITS.neg))).toBeCloseTo(Math.PI, 6);
   });
});

describe("museum-guard director", () => {
   it("waits until 3 s, respects the phase caps and gaps, and never starts a dino early or a second short", () => {
      const run = createRun(9);
      let t = 0;
      let short = 0;
      let maxShort = 0;
      while (t < 29 && !run.outcome) {
         t += DT;
         stepGame(run, ZERO, DT, t);
         const sneaking = run.exhibits.filter((ex) => ex.mode === "sneaking");
         expect(sneaking.length).toBeLessThanOrEqual(PHASES.cap[phaseIndex(t)]);
         short = sneaking.filter((ex) => run.pedestals[ex.pedestal].length < 5).length;
         if (short > maxShort) maxShort = short;
         if (t < 3) expect(sneaking.length).toBe(0);
         for (const ex of sneaking) if (ex.kind === "dino") expect(t).toBeGreaterThanOrEqual(30);
         expect(centreRadius(run.exhibits[0])).toBeGreaterThanOrEqual(5.2 - 1e-6);
      }
      expect(maxShort).toBeLessThanOrEqual(1);
      expect(run.starts[0]).toBeLessThanOrEqual(6);
      expect(run.starts[0]).toBeGreaterThan(0);
      expect(run.lastStart).toBeGreaterThanOrEqual(3);

      const aimed = createRun(9);
      const ped = aimed.pedestals[0];
      let at = 0;
      while (at < 8) {
         at += DT;
         aimed.yaw = ped.angle;
         stepGame(aimed, ZERO, DT, at);
      }
      expect(aimed.exhibits[0].mode).toBe("still");
   });

   it("repeats a fixed yaw trace", () => {
      const once = (seed: number) => {
         const run = createRun(seed);
         let t = 0;
         while (t < 12 && !run.outcome) {
            t += DT;
            run.yaw = Math.sin(t * 0.7) * 1.4;
            stepGame(run, ZERO, DT, t);
         }
         return run.exhibits.map((ex) => `${ex.mode}:${ex.s.toFixed(3)}`).join("|") + run.score;
      };
      expect(once(15)).toBe(once(15));
      expect(once(15)).not.toBe(once(16));
   });

   it("alarms the three-penguin fixture at 13.79 s, the point at 14.24 s, and not before", () => {
      const run = createFixture();
      let t = 0;
      const dt = 0.001;
      while (!run.outcome && t < 20) {
         t += dt;
         stepGame(run, ZERO, dt, t);
      }
      expect(run.outcome).toBe("lose");
      expect(run.alarms).toBe(0);
      expect(run.returns).toBe(0);
      expect(run.alarmAt).toBeGreaterThan(13.7);
      expect(run.alarmAt).toBeCloseTo(13.79, 2);
      expect(run.pointAt).toBeCloseTo(14.24, 2);
      expect(run.score).toBe(5 * 13);
      expect(FIXTURE_STARTS[2]).toBe(11.4);
   });

   it("stays at r >= 5.2 for 20,000 steps and keeps a centre off the guard", () => {
      let steps = 0;
      let low = false;
      for (let seed = 1; steps < 20000; seed++) {
         const run = createRun(seed);
         let t = 0;
         while (steps < 20000 && t < 5 && !run.outcome) {
            t += DT;
            steps += 1;
            stepGame(run, ZERO, DT, t);
            for (const ex of run.exhibits) {
               const r = centreRadius(ex);
               if (r < RING.laneR - 1e-6 || r <= RING.guardR) low = true;
            }
         }
      }
      expect(low).toBe(false);
      expect(steps).toBeGreaterThanOrEqual(20000);
   });
});

describe("museum-guard score", () => {
   it("scores 5 a second, 50 a paid return and 150 an alarm left at dawn", () => {
      expect(runScore(90, 21, 3, true)).toBe(1950);
      expect(runScore(90, 21, 3, false)).toBe(1500);
      expect(runScore(13.79, 0, 0, false)).toBe(65);
      expect(runScore(91, 0, 3, true)).toBe(5 * 90 + 450);
      const run = createRun(1);
      const gained: number[] = [];
      let reason = "";
      stepGame(run, ZERO, DT, 90, {
         addScore: (n) => gained.push(n),
         setStat: () => {},
         end: (r) => { reason = r; },
      });
      expect(reason).toBe("win");
      expect(gained.reduce((a, b) => a + b, 0)).toBe(5 * 90 + 150 * 3);
      expect(run.exhibits.every((ex) => ex.mode === "still" && ex.s === 0)).toBe(true);
      expect(finalScore({ ...blank(), score: 0, elapsedMs: 90050, endReason: "win", stats: { returns: 2, alarms: 3 } }).score).toBe(5 * 90 + 100 + 450);
   });

   it("turns at most π rad/s for keys, hover and a drag", () => {
      const spin = createRun(1);
      stepUntil(spin, 1, (live) => { live.moveX = 1; });
      expect(spin.yaw).toBeCloseTo(Math.PI, 2);
      const hover = createRun(1);
      stepUntil(hover, 1, (live) => { live.pointerX = 1; });
      expect(hover.yaw).toBeCloseTo(Math.PI, 2);
      const dead = createRun(1);
      stepUntil(dead, 1, (live) => { live.pointerX = 0.15; });
      expect(dead.yaw).toBe(0);
      const drag = createRun(1);
      stepUntil(drag, 0.5, (live) => { live.dragYaw = 2; live.moveX = 1; });
      expect(drag.yaw).toBeCloseTo(TURN_RATE * 0.5, 2);
      expect(beamHalf(0, true)).toBeCloseTo((17 * Math.PI) / 180, 6);
      expect(beamHalf(2, false)).toBeCloseTo((12 * Math.PI) / 180, 6);
      expect(BEAM.hold).toBe(0.7);
      expect(SCORE.returnMinM).toBe(2);
   });
});

interface Brain { lock: number; pending: number; wait: number }

function timeLeft(run: Run, index: number): number {
   const ex = run.exhibits[index];
   const ped = run.pedestals[ex.pedestal];
   const dist = Math.hypot(ex.x - ped.exitX, ex.z - ped.exitZ);
   const speed = ex.coast > 0 ? ex.coastSpeed : TYPES[ex.kind].speed * PHASES.speed[run.phase];
   return Math.max(0, dist - BEAM.alarm) / speed;
}

function bearingOf(ex: Exhibit): number {
   return Math.atan2(ex.x, ex.z);
}

/** Least time among statues still out. -1 when the gallery is quiet. */
function urgent(run: Run): number {
   let best = -1;
   let left = Infinity;
   for (let i = 0; i < run.exhibits.length; i++) {
      const mode = run.exhibits[i].mode;
      if (mode !== "sneaking" && mode !== "frozen") continue;
      const t = timeLeft(run, i);
      if (t < left) { left = t; best = i; }
   }
   return best;
}

function wantFlash(run: Run): boolean {
   if (run.cooldown > 0 || run.flashLeft > 0) return false;
   let hot = 0;
   let inside = false;
   for (let i = 0; i < run.exhibits.length; i++) {
      if (run.exhibits[i].mode !== "sneaking") continue;
      if (timeLeft(run, i) <= 2.2) hot += 1;
      if (Math.abs(wrapAngle(bearingOf(run.exhibits[i]) - run.yaw)) <= FLASH.half) inside = true;
   }
   return hot >= 2 && inside;
}

function steer(run: Run, brain: Brain, dt: number, reaction: number): { target: number; hold: boolean } {
   if (brain.lock >= 0) {
      const mode = run.exhibits[brain.lock].mode;
      if (mode === "returning" || mode === "still") brain.lock = -1;
   }
   const next = urgent(run);
   if (brain.lock < 0 && next >= 0) {
      if (brain.pending !== next) { brain.pending = next; brain.wait = reaction; }
      brain.wait -= dt;
      if (brain.wait <= 0) brain.lock = next;
   }
   const focus = brain.lock;
   if (focus < 0) return { target: 0, hold: false };
   const off = Math.abs(wrapAngle(bearingOf(run.exhibits[focus]) - run.yaw));
   return { target: bearingOf(run.exhibits[focus]), hold: off <= run.half };
}

type Hands = "keys" | "hover" | "touch";

function control(run: Run, brain: Brain, live: GuardInput, dt: number, reaction: number, hands: Hands): void {
   const aim = steer(run, brain, dt, reaction);
   live.moveX = 0;
   live.pointerX = null;
   live.dragYaw = null;
   live.coarse = hands === "touch";
   live.flash = wantFlash(run);
   if (aim.hold) {
      if (hands === "touch") live.dragYaw = run.yaw;
      return;
   }
   const delta = wrapAngle(aim.target - run.yaw);
   const dir = delta > 0.02 ? 1 : delta < -0.02 ? -1 : 0;
   if (hands === "keys") live.moveX = dir;
   else if (hands === "hover") live.pointerX = dir;
   else live.dragYaw = aim.target;
}

function play(seed: number, hands: Hands | "camp" | "spin" | "idle" | "spam", frame = fixedFrames(1000 / 60), reaction = 0.22) {
   const run = createRun(seed);
   const brain: Brain = { lock: -1, pending: -2, wait: 0 };
   const live = input();
   let legal = true;
   const end = simulateRun(createArcadeStore(), {
      resultDelayMs: 0,
      frame,
      step: (dt, time, store) => {
         if (hands === "camp") run.yaw = Math.PI / 2;
         else if (hands === "spin") live.moveX = 1;
         else if (hands === "idle") { /* held at zero */ }
         else if (hands === "spam") { live.moveX = Math.sin(time * 17) > 0 ? 1 : -1; live.flash = true; }
         else control(run, brain, live, dt, reaction, hands);
         if (hands === "camp" || hands === "spin" || hands === "idle") {
            live.flash = false;
            if (hands !== "spin") live.moveX = 0;
            live.pointerX = null;
            live.dragYaw = null;
         }
         stepGame(run, live, dt, time, store.getState());
         const ms = store.getState().elapsedMs;
         if (run.score * 1000 > LIMITS.base * 1000 + LIMITS.maxPointsPerSec * ms) legal = false;
         if (run.score > SCORE.ceiling) legal = false;
      },
   });
   return { run, end, legal };
}

function limitsHold(score: number, ms: number): boolean {
   return withinServerLimits(score, ms, LIMITS) && capScore(score, ms, LIMITS) === score && score <= 1950;
}

describe("museum-guard bots", () => {
   it("lets a perfect sweeper keep every alarm and clear 90% of the server max", () => {
      let best = 0;
      for (let seed = 1; seed <= 10; seed++) {
         const { run, end, legal } = play(seed, "keys", fixedFrames(1000 / 60), 0);
         expect(legal).toBe(true);
         expect(end.endReason).toBe("win");
         expect(run.alarms).toBe(3);
         expect(limitsHold(end.score, end.elapsedMs)).toBe(true);
         expect(finalScore(end).score).toBe(end.score);
         if (end.score > best) best = end.score;
      }
      expect(best).toBeGreaterThanOrEqual(Math.ceil(LIMITS.maxScore * 0.9));
      expect(best).toBeLessThanOrEqual(1950);
   });

   it("wins at least half of 30 seeds on keys, hover and a 140 px/s drag", () => {
      for (const hands of ["keys", "hover", "touch"] as const) {
         let wins = 0;
         for (let seed = 1; seed <= 30; seed++) {
            const { end, legal } = play(seed, hands);
            expect(legal).toBe(true);
            expect(limitsHold(end.score, end.elapsedMs)).toBe(true);
            if (end.endReason === "win") wins += 1;
         }
         expect(wins).toBeGreaterThanOrEqual(15);
      }
   });

   it("loses a camp and a spin before 40 s with no paid return and at most 200 points", () => {
      for (let seed = 1; seed <= 30; seed++) {
         for (const hands of ["camp", "spin"] as const) {
            const { run, end, legal } = play(seed, hands);
            expect(legal).toBe(true);
            expect(end.endReason).toBe("lose");
            expect(end.elapsedMs).toBeLessThan(40000);
            expect(run.returns).toBe(0);
            expect(end.score).toBeLessThanOrEqual(200);
            expect(limitsHold(end.score, end.elapsedMs)).toBe(true);
         }
      }
   });

   it("keeps idle, spam and uneven frames inside the server limits", () => {
      for (let seed = 1; seed <= 20; seed++) {
         for (const hands of ["idle", "spam"] as const) {
            const { end, legal } = play(seed, hands);
            expect(legal).toBe(true);
            expect(limitsHold(end.score, end.elapsedMs)).toBe(true);
            expect(end.score).toBeLessThan(1000);
         }
      }
      for (let seed = 1; seed <= 5; seed++) {
         for (const frame of [fixedFrames(1000 / 30), fixedFrames(1000 / 144), randomFrames(seed)]) {
            const { end, legal } = play(seed, "keys", frame, 0);
            expect(legal).toBe(true);
            expect(limitsHold(end.score, end.elapsedMs)).toBe(true);
         }
      }
   });
});

function blank() {
   return {
      phase: "over" as const,
      runId: 1,
      score: 0,
      elapsedMs: 0,
      timeLeftMs: null,
      lives: null,
      level: 1,
      stats: {},
      endReason: null,
      countdownMs: 0,
      pausedFrom: null,
   };
}
