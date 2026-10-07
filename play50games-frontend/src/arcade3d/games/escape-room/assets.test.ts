// The group C GLBs and the runner as Primitives.tsx / Scene.tsx draw them (assets.ts scale /
// stretch / rotationY / yOffset on the real, meshopt-decoded meshes, inside the groups the drawn
// elements carry): each at the size its stand-in is authored at, so look.test.ts's loot boxes and
// the door leaf hold. The transforms are read back from Primitives.tsx's own (hook-free) Loot and
// DoorLeaf elements, so dropping one there fails here.
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BOOK_DRAWN, DOOR_HINGE, DOOR_LEAF, KEY_DRAWN, RUNNER_ASSET, RUNNER_SCALE } from "./assets";
import { DoorLeaf, Loot } from "./Primitives";

const UP = new Vector3(0, 1, 0);
/** Room swings the hinge group to rotation.y = -1.15 when the door is fully open. */
const DOOR_OPEN = -1.15;

/** core <Model>: yOffset, then rotationY, then scale x stretch in the GLB's own axes */
function modelMatrix(asset: ModelAsset): Matrix4 {
   const s = asset.scale ?? 1, k = asset.stretch ?? [1, 1, 1];
   return new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(s * k[0], s * k[1], s * k[2]),
   );
}

type Props = Record<string, unknown> & { children?: unknown };
const propsOf = (node: unknown): Props => (node as ReactElement<Props>).props;

/** An element's own transform from its position / rotation props, like R3F applies them. */
function transformOf(props: Props): Matrix4 {
   for (const key of Object.keys(props)) {
      if (/^(position|rotation|scale|quaternion)-/.test(key) || key === "scale" || key === "quaternion" || key === "matrix") {
         throw new Error(`a transform prop this test does not read: ${key}`);
      }
   }
   const p = (props.position as number[] | undefined) ?? [0, 0, 0];
   const r = (props.rotation as number[] | undefined) ?? [0, 0, 0];
   return new Matrix4().compose(new Vector3(p[0], p[1], p[2]), new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2])), new Vector3(1, 1, 1));
}

/** A stand-in <mesh> (its <boxGeometry> child) placed by `group` and its own transform. */
function standInBox(mesh: Props, group: Matrix4): Box3 {
   const children = Array.isArray(mesh.children) ? mesh.children : [mesh.children];
   const box = children.find((c) => (c as ReactElement).type === "boxGeometry");
   const args = propsOf(box).args as [number, number, number];
   const geometry = new BoxGeometry(...args).applyMatrix4(group.clone().multiply(transformOf(mesh)));
   geometry.computeBoundingBox();
   const out = geometry.boundingBox!.clone();
   geometry.dispose();
   return out;
}

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

function expectCentre(name: string, box: Box3, want: readonly number[], digits = 2): void {
   const c = box.getCenter(new Vector3()).toArray();
   for (let a = 0; a < 3; a++) expect(c[a], `${name} centre axis ${a}`).toBeCloseTo(want[a], digits);
}

/** The door's hinge group (swung about y by `swing`), then the leaf group: what the door GLB and its stand-in sit in. */
function doorGroups(swing: number): { model: Props; leafAt: Matrix4 } {
   const hinge = propsOf(DoorLeaf({ hinge: () => {} }));
   const leaf = propsOf(hinge.children);
   const model = propsOf(leaf.children);
   const leafAt = transformOf(hinge).multiply(new Matrix4().makeRotationY(swing)).multiply(transformOf(leaf));
   return { model, leafAt };
}

describe("escape-room group C GLBs", () => {
   it("the key lies flat at its stand-in's box: 0.28 x 0.08 x 0.12, centred 0.08 up", async () => {
      const key = propsOf(Loot({ kind: 0 }));
      expect(key.asset).toBe(ASSETS.key);
      const group = transformOf(key);
      const { box } = await drawn(ASSETS.key, group);
      expectSize("key", box, KEY_DRAWN.size);
      expectCentre("key", box, [0, KEY_DRAWN.y, 0]);
      const standIn = standInBox(propsOf(key.fallback), group);
      expectSize("key stand-in", standIn, KEY_DRAWN.size);
      expectCentre("key stand-in", standIn, [0, KEY_DRAWN.y, 0], 6);
   });

   it("the book lies flat, red cover up, at its stand-in's box: 0.22 x 0.08 x 0.30, centred 0.06 up", async () => {
      const book = propsOf(Loot({ kind: 1 }));
      expect(book.asset).toBe(ASSETS.book);
      const group = transformOf(book);
      const { box } = await drawn(ASSETS.book, group);
      expectSize("book", box, BOOK_DRAWN.size);
      expectCentre("book", box, [0, BOOK_DRAWN.y, 0]);
      // the GLB stands on its tail edge with the red cover facing -x: that face now looks up
      const cover = new Vector3(-1, 0, 0).transformDirection(group.clone().multiply(modelMatrix(ASSETS.book)));
      expect(cover.y).toBeCloseTo(1, 6);
      // the stand-in inside the same group lies exactly as authored (look.test.ts's book box)
      const standIn = standInBox(propsOf(book.fallback), group);
      expectSize("book stand-in", standIn, BOOK_DRAWN.size);
      expectCentre("book stand-in", standIn, [0, BOOK_DRAWN.y, 0], 6);
   });

   it("the stand-ins' look.test boxes are the drawn sizes", () => {
      expect(KEY_DRAWN.size).toEqual([0.28, 0.08, 0.12]);
      expect(BOOK_DRAWN.size).toEqual([0.22, 0.08, 0.3]);
   });

   it("the door is the 1.4 x 2.0 x 0.12 leaf filling the frame, hinged at its -x edge, knob at the free +x edge", async () => {
      const { model, leafAt } = doorGroups(0);
      expect(model.asset).toBe(ASSETS.door);
      const { box, points } = await drawn(ASSETS.door, leafAt);
      expectSize("door", box, DOOR_LEAF);
      expect(box.min.y).toBeCloseTo(0, 2);
      // centred in the frame (x 0), 0.08 in front of it; the stand-in leaf the same
      expectCentre("door", box, [0, DOOR_LEAF[1] / 2, DOOR_HINGE.position[2]]);
      const standIn = standInBox(propsOf(model.fallback), leafAt);
      expectSize("door stand-in", standIn, DOOR_LEAF);
      expectCentre("door stand-in", standIn, [0, DOOR_LEAF[1] / 2, DOOR_HINGE.position[2]], 6);
      // the hinge axis is the leaf's -x edge
      expect(box.min.x).toBeCloseTo(DOOR_HINGE.position[0], 2);
      expect(box.min.x).toBeCloseTo(-DOOR_LEAF[0] / 2, 2);
      // the knobs are what sticks out past the leaf's face (GLB |z| > 0.11, at the GLB's x = -0.33):
      // turned round, they must be on the side away from the hinge
      const { cloud } = await readCharacterGlb(ASSETS.door.url);
      let knobs = 0;
      for (let i = 0; i < cloud.length; i += 3) {
         if (Math.abs(cloud[i + 2]) <= 0.11) continue;
         knobs++;
         expect(points[i / 3].x, "knob vertex").toBeGreaterThan(0.25);
      }
      expect(knobs).toBeGreaterThan(20);
   });

   it("the door swings about its hinge edge: that edge stays put, the free edge opens", async () => {
      const shut = (await drawn(ASSETS.door, doorGroups(0).leafAt)).points;
      const open = (await drawn(ASSETS.door, doorGroups(DOOR_OPEN).leafAt)).points;
      const minX = Math.min(...shut.map((p) => p.x)), maxX = Math.max(...shut.map((p) => p.x));
      let hingeEdge = 0, freeEdge = 0;
      for (let i = 0; i < shut.length; i++) {
         const moved = Math.hypot(open[i].x - shut[i].x, open[i].z - shut[i].z);
         if (shut[i].x < minX + 0.05) { hingeEdge++; expect(moved, "hinge-edge vertex").toBeLessThan(0.12); }
         if (shut[i].x > maxX - 0.05) { freeEdge++; expect(moved, "free-edge vertex").toBeGreaterThan(1.2); }
      }
      expect(hingeEdge).toBeGreaterThan(20);
      expect(freeEdge).toBeGreaterThan(20);
   });
});

describe("escape-room runner", () => {
   it("RUNNER_ASSET is runner.glb drawn 1.40 m tall (the stand-in's and the README's height), stride and lift through its scale", async () => {
      expect(RUNNER_ASSET).toBe(ASSETS.runner);
      const { box } = await drawn(RUNNER_ASSET);
      expect(box.max.y / 1.4).toBeGreaterThan(0.97);
      expect(box.max.y / 1.4).toBeLessThan(1.03);
      expect(RUNNER_SCALE).toBe(RUNNER_ASSET.scale);
      // Scene.tsx's gait and stand-in limbs use RUNNER_LANDMARKS: the same joints the rig skins with
      expect(RUNNER_ASSET.humanoid?.landmarks).toBe(RUNNER_LANDMARKS);
   });

   it("Scene.tsx draws exactly RUNNER_ASSET and takes RUNNER_SCALE from assets.ts", () => {
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.match(/<HumanoidModel\b/g)).toHaveLength(1);
      expect(scene).toMatch(/<HumanoidModel\s+asset=\{RUNNER_ASSET\}\s/);
      expect(scene).toMatch(/import \{[^}]*\bRUNNER_ASSET\b[^}]*\bRUNNER_SCALE\b[^}]*\} from "\.\/assets";/);
      expect(scene).not.toMatch(/\b(const|let|var)\s+RUNNER_(SCALE|ASSET)\b/);
      expect(scene).not.toMatch(/SHARED_ASSETS|ASSETS\.runner/);
   });
});
