// Fits on the real meshes: the suitcase's shell, the 3.2 m plane, the 1.556 m handler.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { modelParts } from "@/arcade3d/core/assets";
import { ASSETS, CASE_DRAWN, CASE_GLB, CASE_HEIGHT, CASE_SPOTS, DUFFEL_DRAWN, DUFFEL_GLB, DUFFEL_LENGTH, DUFFEL_SPOTS, HANDLER_SCALE, PLANE_LENGTH } from "./assets";
import { PLAY_AREA } from "./looks";
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

describe("luggage-rush apron bags", () => {
   it("fits the duffel and the hard case and keeps both outside the belts", async () => {
      expect(existsSync(resolve("public", ASSETS.duffel.url.slice(1)))).toBe(true);
      expect(existsSync(resolve("public", ASSETS.hardCase.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.duffel.url)).toBe(true);
      expect(hasModel(ASSETS.hardCase.url)).toBe(true);
      const duffel = await sizeOf(ASSETS.duffel.url, ASSETS.duffel);
      const hard = await sizeOf(ASSETS.hardCase.url, ASSETS.hardCase);
      expect(duffel.z).toBeCloseTo(DUFFEL_LENGTH, 2);
      expect(duffel.x).toBeCloseTo(DUFFEL_DRAWN.depth, 2);
      expect(duffel.y).toBeCloseTo(DUFFEL_DRAWN.height, 2);
      expect(hard.y).toBeCloseTo(CASE_HEIGHT, 2);
      expect(hard.x).toBeCloseTo(CASE_DRAWN.width, 2);
      expect(hard.z).toBeCloseTo(CASE_DRAWN.depth, 2);
      const rawDuffel = await sizeOf(ASSETS.duffel.url, { ...ASSETS.duffel, scale: 1, rotationY: 0 });
      const rawCase = await sizeOf(ASSETS.hardCase.url, { ...ASSETS.hardCase, scale: 1 });
      expect(rawDuffel.x).toBeCloseTo(DUFFEL_GLB.width, 2);
      expect(rawCase.y).toBeCloseTo(CASE_GLB.height, 2);
      const bags = [
         ...DUFFEL_SPOTS.map((s) => ({ ...s, r: Math.hypot(duffel.x, duffel.z) / 2 })),
         ...CASE_SPOTS.map((s) => ({ ...s, r: Math.hypot(hard.x, hard.z) / 2 })),
      ];
      for (const bag of bags) {
         const inside = bag.x + bag.r > PLAY_AREA.minX && bag.x - bag.r < PLAY_AREA.maxX && bag.z + bag.r > PLAY_AREA.minZ && bag.z - bag.r < PLAY_AREA.maxZ;
         expect(inside, `${bag.x},${bag.z}`).toBe(false);
      }
      for (let i = 0; i < bags.length; i++) for (let j = i + 1; j < bags.length; j++) {
         const gap = Math.hypot(bags[i].x - bags[j].x, bags[i].z - bags[j].z) - bags[i].r - bags[j].r;
         expect(gap).toBeGreaterThan(0.2);
      }
   });
});
