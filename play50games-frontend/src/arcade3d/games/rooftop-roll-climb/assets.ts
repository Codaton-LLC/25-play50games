// Rooftop Roll Climb's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts, each its own GLB). This game's own Hyper3D props live in public/models/3d/rooftop-roll-climb.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
// The scene fits each model to the rules' rectangles from these numbers, so a model never decides gameplay.
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

/** Raw GLB bounds (x, y, z). rooftopBlock.top is the walkable deck, under the parapet. */
export const GLB_SIZE = {
   rooftopBlock: { x: 1.8950767517089844, y: 0.6731983423233032, z: 1.8989813327789307, top: 0.3702080249786377 },
   exhaustFan: { x: 1.912214756011963, y: 1.8337472677230835, z: 1.7966982126235962 },
   solarRack: { x: 1.904117465019226, y: 1.3686985969543457, z: 1.6240888833999634 },
   skylineTower: { x: 0.9052000641822815, y: 1.897120714187622, z: 0.8364416360855103 },
   // the slanted tin roof (m2SlopedRoofI): a block whose top falls along +z from 1.42 (the ridge, z -0.95)
   // to 0.45 (the gutter lip, z +0.95), close to a straight line; Course.tsx turns +z to the slope's dir
   slopedRoof: { x: 1.5693976879119873, y: 1.4175523519515991, z: 1.8991036415100098 },
   // Ashback, the Shadow Armadillo (menu2/m2ShadowArmadillo, Rooftop Roll Climb's level 5 boss): feet on 0, long along z
   ashback: { x: 1.2982308864593506, y: 1.534679651260376, z: 1.8945307731628418 },
} as const;

/** The sloped-roof GLB's top: its ridge and gutter heights, and the z of each (raw GLB units). */
export const SLOPED_ROOF_TOP = { ridge: 1.41, lip: 0.45, ridgeZ: -0.9, lipZ: 0.9 } as const;

/** Ashback is drawn this tall (m): a head over the hero (1.45 m), a rolling armoured threat. */
export const ASHBACK_HEIGHT = 2.1;
export const ASHBACK_SCALE = ASHBACK_HEIGHT / GLB_SIZE.ashback.y;

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
   slopedRoof: prop("m2SlopedRoofI", "#9f3a2c"),
   ashback: { id: "m2ShadowArmadillo", url: "/models/3d/menu2/m2ShadowArmadillo.glb", fallback: "box", fallbackColor: "#475569", budget: CHARACTER_BUDGET },
   coin: { ...SHARED_ASSETS.coin, scale: ORB_SCALE, stretch: [1, 1, 0.8], yOffset: (-ORB_SCALE * COIN_GLB_SIZE.height) / 2 },
};
