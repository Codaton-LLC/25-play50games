// The Menu 2 GLBs as Sky Tower Jump draws them: listed in the manifest, within budget, GLB_SIZE equal
// to the real (meshopt-decoded) meshes, the platform tops where the Scene puts the rules' tops, the
// baked hero stand-in, and the definition's levels. The hero GLB's rig is hero.test.ts.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, BOSS_SCALE, BOSS_WIDTH, GLB_SIZE } from "./assets";
import { CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";
import { BufferGeometry } from "three";
import { ARMADILLO, buildArmadilloShapes } from "./Armadillo";
import { cloudHopperMeta } from "./meta";
import definition from "./index";
import { cameraGoal, introKeyframes, playCamera } from "./camera";
import { COURSE } from "./rules";

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

/** The highest vertex within `r` of (x, z): the walkable top there. */
function topAt(cloud: Float32Array, x: number, z: number, r = 0.12): number {
   let best = -Infinity;
   for (let i = 0; i < cloud.length; i += 3) if (Math.abs(cloud[i] - x) < r && Math.abs(cloud[i + 2] - z) < r) best = Math.max(best, cloud[i + 1]);
   return best;
}

describe("cloud-hopper models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         const bytes = statSync(path.join(PUBLIC, asset.url)).size;
         expect(bytes).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }

   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
         const asset = ASSETS[key];
         const { cloud } = await readCharacterGlb(asset.url);
         const b = bounds(cloud);
         expect(b.size[0]).toBeCloseTo(size.x, 2);
         expect(b.size[1]).toBeCloseTo(size.y, 2);
         expect(b.size[2]).toBeCloseTo(size.z, 2);
         expect(b.min[1]).toBeCloseTo(0, 2);
         expect(Math.abs(b.max[0] + b.min[0])).toBeLessThan(0.02);
         if ("top" in size) {
            const t = topAt(cloud, 0, 0, 0.2);
            expect(t).toBeGreaterThan(size.top - 0.08);
            expect(t).toBeLessThan(size.top + 0.08);
         }
      });
   }

   it("bakes the armadillo stand-in into a few merged meshes, 1.45 m tall with its feet on the floor", () => {
      const shapes = buildArmadilloShapes();
      const geos: BufferGeometry[] = [];
      const walk = (v: unknown) => {
         if (v instanceof BufferGeometry) geos.push(v);
         else if (v && typeof v === "object") Object.values(v).forEach(walk);
      };
      walk(shapes);
      // one mesh per joint and material (the legs share theirs): about 20 draw calls for the whole hero
      expect(geos.length).toBeLessThanOrEqual(22);
      for (const g of geos) {
         g.computeBoundingBox();
         expect(g.getAttribute("position").count).toBeGreaterThan(0);
      }
      const box = (g: BufferGeometry) => g.boundingBox!;
      const feet = ARMADILLO.hipY + box(shapes.leg.body).min.y;
      const top = ARMADILLO.headY + Math.max(box(shapes.head.shell).max.y, box(shapes.head.body).max.y);
      expect(feet).toBeGreaterThan(-0.02);
      expect(feet).toBeLessThan(0.02);
      expect(top).toBeGreaterThan(ARMADILLO.height - 0.06);
      expect(top).toBeLessThan(ARMADILLO.height + 0.06);
   });

   it("Gloom Nimbus is its own High GLB (character budget), drawn BOSS_WIDTH wide; the storm-cloud fallback the same width", async () => {
      expect(ASSETS.boss.url).toBe("/models/3d/cloud-hopper/m2GloomNimbusBoss.glb");
      expect(ASSETS.boss.budget).toEqual(CHARACTER_BUDGET);
      const { cloud } = await readCharacterGlb(ASSETS.boss.url);
      const b = bounds(cloud);
      // 15k tris at most (the High tier), well inside the character budget
      expect(cloud.length / 3).toBeGreaterThan(5000);
      expect(b.size[0] * BOSS_SCALE).toBeCloseTo(BOSS_WIDTH, 2);
      expect(b.size[1] * BOSS_SCALE).toBeGreaterThan(9);
      expect(b.size[1] * BOSS_SCALE).toBeLessThan(12);
      // the fallback group scales m2StormCloud to the boss GLB's raw width before BOSS_SCALE
      expect(GLB_SIZE.storm.x * (GLB_SIZE.boss.x / GLB_SIZE.storm.x) * BOSS_SCALE).toBeCloseTo(BOSS_WIDTH, 6);
   });

   it("keeps the stand-in at the hero's drawn height", () => {
      expect(ARMADILLO.height).toBeCloseTo(1.45, 6);
   });
});

describe("definition and camera", () => {
   it("has five levels matching meta, the intro on, its own clock", () => {
      expect(definitionLevelProblems(cloudHopperMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Power" });
      expect(cloudHopperMeta.controls.touch).toContain("Power");
      expect(cloudHopperMeta.controls.keyboard).toContain("Enter");
      expect(cloudHopperMeta.status).toBe("dev");
      expect(cloudHopperMeta.collection).toBe("rollheroes");
      expect(cloudHopperMeta.order).toBe(55);
      expect(cloudHopperMeta.owner).toBe("cursor");
      expect(definition.ResultExtra).toBeDefined();
      expect(definition.runPlayers?.({} as never)).toBe(1);
      expect(cloudHopperMeta.levels!.map((l) => l.title)).toEqual(["Soft Clouds", "Moving Clouds", "Wind Zone", "Fading Clouds", "Sky Sprint"]);
   });

   it("the intro ends behind and above the hero (the orbit camera's start pose: orbit.test.ts), and flies back from the bridge", () => {
      // play now uses the shared orbit camera (menu2/camera); orbit.test.ts checks the exact pose
      const play = playCamera(COURSE, 1.6);
      expect(play.position[2]).toBeGreaterThan(COURSE.startZ + 3);
      expect(play.position[1]).toBeGreaterThan(COURSE.clouds[0].top + 2);
      const keys = introKeyframes(COURSE);
      expect(keys[0].position[1]).toBeGreaterThan(COURSE.clouds[COURSE.goal].top);
      // the shots fly back from the bridge towards the start
      for (let i = 1; i < keys.length; i++) expect(keys[i].position[2]).toBeGreaterThan(keys[i - 1].position[2]);
      // descending: each shot no higher than the one before
      for (let i = 1; i < keys.length; i++) expect(keys[i].position[1]).toBeLessThanOrEqual(keys[i - 1].position[1]);
      // the camera stays behind the hero at the same distance whatever the look-ahead, a little to the side (3/4)
      const far = cameraGoal(0, 10, -20, 6, 14, -30, 1.6, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
      expect(far.pz).toBeCloseTo(-20 + 5.6, 6);
      expect(far.px).toBeGreaterThan(1);
      // a target behind the hero (a fall back, a jump from the last island) never turns the view round
      const back = cameraGoal(0, 58, -115, 1, 40, -84, 1.6, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
      expect(back.lz).toBeLessThanOrEqual(-115 - 4.5 + 1e-9);
      expect(back.pz).toBeGreaterThan(back.lz);
   });
});
