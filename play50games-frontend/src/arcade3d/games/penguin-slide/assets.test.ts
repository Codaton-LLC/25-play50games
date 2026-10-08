import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, BELLY_LIFT, BELLY_ROTATION_Y, FLAG_BOUNDS, PENGUIN_SCALE, bellyClearance } from "./assets";

interface Glb {
   accessors: Array<{ min: number[]; max: number[] }>;
   meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>;
   nodes: Array<{ mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
   scenes: Array<{ nodes: number[] }>; scene?: number;
}

function bounds(url: string): Box3 {
   const bytes = readFileSync(resolve("public", url.slice(1)));
   expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
   const glb: Glb = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
   const result = new Box3();
   function visit(index: number, parent: Matrix4) {
      const node = glb.nodes[index];
      const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]));
      const world = new Matrix4().multiplyMatrices(parent, local);
      if (node.mesh !== undefined) for (const primitive of glb.meshes[node.mesh].primitives) {
         const accessor = glb.accessors[primitive.attributes.POSITION];
         result.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(world));
      }
      for (const child of node.children ?? []) visit(child, world);
   }
   for (const node of glb.scenes[glb.scene ?? 0].nodes) visit(node, new Matrix4());
   return result;
}

describe("penguin-slide real GLB fits", () => {
   it("fits the solid penguin to 1 m standing and its resting belly clears by 1 cm", () => {
      const box = bounds(ASSETS.penguin.url);
      const size = box.getSize(new Vector3());
      expect(size.x).toBeCloseTo(EXPANSION_GLB_SIZE.penguin.width, 3);
      expect(size.y * PENGUIN_SCALE).toBeCloseTo(1, 3);
      expect(size.z).toBeCloseTo(EXPANSION_GLB_SIZE.penguin.depth, 3);
      const belly = box.clone().applyMatrix4(new Matrix4().makeScale(PENGUIN_SCALE, PENGUIN_SCALE, PENGUIN_SCALE)).applyMatrix4(new Matrix4().makeRotationY(BELLY_ROTATION_Y)).applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2));
      expect(belly.min.y + BELLY_LIFT).toBeCloseTo(0.01, 3);
      expect(ASSETS.penguin.humanoid).toBeUndefined();
   });

   it("points the real fitted GLB belly down and head down-track", () => {
      const box = bounds(ASSETS.penguin.url);
      expect(box.getSize(new Vector3()).y * PENGUIN_SCALE).toBeCloseTo(1, 3);
      const fit = new Matrix4().makeRotationX(-Math.PI / 2).multiply(new Matrix4().makeRotationY(BELLY_ROTATION_Y));
      expect(new Vector3(0, 0, 1).transformDirection(fit).y).toBeCloseTo(-1, 8);
      const head = new Vector3(0, box.max.y, 0).sub(new Vector3(0, box.min.y, 0)).transformDirection(fit);
      expect(head.z).toBeCloseTo(-1, 8);
   });

   it("fits fish and trees from shared measured bounds", () => {
      const fish = bounds(ASSETS.fish.url).getSize(new Vector3());
      const pine = bounds(ASSETS.pine.url).getSize(new Vector3());
      expect(fish.z * ASSETS.fish.scale).toBeCloseTo(0.6, 3);
      expect(pine.y * ASSETS.pine.scale).toBeCloseTo(4, 3);
   });

   it("keeps the belly within 1 cm of the slope through all cosmetic banks", () => {
      const box = bounds(ASSETS.penguin.url);
      for (const grade of [0.03, 0.055, 0.08]) for (const degrees of [-12, -6, 0, 6, 12]) {
         const roll = degrees * Math.PI / 180;
         const transform = new Matrix4().makeRotationZ(roll).multiply(new Matrix4().makeTranslation(0, BELLY_LIFT, 0)).multiply(new Matrix4().makeRotationX(-Math.PI / 2 - Math.atan(grade))).multiply(new Matrix4().makeTranslation(0, -0.5, 0)).multiply(new Matrix4().makeRotationY(BELLY_ROTATION_Y)).multiply(new Matrix4().makeScale(PENGUIN_SCALE, PENGUIN_SCALE, PENGUIN_SCALE));
         let lowest = Infinity;
         for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const point = new Vector3(x, y, z).applyMatrix4(transform);
            lowest = Math.min(lowest, point.y - grade * point.z + bellyClearance(grade, roll));
         }
         expect(lowest).toBeCloseTo(0.01, 3);
      }
   });

   it("keeps the floor-normalized checkpoint flag's pole on the surface and fits 1.5 m", () => {
      const box = bounds(ASSETS.flag.url);
      expect(box.min.y).toBeCloseTo(FLAG_BOUNDS.minY, 5);
      expect(box.getSize(new Vector3()).y * ASSETS.flag.scale).toBeCloseTo(1.5, 5);
      expect(box.min.y * ASSETS.flag.scale + ASSETS.flag.yOffset).toBeCloseTo(0, 5);
   });
});
