// Moving instances (<DynamicInstanced>, <DynamicInstancedModel>): the per-frame writer with real
// three.js InstancedMeshes (node, no WebGL), and the components server-rendered with a mocked
// useFrame to check which meshes they draw, which fallback they pick and that nothing is fetched.
import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   BoxGeometry,
   Color,
   Group,
   InstancedMesh,
   Matrix4,
   Mesh,
   MeshBasicMaterial,
   SkinnedMesh,
   Vector3,
   type Object3D,
} from "three";
import type { ModelAsset } from "./types";
import { FRAME_PRIORITY } from "./frameLoop";
import { DynamicInstanced, createInstanceTint, piecesOf, releaseInstanceBuffers, writeDynamicInstances, type InstancePart, type InstanceTarget } from "./render";
import { DynamicInstancedModel } from "./assets";

const { useGLTF, useFrame, frames, PROP, BROKEN, RIGGED, prop } = vi.hoisted(() => {
   const prop: { scene: unknown; rigged: unknown } = { scene: null, rigged: null };
   const load = vi.fn((url: string) => {
      if (url.endsWith("broken.glb")) throw new Error("404");
      if (url.endsWith("rigged.glb")) return { scene: prop.rigged, animations: [] };
      return { scene: prop.scene, animations: [] };
   });
   const frames: Array<{ callback: () => void; priority: number | undefined }> = [];
   return {
      useGLTF: Object.assign(load, { clear: vi.fn() }),
      useFrame: vi.fn((callback: () => void, priority?: number) => {
         frames.push({ callback, priority });
      }),
      frames,
      PROP: "/models/3d/test/car.glb",
      BROKEN: "/models/3d/test/broken.glb",
      RIGGED: "/models/3d/test/rigged.glb",
      prop,
   };
});
vi.mock("@react-three/drei", () => ({ useGLTF }));
vi.mock("@react-three/fiber", () => ({ useFrame, useThree: vi.fn() }));
vi.mock("./modelManifest", () => ({
   MODEL_MANIFEST: [PROP, BROKEN, RIGGED],
   hasModel: (url: string) => url === PROP || url === BROKEN || url === RIGGED,
}));

const asset = (url: string, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id: "car",
   url,
   fallback: "box",
   budget: { tris: 1, bytes: 1 },
   ...extra,
});
const MISSING = asset("/models/3d/test/missing.glb");

/** A two-mesh GLB: a body and a cabin 1 unit up. */
function carScene(): Object3D {
   const root = new Group();
   const body = new Mesh(new BoxGeometry(2, 1, 1), new MeshBasicMaterial());
   const cabin = new Mesh(new BoxGeometry(1, 0.5, 1), new MeshBasicMaterial());
   cabin.position.set(0, 1, 0);
   root.add(body, cabin);
   return root;
}

function markup(node: ReactNode): string {
   const error = vi.spyOn(console, "error").mockImplementation(() => {});
   try {
      return renderToString(node).toLowerCase();
   } finally {
      error.mockRestore();
   }
}
const meshTags = (html: string) => html.match(/<instancedmesh/g)?.length ?? 0;

afterEach(() => {
   useGLTF.mockClear();
   useFrame.mockClear();
   frames.length = 0;
});

describe("writeDynamicInstances", () => {
   const origin = (mesh: InstancedMesh, i: number) => {
      const m = new Matrix4();
      mesh.getMatrixAt(i, m);
      return new Vector3().applyMatrix4(m);
   };

   it("places every shown copy in every mesh, packs them and hides the rest", () => {
      const lift = new Matrix4().makeTranslation(0, 1, 0);
      const side = new Matrix4().makeTranslation(0.5, 0, 0);
      const twoPieces = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4 * 2);
      const onePiece = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4);
      const targets: InstanceTarget[] = [
         { mesh: twoPieces, locals: [lift, side] },
         { mesh: onePiece, locals: null },
         { mesh: null, locals: null }, // not mounted (yet): skipped
      ];
      const update = vi.fn((i: number, m: Matrix4) => {
         if (i === 1) return false; // an unused pool slot
         m.makeTranslation(10 * i, 0, -i);
      });
      const versionBefore = onePiece.instanceMatrix.version;
      const shown = writeDynamicInstances(targets, 4, update, new Matrix4(), new Matrix4());
      expect(shown).toBe(3);
      // update ran once per copy, not once per mesh
      expect(update).toHaveBeenCalledTimes(4);
      expect(twoPieces.count).toBe(6);
      expect(onePiece.count).toBe(3);
      expect(onePiece.instanceMatrix.version).toBeGreaterThan(versionBefore);
      // copy 2 is the second shown copy: slot 1 of the one-piece mesh, slots 2 and 3 of the other
      expect(origin(onePiece, 1).toArray()).toEqual([20, 0, -2]);
      expect(origin(twoPieces, 2).toArray()).toEqual([20, 1, -2]);
      expect(origin(twoPieces, 3).toArray()).toEqual([20.5, 0, -2]);
      expect(origin(onePiece, 2).toArray()).toEqual([30, 0, -3]);
   });

   it("hands every copy a fresh identity matrix (an update may write nothing)", () => {
      const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 3);
      const seen: number[][] = [];
      const update = (i: number, m: Matrix4) => {
         seen.push(m.toArray());
         if (i === 0) m.makeTranslation(5, 5, 5);
      };
      writeDynamicInstances([{ mesh }], 3, update, new Matrix4(), new Matrix4());
      const identity = new Matrix4().toArray();
      expect(seen).toEqual([identity, identity, identity]);
      expect(origin(mesh, 1).toArray()).toEqual([0, 0, 0]);
      expect(mesh.count).toBe(3);
   });

   it("all hidden draws nothing; pieces default to one", () => {
      const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 5);
      expect(writeDynamicInstances([{ mesh, locals: [] }], 5, () => false, new Matrix4(), new Matrix4())).toBe(0);
      expect(mesh.count).toBe(0);
      expect(piecesOf(null)).toBe(1);
      expect(piecesOf([])).toBe(1);
      expect(piecesOf([new Matrix4(), new Matrix4()])).toBe(2);
   });
});

describe("per-copy tint", () => {
   const colorAt = (mesh: InstancedMesh, i: number) => {
      const c = new Color();
      mesh.getColorAt(i, c);
      return c.toArray().map((v) => Math.round(v * 1000) / 1000);
   };

   it("an update that never sets the colour writes no colours (old callers unchanged)", () => {
      const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 3);
      const seen: number[][] = [];
      const tint = createInstanceTint();
      writeDynamicInstances([{ mesh }], 3, (_i, _m, color) => void seen.push(color.toArray()), new Matrix4(), new Matrix4(), tint);
      expect(mesh.instanceColor).toBeNull();
      expect(tint.on).toBe(false);
      expect(seen).toEqual([[1, 1, 1], [1, 1, 1], [1, 1, 1]]);
   });

   it("tints each shown copy, packed like the matrices, and multiplies piece colours", () => {
      const red = new Color(1, 0, 0);
      const half = new Color(0.5, 0.5, 0.5);
      const plain = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4);
      const pieces = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 8);
      const targets: InstanceTarget[] = [
         { mesh: plain, locals: null },
         { mesh: pieces, locals: [new Matrix4(), new Matrix4()], colors: [new Color(1, 1, 1), half] },
      ];
      const tint = createInstanceTint();
      const update = (i: number, _m: Matrix4, color: Color) => {
         if (i === 0) return false;
         if (i === 2) color.copy(red);
      };
      writeDynamicInstances(targets, 3, update, new Matrix4(), new Matrix4(), tint);
      expect(tint.on).toBe(true);
      // copy 1 = slot 0 (untinted, white), copy 2 = slot 1 (red)
      expect(colorAt(plain, 0)).toEqual([1, 1, 1]);
      expect(colorAt(plain, 1)).toEqual([1, 0, 0]);
      expect(colorAt(pieces, 2)).toEqual([1, 0, 0]);
      expect(colorAt(pieces, 3)).toEqual([0.5, 0, 0]);
      const version = plain.instanceColor!.version;
      // next frame nobody is tinted: the slots go back to white (no stale red)
      writeDynamicInstances(targets, 3, () => {}, new Matrix4(), new Matrix4(), tint);
      expect(colorAt(plain, 1)).toEqual([1, 1, 1]);
      expect(colorAt(pieces, 3)).toEqual([0.5, 0.5, 0.5]);
      expect(plain.instanceColor!.version).toBeGreaterThan(version);
   });

   it("allocates nothing per copy (the same colour object every call)", () => {
      const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 3);
      const objects = new Set<Color>();
      writeDynamicInstances([{ mesh }], 3, (_i, _m, color) => void objects.add(color.setRGB(0.2, 0.4, 0.6)), new Matrix4(), new Matrix4(), createInstanceTint());
      expect(objects.size).toBe(1);
   });
});

describe("<DynamicInstanced>", () => {
   it("one mesh from its children, updated in a FRAME_PRIORITY.visuals frame callback", () => {
      const update = vi.fn();
      const html = markup(
         createElement(DynamicInstanced, { count: 7, update }, createElement("boxGeometry"), createElement("meshStandardMaterial"))
      );
      expect(meshTags(html)).toBe(1);
      expect(html).toContain("<boxgeometry");
      expect(frames).toHaveLength(1);
      expect(frames[0].priority).toBe(FRAME_PRIORITY.visuals);
      // one frame: update runs for every copy (meshes are not mounted in a server render)
      frames[0].callback();
      expect(update).toHaveBeenCalledTimes(7);
   });

   it("one mesh per part, whatever the pieces per copy", () => {
      const parts: InstancePart[] = [
         { geometry: new BoxGeometry(), material: new MeshBasicMaterial(), locals: [new Matrix4(), new Matrix4()], colors: [new Color("red"), new Color("blue")] },
         { geometry: new BoxGeometry(), material: new MeshBasicMaterial() },
      ];
      expect(meshTags(markup(createElement(DynamicInstanced, { count: 3, update: () => {}, parts })))).toBe(2);
   });
});

describe("releasing a pool mesh on unmount", () => {
   it("works on a mesh whose dispose R3F nulled (dispose={null}) and still frees the instance buffers", () => {
      const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4);
      // what R3F's dispose={null} prop does to the object (it keeps the shared geometry/material)
      (mesh as unknown as { dispose: null }).dispose = null;
      const disposed = vi.fn();
      mesh.addEventListener("dispose", disposed);
      expect(() => releaseInstanceBuffers(mesh)).not.toThrow();
      expect(disposed).toHaveBeenCalledTimes(1);
   });
});

describe("<DynamicInstancedModel>", () => {
   it("a model not in the manifest draws the asset's primitive, without fetching", () => {
      const html = markup(createElement(DynamicInstancedModel, { asset: MISSING, count: 12, update: () => {} }));
      expect(meshTags(html)).toBe(1);
      expect(useGLTF).not.toHaveBeenCalled();
      expect(frames).toHaveLength(1);
      expect(frames[0].priority).toBe(FRAME_PRIORITY.visuals);
   });

   /** Three stand-in parts, so their meshes are told apart from a GLB's two. */
   const standIns = (): InstancePart[] => [
      { geometry: new BoxGeometry(), material: new MeshBasicMaterial(), locals: [new Matrix4(), new Matrix4(), new Matrix4()] },
      { geometry: new BoxGeometry(), material: new MeshBasicMaterial() },
      { geometry: new BoxGeometry(), material: new MeshBasicMaterial() },
   ];

   it("draws the stand-in parts while the GLB is missing, moved by the same update", () => {
      const update = vi.fn();
      const html = markup(createElement(DynamicInstancedModel, { asset: MISSING, count: 4, update, fallbackParts: standIns() }));
      expect(meshTags(html)).toBe(3);
      expect(useGLTF).not.toHaveBeenCalled();
      // the stand-in is a moving pool too: one frame callback places every copy
      expect(frames).toHaveLength(1);
      frames[0].callback();
      expect(update).toHaveBeenCalledTimes(4);
   });

   it("a listed GLB: one InstancedMesh per GLB mesh for the whole pool, no stand-in", () => {
      prop.scene = carScene();
      const update = vi.fn();
      const html = markup(
         createElement(DynamicInstancedModel, {
            asset: asset(PROP, { scale: 2 }),
            count: 32,
            update,
            fallbackParts: standIns(),
         })
      );
      expect(useGLTF).toHaveBeenCalledWith(PROP, false, true);
      expect(meshTags(html)).toBe(2);
      frames[0].callback();
      expect(update).toHaveBeenCalledTimes(32);
   });

   it("a listed GLB that fails to load, or a rigged one, falls back", () => {
      const update = vi.fn();
      expect(meshTags(markup(createElement(DynamicInstancedModel, { asset: asset(BROKEN), count: 2, update, fallbackParts: standIns() })))).toBe(3);
      frames[frames.length - 1].callback();
      expect(update).toHaveBeenCalledTimes(2);
      const rigged = new Group();
      rigged.add(new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial()));
      prop.rigged = rigged;
      const html = markup(createElement(DynamicInstancedModel, { asset: asset(RIGGED, { rigged: true }), count: 2, update: () => {} }));
      // the asset's primitive: one mesh, not one per skinned mesh
      expect(meshTags(html)).toBe(1);
   });
});
