// useModel / useModelFailed / <Model> rendered with react-dom/server (node, no WebGL): proves that
// a url missing from the model manifest is never fetched and goes straight to its fallback.
import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelAsset } from "./types";
import { Model, clearModelCache, useModel, useModelFailed } from "./assets";

const { useGLTF, LISTED, BROKEN } = vi.hoisted(() => {
   const load = vi.fn((url: string) => {
      if (url.endsWith("broken.glb")) throw new Error("404");
      return { scene: { clone: () => ({ isClone: true, url }) }, animations: [] };
   });
   return {
      useGLTF: Object.assign(load, { clear: vi.fn() }),
      LISTED: "/models/3d/test/listed.glb",
      BROKEN: "/models/3d/test/broken.glb",
   };
});
vi.mock("@react-three/drei", () => ({ useGLTF }));
vi.mock("./modelManifest", () => ({
   MODEL_MANIFEST: [LISTED, BROKEN],
   hasModel: (url: string) => url === LISTED || url === BROKEN,
}));

const asset = (url: string): ModelAsset => ({ id: "x", url, fallback: "box", budget: { tris: 1, bytes: 1 } });
const MISSING = asset("/models/3d/shared/robot.glb");

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

   it("<Model> renders the custom fallback (element or render function), else the primitive", () => {
      expect(markup(createElement(Model, { asset: MISSING, fallback: createElement("span", null, "stand-in") }))).toContain("stand-in");
      const render = vi.fn(() => createElement("span", null, "drawn"));
      expect(markup(createElement(Model, { asset: MISSING, fallback: render }))).toContain("drawn");
      expect(render).toHaveBeenCalled();
      expect(markup(createElement(Model, { asset: MISSING })).toLowerCase()).toContain("<boxgeometry");
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
