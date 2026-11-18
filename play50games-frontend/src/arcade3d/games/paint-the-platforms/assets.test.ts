// The GLBs as Paint the Platforms draws them: listed in the manifest, on disk, within budget, GLB_SIZE
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
import { ASSETS, GLB_SIZE, TILE_DRAWN, TILE_STRETCH } from "./assets";
import { TILE, courseFor } from "./course";
import { BLOB, COMBO, SECRETS, SLAM_R, paintStarLabels, starSpecFor } from "./progression";
import { paintThePlatformsMeta } from "./meta";
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

describe("paint-the-platforms models", () => {
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

   it("a tile is drawn square inside its 2 m cell, a seam to the next", () => {
      expect(GLB_SIZE.tile.x * TILE_STRETCH[0]).toBeCloseTo(TILE_DRAWN, 6);
      expect(GLB_SIZE.tile.z * TILE_STRETCH[2]).toBeCloseTo(TILE_DRAWN, 6);
      expect(TILE_DRAWN).toBeLessThan(TILE);
      expect(TILE - TILE_DRAWN).toBeLessThan(0.15);
   });

   it("the hero is the shared hero GLB; the Paint Blob uses the character budget, the tile a lean 600 triangles", () => {
      expect(ASSETS.hero.url).toBe(heroModelAsset("riko").url);
      expect(ASSETS.blob.budget).toEqual(CHARACTER_BUDGET);
   });
});

describe("definition and menu2 configs", () => {
   it("has five levels matching meta, the intro on, its own clock, Jump and Power on touch", () => {
      expect(definitionLevelProblems(paintThePlatformsMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.touchLabels).toEqual({ jump: "Jump", action: "Power" });
      expect(paintThePlatformsMeta.status).toBe("live");
      expect(paintThePlatformsMeta.collection).toBe("rollheroes");
      expect(paintThePlatformsMeta.order).toBe(94);
      expect(paintThePlatformsMeta.scoring.kind).toBe("time");
      expect(paintThePlatformsMeta.levels!.map((l) => l.title)).toEqual(["First Strokes", "Grey Blots", "Moving Tiles", "Time Attack", "80% Master"]);
   });

   it("the card's goals and timers: 30/40/50/65/80 % in 60/75/90/105/120 s", () => {
      const goals = LEVEL_IDS.map((id) => courseFor(id).cfg.goal);
      expect(goals).toEqual([0.3, 0.4, 0.5, 0.65, 0.8]);
      expect(LEVEL_IDS.map((id) => courseFor(id).durationMs)).toEqual([60_000, 75_000, 90_000, 105_000, 120_000]);
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.need).toBe(Math.ceil(c.cfg.goal * c.tiles.length));
         expect(c.targetMs).toBeLessThan(c.durationMs);
      }
   });

   it("the star screen calls the collectibles paint blobs (the shared label says orbs)", () => {
      expect(paintStarLabels(1, 3)).toEqual(["Clear the level", "All 3 paint blobs", expect.stringContaining("15")]);
   });

   it("boss, secrets, stars and combo have no problems; only level 5 has the boss", () => {
      expect(bossProblems(BLOB)).toEqual([]);
      expect(BLOB.phases.length).toBe(3);
      expect(SLAM_R).toHaveLength(3);
      expect(comboConfigProblems(COMBO)).toEqual([]);
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, c.pickups.length))).toEqual([]);
         expect(!!c.boss).toBe(id === 5);
      }
   });
});
