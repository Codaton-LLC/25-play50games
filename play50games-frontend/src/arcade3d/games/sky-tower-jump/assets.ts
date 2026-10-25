// Sky Tower Jump's models: the Menu 2 Hyper3D GLBs (public/models/3d/menu2, shared by the Color Roll
// Heroes games) and this game's own sky platform. Every GLB is one mesh with one material,
// feet on y = 0, centred on x and z (tools/hyper3d optimize). GLB_SIZE holds the raw bounds and the
// top surfaces measured on the meshes (assets.test.ts checks them against the real files); the Scene
// fits each model to the rules' rectangles from these numbers, so a model never decides gameplay.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, COIN_GLB_SIZE, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

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
   // The Menu 2 hero slot (CLAUDE.md decision 5: the armadillo hero). No GLB yet: the url is not in the
   // model manifest, so nothing is fetched and Hero.tsx draws the code stand-in (Armadillo.tsx). When the
   // Hyper3D hero exists, its url joins the manifest (scale it to ARMADILLO.height, 1.45 m).
   hero: menu2("m2ArmadilloHero", { fallback: "capsule", fallbackColor: "#ef4444", budget: CHARACTER_BUDGET }),
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
