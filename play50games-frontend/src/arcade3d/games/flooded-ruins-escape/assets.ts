// Flooded Ruins Escape's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts, each its own GLB). This game's own Hyper3D props live in public/models/3d/flooded-ruins-escape.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
// The scene fits each model to the rules' rectangles from these numbers, so a model never decides gameplay.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { HERO_GLB, HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { COIN_GLB_SIZE, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

// The five hero models, scales and joints live in menu2/heroModels.ts (shared by every Menu 2 game).
// RIKO_* are kept as the default hero's names (tests); Hero.tsx reads the picked hero from there.
export const RIKO_GLB_HEIGHT = HERO_GLB.riko.height;
export const RIKO_SCALE = HERO_SCALE.riko;
export const RIKO_LANDMARKS: HumanoidLandmarks = HERO_LANDMARKS.riko;
export const RIKO_SOLE_Z = HERO_SOLE_Z.riko;

/** Raw GLB bounds (x, y, z). platform.top is the walkable deck, under the raised lip. */
export const GLB_SIZE = {
   platform: { x: 1.5533100366592407, y: 0.5869178175926208, z: 1.894503116607666, top: 0.3385263681411743 },
   brickLedge: { x: 1.8836073875427246, y: 0.6977473497390747, z: 1.1200847625732422 },
   channel: { x: 1.895902395248413, y: 0.42309802770614624, z: 1.576421856880188 },
   lever: { x: 1.729189157485962, y: 1.3045274019241333, z: 1.9008623361587524 },
   floodGate: { x: 1.8740476369857788, y: 1.9022464752197266, z: 0.40018993616104126 },
   spout: { x: 1.8949108123779297, y: 1.591225504875183, z: 1.462268352508545 },
   temple: { x: 1.8819454908370972, y: 1.8824912309646606, z: 1.4473990201950073 },
} as const;

/**
 * A coin is the shared Hyper3D gold star, 0.62 m across, its centre on the rules' pickup point.
 */
export const ORB_SIZE = 0.62;
export const ORB_SCALE = ORB_SIZE / COIN_GLB_SIZE.width;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/flooded-ruins-escape/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   platform: prop("m2RuinPlatform", "#a89078"),
   brickLedge: prop("m2RuinBrickLedge", "#8d735c"),
   channel: prop("m2RuinChannel", "#7d8f86"),
   lever: prop("m2StoneLever", "#6b5a48"),
   floodGate: prop("m2RuinFloodGate", "#5c6b62"),
   spout: prop("m2RuinWaterSpout", "#3d8b9a"),
   temple: prop("m2SunkenTempleBg", "#6e6256"),
   coin: { ...SHARED_ASSETS.coin, scale: ORB_SCALE, stretch: [1, 1, 0.8], yOffset: (-ORB_SCALE * COIN_GLB_SIZE.height) / 2 },
};
