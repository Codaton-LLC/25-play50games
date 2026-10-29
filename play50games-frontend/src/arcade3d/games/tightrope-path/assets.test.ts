// The GLBs as Tightrope Path draws them: listed in the manifest, on disk, within budget, GLB_SIZE
// equal to the real (meshopt-decoded) meshes; the shared hero; the definition's levels; and the menu2
// configs (boss, secrets, stars, combo) without problems.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { comboConfigProblems } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE } from "./assets";
import { courseFor } from "./course";
import { COMBO, SECRETS, UMBRA, starSpecFor } from "./progression";
import { tightropePathMeta } from "./meta";
import definition from "./index";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

function bounds(cloud: Float32Array) {
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i += 3) {
      for (let k = 0; k < 3; k++) {
         min[k] = Math.min(min[k], cloud[i + k]);
         max[k] = Math.max(max[k], cloud[i + k]);
      }
   }
   return { min, max, size: max.map((v, k) => v - min[k]) };
}

describe("tightrope-path models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      if (key === "hero") continue;
      it(`${key}: listed, on disk, within its byte budget, never a turtle / ninja / shell file`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(asset.url).not.toMatch(/ninja|turtle|shell|StoneMinion|ShadowClone/i);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred), within its triangle budget`, async () => {
         const asset = ASSETS[key];
         const g = await readCharacterGlb(asset.url);
         const b = bounds(g.cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.03);
         expect(g.indices.length / 3).toBeLessThanOrEqual(asset.budget.tris);
      });
   }

   it("the hero is Kiro's shared GLB; Umbra uses the character budget", () => {
      expect(ASSETS.hero.url).toBe(heroModelAsset("kiro").url);
      expect(ASSETS.umbra.budget).toEqual(CHARACTER_BUDGET);
   });
});

describe("definition and menu2 configs", () => {
   it("has five levels matching meta, the intro on, its own clock, Throw and Power on touch", () => {
      expect(definitionLevelProblems(tightropePathMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.touchLabels).toEqual({ jump: "Jump", action: "Duck" });
      expect(tightropePathMeta.status).toBe("dev");
      expect(tightropePathMeta.collection).toBe("rollheroes");
      expect(tightropePathMeta.order).toBe(74);
      expect(tightropePathMeta.scoring.kind).toBe("time");
      expect(tightropePathMeta.levels!.map((l) => l.title)).toEqual(["Wide Beams", "Narrow Beams", "Moving Beams", "Rotating Path", "Balance Master"]);
   });

   it("boss, secrets, stars and combo have no problems; only level 5 has the boss", () => {
      expect(bossProblems(UMBRA)).toEqual([]);
      expect(UMBRA.phases.length).toBe(3);
      expect(comboConfigProblems(COMBO)).toEqual([]);
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, c.mainOrbs))).toEqual([]);
         expect(c.arenaStart >= 0).toBe(id === 5);
      }
   });
});
