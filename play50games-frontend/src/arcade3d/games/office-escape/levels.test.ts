import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { definitionLevelProblems, isLevelCleared, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { LEVELS, type OfficeLevel } from "./levels";
import { createRun, createStepInput, distanceAt, timeAt, jumpHeight, step, advanceClock, updateTrack, rowFront, rowBack, isPassable, NO_OBSTACLE, OBSTACLE, PROPOSED_LEVEL_LIMITS, RUN_LIMIT_MS, GAP_MIN_MS, obstacleOffset, readInput, scoreFor, type OfficeRun, type Row, type StepInput } from "./rules";
import { officeEscapeMeta } from "./meta";
vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));
import definition from "./index";

function nextRow(run: OfficeRun): Row | null {
   let best: Row | null = null;
   for (const row of run.rows) {
      if (row.alive && rowBack(row) >= run.distance && (!best || row.index < best.index)) best = row;
   }
   return best;
}

/** Visible-row strategy with a 120 ms action cooldown (human-paced, no two-lane instant moves).
 * The oracle uses the same strategy without that cooldown. Both hold their lane inside a row.
 */
function steer(run: OfficeRun, dtMs: number, out: StepInput, nextActionMs: number): boolean {
   const row = nextRow(run);
   if (!row || run.distance >= rowFront(row)) return false;
   let target = -1, cost = Infinity;
   for (let lane = 0; lane < 3; lane++) {
      if (!isPassable(row.lanes[lane])) continue;
      const c = Math.abs(lane - run.lane) * 2 + (row.lanes[lane] === NO_OBSTACLE ? 0 : 1);
      if (c < cost) { target = lane; cost = c; }
   }
   if (target < 0) throw new Error("no passable lane");
   if (target !== run.lane && run.simMs >= nextActionMs) out.lane = target > run.lane ? 1 : -1;
   const pressMs = row.inMs - 150;
   if (row.lanes[target] !== NO_OBSTACLE && run.simMs <= pressMs && run.simMs + Math.floor(run.carry + dtMs) > pressMs) out.jumpPressed = true;
   return out.lane !== 0;
}

type Bot = "oracle" | "honest" | "greedy" | "idle" | "spam";
function play(seed: number, level: OfficeLevel, fps: number, bot: Bot, untilMs: number) {
   const run = createRun(seed, level);
   const input = createStepInput();
   const store = createArcadeStore();
   store.getState().configure({});
   store.getState().markReady();
   store.getState().start();
   const id = LEVEL_IDS.find((id) => LEVELS[id] === level)!;
   const limits = PROPOSED_LEVEL_LIMITS[id];
   // Bulk sweeps use pure rules. Honest/greedy/idle/spam each have one real-store seed per rate.
   // L5 oracle seed 0 covers the full horizon. The unchanged suite covers L1's full store clock.
   const realClock = seed < 3 && (untilMs <= 180000 || (id === 5 && seed === 0));
   let elapsedMs = 0;
   let nextActionMs = 0, frame = 0, violations = 0, lastPassed = -1, lastOut = 0, generated = -1;
   let minGap = Infinity;
   while (!run.over && run.simMs < untilMs) {
      if (realClock) advanceRunClock(store, 1 / fps);
      const dtMs = realClock ? playedFrameDt(store.getState()) * 1000 : 1000 / fps;
      if (!dtMs) continue;
      elapsedMs = realClock ? store.getState().elapsedMs : elapsedMs + dtMs;
      input.lane = 0; input.lane2 = 0; input.jumpPressed = false;
      if (bot === "spam") {
         input.lane = frame % 2 ? 1 : -1;
         input.lane2 = frame % 3 ? -1 : 1;
         input.jumpPressed = true;
      } else if (bot !== "idle") {
         if (steer(run, dtMs, input, nextActionMs)) nextActionMs = run.simMs + (bot === "oracle" ? 0 : 120);
         // Greedy: take nearby coins only when the next row has a full second of recovery.
         const row = nextRow(run);
         if (bot === "greedy" && row && row.inMs - run.simMs > 1600 && run.simMs >= nextActionMs) {
            let nearest = Infinity, target = run.lane;
            for (const coin of run.coinPool) {
               if (coin.alive && !coin.taken && coin.kind === "ground" && coin.s > run.distance && coin.s < nearest && timeAt(coin.s + 600, level) + 1000 < row.inMs) {
                  nearest = coin.s; target = coin.lane;
               }
            }
            input.lane = target > run.lane ? 1 : target < run.lane ? -1 : 0;
            if (input.lane) nextActionMs = run.simMs + 120;
         }
      }
      const ev = step(run, dtMs, input);
      const s = store.getState();
      if (realClock) {
         if (ev.scoreChanged) s.setScore(run.score);
         if (ev.coin) s.setStat("coins", run.coins);
         if (ev.stageChanged) s.setLevel(run.stage + 1);
         if (ev.ended) s.end(ev.ended);
         if (s.elapsedMs + 1e-6 < run.simMs || s.elapsedMs - run.simMs >= 1 + 1e-6) violations++;
      }
      // Between score events the score is constant and the rate allowance only grows.
      if (ev.scoreChanged && capScore(run.score, elapsedMs, limits) !== run.score) violations++;
      if (run.poolFull || run.score !== scoreFor(run.distance, run.coins, level)) violations++;
      if (run.nextRow.index !== generated) {
         generated = run.nextRow.index;
         for (const row of run.rows) {
            if (row.alive && !row.lanes.some(isPassable)) violations++;
         }
      }
      const row = nextRow(run);
      if (row && row.index !== lastPassed) {
         if (lastPassed >= 0) minGap = Math.min(minGap, row.inMs - lastOut);
         lastPassed = row.index; lastOut = row.outMs;
      }
      frame++;
      if ((bot === "honest" || bot === "greedy") && run.score >= level.clearScore) break;
      if (bot === "oracle" && untilMs <= 180000 && run.score >= level.clearScore) break;
   }
   if (run.over && !withinServerLimits(run.score, elapsedMs, limits)) violations++;
   if (realClock && store.getState().score !== run.score) violations++;
   return { run, violations, minGap, score: run.score };
}

describe("office-escape levels", () => {
   const fullRunBests: number[] = [];
   it("declares five levels while preserving the live scoring contract", () => {
      expect(officeEscapeMeta.levels?.map((level) => level.id)).toEqual([1, 2, 3, 4, 5]);
      expect(officeEscapeMeta.levels?.[0].scoring).toEqual(officeEscapeMeta.scoring);
      expect(officeEscapeMeta.scoring).toEqual({ kind: "points", maxScore: 152500, minDurationMs: 4800, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 85, unitLabel: "pts", display: "int" });
   });

   it("matches the core/pilot shape, level overrides and proposed limits", () => {
      expect(definitionLevelProblems(officeEscapeMeta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(officeEscapeMeta.levels![id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(definition.levels![id - 1].config).toEqual(LEVELS[id]);
         expect(levelRunConfig(definition, id).durationMs).toBeUndefined();
         expect(levelHudStats(definition, id)).toEqual([{ key: "coins", label: "Coins" }]);
      }
      expect(levelInstructions(definition, 1)).toEqual(definition.instructions);
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["indoor", "day", "indoor", "night", "sunset"]);
   });

   it("difficulty, recovery pressure, targets and score potential increase monotonically", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as keyof typeof LEVELS], b = LEVELS[id];
         expect(b.speedBonus).toBeGreaterThan(a.speedBonus);
         expect(b.extraReductionMs).toBeGreaterThan(a.extraReductionMs);
         expect(b.minObstacles).toBeGreaterThanOrEqual(a.minObstacles);
         expect(b.movingMm).toBeGreaterThanOrEqual(a.movingMm);
         expect(b.motionPeriodMs).toBeLessThanOrEqual(a.motionPeriodMs);
         expect(b.clearScore).toBeGreaterThan(a.clearScore);
         expect(b.coinPoints).toBeGreaterThan(a.coinPoints);
         expect(distanceAt(RUN_LIMIT_MS, b)).toBeGreaterThan(distanceAt(RUN_LIMIT_MS, a));
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as keyof typeof LEVELS].maxScore);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1's explicit config is byte-for-byte equivalent in run output to the old default", () => {
      for (let seed = 0; seed < 20; seed++) {
         const a = createRun(seed), b = createRun(seed, LEVELS[1]);
         for (let frame = 0; frame < 400; frame++) {
            const input = { lane: (frame % 4 === 0 ? 1 : frame % 4 === 2 ? -1 : 0) as -1 | 0 | 1, jumpPressed: frame % 30 === 0 };
            step(a, 1000 / 60, input); step(b, 1000 / 60, input);
         }
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
   });

   it("moving hazards are real, bounded and reproducible; printer patterns retain a passable lane", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(123, LEVELS[id]);
         const row = run.rows.find((r) => r.alive)!;
         const positions = new Set<number>();
         for (let ms = 0; ms <= 2400; ms += 25) {
            run.simMs = ms;
            const offset = obstacleOffset(run, row, OBSTACLE.coffeeCart);
            expect(Math.abs(offset)).toBeLessThanOrEqual(150);
            expect(obstacleOffset(run, row, OBSTACLE.printer)).toBe(0);
            positions.add(offset);
         }
         expect(positions.size > 1).toBe(id >= 3);
         if (id >= 3) expect(row.lanes).toEqual([OBSTACLE.printer, OBSTACLE.printer, OBSTACLE.printer]);
      }
   });

   it("each level's generated track is independent of the frame rate", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 5; seed++) {
            const logs: string[] = [];
            for (const fps of [20, 30, 60, 144]) {
               const run = createRun(seed, LEVELS[id]);
               const rows = new Map<number, unknown>();
               const coins = new Map<number, unknown>();
               while (run.simMs < 120000) {
                  for (const row of run.rows) if (row.alive && row.inMs <= 120000) rows.set(row.index, [row.s, row.inMs, row.outMs, [...row.lanes]]);
                  for (const coin of run.coinPool) if (coin.alive && coin.s <= distanceAt(120000, LEVELS[id])) coins.set(coin.slot, [coin.s, coin.lane, coin.kind]);
                  advanceClock(run, 1000 / fps); updateTrack(run);
               }
               logs.push(JSON.stringify([[...rows].sort((a, b) => a[0] - b[0]), [...coins].sort((a, b) => a[0] - b[0])]));
            }
            expect(new Set(logs).size).toBe(1);
         }
      }
   });

   it("touch and keyboard actions have identical jump/steer timing on every level", () => {
      for (const id of LEVEL_IDS) {
         const a = createRun(17, LEVELS[id]), b = createRun(17, LEVELS[id]);
         for (let frame = 0; frame < 1200; frame++) {
            const move = frame % 120 === 0 ? -1 : frame % 120 === 60 ? 1 : 0;
            const jump = frame % 57 === 7;
            step(a, 1000 / 60, readInput(a.edges, { moveX: move, moveY: 0, jumpPressed: jump, swipe: null }, a.input));
            step(b, 1000 / 60, readInput(b.edges, { moveX: 0, moveY: 0, jumpPressed: false, swipe: move < 0 ? "left" : move > 0 ? "right" : jump ? "up" : null }, b.input));
            expect([a.simMs, a.x, a.jumpMs, a.feet, a.score, a.over]).toEqual([b.simMs, b.x, b.jumpMs, b.feet, b.score, b.over]);
         }
      }
   });

   it("every level retains the worst-case minimum-gap recovery, including buffered double jumps", () => {
      for (const id of LEVEL_IDS) for (let stage = 0; stage <= 8; stage++) {
         for (const airLeft of [-1, 700, 135]) for (const fps of [20, 30, 144]) {
            const level = LEVELS[id], run = createRun(17, level);
            for (const row of run.rows) row.alive = false;
            for (const coin of run.coinPool) coin.alive = false;
            run.nextRow.s = 1e12; run.nextRow.hd = 0; run.nextCoinSlot = 1e8;
            run.simMs = stage * 20000 + 19700;
            run.distance = distanceAt(run.simMs, level);
            run.lane = 0; run.x = -2000;
            run.jumpMs = airLeft < 0 ? -1 : 700 - airLeft;
            run.jumpBuffered = airLeft === 135;
            run.feet = jumpHeight(run.jumpMs);
            const row = run.rows[0];
            row.alive = true; row.index = 1; row.count = 3; row.hd = 650;
            row.lanes[0] = OBSTACLE.chair; row.lanes[1] = OBSTACLE.coffeeCart; row.lanes[2] = OBSTACLE.boxes;
            row.inMs = run.simMs + GAP_MIN_MS;
            row.s = distanceAt(row.inMs, level) + row.hd + 250;
            row.outMs = timeAt(row.s + row.hd + 250, level);
            const input = createStepInput();
            let nextActionMs = 0;
            while (!run.over && run.simMs <= row.outMs + 50) {
               input.lane = 0; input.jumpPressed = false;
               if (steer(run, 1000 / fps, input, nextActionMs)) nextActionMs = run.simMs + 120;
               step(run, 1000 / fps, input);
            }
            expect(run.endReason, `L${id}/stage${stage}/air${airLeft}/${fps}`).toBeNull();
         }
      }
   });

   it("B(t) fits every level's rate cap for every millisecond and its safety maximum", () => {
      const maxima: number[] = [];
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
         let worst = 0, maximum = 0;
         for (let ms = 4800; ms <= RUN_LIMIT_MS + 50; ms++) {
            const d = distanceAt(ms + 50, level);
            const n = Math.max(0, Math.ceil((d + 600 - 20000) / 10000));
            const bound = scoreFor(d, n - Math.floor(n / 7), level);
            worst = Math.max(worst, bound * 1000 / ms);
            if (ms <= RUN_LIMIT_MS - 1) maximum = bound;
         }
         expect(worst).toBeLessThanOrEqual(limits.maxPointsPerSec!);
         expect(maximum).toBeLessThanOrEqual(limits.maxScore);
         expect(limits.maxScore / maximum).toBeLessThan(1.05);
         maxima.push(maximum);
      }
      console.info("OFFICE envelopes", maxima);
   });

   for (const id of LEVEL_IDS) {
      it(`L${id}: oracle clears on 200 seeds, plus full-horizon runs, limits hold at every frame`, () => {
         let best = 0;
         for (let seed = 0; seed < 200; seed++) {
            const full = seed < 3;
            const result = play(seed, LEVELS[id], 20, "oracle", full ? RUN_LIMIT_MS + 50 : 180000);
            if (result.violations || (full && result.run.endReason !== "win") || result.score < LEVELS[id].clearScore || result.minGap < GAP_MIN_MS) throw new Error(`L${id} seed ${seed}: ${JSON.stringify({ violations: result.violations, end: result.run.endReason, gap: result.minGap })}`);
            best = Math.max(best, result.score);
         }
         console.info(`OFFICE L${id} oracle 200/200; best ${best}`);
         fullRunBests[id] = best;
      }, 55_000);

      it(`L${id}: 200 seeds with 30/60/144 Hz honest, greedy, idle and spam; >=90% honest clears`, () => {
         const rates: number[] = [];
         for (const fps of [30, 60, 144]) {
            let honest = 0, greedy = 0;
            let seeds = 0;
            for (let seed = 0; seed < 200; seed++) {
               if ([30, 60, 144][seed % 3] !== fps) continue;
               seeds++;
               for (const bot of ["honest", "greedy", "idle", "spam"] as const) {
                  const result = play(seed, LEVELS[id], fps, bot, 180000);
                  if (result.violations || result.minGap < GAP_MIN_MS) throw new Error(`L${id}/${fps}/${seed}/${bot}: rule or score violation`);
                  const cleared = isLevelCleared(result.run.endReason, result.score, officeEscapeMeta.levels![id - 1]);
                  if (bot === "honest" && cleared) honest++;
                  if (bot === "greedy" && cleared) greedy++;
                  if (bot === "idle" && cleared) throw new Error("idle cleared");
               }
            }
            expect(honest).toBeGreaterThanOrEqual(Math.ceil(seeds * 0.9));
            expect(greedy).toBeGreaterThanOrEqual(Math.ceil(seeds * 0.6));
            rates.push(honest, greedy);
         }
         console.info(`OFFICE L${id} honest/greedy at 30/60/144 Hz`, rates);
      }, 55_000);
   }

   it("the same full-horizon bot can earn at least as much on every harder level as on level 1", () => {
      for (const id of LEVEL_IDS.slice(1)) expect(fullRunBests[id]).toBeGreaterThanOrEqual(fullRunBests[1]);
   });
});

