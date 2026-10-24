// Zoo Escape's fits on the real, meshopt-decoded GLBs (through core modelParts, what <Model> /
// <InstancedModel> draw): every model is in the manifest and drawn at the README's size.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BAMBOO_GLB, KEEPER_SCALE, PANDA_LENGTH, PROP_SIZE } from "./assets";

async function drawnSize(asset: ModelAsset): Promise<Vector3> {
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
   const v = new Vector3();
   for (let i = 0; i < local.length; i += 3) box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   expect(box.min.y).toBeCloseTo(0, 2);
   return box.getSize(new Vector3());
}

describe("zoo-escape models", () => {
   it("are all in the manifest", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.bamboo.url).toBe("/models/3d/zoo-escape/bamboo.glb");
   });

   it("measures the new bamboo GLB as committed", async () => {
      const raw = await drawnSize({ ...ASSETS.bamboo, scale: 1 });
      expect(raw.x).toBeCloseTo(BAMBOO_GLB.width, 3);
      expect(raw.y).toBeCloseTo(BAMBOO_GLB.height, 3);
      expect(raw.z).toBeCloseTo(BAMBOO_GLB.depth, 3);
   });

   it("draws every model at the README's size", async () => {
      const panda = await drawnSize(ASSETS.panda);
      expect(panda.z).toBeCloseTo(PANDA_LENGTH, 2);
      expect(panda.y).toBeCloseTo(1.0, 1);
      expect((await drawnSize(ASSETS.keeper)).y).toBeCloseTo(1.75, 2);
      expect(KEEPER_SCALE).toBeCloseTo(1.75 / 1.8921, 6);
      expect((await drawnSize(ASSETS.bamboo)).x).toBeCloseTo(1, 3);
      expect((await drawnSize(ASSETS.rock)).x).toBeCloseTo(1, 2);
      expect((await drawnSize(ASSETS.leafyTree)).y).toBeCloseTo(3.5, 2);
      expect((await drawnSize(ASSETS.bench)).x).toBeCloseTo(PROP_SIZE.benchLength, 2);
      expect((await drawnSize(ASSETS.bin)).y).toBeCloseTo(PROP_SIZE.binHeight, 2);
      expect((await drawnSize(ASSETS.lamp)).y).toBeCloseTo(PROP_SIZE.lampHeight, 2);
      expect((await drawnSize(ASSETS.palm)).y).toBeCloseTo(PROP_SIZE.palmHeight, 2);
      const car = await drawnSize(ASSETS.car);
      expect(car.z).toBeCloseTo(PROP_SIZE.carLength, 2);
      // inside its 2.0 x 4.2 rules box
      expect(car.x).toBeLessThanOrEqual(2.01);
   });
});
