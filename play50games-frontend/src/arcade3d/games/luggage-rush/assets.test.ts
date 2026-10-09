// Fits on the real meshes: the suitcase's shell, the 3.2 m plane, the 1.556 m handler.
import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { modelParts } from "@/arcade3d/core/assets";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from "three";
import { ASSETS, HANDLER_SCALE, PLANE_LENGTH } from "./assets";
import { TAG_M } from "./rules";

async function sizeOf(url: string, asset: (typeof ASSETS)[keyof typeof ASSETS]): Promise<Vector3> {
   const { local, node } = await readCharacterGlb(url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   const points: Vector3[] = [];
   for (const part of parts) {
      const position = part.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(part.matrix));
   }
   geometry.dispose();
   return new Box3().setFromPoints(points).getSize(new Vector3());
}

describe("luggage-rush models", () => {
   it("are in the manifest", () => {
      expect(hasModel(ASSETS.suitcase.url)).toBe(true);
      expect(hasModel(ASSETS.plane.url)).toBe(true);
      expect(hasModel(ASSETS.handler.url)).toBe(true);
      expect(ASSETS.suitcase.url).toBe("/models/3d/luggage-rush/suitcase.glb");
      expect(ASSETS.plane.url).toBe("/models/3d/luggage-rush/plane.glb");
   });

   it("draws the plane at 3.2 m and the handler at 1.556 m", async () => {
      const plane = await sizeOf(ASSETS.plane.url, ASSETS.plane);
      expect(plane.z).toBeCloseTo(PLANE_LENGTH, 1);
      const handler = await sizeOf(ASSETS.handler.url, ASSETS.handler);
      expect(handler.y).toBeCloseTo(1.886 * HANDLER_SCALE, 1);
      expect(TAG_M).toBeGreaterThanOrEqual(0.45);
   });

   it("fits the suitcase shell to 0.50 x 0.70 x 0.25 upright, handle included in the height", async () => {
      const size = await sizeOf(ASSETS.suitcase.url, ASSETS.suitcase);
      expect(size.x).toBeCloseTo(0.5, 1);
      expect(size.z).toBeCloseTo(0.25, 1);
      expect(size.y).toBeGreaterThan(0.7);
      expect(size.y).toBeLessThan(1.05);
   });
});
