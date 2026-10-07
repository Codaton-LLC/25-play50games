// The group C GLBs and the runner as Primitives.tsx / Scene.tsx draw them (assets.ts scale /
// stretch / rotationY / yOffset on the real, meshopt-decoded meshes, plus the book's lying group):
// each at the size its stand-in is authored at, so look.test.ts's loot boxes and the door leaf hold.
import { describe, expect, it } from "vitest";
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BOOK_DRAWN, BOOK_LIE, DOOR_LEAF, KEY_DRAWN } from "./assets";

const UP = new Vector3(0, 1, 0);

/** core <Model>: yOffset, then rotationY, then scale x stretch in the GLB's own axes */
function modelMatrix(asset: ModelAsset): Matrix4 {
   const s = asset.scale ?? 1, k = asset.stretch ?? [1, 1, 1];
   return new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(s * k[0], s * k[1], s * k[2]),
   );
}

/** The book's <Model> group in Primitives.tsx Loot */
const BOOK_GROUP = new Matrix4().compose(new Vector3(0, BOOK_DRAWN.y, 0), new Quaternion().setFromEuler(new Euler(BOOK_LIE, 0, 0)), new Vector3(1, 1, 1));

async function drawn(asset: ModelAsset, group = new Matrix4()): Promise<{ box: Box3; points: Vector3[] }> {
   const { cloud } = await readCharacterGlb(asset.url);
   const m = group.clone().multiply(modelMatrix(asset));
   const points: Vector3[] = [];
   for (let i = 0; i < cloud.length; i += 3) points.push(new Vector3(cloud[i], cloud[i + 1], cloud[i + 2]).applyMatrix4(m));
   return { box: new Box3().setFromPoints(points), points };
}

function expectSize(name: string, box: Box3, want: readonly number[]): void {
   const size = box.getSize(new Vector3()).toArray();
   for (let a = 0; a < 3; a++) expect(Math.abs(size[a] / want[a] - 1), `${name} axis ${a}: ${size[a]} vs ${want[a]}`).toBeLessThan(0.05);
}

describe("escape-room group C GLBs", () => {
   it("the key lies flat at its stand-in's box: 0.28 x 0.08 x 0.12, centred 0.08 up", async () => {
      const { box } = await drawn(ASSETS.key);
      expectSize("key", box, KEY_DRAWN.size);
      const c = box.getCenter(new Vector3());
      expect(c.y).toBeCloseTo(KEY_DRAWN.y, 2);
      expect(Math.abs(c.x)).toBeLessThan(0.01);
      expect(Math.abs(c.z)).toBeLessThan(0.01);
   });

   it("the book lies flat, red cover up, at its stand-in's box: 0.22 x 0.08 x 0.30, centred 0.06 up", async () => {
      const { box } = await drawn(ASSETS.book, BOOK_GROUP);
      expectSize("book", box, BOOK_DRAWN.size);
      const c = box.getCenter(new Vector3());
      expect(c.y).toBeCloseTo(BOOK_DRAWN.y, 2);
      expect(Math.abs(c.x)).toBeLessThan(0.01);
      expect(Math.abs(c.z)).toBeLessThan(0.01);
      // the GLB stands on its tail edge with the red cover facing -x: that face now looks up
      const cover = new Vector3(-1, 0, 0).transformDirection(BOOK_GROUP.clone().multiply(modelMatrix(ASSETS.book)));
      expect(cover.y).toBeCloseTo(1, 6);
   });

   it("the stand-ins' look.test boxes are the drawn sizes", () => {
      expect(KEY_DRAWN.size).toEqual([0.28, 0.08, 0.12]);
      expect(BOOK_DRAWN.size).toEqual([0.22, 0.08, 0.3]);
   });

   it("the door is the 1.4 x 2.0 x 0.12 leaf on the floor, centred on its group, knob at the free +x edge", async () => {
      const { box, points } = await drawn(ASSETS.door);
      expectSize("door", box, DOOR_LEAF);
      expect(box.min.y).toBeCloseTo(0, 2);
      const c = box.getCenter(new Vector3());
      expect(Math.abs(c.x)).toBeLessThan(0.01);
      expect(Math.abs(c.z)).toBeLessThan(0.01);
      // the knobs are what sticks out past the leaf's face (GLB |z| > 0.11, at the GLB's x = -0.33):
      // turned round, they must be on the side away from the hinge (Primitives.tsx: hinge at -x)
      const { cloud } = await readCharacterGlb(ASSETS.door.url);
      let knobs = 0;
      for (let i = 0; i < cloud.length; i += 3) {
         if (Math.abs(cloud[i + 2]) <= 0.11) continue;
         knobs++;
         expect(points[i / 3].x, "knob vertex").toBeGreaterThan(0.25);
      }
      expect(knobs).toBeGreaterThan(20);
   });
});

describe("escape-room runner", () => {
   it("is runner.glb drawn 1.40 m tall (the stand-in's and the README's height)", async () => {
      const { box } = await drawn(ASSETS.runner);
      expect(box.max.y / 1.4).toBeGreaterThan(0.97);
      expect(box.max.y / 1.4).toBeLessThan(1.03);
      expect(ASSETS.runner.humanoid?.landmarks).toBeTruthy();
   });
});
