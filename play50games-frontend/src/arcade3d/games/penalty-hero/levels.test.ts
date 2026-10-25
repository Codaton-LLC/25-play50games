// Five levels (docs/arcade-levels.md §6.3): declarations, Level 1 compatibility, monotone
// difficulty, target/timing rules, fairness and the analytic server-limit proof per level.
// The 200-seed honest-bot and real-store proofs are in rules.levels.test.ts.
import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { penaltyHeroMeta as meta } from "./meta";
import {
   AIM_TIMEOUT_MS,
   CYCLE_MS,
   FLIGHT_MS,
   NEXT_GOAL_POINTS,
   RUNUP_MS,
   SHOTS,
   ZONE_CENTRE_X,
   ZONE_CENTRE_Y,
   ZONE_WIDTH,
   PROPOSED_LEVEL_LIMITS,
   createRun,
   isAccurate,
   levelReticleOffset,
   levelZoneAt,
   reticleOffset,
   step,
   targetDrift,
   zoneAt,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const previous = (id: LevelId) => LEVELS[(id - 1) as LevelId];

describe("penalty-hero levels: declarations", () => {
   it("declares five matching meta and definition levels with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.levels!.map((level) => level.title)).toEqual(["Training", "Local Cup", "Night Match", "Semi Final", "Final Shootout"]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.levels!.every((level) => level.clearScore === undefined)).toBe(true);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS.slice(1)) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
      }
   });

   it("keeps Level 1 exactly on today's rules, limits, environment, HUD and instructions", () => {
      expect(meta.scoring).toEqual({
         kind: "points", maxScore: 1450, minDurationMs: 15500, maxDurationMs: 225000,
         base: 0, maxPointsPerSec: 95, unitLabel: "pts", display: "int",
      });
      expect(LEVELS[1]).toEqual({
         shots: SHOTS,
         goalsToWin: 0,
         nextGoalPoints: NEXT_GOAL_POINTS,
         keeperRead: 0,
         targetScale: 1,
         reticleBand: 0.25,
         reticlePeriodS: 1.2,
         movePeriodMs: 0,
         wind: 0,
         aimTimeoutMs: AIM_TIMEOUT_MS,
      });
      expect(createRun(7).config).toBe(LEVELS[1]);
      expect(createRun(7, LEVELS[1]).weights).toEqual([2, 2, 2, 2, 2, 2]);
      expect(levelEnvironment(definition, 1)).toEqual({ background: "#0b1226", fog: ["#0b1226", 40, 90], lighting: "day" });
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: undefined, resultDelayMs: undefined });
      expect(levelHudStats(definition, 1)).toEqual([{ key: "shots", label: "Shots", max: 10 }]);
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      for (const ms of [0, 300, 600, 1337]) expect(levelReticleOffset(ms, 0.4, LEVELS[1])).toBeCloseTo(reticleOffset(ms, 0.4), 12);
   });

   it("uses each level's shot maximum, instructions and core lighting preset", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(levelHudStats(definition, id)![0].max).toBe(level.shots);
         if (id > 1) expect(levelInstructions(definition, id).join(" ")).toContain(`${level.shots} shots`);
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
      }
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["day", "day", "sunset", "night", "sunset"]);
      expect(levelEnvironment(definition, 4)!.background).not.toBe(levelEnvironment(definition, 1)!.background);
      expect(levelEnvironment(definition, 5)!.background).not.toBe(levelEnvironment(definition, 4)!.background);
   });
});

describe("penalty-hero levels: difficulty and rules", () => {
   it("is monotone in attempts, goal targets, keeper skill, targets, timing, movement and wind", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = previous(id), b = LEVELS[id];
         expect(b.shots).toBeGreaterThan(a.shots);
         expect(b.goalsToWin).toBeGreaterThan(a.goalsToWin);
         expect(b.nextGoalPoints).toBeGreaterThanOrEqual(a.nextGoalPoints);
         expect(b.keeperRead).toBeGreaterThan(a.keeperRead);
         expect(b.targetScale).toBeLessThan(a.targetScale);
         expect(b.reticleBand).toBeLessThan(a.reticleBand);
         expect(b.reticlePeriodS).toBeLessThan(a.reticlePeriodS);
         expect(b.aimTimeoutMs).toBeLessThan(a.aimTimeoutMs);
         expect(b.wind).toBeGreaterThanOrEqual(a.wind);
         if (a.movePeriodMs === 0) expect(b.movePeriodMs).toBeGreaterThan(0);
         else expect(b.movePeriodMs).toBeLessThan(a.movePeriodMs);
      }
   });

   it("keeps every moving, shrunk target inside its original goal zone", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let zone = 0; zone < 6; zone++) {
            for (let shot = 0; shot < level.shots; shot++) {
               for (const ms of [0, 317, 900, 1900, 5000]) {
                  const drift = targetDrift(ms, zone, shot, level);
                  expect(Math.abs(drift) + (ZONE_WIDTH * level.targetScale) / 2).toBeLessThanOrEqual(ZONE_WIDTH / 2 + 1e-9);
                  const col = zone % 3, row = zone < 3 ? 1 : 0;
                  expect(levelZoneAt(ZONE_CENTRE_X[col] + drift, ZONE_CENTRE_Y[row], ms, shot, level)).not.toBeNull();
               }
            }
         }
         expect(targetDrift(1234, 0, 0, level)).toBe(targetDrift(1234, 0, 0, level));
      }
      expect(targetDrift(1234, 0, 0, LEVELS[1])).toBe(0);
   });

   it("shrinks touch targets without changing Level 1's goal-plane mapping", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const mapped = levelZoneAt(-3.66, 0.61, 0, 0, level);
         if (id === 1) expect(mapped).toBe(zoneAt(-3.66, 0.61));
         else expect(mapped).toBeNull();
      }
   });

   for (const id of LEVEL_IDS) it(`L${id}: touch and keyboard share the same shot window and outcome`, () => {
      const touch = createRun(9876, LEVELS[id]);
      const keyboard = createRun(9876, LEVELS[id]);
      let guard = 0;
      while (guard++ < 10000) {
         const offset = levelReticleOffset(touch.aimMs, touch.reticlePhase, LEVELS[id]);
         if (isAccurate(offset, LEVELS[id].reticleBand)) break;
         step(touch, 10);
         step(keyboard, 10);
      }
      expect(touch.phase).toBe("aim");
      step(touch, 10, { zoneId: "top-right" });
      step(keyboard, 10, { pressed: { right: true, up: true }, jumpPressed: true });
      expect(keyboard.pending).toEqual(touch.pending);
      expect(keyboard.targetX).toBeCloseTo(touch.targetX, 12);
      expect(keyboard.targetY).toBe(touch.targetY);
      expect(keyboard.keeperIndex).toBe(touch.keeperIndex);
      while (!touch.ended && guard++ < 20000) {
         step(touch, 50);
         step(keyboard, 50);
      }
      expect(keyboard.score).toBe(touch.score);
      expect(keyboard.lastResult).toBe(touch.lastResult);
   });
});

describe("penalty-hero levels: analytic server-limit proof", () => {
   for (const id of LEVEL_IDS) it(`L${id}: B(t) fits base + pps t, maxScore and the duration window`, () => {
      const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
      const n = level.shots, p = level.nextGoalPoints;
      const maximum = 100 + (n - 1) * p;
      const fastestMs = n * CYCLE_MS;
      const finalGoalMs = (n - 1) * CYCLE_MS + RUNUP_MS + FLIGHT_MS;
      const longestMs = n * (level.aimTimeoutMs + CYCLE_MS);
      expect(limits.maxScore).toBe(maximum);
      expect(limits.minDurationMs).toBeLessThanOrEqual(fastestMs);
      expect(limits.minDurationMs).toBeGreaterThan(fastestMs * 0.95);
      expect(limits.maxDurationMs).toBeGreaterThanOrEqual(longestMs + 50);
      expect(limits.maxDurationMs).toBeGreaterThanOrEqual(longestMs * 1.03);
      expect(limits.maxDurationMs).toBeLessThanOrEqual(longestMs * 1.05);
      expect(maximum * 1000).toBeLessThanOrEqual(limits.maxPointsPerSec! * limits.minDurationMs);
      expect(limits.maxPointsPerSec!).toBeGreaterThanOrEqual((maximum * 1000) / finalGoalMs);
      expect(limits.maxPointsPerSec!).toBeLessThanOrEqual(Math.ceil(((maximum * 1000) / finalGoalMs) * 1.05));
      // B(t): k consecutive goals cannot resolve before k run-ups + flights and k-1 holds.
      for (let k = 1; k <= n; k++) {
         const atMs = (k - 1) * CYCLE_MS + RUNUP_MS + FLIGHT_MS;
         const score = 100 + (k - 1) * p;
         expect(score * 1000).toBeLessThanOrEqual(limits.base! * 1000 + limits.maxPointsPerSec! * atMs + 1e-6);
      }
   });
});
