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
import { ASHBACK_HEIGHT, ASHBACK_SCALE, ASSETS, GLB_SIZE, SLOPED_ROOF_TOP } from "./assets";
import { CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";
import { slopeSpot } from "./Course";
import { BufferGeometry } from "three";
import { ARMADILLO, buildArmadilloShapes } from "./Armadillo";
import { rooftopRollClimbMeta } from "./meta";
import definition from "./index";
import { introKeyframes, playCamera, startSpot } from "./camera";
import { COURSE, courseFor, surfaceY } from "./rules";

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

describe("rooftop-roll-climb models", () => {
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

   it("the sloped roof's top falls in a near straight line from the ridge to the gutter lip (the Scene fits it to the rules' slope)", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.slopedRoof.url);
      const ridge = topAt(cloud, 0, SLOPED_ROOF_TOP.ridgeZ, 0.1);
      const lip = topAt(cloud, 0, SLOPED_ROOF_TOP.lipZ, 0.1);
      expect(ridge).toBeCloseTo(SLOPED_ROOF_TOP.ridge, 1);
      expect(lip).toBeCloseTo(SLOPED_ROOF_TOP.lip, 1);
      // the middle within 6 cm of the straight line between them (raw units)
      const mid = topAt(cloud, 0, 0, 0.1);
      expect(Math.abs(mid - (ridge + lip) / 2)).toBeLessThan(0.06);
   });

   it("every drawn slope puts the GLB's ridge on the rules' high edge and its lip on the rules' low edge", () => {
      for (const id of [1, 3, 5] as const) {
         for (const s of courseFor(id).supports) {
            if (!s.slope) continue;
            const spot = slopeSpot(s);
            expect(spot.y + SLOPED_ROOF_TOP.ridge * spot.sy!).toBeCloseTo(s.top, 6);
            expect(spot.y + SLOPED_ROOF_TOP.lip * spot.sy!).toBeCloseTo(s.low, 6);
            expect(surfaceY(s, s.cx + s.slope.dir * s.hw)).toBeCloseTo(s.low, 6);
            // the GLB's +z (ridge to lip) turned to the slope's dir
            expect(Math.sin(spot.rotY!)).toBeCloseTo(s.slope.dir, 6);
            expect(GLB_SIZE.slopedRoof.z * spot.sz!).toBeCloseTo(s.hw * 2, 6);
            expect(GLB_SIZE.slopedRoof.x * spot.sx!).toBeCloseTo(s.hd * 2, 6);
         }
      }
   });

   it("draws Ashback 2.1 m tall from his real mesh, within the character budget", () => {
      expect(GLB_SIZE.ashback.y * ASHBACK_SCALE).toBeCloseTo(ASHBACK_HEIGHT, 6);
      expect(ASSETS.ashback.budget).toEqual(CHARACTER_BUDGET);
      expect(ASSETS.ashback.url).toBe("/models/3d/menu2/m2ShadowArmadillo.glb");
   });
});

describe("definition and camera", () => {
   it("has five levels matching meta, the intro on, its own clock", () => {
      expect(definitionLevelProblems(rooftopRollClimbMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Power" });
      expect(rooftopRollClimbMeta.controls.touch).toContain("Power");
      expect(rooftopRollClimbMeta.controls.keyboard).toContain("Enter");
      expect(rooftopRollClimbMeta.status).toBe("dev");
      expect(rooftopRollClimbMeta.collection).toBe("rollheroes");
      expect(rooftopRollClimbMeta.order).toBe(52);
      expect(rooftopRollClimbMeta.owner).toBe("cursor");
      expect(rooftopRollClimbMeta.levels!.map((l) => l.title)).toEqual(["Low Roofs", "Office Roofs", "Moving Rooftops", "Night Skyline", "High-Rise Climb"]);
   });

   it("the intro ends behind and above the hero's spawn (the orbit's first pose), and flies from the helipad down", () => {
      const play = playCamera(COURSE, 1.6);
      const spawn = startSpot(COURSE);
      // behind (+z) and above the spawn, looking ahead of it
      expect(play.position[2]).toBeGreaterThan(spawn.z);
      expect(play.position[1]).toBeGreaterThan(spawn.y + 1.5);
      expect(play.lookAt[2]).toBeLessThanOrEqual(spawn.z + 1e-9);
      const keys = introKeyframes(COURSE);
      expect(keys[0].position[1]).toBeGreaterThan(COURSE.supports[COURSE.goal].top);
      // descending: each shot no higher than the one before
      for (let i = 1; i < keys.length; i++) expect(keys[i].position[1]).toBeLessThanOrEqual(keys[i - 1].position[1]);
   });
});
