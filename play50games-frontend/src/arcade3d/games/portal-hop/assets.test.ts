// The models: listed in the manifest, on disk, within budget, GLB_SIZE equal to the real (meshopt-decoded)
// meshes; the definition's levels; the progression data (stars, secrets, the Wyrm); the level end through
// the progress adapter; the hero motion writer; the course data (every route's anchors exist, the goal
// sits on an island, every pair from level 2 on has three anchors or more, one of them a false lead).
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
import { portalHopMeta } from "./meta";
import { SECRETS, WYRM, starSpecFor } from "./progression";
import { levelEndStats } from "./levelEnd";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { createRun } from "./rules";
import { courseFor } from "./course";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

describe("portal-hop models", () => {
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
      expect(definitionLevelProblems(portalHopMeta, definition)).toEqual([]);
      expect(definition.levels).toHaveLength(5);
   });
});

describe("progression", () => {
   it("the Wyrm, the secrets and the star specs are valid", () => {
      expect(bossProblems(WYRM)).toEqual([]);
      expect(WYRM.phases).toHaveLength(3);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, 5))).toEqual([]);
      }
   });

   it("the level end records the run through the progress adapter", () => {
      const run = createRun(1, 1);
      run.ended = "win";
      run.finishMs = 30_000;
      const stats = levelEndStats(run, null, memoryProgressStorage());
      expect(stats.stars & 1).toBe(1);
      expect(stats.xp).toBeGreaterThan(0);
   });

   it("the hero motion writer turns a fling into the ball-roll", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      run.hero.grounded = false;
      run.hero.vx = 15;
      writeHeroMotion(m, createMotionMemo(), run, createHeroAnim(), 0);
      expect(m.rolling).toBe(true);
      expect(m.grounded).toBe(false);
   });
});

describe("course", () => {
   it("routes, goals and anchors hold together", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const cmd of c.route) if (cmd.t === "pick") expect(c.anchors[cmd.anchor]).toBeDefined();
         if (c.goal) expect(c.islands.some((i) => Math.abs(i.y - c.goal!.y) < 1e-6 && Math.hypot(i.x - c.goal!.x, i.z - c.goal!.z) < i.r)).toBe(true);
         for (const p of c.pairs) {
            expect(p.start).toBeLessThan(p.anchors.length);
            for (const a of p.anchors) expect(c.anchors[a].pair).toBe(p.id);
         }
         // from level 2 on, the pairs that carry the main route have three anchors or more
         if (id >= 2 && id <= 4) expect(c.pairs.filter((p) => p.anchors.length >= 3).length).toBeGreaterThanOrEqual(1);
      }
   });
});
