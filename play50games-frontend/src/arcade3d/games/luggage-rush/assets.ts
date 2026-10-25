// Models for Airport Luggage Rush. Plain data: GameShell frees the GLBs, the scene draws them.
// Suitcase and plane are already imported (EXPANSION_ASSETS). The handler is the shared runner.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** Office-escape's runner height: 0.825 draws the 1.886 GLB at 1.556 m. */
export const HANDLER_SCALE = 0.825;

/** The shared plane fit is 8 m long. This bay draws it at 3.2 m so the hall fit stays on the belts. */
export const PLANE_LENGTH = 3.2;

/** duffelBag.glb (Group D, QA "OK"): long axis is x. rotationY puts that length along z. 0.85 m long. */
export const DUFFEL_GLB = { width: 1.9007, height: 1.2009, depth: 1.1009 } as const;
export const DUFFEL_LENGTH = 0.85;
const DUFFEL_SCALE = DUFFEL_LENGTH / DUFFEL_GLB.width;
export const DUFFEL_DRAWN = {
   depth: DUFFEL_GLB.depth * DUFFEL_SCALE,
   height: DUFFEL_GLB.height * DUFFEL_SCALE,
   length: DUFFEL_LENGTH,
} as const;

/** hardCaseTeal.glb (Group D, QA "OK"): stands upright. 0.72 m tall. */
export const CASE_GLB = { width: 1.2335, height: 1.9069, depth: 0.7456 } as const;
export const CASE_HEIGHT = 0.72;
const CASE_SCALE = CASE_HEIGHT / CASE_GLB.height;
export const CASE_DRAWN = {
   width: CASE_GLB.width * CASE_SCALE,
   height: CASE_HEIGHT,
   depth: CASE_GLB.depth * CASE_SCALE,
} as const;

/** West of the hall (x < 0.4) and on the north apron (z < -0.6). Feet on y = 0. */
export const DUFFEL_SPOTS = [
   { x: -2.8, y: 0, z: 1.5 },
   { x: -2.8, y: 0, z: 4.5 },
   { x: -2.8, y: 0, z: 7.5 },
   { x: -2.8, y: 0, z: 10.5 },
   { x: 1.5, y: 0, z: -6.2, rotY: 0.2 },
   { x: 7, y: 0, z: -6.2, rotY: -0.15 },
   { x: 12, y: 0, z: -6.2, rotY: 0.1 },
] as const;
/** Further west, and east of the parked carts (x > 8.2). */
export const CASE_SPOTS = [
   { x: -3.9, y: 0, z: 3, rotY: 0.4 },
   { x: -3.9, y: 0, z: 8, rotY: -0.3 },
   { x: -3.9, y: 0, z: 12.2, rotY: 0.2 },
   { x: 12.2, y: 0, z: 3.2, rotY: 1.2 },
   { x: 12.2, y: 0, z: 8, rotY: -1.1 },
   { x: 12.2, y: 0, z: 12.2, rotY: 0.6 },
] as const;
/** Fallback boxes are centred. The duffel's box is already turned so its length runs along z. */
export const DUFFEL_FALLBACK = DUFFEL_SPOTS.map((s) => ({ ...s, y: DUFFEL_DRAWN.height / 2 }));
export const CASE_FALLBACK = CASE_SPOTS.map((s) => ({ ...s, y: CASE_HEIGHT / 2 }));

export const ASSETS = {
   // A near-white shell. The flight tint multiplies this colour; the GLB's own dark albedo turned yellow brown and red maroon.
   suitcase: { ...EXPANSION_ASSETS.suitcase, material: { color: "#f8fafc", roughness: 0.4, metalness: 0.02 } },
   plane: { ...EXPANSION_ASSETS.plane, scale: PLANE_LENGTH / EXPANSION_GLB_SIZE.plane.depth },
   handler: { ...SHARED_ASSETS.runner, scale: HANDLER_SCALE, humanoid: { landmarks: RUNNER_LANDMARKS } },
   duffel: {
      id: "duffel",
      url: "/models/3d/luggage-rush/duffelBag.glb",
      scale: DUFFEL_SCALE,
      rotationY: Math.PI / 2,
      fallback: "box",
      fallbackColor: "#1e3a8a",
      budget: { ...PROP_BUDGET },
   },
   hardCase: {
      id: "hardCase",
      url: "/models/3d/luggage-rush/hardCaseTeal.glb",
      scale: CASE_SCALE,
      fallback: "box",
      fallbackColor: "#0f766e",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
