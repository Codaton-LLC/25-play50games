import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import {
   ASSETS, BALL_HEIGHT, BOOK_LENGTH, CANDLE_HEIGHT, GLB_SIZE, INGREDIENT_SIZE, SHELF_WIDTH, TABLE_HEIGHT, TABLE_WIDTH, WIZARD_HEIGHT, WIZARD_LANDMARKS,
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

const ING = ["mushroom", "crystal", "berry", "flower", "herb", "bottle"] as const;

describe("wizard-potion-lab models", () => {
   it("lists every GLB it uses; only the wizard is a humanoid", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.wizard.humanoid?.landmarks).toBe(WIZARD_LANDMARKS);
      expect(Object.keys(WIZARD_LANDMARKS)).toHaveLength(32);
      for (const key of Object.keys(ASSETS) as Array<keyof typeof ASSETS>) if (key !== "wizard") expect((ASSETS[key] as ModelAsset).humanoid).toBeUndefined();
   });

   it("draws the wizard at 1.70 m, every ingredient at its size, the shelf, table, book, ball and candle at theirs", async () => {
      expect((await drawnSize(ASSETS.wizard)).y).toBeCloseTo(WIZARD_HEIGHT, 2);
      for (const type of ING) {
         const s = await drawnSize(ASSETS[type]);
         expect(Math.max(s.x, s.y, s.z), type).toBeCloseTo(INGREDIENT_SIZE[type], 2);
      }
      expect((await drawnSize(ASSETS.shelf)).x).toBeCloseTo(SHELF_WIDTH, 2);
      const table = await drawnSize(ASSETS.table);
      expect(table.x).toBeCloseTo(TABLE_WIDTH, 2);
      expect(table.y).toBeCloseTo(TABLE_HEIGHT, 2);
      expect((await drawnSize(ASSETS.book)).x).toBeCloseTo(BOOK_LENGTH, 2);
      expect((await drawnSize(ASSETS.ball)).y).toBeCloseTo(BALL_HEIGHT, 2);
      expect((await drawnSize(ASSETS.candle)).y).toBeCloseTo(CANDLE_HEIGHT, 2);
   });

   it("the constants match the real GLB bounds", async () => {
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const real = await drawnSize({ ...ASSETS[key], scale: 1, stretch: undefined } as ModelAsset);
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });
});

describe("wizard GLB", () => {
   describeCharacter("wizard", {
      asset: ASSETS.wizard,
      landmarks: WIZARD_LANDMARKS,
      height: GLB_SIZE.wizard.y,
      reach: 0.951,
      estimate: { tolerance: { hemY: 0.2 } },
      headFrom: WIZARD_LANDMARKS.headY + WIZARD_LANDMARKS.neckBlend + 0.005,
      hipHalfWidth: 0.25,
   });
});
