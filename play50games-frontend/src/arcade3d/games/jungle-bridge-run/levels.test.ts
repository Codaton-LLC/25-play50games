import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { fogConfigFor } from "./looks";
import { jungleBridgeRunMeta as meta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, createRun, earliestWinS } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

describe("jungle-bridge-run levels", () => {
   it("five levels in meta and the definition, limits = PROPOSED_LEVEL_LIMITS, cleared by a win only", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.levels!.map((l) => l.title)).toEqual(LEVEL_IDS.map((id) => LEVEL_TITLES[id]));
      expect(meta.levels!.every((l) => l.clearScore === undefined)).toBe(true);
      expect(meta).toMatchObject({ slug: "jungle-bridge-run", status: "dev", owner: "antigravity", collection: "adventure", order: 46, difficulty: 2 });
      expect(meta.controls.scheme).toBe("runner");
   });

   it("each level's spec carries its own config, clock, lives, lighting, fog and HUD maxima", () => {
      for (const id of LEVEL_IDS) {
         const spec = definition.levels!.find((l) => l.id === id)!;
         const level = LEVELS[id];
         expect(spec.config).toBe(level);
         expect(spec.description).toBe(LEVEL_LINES[id]);
         expect(levelRunConfig(definition, id)).toMatchObject({ durationMs: level.durationMs, lives: 3, resultDelayMs: 900 });
         const env = levelEnvironment(definition, id)!;
         expect(env).toMatchObject({ background: level.background, lighting: level.lighting });
         expect(env.fog).toEqual(fogConfigFor(level));
         expect(levelHudStats(definition, id)).toEqual([
            { key: "section", label: "Section", max: level.sections },
            { key: "gems", label: "Gems", max: level.sections * level.gemsPerSection },
         ]);
         expect(levelInstructions(definition, id).length).toBe(3);
      }
      expect(definition.touchControls).toEqual([]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].lighting)).toEqual(["day", "day", "day", "sunset", "sunset"]);
   });

   it("matches the spec's level table", () => {
      expect(LEVEL_IDS.map((id) => [LEVELS[id].sections, LEVELS[id].speed, LEVELS[id].logSpeed, LEVELS[id].durationMs, LEVELS[id].fogFar])).toEqual([
         [3, 6.0, 0, 75_000, 70],
         [5, 6.5, 0, 90_000, 60],
         [7, 7.0, 2.5, 110_000, 55],
         [9, 7.8, 3.2, 120_000, 45],
         [12, 8.4, 3.6, 120_000, 40],
      ]);
      expect(LEVELS[5].patterns).toContain("lava");
      expect(LEVEL_IDS.filter((id) => LEVELS[id].patterns.includes("lava"))).toEqual([5]);
   });

   it("difficulty never drops: more sections, faster, more patterns, a tighter clock per section; every level pays at least L1; L5 <= 3 x L1", () => {
      for (let id = 2; id <= 5; id++) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id as LevelId];
         expect(b.sections).toBeGreaterThan(a.sections);
         expect(b.speed).toBeGreaterThan(a.speed);
         expect(b.patterns.length).toBeGreaterThanOrEqual(a.patterns.length);
         for (const p of a.patterns) expect(b.patterns).toContain(p);
         expect(b.logSpeed).toBeGreaterThanOrEqual(a.logSpeed);
         expect(b.fogFar).toBeLessThanOrEqual(a.fogFar);
         expect(b.durationMs / b.sections).toBeLessThanOrEqual(a.durationMs / a.sections);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].base).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].base);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("createRun reads the level it is given", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id], id);
         expect(run.sections.length).toBe(LEVELS[id].sections);
         expect(run.speed).toBe(LEVELS[id].speed);
         expect(run.gems.length).toBe(LEVELS[id].sections * LEVELS[id].gemsPerSection);
         expect(earliestWinS(LEVELS[id])).toBeCloseTo((6 + 24 * LEVELS[id].sections) / LEVELS[id].speed, 9);
      }
   });
});
