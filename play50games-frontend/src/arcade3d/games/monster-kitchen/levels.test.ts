// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's
// game, monotone difficulty, the schedule proof per level, the same timing for touch and keyboard,
// and the bots. The 200-seed human sweep runs on the pure rules loop (the store tick is most of a
// run's cost); a few seeds per level also go through the real store.
import { describe, expect, it, vi } from "vitest";
import { isLevelCleared, definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { monsterKitchenMeta as meta } from "./meta";
import definition from "./index";
import {
   DRIFT,
   DURATION_MS,
   ORDERS,
   PATIENCE,
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   WHEEL,
   centreSlot,
   createRun,
   fastestSchedule,
   levelOrderLen,
   scheduleCeiling,
   scheduleSlope,
   stepRun,
   type Order,
   type RunState,
   type StepInput,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const blank = (): StepInput => ({ rotate: 0, tapSlot: null, tossCentre: false });

describe("monster-kitchen levels: declarations", () => {
   it("declares five levels in meta and the definition, with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      expect(meta.levels!.map((level) => level.title)).toEqual([
         "Snack Bar", "Monster Café", "Busy Kitchen", "Dinner Rush", "Grand Feast",
      ]);
      expect(meta.levels!.map((level) => level.clearScore)).toEqual([2000, 2600, 3000, 3200, 3600]);
      // decision 3: level 5 at most ~3 × level 1, and no later level offers fewer points than level 1
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) if (id > 1) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
      }
   });

   it("level 1 is today's game: same clock, hatch, lengths, drift, patience, look and start card", () => {
      const l1 = LEVELS[1];
      expect(l1.durationMs).toBe(DURATION_MS);
      expect(l1.windowBAtS).toBe(ORDERS.windowBAtS);
      expect([l1.len3Until, l1.len4Until]).toEqual([25, 50]);
      expect([l1.driftFromS, l1.driftEveryS]).toEqual([DRIFT.fromS, DRIFT.everyS]);
      expect(l1.penalty).toBe(PATIENCE.penalty);
      expect(l1.drains).toEqual(PATIENCE.drains);
      for (const t of [0, 10, 24.9, 25, 40, 49.9, 50, 70, 89]) {
         expect(levelOrderLen(l1, t, 0.49)).toBe(ORDERS.lenPick(t, 0.49));
         expect(levelOrderLen(l1, t, 0.5)).toBe(ORDERS.lenPick(t, 0.5));
      }
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(definition.environment).toEqual({ background: "#3f3f46", fog: ["#3f3f46", 16, 42], lighting: "indoor" });
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: 3, resultDelayMs: 1200 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual([{ key: "served", label: "Served" }]);
      // createRun() and createRun(seed, level 1) play the same kitchen
      for (const seed of [1, 7, 42]) {
         const a = createRun(seed), b = createRun(seed, l1);
         for (let n = 1; n <= 90 * 20; n++) {
            stepRun(a, blank(), 1 / 20, n / 20);
            stepRun(b, blank(), 1 / 20, n / 20);
         }
         expect(b.rng.s).toBe(a.rng.s);
         expect(b.rotation).toBe(a.rotation);
         expect(b.completions).toBe(a.completions);
         expect(b.slots.map((s) => s.kind)).toEqual(a.slots.map((s) => s.kind));
      }
   });

   it("levels 2-5 override the clock and the light; level 4 is night and level 5 is the dramatic preset", () => {
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["indoor", "day", "sunset", "night", "sunset"]);
      for (const id of LEVEL_IDS) {
         if (id === 1) continue;
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
         expect(levelRunConfig(definition, id).lives).toBe(3);
         expect(levelInstructions(definition, id).length).toBe(definition.instructions.length + 1);
         expect(levelHudStats(definition, id)).toEqual(levelHudStats(definition, 1));
      }
   });
});

describe("monster-kitchen levels: difficulty", () => {
   it("is monotone, and each level offers a higher schedule ceiling than the one before it", () => {
      let prevCeiling = 0;
      for (const id of LEVEL_IDS) {
         const ceiling = scheduleCeiling(LEVELS[id]);
         expect(ceiling).toBeGreaterThan(prevCeiling);
         prevCeiling = ceiling;
         if (id === 1) continue;
         const a = LEVELS[(id - 1) as LevelId], b = LEVELS[id];
         expect(b.windowBAtS).toBeLessThan(a.windowBAtS);
         expect(b.len3Until).toBeLessThan(a.len3Until);
         expect(b.len4Until).toBeLessThan(a.len4Until);
         expect(b.driftFromS).toBeLessThan(a.driftFromS);
         expect(b.driftEveryS).toBeLessThanOrEqual(a.driftEveryS);
         expect(b.penalty).toBeGreaterThanOrEqual(a.penalty);
         expect(b.drains.jolly).toBeGreaterThanOrEqual(a.drains.jolly);
         expect(b.drains.greedy).toBeGreaterThanOrEqual(a.drains.greedy);
         expect(b.drains.grumpy).toBeGreaterThanOrEqual(a.drains.grumpy);
         expect(b.durationMs).toBeGreaterThan(a.durationMs);
      }
      // the short-order policy scores less on every level: longest orders are the ceiling
      for (const id of LEVEL_IDS) expect(scheduleCeiling(LEVELS[id], false)).toBeLessThan(scheduleCeiling(LEVELS[id]));
   });
});

describe("monster-kitchen levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: the schedule ceiling, B(t), and the duration window`, () => {
      const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
      const ceiling = scheduleCeiling(level);
      const slope = scheduleSlope(level);
      if (id === 1) {
         expect(ceiling).toBe(4250);
         expect(ceiling).toBeLessThanOrEqual(4680);
         expect(limits).toEqual(PROPOSED_LIMITS);
      } else {
         expect(limits.maxScore).toBe(Math.ceil((ceiling * 1.03) / 10) * 10);
         expect(limits.maxPointsPerSec).toBe(Math.ceil(slope * 1.03));
         expect(limits.maxDurationMs).toBe(level.durationMs + 2000);
         expect(limits.minDurationMs).toBe(id >= 4 ? 11000 : 12000);
         expect(limits.base).toBe(240);
      }
      let running = 0;
      for (const stop of fastestSchedule(level)) {
         running += stop.pay;
         expect(running).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * stop.land + 1e-6);
      }
      expect(running).toBe(ceiling);
      expect(ceiling).toBeLessThanOrEqual(limits.maxScore);
   });
});

describe("monster-kitchen levels: touch and keyboard", () => {
   it("a toss from Space and a tap on the centre slot land the same ingredient, on every level", () => {
      const events = [0.25, 0.8, 1.4, 2.1, 2.8, 3.6];
      for (const id of LEVEL_IDS) {
         const play = (touch: boolean) => {
            const run = createRun(11, LEVELS[id]);
            const input = blank();
            let next = 0;
            const clock = 5;
            while (run.time < clock - 1e-9) {
               const dt = Math.min(1 / 60, clock - run.time);
               const time = run.time + dt;
               input.rotate = 0;
               input.tapSlot = null;
               input.tossCentre = false;
               if (next < events.length && time + 1e-9 >= events[next]) {
                  if (next % 2 === 0) input.rotate = next % 4 === 0 ? 1 : -1;
                  else if (touch) input.tapSlot = centreSlot(run.rotation);
                  else input.tossCentre = true;
                  next += 1;
               }
               stepRun(run, input, dt, time);
            }
            return { rotation: run.rotation, completions: run.completions, kinds: run.slots.map((s) => s.kind), rng: run.rng.s };
         };
         expect(play(true)).toEqual(play(false));
      }
   });
});

// ---------- bots ----------

type Profile = "oracle" | "human" | "spam" | "idle";

/** The cook. Oracle turns every frame; the human turns no faster than the wheel eases (keyboard and touch share that one interval). */
function drive(run: RunState, input: StepInput, profile: Profile, nextRotate: { at: number }): void {
   if (profile === "idle") return;
   if (profile === "spam") {
      if (!run.flight && run.time >= run.burpUntil - 1e-9) input.tossCentre = true;
      return;
   }
   if (run.time < run.burpUntil - 1e-9) return;
   const slack = (o: Order) => o.patience / run.config.drains[o.type] - (o.kinds.length - o.progress) * 0.55;
   let order: Order | null = null;
   for (const w of run.windows) {
      const o = w.order;
      if (!o || o.phase !== "ordering") continue;
      const left = o.kinds.length - o.progress;
      if (!order || left < order.kinds.length - order.progress || (left === order.kinds.length - order.progress && slack(o) < slack(order))) order = o;
   }
   if (!order) return;
   const need = order.kinds[order.progress];
   let best = -1;
   let bestD = Infinity;
   for (let k = 0; k < WHEEL.slots; k++) {
      if (run.slots[k].kind !== need) continue;
      const p = ((k + run.rotation) % WHEEL.slots + WHEEL.slots) % WHEEL.slots;
      const d = Math.min(Math.abs(p - (WHEEL.front - 1)), Math.abs(p - WHEEL.front), Math.abs(p - (WHEEL.front + 1)));
      if (d < bestD) { bestD = d; best = k; if (d === 0) break; }
   }
   if (best < 0) return;
   if (bestD === 0) {
      if (!run.flight) input.tapSlot = best;
      return;
   }
   if (profile === "human" && run.time + 1e-9 < nextRotate.at) return;
   const pos = ((best + run.rotation) % WHEEL.slots + WHEEL.slots) % WHEEL.slots;
   input.rotate = pos > WHEEL.front ? 1 : -1;
   if (profile === "human") nextRotate.at = run.time + WHEEL.rotateS;
}

interface Played { score: number; ms: number; end: "win" | "lose" | "timeup"; lives: number }

function play(seed: number, profile: Profile, hz: number, id: LevelId): Played {
   const level = LEVELS[id], run = createRun(seed, level), input = blank(), nextRotate = { at: 0 };
   const clock = level.durationMs / 1000;
   let score = 0, lives = 3;
   while (run.time < clock - 1e-9 && lives > 0) {
      const dt = Math.min(1 / hz, clock - run.time);
      input.rotate = 0; input.tapSlot = null; input.tossCentre = false;
      drive(run, input, profile, nextRotate);
      stepRun(run, input, dt, run.time + dt);
      if (run.events.completed) score += run.events.completed.points;
      if (run.events.angryLeft & 1) lives -= 1;
      if (run.events.angryLeft & 2) lives -= 1;
   }
   const timedOut = run.time >= clock - 1e-9;
   return { score, ms: timedOut ? level.durationMs : Math.round(run.time * 1000), end: timedOut ? "timeup" : "lose", lives };
}

const HZ = [30, 60, 144] as const;
// Human 200 is the clear-rate sweep. Oracle 24 is enough to see the ceiling ratio (a full 200
// stays under the suite budget; level 1's own 200-seed store proof is in rules.test.ts). Spam 40
// hunts the fastest legal lose. Idle 3 never scores.
const SWEEP: Record<Profile, number> = { human: 200, oracle: 24, spam: 40, idle: 3 };

describe("monster-kitchen levels: bots", () => {
   for (const id of LEVEL_IDS) {
      const limits = PROPOSED_LEVEL_LIMITS[id], levelMeta = meta.levels![id - 1], ceiling = scheduleCeiling(LEVELS[id]);

      it(`L${id}: human clears >= 90% of 200 seeds; oracle, spam and idle stay inside the limits`, () => {
         const stats: Record<string, { clears: number; best: number; min: number; mean: number; loses: number; fastestLose: number }> = {};
         for (const profile of Object.keys(SWEEP) as Profile[]) {
            let clears = 0, best = 0, min = Infinity, sum = 0, loses = 0, fastestLose = Infinity;
            for (let seed = 0; seed < SWEEP[profile]; seed++) {
               const played = play(seed, profile, HZ[seed % 3], id);
               expect(fitsLimits(played.score, played.ms, limits), `${profile} seed ${seed}`).toBe(true);
               expect(capToLimits(played.score, played.ms, limits)).toBe(played.score);
               if (isLevelCleared(played.end, played.score, levelMeta)) clears += 1;
               if (played.end === "lose") { loses += 1; fastestLose = Math.min(fastestLose, played.ms); }
               best = Math.max(best, played.score);
               min = Math.min(min, played.score);
               sum += played.score;
            }
            stats[profile] = { clears, best, min, mean: Math.round(sum / SWEEP[profile]), loses, fastestLose: Math.round(fastestLose) };
         }
         console.info("monster-kitchen levels", id, "ceiling", ceiling, JSON.stringify(stats));
         expect(stats.human.clears).toBeGreaterThanOrEqual(0.9 * SWEEP.human);
         expect(stats.oracle.loses).toBe(0);
         // The schedule prices every order at maximum length and a full tip, so a real cook lands
         // under it. 80% is the same bar as level 1's proof (oracle ~3860 vs ceiling 4680).
         // 90% of maxScore cannot hold: that bar sits under the schedule ceiling (README "Levels").
         expect(stats.oracle.best).toBeGreaterThanOrEqual(0.8 * ceiling);
         expect(stats.spam.clears).toBe(0);
         expect(stats.idle.clears).toBe(0);
         expect(stats.idle.best).toBe(0);
         expect(stats.spam.fastestLose).toBeGreaterThanOrEqual(limits.minDurationMs);
      });

      it(`L${id}: one oracle seed through the real store matches the rules loop`, () => {
         const rules = play(4, "oracle", 30, id);
         const run = createRun(4, LEVELS[id]), input = blank(), nextRotate = { at: 0 };
         let score = 0;
         const final = simulateRun(createArcadeStore(), {
            durationMs: LEVELS[id].durationMs,
            lives: 3,
            frame: fixedFrames(1000 / 30),
            step: (dt, time, store) => {
               input.rotate = 0; input.tapSlot = null; input.tossCentre = false;
               drive(run, input, "oracle", nextRotate);
               stepRun(run, input, dt, time);
               if (run.events.completed) {
                  score += run.events.completed.points;
                  store.getState().addScore(run.events.completed.points);
                  store.getState().setStat("served", run.completions);
               }
               if (run.events.angryLeft & 1) store.getState().loseLife();
               if (run.events.angryLeft & 2) store.getState().loseLife();
            },
         });
         expect(final.score).toBe(score);
         // The store clock and the rules loop can disagree by one tip point: patience is rounded
         // at a landing, and the two clocks do not share a frame edge. A whole order is >= 100.
         expect(Math.abs(final.score - rules.score)).toBeLessThanOrEqual(5);
         expect(fitsLimits(final.score, final.elapsedMs, limits)).toBe(true);
         expect(capToLimits(final.score, final.elapsedMs, limits)).toBe(final.score);
      });
   }
});
