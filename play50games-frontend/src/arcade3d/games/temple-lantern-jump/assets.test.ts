// The models: listed in the manifest, on disk, within budget, GLB_SIZE equal to the real
// (meshopt-decoded) meshes; the definition's levels; the progression data (stars, secrets, the Queen);
// the level end through the progress adapter; the hero motion writer.
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
import { templeLanternJumpMeta } from "./meta";
import { QUEEN, SECRETS, starSpecFor } from "./progression";
import { levelEndStats } from "./levelEnd";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { createRun } from "./rules";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

describe("temple-lantern-jump models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(statSync(path.join(PUBLIC, asset.url)).size).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }
   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
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
      expect(definitionLevelProblems(templeLanternJumpMeta, definition)).toEqual([]);
      expect(definition.levels).toHaveLength(5);
   });
});

describe("progression", () => {
   it("the Queen, the secrets and the star specs are valid", () => {
      expect(bossProblems(QUEEN)).toEqual([]);
      expect(QUEEN.phases).toHaveLength(3);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, createRun(1, id).course.orbs.length))).toEqual([]);
      }
   });

   it("the level end records stars and xp through the progress adapter", () => {
      const run = createRun(1, 1);
      run.ended = "win";
      run.finishMs = 40000;
      run.orbs = run.course.orbs.length;
      const s = levelEndStats(run, null, memoryProgressStorage());
      expect(s.stars & 1).toBe(1);
      expect(s.xp).toBeGreaterThan(0);
   });
});

describe("the hero motion writer", () => {
   it("grounded on a ledge, airborne after a bounce", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.grounded).toBe(true);
      Object.assign(run.hero, { grounded: false, vy: 8 });
      writeHeroMotion(m, memo, run, anim, 0.1);
      expect(m.grounded).toBe(false);
      expect(m.vy).toBe(8);
   });
});
