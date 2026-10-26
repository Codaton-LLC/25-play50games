// Sky Tower Jump's models: the Menu 2 Hyper3D GLBs (public/models/3d/menu2, shared by the Color Roll
// Heroes games) and this game's own sky platform. Every GLB is one mesh with one material,
// feet on y = 0, centred on x and z (tools/hyper3d optimize). GLB_SIZE holds the raw bounds and the
// top surfaces measured on the meshes (assets.test.ts checks them against the real files); the Scene
// fits each model to the rules' rectangles from these numbers, so a model never decides gameplay.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { HERO_GLB, HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, COIN_GLB_SIZE, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

// The five hero models, scales and joints live in menu2/heroModels.ts (shared by every Menu 2 game).
// RIKO_* are kept as the default hero's names (tests, the gait); Hero.tsx reads the picked hero from there.
export const RIKO_GLB_HEIGHT = HERO_GLB.riko.height;
export const RIKO_SCALE = HERO_SCALE.riko;
export const RIKO_LANDMARKS: HumanoidLandmarks = HERO_LANDMARKS.riko;
export const RIKO_SOLE_Z = HERO_SOLE_Z.riko;

/** Raw GLB bounds (x, y, z) and, for platforms, the height of the walkable top inside y. */
export const GLB_SIZE = {
   islandA: { x: 1.892, y: 0.51, z: 1.9, top: 0.46 },
   islandB: { x: 1.918, y: 1.439, z: 1.816 },
   islandC: { x: 1.498, y: 1.849, z: 1.666 },
   islandD: { x: 1.761, y: 1.571, z: 1.89 },
   skyPlatform: { x: 1.889, y: 0.59, z: 1.892, top: 0.58 },
   movingBlock: { x: 1.891, y: 1.208, z: 1.883, top: 1.06 },
   plankBridge: { x: 1.896, y: 0.548, z: 0.891, top: 0.2 },
   bouncePad: { x: 1.812, y: 0.5, z: 1.892, top: 0.43 },
   checkpointBeacon: { x: 1.168, y: 1.902, z: 0.989 },
   skyFortressGate: { x: 1.895, y: 1.346, z: 1.071 },
   stoneTower: { x: 1.648, y: 1.905, z: 1.589 },
   woodenLadder: { x: 0.896, y: 1.898, z: 1.234 },
} as const;

/**
 * An orb is drawn as the shared Hyper3D gold star coin (the concept board's coins), 0.75 m across,
 * its centre on the rules' orb point (the pickup radius is the rules' ORB, not this).
 */
export const ORB_SIZE = 0.75;
export const ORB_SCALE = ORB_SIZE / COIN_GLB_SIZE.width;

const menu2 = (id: string, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id,
   url: `/models/3d/menu2/${id}.glb`,
   fallback: "box",
   fallbackColor: "#94a3b8",
   budget: PROP_BUDGET,
   ...extra,
});

export const ASSETS: Record<string, ModelAsset> = {
   // The Color Roll Heroes hero: Riko by default, any of the five (menu2/heroModels.ts, each its own GLB, auto-rigged).
   hero: heroModelAsset("riko"),
   islandA: menu2("islandA", { fallbackColor: "#65a30d" }),
   islandB: menu2("islandB", { fallbackColor: "#65a30d" }),
   islandC: menu2("islandC", { fallbackColor: "#65a30d" }),
   islandD: menu2("islandD", { fallbackColor: "#65a30d" }),
   movingBlock: menu2("movingBlock", { fallbackColor: "#64748b" }),
   plankBridge: menu2("plankBridge", { fallbackColor: "#a16207" }),
   bouncePad: menu2("bouncePad", { fallbackColor: "#38bdf8" }),
   checkpointBeacon: menu2("checkpointBeacon", { fallbackColor: "#38bdf8" }),
   skyFortressGate: menu2("skyFortressGate", { fallbackColor: "#64748b" }),
   stoneTower: menu2("stoneTower", { fallbackColor: "#94a3b8" }),
   woodenLadder: menu2("woodenLadder", { fallbackColor: "#a16207" }),
   coin: { ...SHARED_ASSETS.coin, scale: ORB_SCALE, stretch: [1, 1, 0.8], yOffset: (-ORB_SCALE * COIN_GLB_SIZE.height) / 2 },
   skyPlatform: {
      id: "skyPlatform",
      url: "/models/3d/sky-tower-jump/skyPlatform.glb",
      fallback: "box",
      fallbackColor: "#65a30d",
      budget: PROP_BUDGET,
   },
};
