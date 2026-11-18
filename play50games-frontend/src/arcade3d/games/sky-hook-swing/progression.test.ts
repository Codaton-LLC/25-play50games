import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { comboConfigProblems } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { bossProblems, hitsToDefeat } from "@/arcade3d/menu2/boss/boss";
import { levelOf } from "@/arcade3d/menu2/progress/progress";
import { loadProgress, memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { COMBO, GUST_GALLEON, SECRETS, starSpecFor } from "./progression";
import { LEVELS } from "./levels";
import { courseFor, createRun } from "./rules";
import { levelEndStats, runStars } from "./levelEnd";

describe("Sky Hook Swing structure", () => {
   it("combo, stars, secrets and the Gust Galleon are valid", () => {
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(bossProblems(GUST_GALLEON)).toEqual([]);
      expect(GUST_GALLEON.phases).toHaveLength(3);
      expect(hitsToDefeat(GUST_GALLEON, 1)).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, courseFor(id).mainOrbs))).toEqual([]);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].starTargetMs)).toEqual([45_000, 70_000, 90_000, 100_000, 150_000]);
   });

   it("a clear with every main orb under the target records three stars", () => {
      const storage = memoryProgressStorage();
      const run = createRun(1, 1, "nami");
      run.ended = "win";
      run.finishMs = 20_000;
      run.mainOrbs = run.course.mainOrbs;
      run.orbs = run.mainOrbs;
      run.hits = 0;
      const stars = runStars(run);
      expect(stars.clear).toBe(true);
      expect(stars.mask).toBe(7);
      const stats = levelEndStats(run, null, storage);
      expect(stats.stars).toBe(7);
      const saved = levelOf(loadProgress(null, storage), "sky-hook-swing", 1);
      expect(saved?.stars).toBe(7);
      expect(saved?.noHit).toBe(true);
   });
});
