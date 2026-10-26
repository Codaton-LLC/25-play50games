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
import { ASSETS, GLB_SIZE } from "./assets";
import { BufferGeometry } from "three";
import { ARMADILLO, buildArmadilloShapes } from "./Armadillo";
import { lavaPillarJumpMeta } from "./meta";
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

describe("lava-pillar-jump models", () => {
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

   it("keeps the stand-in at the hero's drawn height", () => {
      expect(ARMADILLO.height).toBeCloseTo(1.45, 6);
   });
});

describe("definition and camera", () => {
   it("has five levels matching meta, the intro on, its own clock", () => {
      expect(definitionLevelProblems(lavaPillarJumpMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Power" });
      expect(lavaPillarJumpMeta.controls.touch).toContain("Power");
      expect(lavaPillarJumpMeta.controls.keyboard).toContain("Enter");
      expect(lavaPillarJumpMeta.status).toBe("dev");
      expect(lavaPillarJumpMeta.collection).toBe("rollheroes");
      expect(lavaPillarJumpMeta.order).toBe(54);
      expect(lavaPillarJumpMeta.owner).toBe("cursor");
      expect(lavaPillarJumpMeta.levels!.map((l) => l.title)).toEqual(["Warm Cavern", "Pillar Field", "Falling Rocks", "Fast Lava", "Volcano Core"]);
   });

   it("the intro ends on the follow camera's start pose, and flies from the gate down", () => {
      const play = playCamera(COURSE, 1.6);
      const g = cameraGoal(0, 0, 1.5, COURSE.supports[1].cx, COURSE.supports[1].top, COURSE.supports[1].cz, 1.6, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
      expect(play.position).toEqual([g.px, g.py, g.pz]);
      const keys = introKeyframes(COURSE);
      expect(keys[0].position[1]).toBeGreaterThan(COURSE.supports[COURSE.goal].top);
      // descending: each shot no higher than the one before
      for (let i = 1; i < keys.length; i++) expect(keys[i].position[1]).toBeLessThanOrEqual(keys[i - 1].position[1]);
      // the camera stays behind the hero at the same distance whatever the look-ahead
      const far = cameraGoal(0, 10, -20, 6, 14, -30, 1.6, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
      expect(far.pz).toBeCloseTo(-20 + 5.6, 6);
      // a target behind the hero (a fall back, a jump from the last island) never turns the view round
      const back = cameraGoal(0, 58, -115, 1, 40, -84, 1.6, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
      expect(back.lz).toBeLessThanOrEqual(-115 - 4.5 + 1e-9);
      expect(back.pz).toBeGreaterThan(back.lz);
   });
});
