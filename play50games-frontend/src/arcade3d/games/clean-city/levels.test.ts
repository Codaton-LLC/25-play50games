import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "../../types";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelRunConfig } from "../../core/levels";
import { levelMetaProblems, scoringFor } from "../../levelMeta";
import { COMBO_POINTS, COMBO_WINDOW_MS, EXTRA_BINS, HAZARDS, HAZARD_SLOW, LEVELS } from "./levels";
import { cleanCityMeta as meta } from "./meta";
import definition from "./index";
import { capScore, createRun, earliestFinishMs, finalRunScore, generateLayout, hazardX, isValidLayout, PROPOSED_LEVEL_LIMITS, RUNNER, step, withinServerLimits, type CleanRun, type StepInput } from "./rules";
vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));
const IDLE = { moveX: 0, moveY: 0 };
const place = (run: CleanRun, x: number, z: number) => { run.runner.x = x; run.runner.z = z; run.runner.vx = run.runner.vz = 0; };

describe("clean-city five level declarations", () => {
   it("matches core, meta and the proposed per-level limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
         expect(levelHudStats(definition, id)![0].max).toBe(LEVELS[id].items);
      }
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["day", "day", "sunset", "night", "sunset"]);
   });
   it("keeps the live L1 layout, score, timer and controls", () => {
      expect(meta.scoring).toEqual({ kind: "points", maxScore: 4940, minDurationMs: 43000, maxDurationMs: 250000, base: 1000, maxPointsPerSec: 100, unitLabel: "pts", display: "int" });
      expect(LEVELS[1]).toEqual({ items: 20, spacing: 5.4, durationMs: 240000, extraBins: 0, delivery: false, hazards: 0, matching: false, combo: false, points: 50, bonus: 10 });
      for (const seed of [0, 1, 4242, 0xffffffff]) {
         const run = createRun(seed, LEVELS[1]);
         for (let m = 0; m < 3; m++) expect(run.layouts[m]).toEqual(generateLayout(seed, m));
      }
      expect(definition.touchControls).toEqual(["joystick"]);
   });
   it("increases objectives and hazards, tightens the clock and preserves score potential", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as LevelId], b = LEVELS[id];
         expect(b.items).toBeGreaterThan(a.items);
         expect(b.durationMs).toBeLessThan(a.durationMs);
         expect(b.extraBins).toBeGreaterThan(a.extraBins);
         expect(b.hazards).toBeGreaterThanOrEqual(a.hazards);
         expect(b.spacing).toBeLessThan(a.spacing);
         expect(3 * b.items * b.points).toBeGreaterThanOrEqual(meta.scoring.maxScore);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * meta.scoring.maxScore);
   });
});

describe("clean-city level mechanics", () => {
   it("waits for delivery at the pad; no next-map pickup on the swap frame", () => {
      const run = createRun(9, LEVELS[2]);
      for (const slot of run.litter) slot.active = false;
      const last = run.litter[0]; last.active = true;
      run.items = 23; run.collected = 23; run.score = 23 * 75;
      place(run, last.x, last.z);
      expect(step(run, 16, IDLE).mapCleared).toBe(false);
      expect([run.delivering, run.map, run.items]).toEqual([true, 0, 24]);
      expect(step(run, 16, IDLE).nextMap).toBe(-1);
      place(run, 0, 12);
      const slots = [...run.litter];
      expect({ ...step(run, 16, IDLE) }).toEqual({ collected: -1, mapCleared: true, nextMap: 1, ended: null });
      expect(run.collected).toBe(24);
      expect(run.litter.every((s, i) => s === slots[i] && s.active)).toBe(true);
   });
   it("requires matching kinds and only advances after the last of the current kind", () => {
      for (const id of [4, 5] as const) {
         const run = createRun(12, LEVELS[id]);
         const wrong = run.litter.find((s) => s.kind === 2)!;
         place(run, wrong.x, wrong.z);
         expect(step(run, 16, IDLE).collected).toBe(-1);
         const matching = run.litter.filter((s) => s.kind < 2);
         for (const [i, s] of matching.entries()) {
            place(run, s.x, s.z); step(run, 16, IDLE);
            expect(s.active).toBe(false);
            expect(run.targetKind).toBe(i === matching.length - 1 ? 2 : 0);
         }
         place(run, wrong.x, wrong.z); step(run, 16, IDLE);
         expect(wrong.active).toBe(false);
      }
   });
   it("uses one pause-safe combo window, including its exact edge, on either input device", () => {
      for (const gap of [COMBO_WINDOW_MS, COMBO_WINDOW_MS + 1]) {
         const run = createRun(3, LEVELS[5]);
         const s = run.litter.find((s) => s.kind === 0)!;
         place(run, s.x, s.z); run.simMs = 10000; run.lastPickupMs = 10001 - gap;
         step(run, 1, IDLE);
         expect(run.score).toBe(75 + (gap === COMBO_WINDOW_MS ? COMBO_POINTS : 0));
      }
   });
   it("moving hazards share the drawn path and slow without pushing or exceeding the global speed bound", () => {
      for (const id of [3, 4, 5] as const) for (const hz of [30, 60, 144]) {
         const run = createRun(8, LEVELS[id]);
         place(run, hazardX(0, 0), HAZARDS[0].z);
         step(run, 1000 / hz, { moveX: 0, moveY: 1 });
         expect(run.slowed).toBe(true);
         expect(Math.hypot(run.runner.vx, run.runner.vz)).toBeLessThanOrEqual(RUNNER.speed * HAZARD_SLOW + 1e-9);
         const events = run.events, slots = run.litter, first = slots[0];
         for (let k = 0; k < 1000; k++) {
            const x = run.runner.x, z = run.runner.z;
            step(run, 1000 / hz, { moveX: 100 * Math.sin(k), moveY: 100 * Math.cos(k) });
            if (run.events.nextMap === -1) expect(Math.hypot(run.runner.x - x, run.runner.z - z)).toBeLessThanOrEqual(RUNNER.speed * run.stepMs / 1000 + 1e-9);
         }
         expect(run.events).toBe(events); expect(run.litter).toBe(slots); expect(slots[0]).toBe(first);
      }
   });
});

describe("clean-city limits: analytic proof at every reachable time", () => {
   for (const id of LEVEL_IDS) it(`L${id}: prefix, win and time-up bounds`, () => {
      const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
      const n = level.items * 3, earliest = earliestFinishMs(level);
      expect(limits.minDurationMs).toBeLessThanOrEqual(earliest);
      expect(limits.maxDurationMs).toBeGreaterThanOrEqual(level.durationMs);
      const maxPickup = level.points + (level.combo ? COMBO_POINTS : 0);
      for (let k = 1; k <= n; k++) {
         // Restarting at the pad costs >=3.2 units; pair legs cost >= spacing-1.6.
         const maps = Math.ceil(k / level.items), legs = k - maps;
         const t = (maps * 3.2 + legs * (level.spacing - 1.6)) / RUNNER.speed;
         expect(k * maxPickup).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * t);
      }
      let failedWindows = 0;
      for (let ms = earliest; ms < level.durationMs; ms += 10) {
         const ceiling = n * maxPickup + level.bonus * Math.floor((level.durationMs - ms) / 1000);
         if (!withinServerLimits(ceiling, ms, limits)) failedWindows++;
      }
      expect(failedWindows).toBe(0);
      expect(withinServerLimits(n * maxPickup, level.durationMs, limits)).toBe(true);
      expect(EXTRA_BINS.length).toBeGreaterThanOrEqual(level.extraBins);
   });
});

// Native TS-transpiled child avoids Vite's VM overhead in tens of millions of clock ticks.
// Like the pilot: 200-seed pure sweeps, plus every bot at 30/60/144 Hz through the real store.
describe("clean-city per-level bot and store proofs", () => {
   type Report = { levels: { id: number; seeds: number; runs: number; storeRuns: number; humanRuns: number; wins: number; clears: number; best: number; honestBest: number; slowest: number; maxPasses: number }[]; runtimeMs: number };
   let report: Report;
   beforeAll(() => {
      report = JSON.parse(execFileSync(process.execPath, [resolve("src/arcade3d/games/clean-city/probe.cjs"), "200"], {
         cwd: process.cwd(), encoding: "utf8", timeout: 55000,
      }));
      console.info(`clean-city store bot proof: ${JSON.stringify(report)}`);
   }, 60000);
   for (const id of LEVEL_IDS) it(`L${id}: 200 seeds, honest clears, 30/60/144 Hz oracle and adversarial limits`, () => {
      const row = report.levels[id - 1];
      expect(row.id).toBe(id); expect(row.seeds).toBe(200); expect(row.runs).toBe(1000); expect(row.storeRuns).toBe(15);
      expect(row.wins / row.humanRuns).toBeGreaterThanOrEqual(0.9);
      expect(row.clears / row.humanRuns).toBeGreaterThanOrEqual(0.9);
      expect(row.best).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore * 0.9);
      if (id > 1) expect(row.honestBest).toBeGreaterThanOrEqual(meta.scoring.maxScore);
      expect(row.maxPasses).toBeLessThanOrEqual(40);
   });
});
