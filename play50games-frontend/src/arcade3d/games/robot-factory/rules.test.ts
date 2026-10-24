import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { rngNext, type RngState } from "@/arcade3d/core/math";
import { robotFactoryMeta } from "./meta";
import {
   BELT,
   BOARD,
   CLAW,
   CRADLE,
   EARLIEST_LOSS_S,
   FEEDER_BELT,
   FEEDER_OFFSET,
   KIND,
   MAIN_BELT,
   MAX_ROBOTS,
   PROPOSED_LIMITS,
   SCORING,
   SCRAP_BIN,
   SHAPE_OF,
   SHIFT,
   STREAM,
   WALK,
   beltSpeed,
   blueprintHas,
   blueprintSize,
   capScore,
   createRun,
   createShown,
   currentColour,
   currentKind,
   inZone,
   isWanted,
   maxInstalls,
   NO_INPUT,
   partPoints,
   perfectScore,
   pickTarget,
   placePart,
   progress,
   quietRun,
   robotsFor,
   stepRun,
   syncStore,
   withinServerLimits,
   type FrameInput,
   type Run,
} from "./rules";

const DT = 1 / 30;
const input = (grab: boolean, scrap: boolean, target = -1): FrameInput => ({ grab, scrap, target });
/** A part in the zone that the current step wants, placed by hand. */
const wanted = (run: Run, sEq = 2.5) => placePart(run, currentKind(run), currentColour(run), sEq)!;
/** A clean part the current step does not want (another colour of the same kind). */
const unwanted = (run: Run, sEq = 2.5) => placePart(run, currentKind(run), (currentColour(run) + 1) % 4, sEq)!;

describe("robot-factory tuning", () => {
   it("pins the designed numbers", () => {
      expect(SHIFT).toEqual({ DURATION: 90, WIN_QUOTA: 5, LIVES: 3, RESULT_DELAY_MS: 1400 });
      expect([BELT.Y, BELT.Z, BELT.WIDTH, BELT.GRAB_MIN, BELT.GRAB_MAX, BELT.CLAW_S, BELT.S_MERGE, BELT.FEEDER_T]).toEqual([0.75, 0.35, 0.8, 1.9, 3.7, 2.8, 1.6, 60]);
      expect([BELT.V0, BELT.V1, BELT.GROWTH, BELT.V_MAX]).toEqual([1.45, 1.6, 1.04, 2.6]);
      expect(STREAM).toEqual({
         MAX_PARTS: 8, MIN_PART_GAP: 0.95, PERIOD: 1.6, HALF: 0.8, FIRST_S: 0.72, FAULTY_CHANCE: 0.18,
         FIRST_FAULT_MIN_T: 2.6, FAULT_MIN_INTERVAL: 3.5, FAULT_MIN_INTERVAL_LATE: 2.5, LATE_T: 60,
      });
      expect(CLAW).toEqual({ WRONG_LOCKOUT: 1.0, SCRAP_LOCKOUT: 1.0, FAULT_LOCKOUT: 0.5, ZAP_LOCKOUT: 0.5, BOUNCE: 0.35 });
      expect(SCORING).toEqual({ PART_BASE: 20, COMBO_STEP: 4, COMBO_MAX: 5, ROBOT_BONUS: 200 });
      expect(WALK.DURATION).toBe(0.7);
      expect([CRADLE.x, CRADLE.z, WALK.TO.x, SCRAP_BIN.z, BOARD.y, BOARD.z]).toEqual([1.35, -0.45, 2.4, 0.95, 1.45, -0.95]);
   });

   it("builds the belts: 5.60 m main, 1.664 m feeder joining at 1.60 m", () => {
      expect(MAIN_BELT.total).toBeCloseTo(5.6, 9);
      expect(FEEDER_BELT.total).toBeCloseTo(Math.hypot(1.4, 0.9), 9);
      expect(FEEDER_OFFSET).toBeCloseTo(0.0643, 4);
   });

   it("speeds the belt up per robot: 1.45, 1.60, x1.04, capped at 2.60 from robot 14", () => {
      expect(beltSpeed(0)).toBe(1.45);
      expect(beltSpeed(1)).toBe(1.6);
      expect(beltSpeed(2)).toBeCloseTo(1.664, 9);
      expect(beltSpeed(13)).toBeCloseTo(2.5617, 3);
      expect(beltSpeed(14)).toBe(2.6);
      expect(beltSpeed(30)).toBe(2.6);
   });

   it("grows blueprints 3, 3, 4, 4, 4, 5 in torso, cell, head, arm, arm order", () => {
      expect([0, 1, 2, 3, 4, 5, 9].map(blueprintSize)).toEqual([3, 3, 4, 4, 4, 5, 5]);
      const run = createRun(3);
      const kinds = (r: number) => Array.from({ length: blueprintSize(r) }, (_, i) => run.stepKind[run.robotStart[r] + i]);
      expect(kinds(0)).toEqual([0, 1, 2]);
      expect(kinds(3)).toEqual([0, 1, 2, 3]);
      expect(kinds(7)).toEqual([0, 1, 2, 3, 3]);
      expect(SHAPE_OF.map((row) => row.join(""))).toEqual(["0101", "2222", "3453", "6786"]);
   });

   it("scores 20 + 4 per combo step, capped at +20", () => {
      expect([0, 1, 2, 3, 4, 5, 6, 9].map(partPoints)).toEqual([20, 24, 28, 32, 36, 40, 40, 40]);
   });
});

describe("robot-factory actions", () => {
   it("installs a wanted part with no lockout, and +200 on the blueprint's last part", () => {
      const run = quietRun(5);
      for (let i = 0; i < 3; i++) {
         const part = wanted(run);
         stepRun(run, input(true, false, part.uid), DT);
         expect(part.active).toBe(false);
         expect(run.lockout).toBe(0);
      }
      expect(run.partsInstalled).toBe(3);
      expect(run.robot).toBe(1);
      expect(run.stepIndex).toBe(0);
      expect(run.combo).toBe(3);
      expect(run.score).toBe(20 + 24 + 28 + 200);
      expect(run.walkT).toBeLessThan(DT + 1e-9);
      expect(run.events.slice(0, run.eventCount).map((e) => e.kind)).toEqual(["install", "robot"]);
   });

   it("a wrong grab bounces the part, resets the combo and blueprint step, and locks the claw for 1.00 s", () => {
      const run = quietRun(5);
      stepRun(run, input(true, false, wanted(run).uid), DT);
      const part = unwanted(run);
      stepRun(run, input(true, false, part.uid), DT);
      expect(part.active).toBe(true);
      expect(part.hop).toBeGreaterThan(0);
      expect(run.combo).toBe(0);
      expect(run.stepIndex).toBe(0);
      expect(run.lockout).toBeCloseTo(CLAW.WRONG_LOCKOUT, 9);
      const next = wanted(run);
      stepRun(run, input(true, false, next.uid), CLAW.WRONG_LOCKOUT * 0.9);
      expect(next.active).toBe(true);
      next.passed = false;
      placeAt(next, 2.5);
      stepRun(run, input(true, false, next.uid), CLAW.WRONG_LOCKOUT * 0.2);
      expect(next.active).toBe(false);
      expect(run.score).toBe(40);
      expect(run.stepIndex).toBe(1);
   });

   it("a grabbed faulty part is consumed: one strike, combo 0, 0.50 s lockout; the 3rd strike loses", () => {
      const run = quietRun(5);
      for (let k = 1; k <= 3; k++) {
         const bad = placePart(run, KIND.arm, 0, 2.5, true)!;
         stepRun(run, input(true, false, bad.uid), DT);
         expect(bad.active).toBe(false);
         expect(run.strikes).toBe(k);
         if (k < 3) {
            expect(run.lockout).toBeCloseTo(CLAW.FAULT_LOCKOUT, 9);
            stepRun(run, NO_INPUT, CLAW.FAULT_LOCKOUT);
            stepRun(run, input(true, false, bad.uid), DT);
            expect(run.strikes).toBe(k);
         }
      }
      expect(run.over).toBe(true);
      expect(run.outcome).toBe("lose");
   });

   it("scrapping a faulty part keeps the combo; scrapping a clean one costs the combo and 1.00 s", () => {
      const run = quietRun(5);
      stepRun(run, input(true, false, wanted(run).uid), DT);
      const bad = placePart(run, KIND.arm, 0, 2.5, true)!;
      stepRun(run, input(false, true, bad.uid), DT);
      expect([bad.active, run.combo, run.lockout, run.faultsScrapped]).toEqual([false, 1, 0, 1]);
      const clean = wanted(run);
      stepRun(run, input(false, true, clean.uid), DT);
      expect([clean.active, run.combo, run.cleanScraps]).toEqual([false, 0, 1]);
      expect(run.lockout).toBeCloseTo(CLAW.SCRAP_LOCKOUT, 9);
   });

   it("ignores presses during a lockout and when nothing is in the grab zone", () => {
      const run = quietRun(5);
      const early = wanted(run, 1.0);
      stepRun(run, input(true, true, early.uid), DT);
      expect(early.active).toBe(true);
      expect(run.lockout).toBe(0);
      run.lockout = 0.5;
      const part = wanted(run);
      stepRun(run, input(true, false, part.uid), DT);
      expect(part.active).toBe(true);
   });

   it("aims at the locked part, else the zone part nearest the claw", () => {
      const run = quietRun(5);
      const a = wanted(run, 2.0);
      const b = wanted(run, 3.0);
      const c = wanted(run, 3.6);
      expect(pickTarget(run, a.uid)).toBe(a);
      expect(pickTarget(run, -1)).toBe(b);
      placeAt(a, 1.5);
      expect(pickTarget(run, a.uid)).toBe(b);
      placeAt(c, 2.6);
      expect(pickTarget(run, -1)).toBe(b);
   });

   it("zaps the combo when a faulty part leaves the zone, and resets it on a missed wanted part", () => {
      const run = quietRun(5);
      stepRun(run, input(true, false, wanted(run).uid), DT);
      placePart(run, KIND.arm, 0, 3.69, true);
      stepRun(run, NO_INPUT, DT);
      expect(run.combo).toBe(0);
      expect(run.lockout).toBeCloseTo(CLAW.ZAP_LOCKOUT, 1);
      expect(run.strikes).toBe(0);
      const run2 = quietRun(5);
      stepRun(run2, input(true, false, wanted(run2).uid), DT);
      wanted(run2, 3.69);
      stepRun(run2, NO_INPUT, DT);
      expect([run2.combo, run2.neededMissed, run2.lockout]).toEqual([0, 1, 0]);
   });

   it("ends the shift at exactly 90 s: a win from 5 robots, a loss below", () => {
      for (const robots of [4, 5]) {
         const run = quietRun(2);
         run.robot = robots;
         let t = 0;
         while (!run.over) {
            stepRun(run, NO_INPUT, 0.05);
            t += 0.05;
         }
         expect(run.t).toBe(90);
         expect(t).toBeGreaterThanOrEqual(90 - 1e-6);
         expect(run.outcome).toBe(robots >= 5 ? "win" : "lose");
      }
   });

   it("is the same run for the same seed and the same presses", () => {
      const play = (seed: number) => {
         const run = createRun(seed);
         const log: number[] = [];
         for (let f = 0; f < 2400 && !run.over; f++) {
            stepRun(run, input(f % 7 === 0, f % 11 === 0), DT);
            for (let i = 0; i < run.eventCount; i++) log.push(run.events[i].uid, run.events[i].shape, run.events[i].points);
         }
         return { log, score: run.score, strikes: run.strikes };
      };
      expect(play(77)).toEqual(play(77));
      expect(play(77).log).not.toEqual(play(78).log);
   });
});

function placeAt(part: Run["parts"][number], sEq: number) {
   part.s = part.sEq = sEq;
   part.passed = false;
}

// ---------- bots ----------

type Bot = (run: Run, seen: Map<number, number>) => FrameInput;

/** Remembers when each part entered the grab zone (the bots' eyes). */
function look(run: Run, seen: Map<number, number>) {
   for (const p of run.parts) if (inZone(p) && !seen.has(p.uid)) seen.set(p.uid, run.t);
}

const perfectBot: Bot = (run) => {
   let grab = -1;
   let scrap = -1;
   for (const p of run.parts) {
      if (!inZone(p)) continue;
      if (p.faulty) scrap = p.uid;
      else if (isWanted(run, p)) grab = p.uid;
   }
   // one target per frame: the scrap waits a frame when both are due (still 0 s lockout)
   if (grab >= 0) return input(true, false, grab);
   return input(false, scrap >= 0, scrap);
};

/** Reaction 150-250 ms (sometimes a slow 400-600 ms), a 6 % mis-aim onto a neighbour, 5 % of faults overlooked. */
function humanBot(seed: number): Bot {
   const rng: RngState = { s: seed * 7919 + 13 };
   const delay = new Map<number, number>();
   const ignored = new Set<number>();
   return (run, seen) => {
      for (const p of run.parts) {
         if (!inZone(p) || delay.has(p.uid)) continue;
         const slow = rngNext(rng) < 0.08;
         delay.set(p.uid, slow ? 0.4 + 0.2 * rngNext(rng) : 0.15 + 0.1 * rngNext(rng));
         if (p.faulty && rngNext(rng) < 0.05) ignored.add(p.uid);
      }
      if (run.lockout > 0) return NO_INPUT;
      for (const p of run.parts) {
         if (!inZone(p) || run.t - (seen.get(p.uid) ?? run.t) < (delay.get(p.uid) ?? 1)) continue;
         if (p.faulty && !ignored.has(p.uid)) return input(false, true, p.uid);
         if (!p.faulty && isWanted(run, p)) {
            if (rngNext(rng) < 0.06) {
               const other = run.parts.find((q) => q !== p && inZone(q));
               if (other) return input(true, false, other.uid);
            }
            return input(true, false, p.uid);
         }
      }
      return NO_INPUT;
   };
}

/** Ignores the blueprint: grabs every clean part 150 ms after it arrives, scraps every faulty one. */
const blindBot: Bot = (run, seen) => {
   for (const p of run.parts) {
      if (!inZone(p) || run.t - (seen.get(p.uid) ?? run.t) < 0.15) continue;
      return p.faulty ? input(false, true, p.uid) : input(true, false, p.uid);
   }
   return NO_INPUT;
};
const spamGrabBot: Bot = () => input(true, false);
const spamScrapBot: Bot = () => input(false, true);
const mashBot: Bot = (run) => input(Math.floor(run.t * 30) % 2 === 0, Math.floor(run.t * 30) % 2 === 1);
const idleBot: Bot = () => NO_INPUT;

/** One run through the real store, the way Scene.tsx drives it. */
function playStore(bot: Bot, seed: number, frame: () => number) {
   const store = createArcadeStore();
   const run = createRun(seed);
   const seen = new Map<number, number>();
   const shown = createShown();
   let wantedFromLattice = true;
   const end = simulateRun(store, {
      lives: SHIFT.LIVES,
      resultDelayMs: SHIFT.RESULT_DELAY_MS,
      frame,
      step: (dt) => {
         look(run, seen);
         stepRun(run, bot(run, seen), dt);
         for (let i = 0; i < run.eventCount; i++) if (run.events[i].kind === "install" && !run.events[i].needed) wantedFromLattice = false;
         syncStore(run, store.getState(), shown);
      },
   });
   return { end, run, wantedFromLattice };
}

const PERFECT = perfectScore(56, 12);

describe("robot-factory stream (1,000 seeds)", () => {
   it("keeps the lattice, the gaps, the disjoint distractors and the fault spacing", () => {
      let faults = 0;
      for (let seed = 1; seed <= 1000; seed++) {
         const run = createRun(seed);
         const seen = new Map<number, number>();
         let firstThird = Infinity;
         let lastMiss = -1;
         let waitMax = 0;
         let faultCount = 0;
         const faultIds = new Set<number>();
         const bot = seed % 2 === 0 ? perfectBot : idleBot;
         while (!run.over) {
            const r = run.robot;
            stepRun(run, bot(run, seen), DT);
            for (const p of run.parts) {
               if (!inZone(p) || seen.has(p.uid)) continue;
               seen.set(p.uid, run.t);
               if (isWanted(run, p) && lastMiss >= 0) {
                  waitMax = Math.max(waitMax, run.t - lastMiss);
                  lastMiss = -1;
               }
               if (p.faulty && faultIds.size === 2 && !faultIds.has(p.uid)) firstThird = Math.min(firstThird, run.t);
               if (p.faulty) faultIds.add(p.uid);
            }
            for (let i = 0; i < run.eventCount; i++) {
               const e = run.events[i];
               if (e.kind === "missed" && lastMiss < 0) lastMiss = run.t;
               if (e.kind !== "spawn") continue;
               const part = run.parts.find((p) => p.uid === e.uid)!;
               const slot = part.spawnT / STREAM.PERIOD;
               if (part.needed) expect(Math.abs(slot - Math.round(slot))).toBeLessThan(1e-9);
               else {
                  expect(Math.abs(slot - 0.5 - Math.round(slot - 0.5))).toBeLessThan(1e-9);
                  const pair = part.kind * 4 + part.colour;
                  expect(blueprintHas(run, r, pair) || blueprintHas(run, r + 1, pair), `seed ${seed}`).toBe(false);
               }
               if (part.faulty) {
                  faultCount++;
                  expect(part.spawnT).toBeGreaterThanOrEqual(STREAM.FIRST_FAULT_MIN_T);
               }
               for (const q of run.parts) if (q.active && q !== part) expect(Math.abs(q.sEq - part.sEq)).toBeGreaterThanOrEqual(STREAM.MIN_PART_GAP);
            }
         }
         expect(run.skippedSpawns).toBe(0);
         expect(waitMax, `seed ${seed}`).toBeLessThanOrEqual(1.6 + 1.9 / 1.45 + DT + 1e-9);
         expect(firstThird).toBeGreaterThanOrEqual(EARLIEST_LOSS_S);
         faults += faultCount;
      }
      // 18 % of the 56 non-needed slots, thinned by the 3.5 s / 2.5 s spacing: about 7.5 a shift
      expect(faults / 1000).toBeGreaterThan(6);
      expect(faults / 1000).toBeLessThan(9);
   });

   it("schedules faults the same way however the run is played", () => {
      for (let seed = 1; seed <= 20; seed++) {
         const times = (bot: Bot) => {
            const run = createRun(seed);
            const seen = new Map<number, number>();
            const out: number[] = [];
            while (!run.over) {
               stepRun(run, bot(run, seen), DT);
               for (let i = 0; i < run.eventCount; i++) if (run.events[i].kind === "spawn" && run.events[i].faulty) out.push(run.events[i].t);
            }
            return out.map((t) => Math.round(t * 10));
         };
         expect(times(perfectBot)).toEqual(times(idleBot));
      }
   });
});

describe("robot-factory scoring limit proof", () => {
   it("perfectScore is 40 M - 60 + 200 R from 5 parts on, and 5 R <= M + 7", () => {
      expect(perfectScore(5, 0)).toBe(140);
      for (let m = 5; m <= 120; m++) expect(perfectScore(m, 0)).toBe(40 * m - 60);
      for (let m = 0; m <= 120; m++) expect(5 * robotsFor(m)).toBeLessThanOrEqual(m + 7);
      expect([robotsFor(17), robotsFor(18), robotsFor(56), robotsFor(57), robotsFor(58)]).toEqual([4, 5, 12, 12, 13]);
      expect(PERFECT).toBe(4580);
   });

   it("bounds the score at every moment by 300 + 52 t, and at 4580 <= 4750 over the shift", () => {
      expect(maxInstalls(90)).toBe(56);
      expect(maxInstalls(0.8)).toBe(0);
      expect(EARLIEST_LOSS_S).toBeCloseTo(10.331, 3);
      for (let t = 0; t <= 90; t += 0.01) {
         const m = maxInstalls(t);
         const bound = perfectScore(m, robotsFor(m));
         expect(bound).toBeLessThanOrEqual(50 * t + 264);
         expect(bound).toBeLessThanOrEqual(PROPOSED_LIMITS.base + PROPOSED_LIMITS.maxPointsPerSec * t);
      }
      expect(PROPOSED_LIMITS).toMatchObject({ maxScore: 4750, minDurationMs: 10000, maxDurationMs: 92000, base: 300, maxPointsPerSec: 52 });
      expect(withinServerLimits(4580, 90_000)).toBe(true);
      expect(withinServerLimits(4751, 92_000)).toBe(false);
      expect(withinServerLimits(100, 9_999)).toBe(false);
      expect(withinServerLimits(300 + 52 * 20 + 1, 20_000)).toBe(false);
   });

   it("keeps meta.scoring at the provisional set until go-live, which the proposed limits tighten", () => {
      expect(robotFactoryMeta.scoring).toMatchObject({ kind: "points", maxScore: 6000, minDurationMs: 10000, maxDurationMs: 92000, base: 6000, maxPointsPerSec: 6000 });
      expect(robotFactoryMeta.status).toBe("dev");
   });

   it("the oracle installs all 56 parts, 12 robots, 4580 points, at 30 / 60 / 144 Hz and random frames", () => {
      const frames = [fixedFrames(1000 / 30), fixedFrames(1000 / 60), fixedFrames(1000 / 144)];
      for (let seed = 1; seed <= 200; seed++) {
         const frame = seed <= 6 ? frames[seed % 3] : randomFrames(seed, 0.004, 0.05);
         const { end, run, wantedFromLattice } = playStore(perfectBot, seed, frame);
         expect(end.endReason, `seed ${seed}`).toBe("win");
         expect(run.partsInstalled).toBe(56);
         expect(run.robot).toBe(12);
         expect(end.score).toBe(PERFECT);
         expect(wantedFromLattice).toBe(true);
         expect(end.score).toBeGreaterThanOrEqual(0.9 * PROPOSED_LIMITS.maxScore);
         expect(withinServerLimits(end.score, end.elapsedMs)).toBe(true);
         expect(withinServerLimits(end.score, end.elapsedMs, robotFactoryMeta.scoring)).toBe(true);
         expect(capScore(end.score, end.elapsedMs)).toBe(end.score);
      }
   });

   it("a human-like player (150-250 ms, mis-aims) wins and stays inside the limits", () => {
      let wins = 0;
      let total = 0;
      for (let seed = 1; seed <= 200; seed++) {
         const { end } = playStore(humanBot(seed), seed, randomFrames(seed + 500, 0.012, 0.05));
         if (end.endReason === "win") wins++;
         total += end.score;
         expect(withinServerLimits(end.score, end.elapsedMs)).toBe(true);
         expect(capScore(end.score, end.elapsedMs)).toBe(end.score);
      }
      expect(wins).toBeGreaterThanOrEqual(196);
      expect(total / 200).toBeGreaterThan(0.6 * PERFECT);
   });

   it("grabbing everything (blueprint-blind) earns at most 40 % of the oracle", () => {
      for (let seed = 1; seed <= 150; seed++) {
         const { end } = playStore(blindBot, seed, randomFrames(seed + 900, 0.016, 0.05));
         expect(end.score, `seed ${seed}`).toBeLessThanOrEqual(0.4 * PERFECT);
         expect(withinServerLimits(end.score, end.elapsedMs)).toBe(true);
      }
   });

   it("spam, mash and idle bots score low, rarely survive, and never end inside 10.331 s", () => {
      for (const [bot, cap, maxWins, seeds] of [[spamGrabBot, 0.4, 25, 200], [mashBot, 0.4, 15, 200], [spamScrapBot, 0, 0, 100], [idleBot, 0, 0, 100]] as const) {
         const scores: number[] = [];
         let wins = 0;
         for (let seed = 1; seed <= seeds; seed++) {
            const { end } = playStore(bot, seed, randomFrames(seed + 1300, 0.016, 0.05));
            scores.push(end.score);
            if (end.endReason === "win") wins++;
            expect(end.score, `seed ${seed}`).toBeLessThanOrEqual(cap * PERFECT);
            expect(end.elapsedMs).toBeGreaterThanOrEqual(EARLIEST_LOSS_S * 1000);
            expect(withinServerLimits(end.score, end.elapsedMs)).toBe(true);
            expect(capScore(end.score, end.elapsedMs)).toBe(end.score);
         }
         scores.sort((a, b) => a - b);
         expect(scores[seeds / 2]).toBeLessThanOrEqual(0.3 * PERFECT);
         expect(wins).toBeLessThanOrEqual(maxWins);
      }
   });
});

describe("robot-factory generator sanity", () => {
   it("never runs out of blueprints and keeps the progress index in range", () => {
      const run = createRun(9);
      expect(run.robotStart[MAX_ROBOTS]).toBeGreaterThan(robotsFor(56) * 5);
      expect(progress(run)).toBe(0);
   });
});
