import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { createPose, sitPose } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import {
   ASSETS, BARN_CRATE_WIDTH, BARN_SQUASH, BARN_WIDTH, FARMER_HEIGHT, FARMER_LANDMARKS, FARMER_SCALE, GATE_SCALE, GLB_SIZE, SCARECROW_HEIGHT, SEAT_Y,
   SILO_HEIGHT, SILO_WIDTH, TRACTOR_LENGTH, TRAILER_LENGTH, TROUGH_LENGTH,
} from "./assets";
import { fenceDraw, fenceGlbSpots } from "./looks";

async function drawnSize(asset: ModelAsset): Promise<Vector3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const box = new Box3();
   const v = new Vector3();
   for (const part of modelParts(root, asset)) {
      const position = part.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i += 1) box.expandByPoint(v.fromBufferAttribute(position, i).applyMatrix4(part.matrix));
   }
   geometry.dispose();
   return box.getSize(new Vector3());
}

describe("farm-tractor-challenge models", () => {
   it("lists every GLB it uses; only the farmer is a humanoid", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.farmer.humanoid?.landmarks).toBe(FARMER_LANDMARKS);
      expect(Object.keys(FARMER_LANDMARKS)).toHaveLength(32);
      for (const key of Object.keys(ASSETS) as Array<keyof typeof ASSETS>) if (key !== "farmer") expect((ASSETS[key] as ModelAsset).humanoid).toBeUndefined();
   });

   it("draws the farmer at 1.78 m and every prop at the size the scene places it", async () => {
      expect((await drawnSize(ASSETS.farmer)).y).toBeCloseTo(FARMER_HEIGHT, 2);
      expect((await drawnSize(ASSETS.tractor)).z).toBeCloseTo(TRACTOR_LENGTH, 2);
      expect((await drawnSize(ASSETS.trailer)).z).toBeCloseTo(TRAILER_LENGTH, 2);
      const barn = await drawnSize(ASSETS.barn);
      expect(barn.x).toBeCloseTo(BARN_WIDTH, 2);
      expect(barn.y).toBeCloseTo(GLB_SIZE.barn.y * (BARN_WIDTH / GLB_SIZE.barn.x) * BARN_SQUASH, 2);
      const silo = await drawnSize(ASSETS.silo);
      expect(silo.x).toBeCloseTo(SILO_WIDTH, 2);
      expect(silo.y).toBeCloseTo(SILO_HEIGHT, 2);
      expect((await drawnSize(ASSETS.trough)).x).toBeCloseTo(TROUGH_LENGTH, 2);
      expect((await drawnSize(ASSETS.scarecrow)).y).toBeCloseTo(SCARECROW_HEIGHT, 2);
      expect((await drawnSize(ASSETS.gate)).x).toBeCloseTo(GLB_SIZE.gate.x * GATE_SCALE, 2);
      expect((await drawnSize(ASSETS.barnCrate)).x).toBeCloseTo(BARN_CRATE_WIDTH, 2);
   });

   it("draws the fence, the hay bale and the apple crate as unit models: the scene's scale is their size, never doubled", async () => {
      const bale = await drawnSize(ASSETS.hay);
      expect([bale.x, bale.y, bale.z].map((v) => Math.round(v * 100) / 100)).toEqual([1, 1, 1]);
      const crate = await drawnSize(ASSETS.appleCrate);
      expect([crate.x, crate.y, crate.z].map((v) => Math.round(v * 100) / 100)).toEqual([1, 1, 1]);
      const fence = await drawnSize(ASSETS.fence);
      // one metre long along z after the quarter turn
      expect(fence.z).toBeCloseTo(1, 2);
      expect(fence.y).toBeCloseTo(GLB_SIZE.fence.y / GLB_SIZE.fence.x, 2);
   });

   it("puts one fence segment on every span between two posts, its scale the span", () => {
      for (const id of LEVEL_IDS) {
         const rails = fenceDraw(id).rails;
         const spots = fenceGlbSpots(id);
         expect(spots).toHaveLength(rails.length / 2);
         spots.forEach((spot, i) => {
            expect(spot.y).toBe(0);
            expect(spot.scale).toBe(rails[i * 2].sz);
            expect(spot.sx).toBeUndefined();
         });
      }
   });

   it("the constants match the real GLB bounds", async () => {
      const ids: Record<keyof typeof GLB_SIZE, ModelAsset> = {
         farmer: ASSETS.farmer, tractor: ASSETS.tractor, trailer: ASSETS.trailer, hay: ASSETS.hay, crate: ASSETS.appleCrate, barn: ASSETS.barn, fence: ASSETS.fence,
         gate: ASSETS.gate, scarecrow: ASSETS.scarecrow, silo: ASSETS.silo, trough: ASSETS.trough,
      };
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const real = await drawnSize({ ...ids[key], scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });

   it("seats the farmer with the core sitPose: knees forward, the hips at the seat, the feet hanging under it", async () => {
      const farmer = await rigCharacter(ASSETS.farmer);
      const world = farmer.posed(sitPose(1, createPose()), false);
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < world.length; i += 3) {
         minY = Math.min(minY, world[i]);
         maxY = Math.max(maxY, world[i]);
      }
      const seat = SEAT_Y + FARMER_LANDMARKS.hipY * FARMER_SCALE;
      expect(minY * FARMER_SCALE + SEAT_Y).toBeLessThan(seat);
      expect(minY * FARMER_SCALE + SEAT_Y).toBeGreaterThan(seat - 0.9);
      expect(maxY * FARMER_SCALE + SEAT_Y).toBeGreaterThan(seat + 0.5);
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.includes("sitPose(1, p)")).toBe(true);
   });
});

describe("farmer GLB", () => {
   describeCharacter("farmer", {
      asset: ASSETS.farmer,
      landmarks: FARMER_LANDMARKS,
      height: GLB_SIZE.farmer.y,
      reach: 0.951,
      estimate: { tolerance: { hemY: 0.2 } },
      headFrom: FARMER_LANDMARKS.headY + FARMER_LANDMARKS.neckBlend + 0.005,
      hipHalfWidth: 0.22,
   });
});
