// Neon Cube Jump's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts). This
// game's props live in public/models/3d/neon-cube-jump (Hyper3D, ~/.play50/hyper3d/ready/menu2): the
// neon cube (every A / B / rogue / neutral cube, tinted per set), the energy pad (on the neutral
// cubes), the laser wall, the digital coin, the sentry drone, the neon city background and Flipframe's
// core. Shared from menu2: the checkpoint beacon and the orb. The hologram look is a code wireframe, not
// a model. Every GLB is one mesh, feet on y = 0, centred on x and z; GLB_SIZE is the real bounds
// (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   cube: { x: 1.773, y: 1.908, z: 1.783 },
   pad: { x: 1.893, y: 0.176, z: 1.89 },
   laser: { x: 1.843, y: 1.891, z: 0.258 },
   coin: { x: 1.905, y: 1.559, z: 0.64 },
   drone: { x: 1.895, y: 0.639, z: 1.428 },
   city: { x: 1.503, y: 1.898, z: 1.418 },
   core: { x: 1.9, y: 1.831, z: 0.703 },
   beacon: { x: 1.168, y: 1.902, z: 0.989 },
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A cube is drawn exactly 2 m on every axis (the rules' cube). */
export const CUBE_STRETCH: [number, number, number] = [2 / GLB_SIZE.cube.x, 2 / GLB_SIZE.cube.y, 2 / GLB_SIZE.cube.z];
/** The pad covers 1.6 m of a neutral cube's top; the laser wall spans the cube (2 m wide, 1.9 m tall). */
export const PAD_SCALE = 1.6 / GLB_SIZE.pad.x;
export const LASER_STRETCH: [number, number, number] = [2 / GLB_SIZE.laser.x, 1.9 / GLB_SIZE.laser.y, 1];
/** A coin is 0.55 m tall; a drone 1.3 m wide; the core 2.4 m wide; a beacon 1.5 m tall; an orb 0.5 m. */
export const COIN_SCALE = 0.55 / GLB_SIZE.coin.y;
export const DRONE_SCALE = 1.3 / GLB_SIZE.drone.x;
export const CORE_SCALE = 2.4 / GLB_SIZE.core.x;
export const BEACON_SCALE = 1.5 / GLB_SIZE.beacon.y;
export const ORB_SIZE = 0.5;

const prop = (id: string, color: string, dir = "neon-cube-jump", budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/${dir}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   cube: prop("m2NeonCube", "#3b2a63"),
   pad: prop("m2EnergyPad", "#22d3ee"),
   laser: prop("m2LaserWall", "#475569"),
   coin: { ...prop("m2DigitalCoin", "#facc15"), fallback: "sphere" },
   drone: prop("m2NeonSentryDrone", "#1e293b"),
   city: prop("m2NeonCityBg", "#312e81"),
   core: prop("m2FlipframeCore", "#4c1d95", "neon-cube-jump", CHARACTER_BUDGET),
   beacon: prop("checkpointBeacon", "#4ade80", "menu2"),
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#4ade80", budget: PROP_BUDGET },
};
