import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { EXPANSION_CHARACTER_HEIGHT, EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, KID_SCALE, PINE_HEIGHT, SNOWMAN_GLB, SNOWMAN_HEIGHT, SNOWMAN_RADIUS, SNOWMAN_SCALE, SNOWMAN_STRETCH_XZ } from "./assets";

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
      const local = node.matrix
         ? new Matrix4().fromArray(node.matrix)
         : new Matrix4().compose(
            new Vector3().fromArray(node.translation ?? [0, 0, 0]),
            new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
            new Vector3().fromArray(node.scale ?? [1, 1, 1]),
         );
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

describe("snowball-battle model fits", () => {
   it("draws the snow kid at 1.30 m", () => {
      const box = bounds(ASSETS.kid.url);
      expect(box.getSize(new Vector3()).y * KID_SCALE).toBeCloseTo(EXPANSION_CHARACTER_HEIGHT.snowKid, 2);
      expect(EXPANSION_CHARACTER_HEIGHT.snowKid).toBe(1.3);
   });

   it("draws a pine at 4 m before the per-spot scale", () => {
      const box = bounds(ASSETS.pine.url);
      expect(box.getSize(new Vector3()).y).toBeCloseTo(EXPANSION_GLB_SIZE.pineTree.height, 3);
      expect(PINE_HEIGHT).toBeCloseTo(4, 3);
   });

   it("fits the snowman to 1.60 m tall and a 0.70 m base", () => {
      const box = bounds(ASSETS.snowman.url);
      const size = box.getSize(new Vector3());
      const radius = Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z);
      expect(size.y).toBeCloseTo(SNOWMAN_GLB.height, 2);
      expect(radius).toBeCloseTo(SNOWMAN_GLB.halfWidth, 2);
      expect(size.y * SNOWMAN_SCALE).toBeCloseTo(SNOWMAN_HEIGHT, 2);
      expect(radius * SNOWMAN_SCALE * SNOWMAN_STRETCH_XZ).toBeCloseTo(SNOWMAN_RADIUS, 2);
      expect(box.min.y).toBeCloseTo(0, 2);
   });
});
