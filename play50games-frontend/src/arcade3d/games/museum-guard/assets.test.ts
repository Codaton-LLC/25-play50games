import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BENCH_SCALE, DOOR_SCALE, KNIGHT_SCALE, ROBOT_SCALE } from "./assets";

async function drawnSize(asset: ModelAsset): Promise<Vector3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   const box = new Box3();
   const v = new Vector3();
   for (const part of parts) {
      const position = part.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i += 1) box.expandByPoint(v.fromBufferAttribute(position, i).applyMatrix4(part.matrix));
   }
   geometry.dispose();
   return box.getSize(new Vector3());
}

describe("museum-guard models", () => {
   it("uses listed GLBs, with the knight and the robot still humanoids", () => {
      for (const asset of [ASSETS.knight, ASSETS.robot, ASSETS.penguin, ASSETS.dino, ASSETS.door, ASSETS.bench]) {
         expect(hasModel(asset.url)).toBe(true);
      }
      expect(ASSETS.knight.humanoid).toBeTruthy();
      expect(ASSETS.robot.humanoid).toBeTruthy();
      expect(ASSETS.penguin.humanoid).toBeUndefined();
      expect(ASSETS.dino.humanoid).toBeUndefined();
      expect(ASSETS.knight.scale).toBeCloseTo(1.6 / 1.884, 6);
      expect(KNIGHT_SCALE).toBe(ASSETS.knight.scale);
      expect(ASSETS.robot.scale).toBeCloseTo(1.2 / 1.72, 6);
      expect(ROBOT_SCALE).toBe(ASSETS.robot.scale);
      expect(ASSETS.door.scale).toBe(DOOR_SCALE);
      expect(ASSETS.bench.scale).toBe(BENCH_SCALE);
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.includes("HumanoidModel")).toBe(false);
      expect(scene.includes("<Model")).toBe(true);
   });

   it("draws the knight at 1.6 m, the robot near 1.2 m, the penguin at 0.8 m", async () => {
      const knight = await drawnSize(ASSETS.knight);
      const robot = await drawnSize(ASSETS.robot);
      const penguin = await drawnSize(ASSETS.penguin);
      expect(knight.y).toBeCloseTo(1.6, 2);
      expect(robot.y).toBeCloseTo(1.2, 2);
      expect(penguin.y).toBeCloseTo(0.8, 2);
   });

   it("draws the dino 1.1 m long and 0.8 m tall, the door 2.1 m, the bench 2 m wide", async () => {
      const dino = await drawnSize(ASSETS.dino);
      const door = await drawnSize(ASSETS.door);
      const bench = await drawnSize(ASSETS.bench);
      expect(dino.z).toBeCloseTo(1.1, 2);
      expect(dino.y).toBeCloseTo(0.8, 2);
      expect(door.y).toBeCloseTo(2.1, 2);
      expect(bench.x).toBeCloseTo(2, 2);
   });
});
