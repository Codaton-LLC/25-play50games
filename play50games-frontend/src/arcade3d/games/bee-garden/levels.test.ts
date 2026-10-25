import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { beeGardenMeta as meta } from "./meta";
import { createRun, PROPOSED_LEVEL_LIMITS, PROPOSED_LIMITS, TUNING } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("bee-garden levels: declarations", () => {
   it("declares five levels in meta and definition with proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);

      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      }
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);

      // Cleared by win only (no artificial clearScore)
      expect(meta.levels!.every((level) => level.clearScore === undefined)).toBe(true);

      // Decision 3: level 5 maxScore <= 3x level 1 maxScore
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 matches specifications: same units, hazards, and look", () => {
      const l1 = LEVELS[1];
      expect(l1.units).toBe(10);
      expect(l1.webs).toBe(0);
      expect(l1.branches).toBe(2);
      expect(l1.breeze).toBe(false);
      expect(l1.durationMs).toBe(120_000);
      expect(l1.lighting).toBe("day");

      expect(levelEnvironment(definition, 1)!.lighting).toBe("day");
      expect(levelRunConfig(definition, 1).resultDelayMs).toBe(TUNING.resultDelayMs);
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
   });

   it("monotone difficulty progression across levels 1-5", () => {
      for (let id = 2 as LevelId; id <= 5; id++) {
         const curr = LEVELS[id];
         const prev = LEVELS[(id - 1) as LevelId];

         expect(curr.units).toBeGreaterThan(prev.units);
         expect(curr.webs).toBeGreaterThanOrEqual(prev.webs);
         expect(curr.branches).toBeGreaterThanOrEqual(prev.branches);
         expect(curr.width * curr.depth).toBeGreaterThan(prev.width * prev.depth);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
      }
   });

   it("all flowers are reachable and unobstructed across 200 seeds", () => {
      for (let seed = 1; seed <= 200; seed++) {
         const run = createRun(seed, LEVELS[5], 5);
         expect(run.flowers.length).toBe(LEVELS[5].units);

         for (const fl of run.flowers) {
            // Distance from any branch obstacle
            for (const b of run.branches) {
               const dist = Math.hypot(fl.x - b.x, fl.z - b.z);
               expect(dist).toBeGreaterThanOrEqual(b.radius + 0.3);
            }
         }
      }
   });
});
