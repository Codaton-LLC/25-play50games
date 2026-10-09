import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, BODY_OFFSET, DRONE_HOOK, DRONE_SCALE, ROTORS } from "./assets";

interface Gltf {
   scenes: Array<{ nodes: number[] }>; scene?: number;
   nodes: Array<{ mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
   meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>;
   accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }>;
   bufferViews: Array<{ byteOffset?: number; byteStride?: number }>;
}
/** Read the real mesh vertices without loading textures, fetching URLs or requiring a DOM. */
function bounds(url: string): Box3 {
   const data = readFileSync(resolve("public", url.replace(/^\//, "")));
   expect(data.readUInt32LE(0)).toBe(0x46546c67);
   const jsonLength = data.readUInt32LE(12);
   const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8")) as Gltf;
   const binaryOffset = 20 + jsonLength + 8;
   const box = new Box3(), point = new Vector3();
   const walk = (index: number, parent: Matrix4) => {
      const node = json.nodes[index];
      const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]));
      const matrix = parent.clone().multiply(local);
      if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) {
         const a = json.accessors[primitive.attributes.POSITION], view = json.bufferViews[a.bufferView];
         expect(a.componentType).toBe(5126); expect(a.type).toBe("VEC3");
         const offset = binaryOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? 12;
         for (let i = 0; i < a.count; i++) {
            point.set(data.readFloatLE(offset + i * stride), data.readFloatLE(offset + i * stride + 4), data.readFloatLE(offset + i * stride + 8)).applyMatrix4(matrix);
            box.expandByPoint(point);
         }
      }
      for (const child of node.children ?? []) walk(child, matrix);
   };
   for (const root of json.scenes[json.scene ?? 0].nodes) walk(root, new Matrix4());
   return box;
}

describe("real GLB fits and the logical hook", () => {
   it("fits the real drone to 0.9 m and keeps the measured hook at the origin", () => {
      const b = bounds(ASSETS.drone.url), size = b.getSize(new Vector3());
      expect(size.x).toBeCloseTo(EXPANSION_GLB_SIZE.drone.width, 2);
      expect(size.x * DRONE_SCALE).toBeCloseTo(0.9, 2);
      expect(DRONE_HOOK.x * DRONE_SCALE + BODY_OFFSET[0]).toBeCloseTo(0, 8);
      expect(DRONE_HOOK.y * DRONE_SCALE + ASSETS.drone.yOffset).toBeCloseTo(0, 8);
      expect(DRONE_HOOK.z * DRONE_SCALE + BODY_OFFSET[2]).toBeCloseTo(0, 8);
      for (const p of ROTORS) {
         const original = new Vector3(p.x / DRONE_SCALE + DRONE_HOOK.x, p.y / DRONE_SCALE + DRONE_HOOK.y, p.z / DRONE_SCALE + DRONE_HOOK.z);
         expect(b.clone().expandByScalar(0.03).containsPoint(original)).toBe(true);
      }
   });
   it("keeps fallback rotor centres and cable/parcel origins aligned", () => {
      expect(ROTORS).toHaveLength(4);
      expect(ROTORS.every((p) => Number.isFinite(p.x + p.y + p.z) && p.y > 0)).toBe(true);
      const pivot = 11, top = pivot - 2, centre = top - 0.2;
      expect(centre - 0.2).toBeCloseTo(8.6);
      // core Parcel is bottom-centred, so its draw origin equals the scoring contact point.
      expect(centre - 0.2 + 0.4).toBe(top);
   });
   it("checks every shared and reused model against its intended scale", () => {
      for (const [asset, axis, intended, tolerance] of [
         [ASSETS.car, "z", 1.6, 0.35], [ASSETS.taxi, "z", 1.6, 0.35], [ASSETS.van, "z", 2, 0.4],
         [ASSETS.pigeon, "x", 0.6, 0.03], [ASSETS.crate, "x", 0.8, 0.02], [ASSETS.tree, "y", 3, 0.02],
      ] as const) {
         const size = bounds(asset.url).getSize(new Vector3());
         expect(Math.abs(size[axis] * asset.scale - intended)).toBeLessThan(tolerance);
      }
   });
});
