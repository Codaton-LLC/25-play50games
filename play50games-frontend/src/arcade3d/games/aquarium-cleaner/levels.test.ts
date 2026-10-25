import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES, tasksOf } from "./levels";
import { aquariumCleanerMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, TASK_POINTS, objectiveCeiling } from "./rules";
import { play } from "./testing/bot";

describe("aquarium levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(aquariumCleanerMeta)).toEqual([]);
      expect(definitionLevelProblems(aquariumCleanerMeta, definition)).toEqual([]);
      expect(aquariumCleanerMeta.slug).toBe("aquarium-cleaner");
      expect(aquariumCleanerMeta.status).toBe("dev");
      expect(aquariumCleanerMeta.owner).toBe("kimi");
      expect(aquariumCleanerMeta.order).toBe(49);
      expect(aquariumCleanerMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "action", "jump"]);
      expect(definition.touchLabels).toEqual({ action: "Work", jump: "Float" });
      expect(definition.lives).toBe(3);
      expect(tasksOf(LEVELS[1])).toBe(3);
      expect(LEVEL_IDS.map((id) => tasksOf(LEVELS[id]))).toEqual([3, 4, 5, 6, 8]);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(aquariumCleanerMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(aquariumCleanerMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(aquariumCleanerMeta.levels?.[id - 1].scoring.base).toBe(objectiveCeiling(level));
         expect(aquariumCleanerMeta.levels?.[id - 1].scoring.maxDurationMs).toBe(level.durationMs);
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         expect(levelHudStats(definition, id)?.find((s) => s.key === "tasks")?.max).toBe(tasksOf(level));
      }
   });

   it("level 1 is the base and difficulty never decreases", () => {
      expect(LEVELS[1].sharks).toBe(0);
      expect(LEVELS[1].highAlgae).toBe(0);
      expect(LEVELS[1].current).toBe(false);
      for (const id of [2, 3, 4, 5] as const) {
         const a = LEVELS[(id - 1) as 1 | 2 | 3 | 4];
         const b = LEVELS[id];
         expect(tasksOf(b)).toBeGreaterThanOrEqual(tasksOf(a));
         expect(b.airDrain).toBeGreaterThanOrEqual(a.airDrain);
         expect(b.sharks).toBeGreaterThanOrEqual(a.sharks);
         expect(b.highAlgae).toBeGreaterThanOrEqual(a.highAlgae);
         expect(b.width * b.depth).toBeGreaterThanOrEqual(a.width * a.depth);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(Number(b.current)).toBeGreaterThanOrEqual(Number(a.current));
         if (b.sharks > 0 && a.sharks > 0) expect(b.sharkSpeed).toBeGreaterThanOrEqual(a.sharkSpeed);
      }
   });

   it("every level pays at least level 1's points, and level 5 stays within about 3x level 1", () => {
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(objectiveCeiling(LEVELS[id])).toBeGreaterThanOrEqual(objectiveCeiling(LEVELS[1]));
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("clearScore is every task done (120 each); a paced player reaches it on at least 99% of seeds and an idle one never", () => {
      for (const id of LEVEL_IDS) {
         const meta = aquariumCleanerMeta.levels![id - 1];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         if (id < 5) {
            expect(meta.clearScore).toBe(TASK_POINTS * tasksOf(LEVELS[id]));
            expect(meta.clearScore!).toBeLessThanOrEqual(limits.maxScore);
         } else expect(meta.clearScore).toBeUndefined();
         let cleared = 0;
         const seeds = 100;
         for (let seed = 0; seed < seeds; seed++) {
            const human = play(id, seed + 1000, 30, "human");
            expect(withinServerLimits(human.score, human.ms, limits)).toBe(true);
            if (human.reason === "win" || (meta.clearScore !== undefined && human.score >= meta.clearScore)) cleared += 1;
            if (seed < 10) {
               const idle = play(id, seed, 20, "idle");
               expect(idle.reason).not.toBe("win");
               expect(idle.score).toBeLessThan(meta.clearScore ?? 1);
            }
         }
         expect(cleared / seeds, `level ${id}`).toBeGreaterThanOrEqual(0.99);
      }
   }, 900_000);
});
