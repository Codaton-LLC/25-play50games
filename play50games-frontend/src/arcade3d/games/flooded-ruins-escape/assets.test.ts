// The GLBs as Flooded Ruins Escape draws them (its ruin props, the v2 flood gate, the buoyant crate,
// and the shared Menu 2 creatures: Umbra Roller and the cave bats): listed in the manifest, within budget, GLB_SIZE equal
// to the real (meshopt-decoded) meshes, the platform tops where the Scene puts the rules' tops, the
// baked hero stand-in, and the definition's levels. The hero GLB's rig is hero.test.ts.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { ASSETS, BAT_SCALE, BAT_SPAN, BOSS_LENGTH, BOSS_SCALE, GLB_SIZE } from "./assets";
import { BufferGeometry } from "three";
import { ARMADILLO, buildArmadilloShapes } from "./Armadillo";
import { floodedRuinsEscapeMeta } from "./meta";
import definition from "./index";
import { introKeyframes } from "./camera";
import { BOSS_R, courseFor } from "./rules";
import { LEVEL_IDS } from "../../types";

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

describe("flooded-ruins-escape models", () => {
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
      expect(definitionLevelProblems(floodedRuinsEscapeMeta, definition)).toEqual([]);
      expect(definition.intro).toBe(true);
      expect(definition.clockChip).toBe(false);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Power" });
      expect(floodedRuinsEscapeMeta.controls.touch).toContain("Power");
      expect(floodedRuinsEscapeMeta.controls.keyboard).toContain("Enter");
      expect(floodedRuinsEscapeMeta.status).toBe("dev");
      expect(floodedRuinsEscapeMeta.collection).toBe("rollheroes");
      expect(floodedRuinsEscapeMeta.order).toBe(53);
      expect(floodedRuinsEscapeMeta.owner).toBe("cursor");
      expect(floodedRuinsEscapeMeta.levels!.map((l) => l.title).filter((t) => t.length > 0)).toHaveLength(5);
   });

   it("the intro flies from the flood gate (high over the ruin) down to the start, on every level", () => {
      for (const id of LEVEL_IDS) {
         const course = courseFor(id);
         const keys = introKeyframes(course);
         const goal = course.supports[course.goal];
         expect(keys.length).toBeGreaterThanOrEqual(2 + course.checkpoints.length - 1);
         expect(keys[0].position[1]).toBeGreaterThan(goal.top + 10);
         for (const k of keys) for (const v of [...k.position, ...k.lookAt]) expect(Number.isFinite(v)).toBe(true);
      }
   });

   it("the new models: the v2 flood gate, the crate, Umbra Roller a little over the rules' ball, the bats 1.1 m across", () => {
      expect(ASSETS.floodGate.url).toBe("/models/3d/flooded-ruins-escape/m2RuinFloodGateV2I.glb");
      expect(hasModel("/models/3d/flooded-ruins-escape/m2RuinFloodGate.glb")).toBe(false);
      expect(ASSETS.crate.url).toBe("/models/3d/flooded-ruins-escape/m2FlyingCrate.glb");
      expect(ASSETS.boss.url).toBe("/models/3d/menu2/m2ShadowArmadillo.glb");
      expect(ASSETS.bat.url).toBe("/models/3d/menu2/m2CaveBat.glb");
      expect(GLB_SIZE.boss.z * BOSS_SCALE).toBeCloseTo(BOSS_LENGTH, 9);
      expect(BOSS_LENGTH).toBeGreaterThan(2 * BOSS_R);
      expect(BOSS_LENGTH).toBeLessThan(2.6 * BOSS_R);
      // the curled ball's height stays near the rules' ball too
      expect(GLB_SIZE.boss.y * BOSS_SCALE).toBeGreaterThan(1.6);
      expect(GLB_SIZE.boss.y * BOSS_SCALE).toBeLessThan(2.6);
      expect(GLB_SIZE.bat.x * BAT_SCALE).toBeCloseTo(BAT_SPAN, 9);
   });
});
