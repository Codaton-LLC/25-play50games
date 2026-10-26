// Lava Pillar Jump's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts):
// each hero is its own GLB. This game's props live in public/models/3d/lava-pillar-jump.
// GLB_SIZE is the real mesh (assets.test.ts). The scene fits each model to the rules' rectangles.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { HERO_GLB, HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

export const RIKO_GLB_HEIGHT = HERO_GLB.riko.height;
export const RIKO_SCALE = HERO_SCALE.riko;
export const RIKO_LANDMARKS: HumanoidLandmarks = HERO_LANDMARKS.riko;
export const RIKO_SOLE_Z = HERO_SOLE_Z.riko;

/** Raw GLB bounds (x, y, z). `top` is the walkable surface near the origin, when the mesh has one. */
export const GLB_SIZE = {
   pillar: { x: 1.6723161935806274, y: 1.8991806507110596, z: 1.5977451801300049, top: 1.8926893472671509 },
   collapse: { x: 1.8935598134994507, y: 0.6345640420913696, z: 1.9026687145233154, top: 0.5359768271446228 },
   rock: { x: 1.618241310119629, y: 1.6305009126663208, z: 1.9027676582336426 },
   ember: { x: 1.2934881448745728, y: 1.902660608291626, z: 1.3512263298034668 },
   bridge: { x: 1.9079456329345703, y: 0.7446972727775574, z: 0.7965330481529236, top: 0.727513313293457 },
   geyser: { x: 1.8529993295669556, y: 0.8406079411506653, z: 1.9031288623809814 },
   slug: { x: 0.9996693134307861, y: 0.8379854559898376, z: 1.8894567489624023 },
   volcano: { x: 1.9023818969726562, y: 0.892869770526886, z: 1.8926067352294922 },
} as const;

/** An ember is drawn this tall (m), its centre on the pickup point. */
export const EMBER_HEIGHT = 0.5;
export const EMBER_SCALE = EMBER_HEIGHT / GLB_SIZE.ember.y;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/lava-pillar-jump/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   pillar: prop("m2BasaltPillar", "#44403c"),
   collapse: prop("m2CollapsePlatform", "#7c2d12"),
   rock: prop("m2LavaRock", "#9a3412"),
   ember: { ...prop("m2Ember", "#f97316"), fallback: "sphere" },
   bridge: prop("m2BasaltBridge", "#57534e"),
   geyser: prop("m2LavaGeyserVent", "#ea580c"),
   slug: prop("m2MagmaSlug", "#c2410c"),
   volcano: prop("m2VolcanoBg", "#292524"),
};
