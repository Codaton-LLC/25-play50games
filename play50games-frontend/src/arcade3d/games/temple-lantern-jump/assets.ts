// Temple Lantern Jump's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts, each its own GLB). This game's own Hyper3D props live in public/models/3d/temple-lantern-jump.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
// The scene fits each model to the rules' rectangles from these numbers, so a model never decides gameplay.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { HERO_GLB, HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { COIN_GLB_SIZE, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

// The five hero models, scales and joints live in menu2/heroModels.ts (shared by every Menu 2 game).
// RIKO_* are kept as the default hero's names (tests, the gait); Hero.tsx reads the picked hero from there.
export const RIKO_GLB_HEIGHT = HERO_GLB.riko.height;
export const RIKO_SCALE = HERO_SCALE.riko;
export const RIKO_LANDMARKS: HumanoidLandmarks = HERO_LANDMARKS.riko;
export const RIKO_SOLE_Z = HERO_SOLE_Z.riko;

/** Raw GLB bounds (x, y, z), measured 2026-10-26 (assets.test.ts checks them on the real files). `top` is the walkable deck. */
export const GLB_SIZE = {
   ledge: { x: 1.9, y: 0.402, z: 1.798, top: 0.268 },
   lantern: { x: 1.008, y: 1.909, z: 0.984 },
   brazier: { x: 1.896, y: 1.049, z: 1.88 },
   beam: { x: 1.902, y: 0.533, z: 0.404 },
   roofSection: { x: 1.9, y: 0.792, z: 1.654 },
   towerBg: { x: 1.346, y: 1.811, z: 1.892 },
   balcony: { x: 1.912, y: 1.584, z: 1.482 },
   balconyV2: { x: 1.806, y: 1.496, z: 1.9 },
   lanternDeck: { x: 0.936, y: 1.897, z: 0.898 },
} as const;

/**
 * A coin is the shared Hyper3D gold star, 0.62 m across, its centre on the rules' pickup point.
 */
export const ORB_SIZE = 0.62;
export const ORB_SCALE = ORB_SIZE / COIN_GLB_SIZE.width;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/temple-lantern-jump/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   ledge: prop("m2TempleLedge", "#7c5a3a"),
   lantern: prop("m2TempleLantern", "#f59e0b"),
   brazier: prop("m2StoneBrazier", "#57534e"),
   beam: prop("m2TempleBeam", "#5b3a29"),
   roofSection: prop("m2RuinRoofSection", "#b45309"),
   towerBg: prop("m2TempleTowerBg", "#44403c"),
   balcony: prop("m2WoodenBalcony", "#7c5a3a"),
   balconyV2: prop("m2WoodenBalconyV2", "#7c5a3a"),
   lanternDeck: prop("m2LanternDeck", "#f59e0b"),
   coin: { ...SHARED_ASSETS.coin, scale: ORB_SCALE, stretch: [1, 1, 0.8], yOffset: (-ORB_SCALE * COIN_GLB_SIZE.height) / 2 },
};
