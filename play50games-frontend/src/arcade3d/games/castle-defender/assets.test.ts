import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { EXPANSION_GLB_SIZE, EXPANSION_GLB_POINTS, REUSED_GLB_SIZE, expansionPoint } from "@/arcade3d/core/sharedAssets";
import { ASSETS, MUZZLE } from "./assets";

interface GltfNode { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; }
interface Gltf {
   scene?: number; scenes: { nodes: number[] }[]; nodes: GltfNode[];
   meshes: { primitives: { attributes: { POSITION: number } }[] }[];
   accessors: { min?: number[]; max?: number[] }[];
}
// Meshopt retains accessor bounds in the JSON chunk. Transform those bounds without
// decoding compressed buffers or images; Claude additionally runs the core real-mesh tests.
function declaredBounds(url: string): Vector3 {
   const buffer = readFileSync(resolve(process.cwd(), "public", url.slice(1)));
   expect(buffer.readUInt32LE(0)).toBe(0x46546c67);
   const length = buffer.readUInt32LE(12);
   const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + length)) as Gltf;
   const bounds = new Box3();
   function visit(index: number, parent: Matrix4) {
      const node = gltf.nodes[index];
      const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
         new Vector3().fromArray(node.translation ?? [0, 0, 0]),
         new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
         new Vector3().fromArray(node.scale ?? [1, 1, 1]),
      );
      const world = parent.clone().multiply(local);
      if (node.mesh !== undefined) for (const p of gltf.meshes[node.mesh].primitives) {
         const accessor = gltf.accessors[p.attributes.POSITION];
         if (!accessor.min || !accessor.max) throw new Error(`${url}: POSITION bounds missing`);
         bounds.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(world));
      }
      for (const child of node.children ?? []) visit(child, world);
   }
   for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, new Matrix4());
   return bounds.getSize(new Vector3());
}
describe("solid goblin and shared asset fits", () => {
   it("pins dimensions and muzzle transform from measured core constants", () => {
      expect(ASSETS.goblin.humanoid).toBeUndefined();
      expect(ASSETS.goblin.scale * EXPANSION_GLB_SIZE.goblin.height).toBeCloseTo(1.6, 9);
      expect(ASSETS.goblin.scale * EXPANSION_GLB_SIZE.goblin.width).toBeCloseTo(1.184, 3);
      expect(ASSETS.goblin.scale * EXPANSION_GLB_SIZE.goblin.depth).toBeCloseTo(0.637819, 5);
      expect(ASSETS.gate.scale * REUSED_GLB_SIZE.door.height).toBeCloseTo(3, 9);
      const local = expansionPoint(ASSETS.cannon, EXPANSION_GLB_POINTS.cannonMuzzle);
      expect(MUZZLE.x).toBeCloseTo(0, 8);
      expect(MUZZLE.y).toBeCloseTo(2.0735705, 6);
      expect(MUZZLE.z).toBeCloseTo(2.19995784, 6);
      expect(MUZZLE).toEqual({ x: local.x, y: local.y + 1.2, z: local.z + 3 });
   });
   it.each([
      ["goblin", "height", 1.6], ["tower", "height", 6], ["cannon", "depth", 1.6],
      ["rock", "width", 1], ["tree", "height", 3.5], ["gate", "height", 3],
   ] as const)("checks %s GLB fit on declared transformed bounds", (key, axis, expected) => {
      const asset = ASSETS[key];
      const size = declaredBounds(asset.url);
      expect(size[axis === "width" ? "x" : axis === "height" ? "y" : "z"] * (asset.scale ?? 1)).toBeCloseTo(expected, 1);
   });
});
