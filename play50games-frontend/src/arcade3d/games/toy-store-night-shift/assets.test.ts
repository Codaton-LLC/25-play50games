import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BIN_PLUSH_WIDTH, BIN_WIDTH, CRATE_WIDTH, GLB_SIZE, GUARD_HEIGHT, GUARD_LANDMARKS, TOY_ASSETS, TOY_SIZE, WINDUP_SIZE } from "./assets";
import { CATEGORIES } from "./levels";
import { SHELF_DEPTH, SHELF_H, SHELF_LEN } from "./rules";

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

describe("toy-store-night-shift models", () => {
   it("lists every GLB it uses; only the guard is a humanoid; the toy robot (a wind-up, not a T-pose) is a plain model", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      for (const cat of CATEGORIES) expect(TOY_ASSETS[cat]).toBeTruthy();
      expect(ASSETS.guard.humanoid?.landmarks).toBe(GUARD_LANDMARKS);
      expect(Object.keys(GUARD_LANDMARKS)).toHaveLength(32);
      for (const key of Object.keys(ASSETS) as Array<keyof typeof ASSETS>) if (key !== "guard") expect((ASSETS[key] as ModelAsset).humanoid).toBeUndefined();
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.includes("<HumanoidModel")).toBe(true);
      expect(scene.includes("<Flashlight")).toBe(true);
      expect(scene.includes("light={false}")).toBe(true);
   });

   it("draws the guard at 1.80 m, the shelf 4 x 1.6 x 0.8 m, every toy at its size and the wind-ups at 0.95 m", async () => {
      expect((await drawnSize(ASSETS.guard)).y).toBeCloseTo(GUARD_HEIGHT, 2);
      const shelf = await drawnSize(ASSETS.shelf);
      expect(shelf.x).toBeCloseTo(SHELF_LEN, 2);
      expect(shelf.y).toBeCloseTo(SHELF_H, 2);
      expect(shelf.z).toBeCloseTo(SHELF_DEPTH, 2);
      for (const cat of CATEGORIES) {
         const s = await drawnSize(TOY_ASSETS[cat]);
         expect(Math.max(s.x, s.y, s.z), cat).toBeCloseTo(TOY_SIZE[cat], 2);
      }
      expect((await drawnSize(ASSETS.windupRobot)).y).toBeCloseTo(WINDUP_SIZE, 2);
      expect((await drawnSize(ASSETS.windupCar)).z).toBeCloseTo(WINDUP_SIZE, 2);
      expect((await drawnSize(ASSETS.bin)).x).toBeCloseTo(BIN_WIDTH, 2);
      expect((await drawnSize(ASSETS.binPlush)).x).toBeCloseTo(BIN_PLUSH_WIDTH, 2);
      expect((await drawnSize(ASSETS.crate)).x).toBeCloseTo(CRATE_WIDTH, 2);
   });

   it("the constants match the real GLB bounds", async () => {
      const ids: Record<keyof typeof GLB_SIZE, ModelAsset> = {
         guard: ASSETS.guard, teddy: ASSETS.teddy, car: ASSETS.car, airplane: ASSETS.airplane, ball: ASSETS.ball, blocks: ASSETS.blocks, train: ASSETS.train,
         robot: ASSETS.robot, windupRobot: ASSETS.windupRobot, windupCar: ASSETS.windupCar, shelf: ASSETS.shelf, bin: ASSETS.bin, binPlush: ASSETS.binPlush,
      };
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const real = await drawnSize({ ...ids[key], scale: 1, stretch: undefined });
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });
});

describe("night guard GLB", () => {
   describeCharacter("guard", {
      asset: ASSETS.guard,
      landmarks: GUARD_LANDMARKS,
      height: GLB_SIZE.guard.y,
      reach: 0.942,
      estimate: { tolerance: { hemY: 0.2 } },
      headFrom: GUARD_LANDMARKS.headY + GUARD_LANDMARKS.neckBlend + 0.005,
      hipHalfWidth: 0.25,
   });
});
