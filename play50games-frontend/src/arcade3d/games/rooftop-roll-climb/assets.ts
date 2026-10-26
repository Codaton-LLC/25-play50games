// Rooftop Roll Climb's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts, each its own GLB). This game's own Hyper3D props live in public/models/3d/rooftop-roll-climb.
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

/** Raw GLB bounds (x, y, z). rooftopBlock.top is the walkable deck, under the parapet. */
export const GLB_SIZE = {
   rooftopBlock: { x: 1.8950767517089844, y: 0.6731983423233032, z: 1.8989813327789307, top: 0.3702080249786377 },
   exhaustFan: { x: 1.912214756011963, y: 1.8337472677230835, z: 1.7966982126235962 },
   solarRack: { x: 1.904117465019226, y: 1.3686985969543457, z: 1.6240888833999634 },
   skylineTower: { x: 0.9052000641822815, y: 1.897120714187622, z: 0.8364416360855103 },
} as const;

/**
 * A coin is the shared Hyper3D gold star, 0.62 m across, its centre on the rules' pickup point.
 */
export const ORB_SIZE = 0.62;
export const ORB_SCALE = ORB_SIZE / COIN_GLB_SIZE.width;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/rooftop-roll-climb/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   rooftopBlock: prop("m2RooftopBlock", "#64748b"),
   exhaustFan: prop("m2RoofExhaustFan", "#334155"),
   solarRack: prop("m2RoofSolarRack", "#1e3a5f"),
   skylineTower: prop("m2SkylineTower", "#1e293b"),
   coin: { ...SHARED_ASSETS.coin, scale: ORB_SCALE, stretch: [1, 1, 0.8], yOffset: (-ORB_SCALE * COIN_GLB_SIZE.height) / 2 },
};
