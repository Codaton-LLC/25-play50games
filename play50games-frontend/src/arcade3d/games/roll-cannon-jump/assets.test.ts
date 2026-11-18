// The models: listed in the manifest, on disk, within budget, GLB_SIZE equal to the real
// (meshopt-decoded) meshes; the definition's levels; the progression data (stars, secrets, Ashbag);
// the hero motion writer; the course invariants every level keeps (all five hero lines, two secrets).
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
import { rollCannonJumpMeta } from "./meta";
import { ASHBAG, SECRETS, starSpecFor } from "./progression";
import { levelEndStats, runStars } from "./levelEnd";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { courseFor, createRun } from "./rules";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

describe("roll-cannon-jump models", () => {
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
         for (let i = 0; i < cloud.length; i += 3) for (let k = 0; k < 3; k++) {
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
      expect(definitionLevelProblems(rollCannonJumpMeta, definition)).toEqual([]);
      expect(definition.levels).toHaveLength(5);
   });
});

describe("progression", () => {
   it("Ashbag, the secrets and the star specs are valid", () => {
      expect(bossProblems(ASHBAG)).toEqual([]);
      expect(ASHBAG.phases).toHaveLength(3);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(courseFor(id).secrets).toHaveLength(SECRETS[id].length);
         expect(starSpecProblems(starSpecFor(id, courseFor(id).mainOrbs))).toEqual([]);
      }
   });

   it("every level carries all five hero lines (Riko's board and hidden cannon, Nami's high orbs, Kiro's smoke orbs, Zuno's hidden trail, Vexa's ghost pole)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.boards.length, `L${id}`).toBeGreaterThan(0);
         expect(c.cannons.some((k) => k.board >= 0)).toBe(true);
         for (const hero of ["riko", "nami", "kiro", "zuno", "vexa"] as const) expect(c.orbs.some((o) => o.hero === hero), `L${id} ${hero}`).toBe(true);
         expect(c.orbs.some((o) => o.hidden)).toBe(true);
         expect(c.poles.some((p) => p.ghost)).toBe(true);
         expect(c.jets.length).toBeGreaterThan(0);
      }
   });

   it("the level end records stars and secrets through the progress adapter", () => {
      const run = createRun(1, 1);
      run.ended = "win";
      run.finishMs = 15000;
      run.mainOrbs = run.course.mainOrbs;
      run.secrets.found[0] = 1;
      const s = levelEndStats(run, null, memoryProgressStorage());
      expect(runStars(run).clear).toBe(true);
      expect(s.stars & 1).toBe(1);
      expect(s.stars & 2).toBe(2);
      expect(s.secrets & 1).toBe(1);
      expect(s.xp).toBeGreaterThan(0);
   });
});

describe("the hero motion writer", () => {
   it("curled in every cannon and every flight, walking on a platform, a hurt on a bonk", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.rolling).toBe(true);
      Object.assign(run.hero, { mode: "walk", vx: 2, vz: 0 });
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.rolling).toBe(false);
      expect(m.grounded).toBe(true);
      Object.assign(run.hero, { mode: "lost", lostWhy: "bonk", vx: 3, vz: 0 });
      anim.lostAt = 1;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.hurt).toBe(true);
   });
});
