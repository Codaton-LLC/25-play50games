import { existsSync } from "node:fs";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CATAPULT_SPOTS, THRONE_SPOTS, hasRoyalDecor } from "./assets";
import { FIELD, TOWERS, hillHeight } from "./looks";
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

describe("late-level royal and siege decor", () => {
   it.each(["royalThrone", "siegeCatapultT"] as const)("registers the existing %s GLB", (key) => {
      const asset = ASSETS[key];
      expect(hasModel(asset.url)).toBe(true);
      expect(existsSync(resolve("public", asset.url.slice(1)))).toBe(true);
   });

   it.each([
      ["royalThrone", 1.8, 0.9473, 0.8358],
      ["siegeCatapultT", 1.3931, 1.3629, 1.7],
   ] as const)("fits %s on the real mesh", async (key, height, width, depth) => {
      const box = await decorBox(ASSETS[key]);
      const size = box.getSize(new Vector3());
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(size.y).toBeCloseTo(height, 2);
      expect(size.x).toBeCloseTo(width, 2);
      expect(size.z).toBeCloseTo(depth, 2);
   });

   it("keeps every complete prop outside the play bounds, on flat ground and clear of towers", async () => {
      for (const [key, spots] of [["royalThrone", THRONE_SPOTS], ["siegeCatapultT", CATAPULT_SPOTS]] as const) {
         expect(spots.length).toBeGreaterThanOrEqual(2);
         expect(spots.length).toBeLessThanOrEqual(4);
         const local = await decorBox(ASSETS[key]);
         for (const spot of spots) {
            const box = local.clone().translate(new Vector3(spot.x, spot.y, spot.z));
            expect(box.max.x < FIELD.x0 || box.min.x > FIELD.x1 || box.max.z < FIELD.z0 || box.min.z > FIELD.z1).toBe(true);
            for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) expect(hillHeight(x, z)).toBe(0);
            for (const tower of TOWERS) expect(Math.hypot(spot.x - tower.x, spot.z - tower.z)).toBeGreaterThan(3.5);
         }
      }
   });

   it("shows the extra decor only on selected levels 4 and 5", () => {
      expect([1, 2, 3, 4, 5].map(hasRoyalDecor)).toEqual([false, false, false, true, true]);
   });
});

async function decorBox(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const box = new Box3();
   const point = new Vector3();
   for (let i = 0; i < local.length; i += 3) box.expandByPoint(point.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return box;
}
