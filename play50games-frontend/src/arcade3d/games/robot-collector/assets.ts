// Models used by Robot Collector. Plain data, no three.js: index.tsx hands them to GameShell
// (which frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Until a GLB is listed in core/modelManifest.ts it is never fetched and the game draws its own
// primitives (<Model fallback>, useModelFailed), so swapping in a model is the assets PR (file +
// manifest line) plus at most a scale tweak here, never a scene change.
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** hazardBeacon.glb raw bounds, measured on the mesh (assets.test.ts): feet on y = 0, centred on x / z. */
export const HAZARD_BEACON_GLB = { width: 1.0175, height: 1.89881, depth: 1.01215 } as const;
/**
 * Drawn 0.7 scale: 1.33 m tall, so it clearly pokes above the 0.9 m walls it stands on, with a 0.71 m
 * base. Each spot sits so the base's inner edge is on the wall's inner face (arena edge + 0.36): the
 * whole beacon is outside the 24 x 16 play area, the base overhanging the wall's outer side.
 */
export const HAZARD_BEACON_SCALE = 0.7;
/** Levels 4-5 decor ("Dark Storage", "Mega Warehouse"): one beacon per wall middle plus the four corners. */
export const HAZARD_BEACON_SPOTS = [
   { x: 0, z: -8.36, rotY: 0 },
   { x: 0, z: 8.36, rotY: 1.7 },
   { x: -12.36, z: 0, rotY: 0.9 },
   { x: 12.36, z: 0, rotY: 2.6 },
   { x: -12.36, z: -8.36, rotY: 0.4 },
   { x: 12.36, z: -8.36, rotY: 2.1 },
   { x: -12.36, z: 8.36, rotY: 1.3 },
   { x: 12.36, z: 8.36, rotY: 3.0 },
] as const;

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/*.glb).
   // The robot GLB is 1.72 tall (T-pose, feet on y = 0): 0.82 draws it 1.4 m, the height the
   // original 1.4 was written for (a GLB "about 1 unit tall") and about the stand-in's (its head
   // top is at 1.38 m). At 1.4 it stood 2.4 m tall over the 1.2 m crates.
   robot: { ...SHARED_ASSETS.robot, scale: 0.82 },
   battery: { ...SHARED_ASSETS.battery, scale: 0.7 },
   crate: { ...SHARED_ASSETS.crate, scale: 1.2 },
   // this game only (./assets.spec.json -> public/models/3d/robot-collector/barrel.glb)
   barrel: {
      id: "barrel",
      url: "/models/3d/robot-collector/barrel.glb",
      fallback: "cylinder",
      fallbackColor: "#2563eb",
      budget: { ...PROP_BUDGET },
   },
   // levels 4-5 decor: hazardBeacon.glb (Hyper3D, copied in by Claude). A warning beacon with a
   // wide base; drawn 0.7 scale (assets.test.ts measures the raw bounds it is fitted from).
   hazardBeacon: {
      id: "hazardBeacon",
      url: "/models/3d/robot-collector/hazardBeacon.glb",
      scale: HAZARD_BEACON_SCALE,
      fallback: "cylinder",
      fallbackColor: "#f59e0b",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
