import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { dogParkFetchMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("dog park levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(dogParkFetchMeta)).toEqual([]);
      expect(definitionLevelProblems(dogParkFetchMeta, definition)).toEqual([]);
      expect(dogParkFetchMeta.slug).toBe("dog-park-fetch");
      expect(dogParkFetchMeta.status).toBe("dev");
      expect(dogParkFetchMeta.owner).toBe("kimi");
      expect(dogParkFetchMeta.collection).toBe("adventure");
      expect(dogParkFetchMeta.order).toBe(41);
      expect(dogParkFetchMeta.difficulty).toBe(1);
      expect(dogParkFetchMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "jump"]);
      expect(definition.touchLabels).toEqual({ jump: "Jump" });
      expect(definition.lives).toBeUndefined();
      expect(definition.resultDelayMs).toBe(900);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(dogParkFetchMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(dogParkFetchMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(dogParkFetchMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         expect(definition.levels?.[id - 1].config).toBe(level);
         expect(levelHudStats(definition, id)?.find((stat) => stat.key === "fetched")?.max).toBe(level.throws);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
