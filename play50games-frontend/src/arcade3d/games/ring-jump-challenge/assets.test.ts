// The Menu 2 GLBs as Ring Jump Challenge draws them: listed in the manifest, on disk, within budget,
// GLB_SIZE equal to the real (meshopt-decoded) meshes, the ring's measured opening (so the drawn hole
// is the rules' radius), the column's top platform (so the pad's face is the rules' pad), Cyclone Ray
// at its width, the definition's levels, and the draw-call budget of the course's pools.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";
import { ASSETS, BOSS_SCALE, BOSS_WIDTH, COLUMN_TOP_R, GLB_SIZE, RING_INNER, WIND_INNER } from "./assets";
import { ringJumpChallengeMeta } from "./meta";
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

const KEY: Record<string, string> = {
   ring: "ring",
   column: "column",
   star: "star",
   speed: "speed",
   spring: "spring",
   monument: "monument",
   rock: "rock",
   spiked: "spiked",
   windRing: "windRing",
   beacon: "beacon",
   boss: "boss",
};

describe("ring-jump-challenge models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      if (key === "hero") continue;
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred), within its triangle budget`, async () => {
         const asset = ASSETS[KEY[key]];
         const g = await readCharacterGlb(asset.url);
         const b = bounds(g.cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.02);
         expect(g.indices.length / 3).toBeLessThanOrEqual(asset.budget.tris);
      });
   }

   it("m2NeutralRing's opening: almost no mesh inside RING_INNER of its axis (the drawn hole is the rules' ring)", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.ring.url);
      let inside = 0;
      let rim = 0;
      for (let i = 0; i < cloud.length; i += 3) {
         const r = Math.hypot(cloud[i], cloud[i + 2]);
         if (r < RING_INNER * 0.95) inside++;
         else rim++;
      }
      expect(inside / (inside + rim)).toBeLessThan(0.08);
   });

   it("m2WindRing's opening (laid flat for the wake rings) and the column's top platform", async () => {
      const wind = await readCharacterGlb(ASSETS.windRing.url);
      let inside = 0;
      for (let i = 0; i < wind.cloud.length; i += 3) if (Math.hypot(wind.cloud[i], wind.cloud[i + 1] - GLB_SIZE.windRing.y / 2) < WIND_INNER * 0.6) inside++;
      expect(inside / (wind.cloud.length / 3)).toBeLessThan(0.05);
      const col = await readCharacterGlb(ASSETS.column.url);
      let top = 0;
      for (let i = 0; i < col.cloud.length; i += 3) if (col.cloud[i + 1] > GLB_SIZE.column.y - 0.03) top = Math.max(top, Math.hypot(col.cloud[i], col.cloud[i + 2]));
      expect(top).toBeCloseTo(COLUMN_TOP_R, 1);
   });

   it("Cyclone Ray is its own image-to-3D GLB (character budget), drawn BOSS_WIDTH wide", async () => {
      expect(ASSETS.boss.url).toBe("/models/3d/ring-jump-challenge/m2CycloneRayBoss.glb");
      expect(ASSETS.boss.budget).toEqual(CHARACTER_BUDGET);
      const { cloud } = await readCharacterGlb(ASSETS.boss.url);
      expect(bounds(cloud).size[0] * BOSS_SCALE).toBeCloseTo(BOSS_WIDTH, 2);
   });
});

describe("definition", () => {
   it("has five levels matching meta, the intro on, its own clock, Dive and Power on touch", () => {
      expect(definitionLevelProblems(ringJumpChallengeMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.touchLabels).toEqual({ jump: "Dive", action: "Power" });
      expect(ringJumpChallengeMeta.status).toBe("dev");
      expect(ringJumpChallengeMeta.collection).toBe("rollheroes");
      expect(ringJumpChallengeMeta.order).toBe(56);
      expect(ringJumpChallengeMeta.scoring.kind).toBe("points");
      expect(definition.ResultExtra).toBeDefined();
      expect(definition.runPlayers?.({} as never)).toBe(1);
      expect(ringJumpChallengeMeta.levels!.map((l) => l.title)).toEqual(["Wide Rings", "Moving Rings", "Updraft Rings", "Fast Route", "Perfect Streak"]);
   });
});
