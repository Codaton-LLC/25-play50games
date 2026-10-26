import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";

if (!existsSync(path.join(process.cwd(), "public")) && existsSync(path.join(process.cwd(), "play50games-frontend", "public"))) {
   process.chdir(path.join(process.cwd(), "play50games-frontend"));
}
import { modelParts } from "../../core/assets";
import { hasModel, MODEL_MANIFEST } from "../../core/modelManifest";
import { readCharacterGlb } from "../../core/rig/robotGlb";
import {
   EXPANSION_CHARACTER_GLB_HEIGHT,
   EXPANSION_GLB_SIZE,
} from "../../core/sharedAssets";
import type { ModelAsset } from "../../core/types";
import {
   ASSETS,
   DUMMY_HEIGHT,
   KNIGHT_HEIGHT,
   SHIELD_GLB_SIZE,
   SHIELD_HEIGHT,
   SWORD_BLADE_AHEAD,
   SWORD_GLB_SIZE,
   SWORD_HILT_BACK,
   SWORD_LENGTH,
   TOWER_HEIGHT,
   TREE_HEIGHT,
} from "./assets";
import * as decor from "./assets";
import { ARENA } from "./rules";

describe("late-level training decor", () => {
   it("registers the training dummy file and fits its measured mesh to 1.5 m on the ground", async () => {
      const asset = ASSETS["trainingDummyT" as keyof typeof ASSETS];
      expect(asset?.url).toBe("/models/3d/knight-arena/trainingDummyT.glb");
      expect(MODEL_MANIFEST).toContain(asset.url);
      expect(existsSync(path.join(process.cwd(), "public", asset.url))).toBe(true);
      const measured = await measureDrawnAsset(asset);
      expect(measured.rawSize.x).toBeCloseTo(1.656493, 5);
      expect(measured.rawSize.y).toBeCloseTo(1.895201, 5);
      expect(measured.rawSize.z).toBeCloseTo(0.674425, 5);
      expect(measured.drawnSize.y).toBeCloseTo(1.5, 5);
      expect(measured.minY * (asset.scale ?? 1) + (asset.yOffset ?? 0)).toBeCloseTo(0, 5);
   });

   it("keeps every dummy footprint outside the play bounds and only enables levels 4 and 5", async () => {
      const { TRAINING_DUMMY_SPOTS, hasTrainingDecor } = decor as typeof decor & {
         TRAINING_DUMMY_SPOTS: readonly { x: number; y: number; z: number }[];
         hasTrainingDecor: (level: number) => boolean;
      };
      expect(TRAINING_DUMMY_SPOTS).toBeDefined();
      expect(TRAINING_DUMMY_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(TRAINING_DUMMY_SPOTS.length).toBeLessThanOrEqual(4);
      const { drawnSize } = await measureDrawnAsset(ASSETS["trainingDummyT" as keyof typeof ASSETS]);
      const radius = Math.hypot(drawnSize.x, drawnSize.z) / 2;
      for (const spot of TRAINING_DUMMY_SPOTS) {
         expect(Math.max(Math.abs(spot.x), Math.abs(spot.z)) - radius).toBeGreaterThan(ARENA.RADIUS_M);
         expect(spot.y).toBeCloseTo(-0.04, 6);
      }
      expect([1, 2, 3, 4, 5, 6].map(hasTrainingDecor)).toEqual([false, false, false, true, true, false]);
   });
});

async function measureDrawnAsset(asset: ModelAsset): Promise<{ rawSize: Vector3; drawnSize: Vector3; minY: number; tris: number; bytes: number }> {
   const file = path.join(process.cwd(), "public", asset.url.replace(/^\//, ""));
   const bytes = statSync(file).size;
   const glb = await readCharacterGlb(asset.url);
   const geom = new BufferGeometry();
   geom.setAttribute("position", new Float32BufferAttribute(glb.local, 3));
   geom.setIndex(new BufferAttribute(glb.indices, 1));
   const root = new Group();
   const holder = new Group();
   holder.position.fromArray(glb.node);
   holder.add(new Mesh(geom, new MeshBasicMaterial()));
   root.add(holder);
   root.updateMatrixWorld(true);
   const rawBox = new Box3().setFromObject(root);
   const rawSize = rawBox.getSize(new Vector3());
   const parts = modelParts(root, asset);
   const drawn = new Group();
   for (const p of parts) {
      const g = p.geometry.clone().applyMatrix4(p.matrix);
      drawn.add(new Mesh(g, new MeshBasicMaterial()));
   }
   const box = new Box3().setFromObject(drawn);
   const drawnSize = box.getSize(new Vector3());
   return { rawSize, drawnSize, minY: rawBox.min.y, tris: glb.indices.length / 3, bytes };
}

describe("knight-arena assets", () => {
   it("registers every asset URL in MODEL_MANIFEST and stays within file/triangle budgets", async () => {
      for (const [key, asset] of Object.entries(ASSETS)) {
         expect(hasModel(asset.url), `${key} in hasModel`).toBe(true);
         expect(MODEL_MANIFEST, `${key} url in MODEL_MANIFEST`).toContain(asset.url);
         const { tris, bytes } = await measureDrawnAsset(asset);
         if (asset.budget?.bytes) {
            expect(bytes, `${key} bytes`).toBeLessThanOrEqual(asset.budget.bytes);
         }
         if (asset.budget?.tris) {
            expect(tris, `${key} tris`).toBeLessThanOrEqual(asset.budget.tris);
         }
      }
   });

   it("pins measured bounds of sword.glb and shield.glb against the real meshes", async () => {
      const sword = await measureDrawnAsset(ASSETS.sword);
      expect(sword.minY).toBeCloseTo(0, 3);
      expect(sword.rawSize.x).toBeCloseTo(SWORD_GLB_SIZE.width, 3);
      expect(sword.rawSize.y).toBeCloseTo(SWORD_GLB_SIZE.height, 3);
      expect(sword.rawSize.z).toBeCloseTo(SWORD_GLB_SIZE.depth, 3);
      expect(sword.drawnSize.y).toBeCloseTo(SWORD_LENGTH, 3);

      const shield = await measureDrawnAsset(ASSETS.shield);
      expect(shield.minY).toBeCloseTo(0, 3);
      expect(shield.rawSize.x).toBeCloseTo(SHIELD_GLB_SIZE.width, 3);
      expect(shield.rawSize.y).toBeCloseTo(SHIELD_GLB_SIZE.height, 3);
      expect(shield.rawSize.z).toBeCloseTo(SHIELD_GLB_SIZE.depth, 3);
      expect(shield.drawnSize.y).toBeCloseTo(SHIELD_HEIGHT, 3);
   });

   it("fits knight, dummy, castleTower, leafyTree, sword, and shield to exact world heights", async () => {
      expect(KNIGHT_HEIGHT).toBe(1.75);
      expect((ASSETS.knight.scale ?? 1) * EXPANSION_CHARACTER_GLB_HEIGHT.knight).toBeCloseTo(KNIGHT_HEIGHT, 4);
      expect((ASSETS.dummy.scale ?? 1) * EXPANSION_GLB_SIZE.dummy.height).toBeCloseTo(DUMMY_HEIGHT, 4);
      expect((ASSETS.castleTower.scale ?? 1) * EXPANSION_GLB_SIZE.castleTower.height).toBeCloseTo(TOWER_HEIGHT, 4);
      expect((ASSETS.leafyTree.scale ?? 1) * EXPANSION_GLB_SIZE.leafyTree.height).toBeCloseTo(TREE_HEIGHT, 4);
      expect((ASSETS.sword.scale ?? 1) * SWORD_GLB_SIZE.height).toBeCloseTo(SWORD_LENGTH, 4);
      expect((ASSETS.shield.scale ?? 1) * SHIELD_GLB_SIZE.height).toBeCloseTo(SHIELD_HEIGHT, 4);
      expect(SWORD_BLADE_AHEAD + SWORD_HILT_BACK).toBeCloseTo(SWORD_LENGTH, 6);

      const dummy = await measureDrawnAsset(ASSETS.dummy);
      expect(dummy.drawnSize.y).toBeCloseTo(DUMMY_HEIGHT, 2);
   });
});
