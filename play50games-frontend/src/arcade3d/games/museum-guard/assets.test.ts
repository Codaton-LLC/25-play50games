import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BENCH_SCALE, DOOR_SCALE, KNIGHT_SCALE, ROBOT_SCALE, SARCOPHAGUS_SPOTS } from "./assets";
import { RING } from "./rules";

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

describe("museum-guard sarcophagus decor", () => {
   it("has a listed GLB on disk", () => {
      expect(ASSETS.sarcophagus.url).toBe("/models/3d/museum-guard/sarcophagusT.glb");
      expect(hasModel(ASSETS.sarcophagus.url)).toBe(true);
      expect(existsSync(resolve(process.cwd(), "public", ASSETS.sarcophagus.url.slice(1)))).toBe(true);
   });

   it("fits the measured mesh to a grounded 1.4 m display", async () => {
      const asset = ASSETS.sarcophagus;
      const { cloud } = await readCharacterGlb(asset.url);
      const raw = new Box3();
      const point = new Vector3();
      for (let i = 0; i < cloud.length; i += 3) raw.expandByPoint(point.fromArray(cloud, i));
      const size = raw.getSize(new Vector3());
      expect(size.x).toBeCloseTo(1.557390, 5);
      expect(size.y).toBeCloseTo(0.668518, 5);
      expect(size.z).toBeCloseTo(1.896267, 5);
      expect(raw.min.y * asset.scale + asset.yOffset).toBeCloseTo(0, 5);
      const drawn = await drawnSize(asset);
      expect(drawn.z).toBeCloseTo(1.4, 3);
      expect(drawn.x).toBeCloseTo(1.149785, 3);
      expect(drawn.y).toBeCloseTo(0.493552, 3);
   });

   it("keeps the full displays outside the play bounds and inside the gallery wall", async () => {
      const size = await drawnSize(ASSETS.sarcophagus);
      const playRadius = Math.hypot(RING.pedestalR + RING.pedestalHalf, RING.pedestalHalf);
      expect(SARCOPHAGUS_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(SARCOPHAGUS_SPOTS.length).toBeLessThanOrEqual(4);
      for (const spot of SARCOPHAGUS_SPOTS) {
         const radius = Math.hypot(spot.x, spot.z);
         // Long axis is tangent to the wall; the nearest edge clears the entire play disk.
         expect(radius - size.x / 2).toBeGreaterThan(playRadius);
         expect(Math.hypot(radius + size.x / 2, size.z / 2)).toBeLessThan(7.9);
         expect(spot.y).toBe(0);
         expect(spot.rotY).toBeCloseTo(Math.atan2(spot.x, spot.z) + Math.PI / 2);
      }
   });
});
