// useModel / useModelFailed / <Model> rendered with react-dom/server (node, no WebGL): proves that
// a url missing from the model manifest is never fetched and goes straight to its fallback.
import { createElement, useMemo, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, Vector3, type Object3D } from "three";
import type { ModelAsset } from "./types";
import { InstancedModel, Model, clearModelCache, modelParts, useModel, useModelFailed } from "./assets";
import { spotMatrix } from "./render";

const { useGLTF, LISTED, BROKEN, PROP, prop } = vi.hoisted(() => {
   const prop: { scene: unknown } = { scene: null };
   const load = vi.fn((url: string) => {
      if (url.endsWith("broken.glb")) throw new Error("404");
      if (url.endsWith("prop.glb")) return { scene: prop.scene, animations: [] };
      return { scene: { clone: () => ({ isClone: true, url }) }, animations: [] };
   });
   return {
      useGLTF: Object.assign(load, { clear: vi.fn() }),
      LISTED: "/models/3d/test/listed.glb",
      BROKEN: "/models/3d/test/broken.glb",
      PROP: "/models/3d/test/prop.glb",
      prop,
   };
});
vi.mock("@react-three/drei", () => ({ useGLTF }));
vi.mock("./modelManifest", () => ({
   MODEL_MANIFEST: [LISTED, BROKEN, PROP],
   hasModel: (url: string) => url === LISTED || url === BROKEN || url === PROP,
}));

const asset = (url: string): ModelAsset => ({ id: "x", url, fallback: "box", budget: { tris: 1, bytes: 1 } });
const MISSING = asset("/models/3d/shared/robot.glb");
const SPOTS = [
   { x: 0, y: 0, z: 0 },
   { x: 3, y: 0, z: -2, rotY: 1, scale: 0.8 },
   { x: -4, y: 0, z: 1 },
];

/** A two-mesh GLB scene: a body at the root and a lid 1 unit up, under a root with its own transform. */
function propScene(): Object3D {
   const root = new Group();
   root.position.set(9, 9, 9); // <Model> replaces this with the asset transform
   const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
   const lidGroup = new Group();
   lidGroup.position.set(0, 1, 0);
   const lid = new Mesh(new BoxGeometry(1, 0.1, 1), new MeshBasicMaterial());
   lid.position.set(0.5, 0, 0);
   lidGroup.add(lid);
   root.add(body, lidGroup);
   return root;
}

/** Runs a hook once inside a server render and returns its value. */
function run<T>(hook: () => T): T {
   let value: T | undefined;
   function Probe() {
      value = hook();
      return null;
   }
   renderToString(createElement(Probe));
   return value as T;
}

/** Server-renders <Model> and returns the markup (three.js tags come out as plain tags). */
function markup(node: ReactNode): string {
   const error = vi.spyOn(console, "error").mockImplementation(() => {});
   try {
      return renderToString(node);
   } finally {
      error.mockRestore();
   }
}

afterEach(() => {
   useGLTF.mockClear();
   useGLTF.clear.mockClear();
});

describe("models not in the manifest", () => {
   it("useModel fails at once without fetching", () => {
      const handle = run(() => useModel(MISSING));
      expect(handle).toEqual({ scene: null, animations: [], failed: true });
      expect(useGLTF).not.toHaveBeenCalled();
   });

   it("useModelFailed is true without fetching", () => {
      expect(run(() => useModelFailed(MISSING))).toBe(true);
      expect(useGLTF).not.toHaveBeenCalled();
   });

   it("<Model> renders the custom fallback element, else the primitive", () => {
      expect(markup(createElement(Model, { asset: MISSING, fallback: createElement("span", null, "stand-in") }))).toContain("stand-in");
      // a stand-in with its own hooks: they run in its own component, not inside <Model>
      function WithHooks() {
         const label = useMemo(() => "drawn", []);
         return createElement("span", null, label);
      }
      expect(markup(createElement(Model, { asset: MISSING, fallback: createElement(WithHooks) }))).toContain("drawn");
      expect(markup(createElement(Model, { asset: MISSING })).toLowerCase()).toContain("<boxgeometry");
      expect(useGLTF).not.toHaveBeenCalled();
   });

   it("<InstancedModel> draws its fallback without fetching", () => {
      const html = markup(createElement(InstancedModel, { asset: MISSING, spots: SPOTS, fallback: createElement("span", null, "instanced stand-in") }));
      expect(html).toContain("instanced stand-in");
      expect(html.toLowerCase()).not.toContain("<instancedmesh");
      expect(useGLTF).not.toHaveBeenCalled();
   });

   it("is never cleared from the loader cache (it was never loaded)", () => {
      clearModelCache([MISSING.url, LISTED]);
      expect(useGLTF.clear).toHaveBeenCalledTimes(1);
      expect(useGLTF.clear).toHaveBeenCalledWith(LISTED);
   });
});

describe("models in the manifest", () => {
   it("useModel loads the GLB (meshopt, no Draco) and clones it", () => {
      const handle = run(() => useModel(asset(LISTED)));
      expect(useGLTF).toHaveBeenCalledWith(LISTED, false, true);
      expect(handle.failed).toBe(false);
      expect(handle.scene).toMatchObject({ isClone: true, url: LISTED });
   });

   it("useModelFailed checks without cloning", () => {
      expect(run(() => useModelFailed(asset(LISTED)))).toBe(false);
      expect(useGLTF).toHaveBeenCalledTimes(1);
   });

   it("a listed GLB that fails to load falls back", () => {
      expect(run(() => useModel(asset(BROKEN))).failed).toBe(true);
      expect(run(() => useModelFailed(asset(BROKEN)))).toBe(true);
      expect(markup(createElement(Model, { asset: asset(BROKEN), fallback: createElement("span", null, "stand-in") }))).toContain("stand-in");
   });
});

describe("instanced props", () => {
   it("modelParts places every mesh like <Model> does (asset scale, rotationY, yOffset; not the root's own transform)", () => {
      const parts = modelParts(propScene(), { scale: 2, rotationY: Math.PI / 2, yOffset: 0.5 });
      expect(parts).toHaveLength(2);
      const origin = (m: Matrix4) => new Vector3().applyMatrix4(m);
      // body at the root: only the asset transform
      const body = origin(parts[0].matrix);
      expect(body.x).toBeCloseTo(0, 9);
      expect(body.y).toBeCloseTo(0.5, 9);
      expect(body.z).toBeCloseTo(0, 9);
      // lid at (0.5, 1, 0) in the model: scaled x2, turned a quarter (x -> -z), lifted 0.5
      const lid = origin(parts[1].matrix);
      expect(lid.x).toBeCloseTo(0, 9);
      expect(lid.y).toBeCloseTo(2.5, 9);
      expect(lid.z).toBeCloseTo(-1, 9);
   });

   it("spotMatrix: translate, turn around +y, scale", () => {
      const p = new Vector3(1, 1, 0).applyMatrix4(spotMatrix({ x: 3, y: 0, z: -2, rotY: Math.PI / 2, scale: 2 }));
      expect(p.x).toBeCloseTo(3, 9);
      expect(p.y).toBeCloseTo(2, 9);
      expect(p.z).toBeCloseTo(-4, 9);
   });

   it("<InstancedModel> instances every GLB mesh once for all spots (draw calls do not grow with the spots)", () => {
      prop.scene = propScene();
      const html = markup(createElement(InstancedModel, { asset: asset(PROP), spots: SPOTS, fallback: createElement("span", null, "stand-in") })).toLowerCase();
      expect(useGLTF).toHaveBeenCalledWith(PROP, false, true);
      expect(html.match(/<instancedmesh/g)).toHaveLength(2);
      expect(html).not.toContain("stand-in");
   });

   it("a listed GLB that fails to load falls back", () => {
      const html = markup(createElement(InstancedModel, { asset: asset(BROKEN), spots: SPOTS, fallback: createElement("span", null, "stand-in") }));
      expect(html).toContain("stand-in");
   });
});
