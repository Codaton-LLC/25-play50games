// Models for Aquarium Cleaner (public/models/3d/aquarium-cleaner/*.glb, all in the manifest).
// Every fit comes from the measured GLB bounds below (Rodin makes the longest side about 1.9);
// assets.test.ts checks the drawn size on the real meshes. Props stand on y = 0, centred on x / z.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { CASTLE_R, FILTER_R, ROCK_R } from "./rules";

/** Measured GLB bounds (width x height x depth, GLB units). */
export const GLB_SIZE = {
   diver: { x: 1.894, y: 1.893, z: 0.436 },
   scrubber: { x: 1.902, y: 0.297, z: 0.645 },
   bottle: { x: 0.783, y: 1.896, z: 0.778 },
   fish: { x: 0.533, y: 1.262, z: 1.897 },
   castle: { x: 1.894, y: 1.643, z: 1.73 },
   rock: { x: 1.892, y: 1.283, z: 1.778 },
   filter: { x: 1.887, y: 1.533, z: 1.281 },
   tank: { x: 0.875, y: 1.894, z: 1.68 },
   shark: { x: 1.085, y: 0.788, z: 1.9 },
   basket: { x: 1.814, y: 0.892, z: 1.897 },
   coral: { x: 1.913, y: 1.609, z: 1.754 },
} as const;

export const DIVER_HEIGHT = 1.78;
export const DIVER_SCALE = DIVER_HEIGHT / GLB_SIZE.diver.y;
export const SCRUBBER_LENGTH = 0.5;
export const BOTTLE_HEIGHT = 0.46;
export const FISH_LENGTH = 0.55;
export const CASTLE_WIDTH = CASTLE_R * 2;
export const CASTLE_STRETCH_Y = 0.8;
export const ROCK_WIDTH = ROCK_R * 2;
export const FILTER_WIDTH = FILTER_R * 2;
export const TANK_HEIGHT = 0.7;
export const SHARK_LENGTH = 2.8;
export const BASKET_WIDTH = 1.1;
export const CORAL_WIDTH = 0.9;

/**
 * The diver's joints (GLB units: 1.894 x 1.893 x 0.436 T-pose, faces +z; a helmet, wetsuit, wide
 * flippers). The estimate from the mesh (rig tests pin it), except hemY = crotchY: nothing bridges
 * the legs, the wide flippers read as a hem otherwise.
 */
export const DIVER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.293,
   shoulderX: 0.222,
   shoulderZ: -0.036,
   armRadius: 0.0656,
   clavicleX: 0.111,
   elbowX: 0.476,
   wristX: 0.73,
   armSpread: 0.1375,
   crotchY: 0.828,
   hipY: 0.906,
   hipX: 0.1526,
   hipZ: -0.0713,
   kneeY: 0.4529,
   ankleY: 0.1484,
   toeZ: 0.1746,
   heelZ: -0.174,
   legDepth: 0.085,
   legOuterX: 0.2869,
   hemY: 0.828,
   spineY: 1.0219,
   chestY: 1.138,
   neckY: 1.4158,
   headY: 1.4395,
   spineZ: -0.0246,
   shoulderBlend: 0.0393,
   elbowBlend: 0.0328,
   hipBlend: 0.0906,
   kneeBlend: 0.0679,
   ankleBlend: 0.0537,
   crotchBlend: 0.0752,
   spineBlend: 0.0348,
   neckBlend: 0.0118,
};

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   extra: Partial<ModelAsset> = {},
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({ id, url: `/models/3d/aquarium-cleaner/${id}.glb`, fallback, fallbackColor, budget, ...extra });

export const ASSETS = {
   diver: local("charDiver", "capsule", "#f59e0b", { scale: DIVER_SCALE, humanoid: { landmarks: DIVER_LANDMARKS } }, CHARACTER_BUDGET),
   scrubber: local("aquariumScrubber", "box", "#f59e0b", { scale: SCRUBBER_LENGTH / GLB_SIZE.scrubber.x }),
   bottle: local("plasticBottle", "cylinder", "#38bdf8", { scale: BOTTLE_HEIGHT / GLB_SIZE.bottle.y }),
   fish: local("tropicalFish", "capsule", "#fb923c", { scale: FISH_LENGTH / GLB_SIZE.fish.z }),
   castle: local("aquariumCastle", "box", "#a8a29e", {
      scale: CASTLE_WIDTH / GLB_SIZE.castle.x,
      stretch: [1, CASTLE_STRETCH_Y, 1],
   }),
   rock: local("aquariumRock", "box", "#78716c", { scale: ROCK_WIDTH / GLB_SIZE.rock.x, stretch: [1, 0.8, 1] }),
   filter: local("filterMachineV3", "box", "#94a3b8", { scale: FILTER_WIDTH / GLB_SIZE.filter.x }),
   tank: local("scubaTank", "cylinder", "#facc15", { scale: TANK_HEIGHT / GLB_SIZE.tank.y }),
   shark: local("shark", "capsule", "#64748b", { scale: SHARK_LENGTH / GLB_SIZE.shark.z }),
   basket: local("trashBasket", "box", "#22c55e", { scale: BASKET_WIDTH / GLB_SIZE.basket.x }),
   coral: local("coralI", "cylinder", "#f472b6", { scale: CORAL_WIDTH / GLB_SIZE.coral.x }),
} satisfies Record<string, ModelAsset>;
