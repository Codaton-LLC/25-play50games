import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";

// Bounds measured from the ready GLBs' POSITION accessors (GLB units). Each GLB's root node lifts its
// mesh so the base sits on y = 0: a spot's y is the prop's foot.
export const BOUNDS = {
   horseshoe: { x: 1.888, y: 1.353, z: 1.887 },
   drone: { x: 1.892, y: 1.542, z: 1.67 },
   machine: { x: 1.169, y: 1.903, z: 1.052 },
   kiosk: { x: 1.071, y: 1.839, z: 1.897 },
   platform: { x: 1.902, y: 0.872, z: 1.733 },
   pad: { x: 1.79, y: 0.17, z: 1.904 },
   block: { x: 1.907, y: 1.864, z: 1.905 },
   gate: { x: 1.903, y: 1.396, z: 0.899 },
   piggy: { x: 1.65, y: 1.774, z: 1.899 },
};

const prop = (id: string, scale: number, color: string, tris: number, bytes: number, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id,
   url: `/models/3d/magnet-coin-lab/${id}.glb`,
   scale,
   fallback: "box",
   fallbackColor: color,
   budget: { tris, bytes },
   ...extra,
});

/** Metres as drawn (a cell is 1 m). */
export const SIZE = {
   pad: 1.15,
   node: 1.0,
   block: 1.0,
   drone: 1.15,
   piggy: 1.45,
   machine: 3.1,
   kiosk: 2.0,
   platform: 1.5,
   gate: 1.4,
   magnusBlock: 1.2,
   magnusHead: 2.0,
} as const;

export const ASSETS = {
   hero: heroModelAsset("zuno"),
   pad: prop("m2MagnetPad", SIZE.pad / BOUNDS.pad.z, "#f59e0b", 1500, 84480),
   node: prop("m2HorseshoeMagnet", SIZE.node / BOUNDS.horseshoe.x, "#dc2626", 3000, 62808),
   magnusHead: prop("m2HorseshoeMagnet", SIZE.magnusHead / BOUNDS.horseshoe.x, "#7f1d1d", 3000, 62808, { id: "m2HorseshoeMagnetBoss", material: { color: "#8b8f98", roughness: 0.45, metalness: 0.7 } }),
   block: prop("m2MetalBlockV2", SIZE.block / BOUNDS.block.x, "#8b6b4a", 1500, 73784),
   drone: prop("m2LabDrone", SIZE.drone / BOUNDS.drone.x, "#e5e7eb", 3000, 157360, { rotationY: Math.PI / 2 }),
   piggy: prop("m2ToyPiggyBank", SIZE.piggy / BOUNDS.piggy.y, "#f9a8d4", 1500, 53672, { rotationY: Math.PI / 2 }),
   machine: prop("m2LabMachineBg", SIZE.machine / BOUNDS.machine.y, "#d6d3d1", 3000, 126364),
   kiosk: prop("m2LabPlatform", SIZE.kiosk / BOUNDS.kiosk.y, "#e7e5e4", 3000, 70588, { rotationY: -Math.PI / 2 }),
   platform: prop("m2LabPlatformV2", SIZE.platform / BOUNDS.platform.x, "#5eead4", 3000, 85248),
   gate: prop("m2PolarityGate", SIZE.gate / BOUNDS.gate.y, "#d6a35c", 3000, 141732, { rotationY: Math.PI / 2 }),
   magnusBlock: prop("m2MetalBlockV2", SIZE.magnusBlock / BOUNDS.block.x, "#52525b", 1500, 73784, { id: "m2MetalBlockMagnus", material: { color: "#7a7f88", roughness: 0.55, metalness: 0.6 } }),
};
