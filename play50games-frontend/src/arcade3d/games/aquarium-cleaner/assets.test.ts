import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import {
   ASSETS, BASKET_WIDTH, BOTTLE_HEIGHT, CASTLE_STRETCH_Y, CASTLE_WIDTH, CORAL_WIDTH, DIVER_HEIGHT, DIVER_LANDMARKS, FILTER_WIDTH, FISH_LENGTH, GLB_SIZE,
   ROCK_WIDTH, SCRUBBER_LENGTH, SHARK_LENGTH, TANK_HEIGHT,
} from "./assets";

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

describe("aquarium-cleaner models", () => {
   it("lists every GLB it uses; only the diver is a humanoid; the scene never forgets a stand-in", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.diver.humanoid?.landmarks).toBe(DIVER_LANDMARKS);
      expect(Object.keys(DIVER_LANDMARKS)).toHaveLength(32);
      for (const key of Object.keys(ASSETS) as Array<keyof typeof ASSETS>) if (key !== "diver") expect((ASSETS[key] as ModelAsset).humanoid).toBeUndefined();
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.includes("<HumanoidModel")).toBe(true);
      expect(scene.includes("fallback=")).toBe(true);
   });

   it("fits every prop to the size the rules use, from the measured GLB bounds", async () => {
      const diver = await drawnSize(ASSETS.diver);
      expect(diver.y).toBeCloseTo(DIVER_HEIGHT, 2);
      expect((await drawnSize(ASSETS.scrubber)).x).toBeCloseTo(SCRUBBER_LENGTH, 2);
      expect((await drawnSize(ASSETS.bottle)).y).toBeCloseTo(BOTTLE_HEIGHT, 2);
      expect((await drawnSize(ASSETS.fish)).z).toBeCloseTo(FISH_LENGTH, 2);
      const castle = await drawnSize(ASSETS.castle);
      expect(castle.x).toBeCloseTo(CASTLE_WIDTH, 2);
      expect(castle.y).toBeCloseTo(GLB_SIZE.castle.y * (CASTLE_WIDTH / GLB_SIZE.castle.x) * CASTLE_STRETCH_Y, 2);
      expect((await drawnSize(ASSETS.rock)).x).toBeCloseTo(ROCK_WIDTH, 2);
      expect((await drawnSize(ASSETS.filter)).x).toBeCloseTo(FILTER_WIDTH, 2);
      expect((await drawnSize(ASSETS.tank)).y).toBeCloseTo(TANK_HEIGHT, 2);
      expect((await drawnSize(ASSETS.shark)).z).toBeCloseTo(SHARK_LENGTH, 2);
      expect((await drawnSize(ASSETS.basket)).x).toBeCloseTo(BASKET_WIDTH, 2);
      expect((await drawnSize(ASSETS.coral)).x).toBeCloseTo(CORAL_WIDTH, 2);
   });

   it("the constants match the real GLB bounds", async () => {
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const asset = { ...ASSETS[key], scale: 1, stretch: undefined } as ModelAsset;
         const real = await drawnSize(asset);
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });
});

describe("shared diver GLB", () => {
   describeCharacter("diver", {
      asset: ASSETS.diver,
      landmarks: DIVER_LANDMARKS,
      height: GLB_SIZE.diver.y,
      reach: 0.947,
      estimate: { tolerance: { hemY: 0.2 } },
      headFrom: DIVER_LANDMARKS.headY + DIVER_LANDMARKS.neckBlend + 0.005,
      hipHalfWidth: 0.22,
   });
});
