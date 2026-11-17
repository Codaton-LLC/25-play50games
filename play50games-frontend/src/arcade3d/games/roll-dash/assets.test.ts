// The models: listed in the manifest, on disk, within budget, GLB_SIZE equal to the real (meshopt-decoded)
// meshes; the definition's levels; the progression data (stars, secrets, the Hawk); the level end through
// the progress adapter; the hero motion writer.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE } from "./assets";
import definition from "./index";
import { rollDashMeta } from "./meta";
import { HAWK, SECRETS, starSpecFor } from "./progression";
import { levelEndStats } from "./levelEnd";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { createRun, orbTotal } from "./rules";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

const SIZE_OF: Record<string, keyof typeof GLB_SIZE> = {
   crate: "crate",
   tesla: "tesla",
   ghostWall: "ghostWall",
   coin: "coin",
   stall: "stall",
   house: "house",
   lamp: "lamp",
   hawk: "hawk",
   barrier: "barrier",
   cart: "cart",
   gate: "gate",
   roller: "roller",
};

describe("roll-dash models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(statSync(path.join(PUBLIC, asset.url)).size).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }
   for (const [key, sizeKey] of Object.entries(SIZE_OF)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0)`, async () => {
         const size = GLB_SIZE[sizeKey];
         const { cloud } = await readCharacterGlb(ASSETS[key].url);
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i += 3)
            for (let k = 0; k < 3; k++) {
               min[k] = Math.min(min[k], cloud[i + k]);
               max[k] = Math.max(max[k], cloud[i + k]);
            }
         expect(max[0] - min[0]).toBeCloseTo(size.x, 2);
         expect(max[1] - min[1]).toBeCloseTo(size.y, 2);
         expect(max[2] - min[2]).toBeCloseTo(size.z, 2);
         expect(min[1]).toBeCloseTo(0, 2);
      });
   }

   it("the definition's five levels match meta", () => {
      expect(definitionLevelProblems(rollDashMeta, definition)).toEqual([]);
      expect(definition.levels).toHaveLength(5);
   });
});

describe("progression", () => {
   it("the Hawk, the secrets and the star specs are valid", () => {
      expect(bossProblems(HAWK)).toEqual([]);
      expect(HAWK.phases).toHaveLength(3);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, orbTotal(id)))).toEqual([]);
      }
   });

   it("the level end records the run through the progress adapter", () => {
      const run = createRun(1, 1);
      run.ended = "win";
      run.finishMs = 50_000;
      const stats = levelEndStats(run, null, memoryProgressStorage());
      expect(stats.stars & 1).toBe(1);
      expect(stats.xp).toBeGreaterThan(0);
   });

   it("the hero motion writer: the ball-roll on the street, uncurled in a jump", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const anim = createHeroAnim();
      writeHeroMotion(m, createMotionMemo(), run, anim, 0);
      expect(m.rolling).toBe(true);
      expect(m.vz).toBeLessThan(0);
      run.hero.grounded = false;
      run.hero.y = 1;
      const m2 = createHeroMotion();
      writeHeroMotion(m2, createMotionMemo(), run, anim, 0);
      expect(m2.rolling).toBe(false);
   });
});
