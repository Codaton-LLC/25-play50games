import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";

// Bounds measured from the optimized GLBs' POSITION accessors (GLB units). Each GLB's root node lifts its
// mesh so the base sits on y = 0: a spot's y is the prop's foot.
export const BOUNDS = {
   keeper: { x: 1.528, y: 1.843, z: 1.893 },
   switch: { x: 1.894, y: 1.399, z: 1.882 },
   anchor: { x: 1.324, y: 1.884, z: 1.324 },
   node: { x: 1.31, y: 1.894, z: 1.095 },
   slab: { x: 1.9, y: 0.333, z: 0.952 },
   broken: { x: 1.899, y: 0.646, z: 1.328 },
   pylon: { x: 0.658, y: 1.895, z: 0.645 },
   isle: { x: 1.846, y: 0.789, z: 1.897 },
   canyon: { x: 1.575, y: 0.913, z: 1.899 },
   prism: { x: 1.113, y: 1.892, z: 1.184 },
   drone: { x: 1.9, y: 1.82, z: 0.857 },
};

const prop = (id: string, scale: number, color: string, tris: number, bytes: number, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id,
   url: `/models/3d/color-bridge-builder/${id}.glb`,
   scale,
   fallback: "box",
   fallbackColor: color,
   budget: { tris, bytes },
   ...extra,
});

/** Metres as drawn (a cell is 2 m). */
export const SIZE = {
   keeper: 7,
   switch: 1.2,
   anchor: 1.5,
   node: 1.6,
   slab: 2,
   pylon: 2.2,
   prism: 1.5,
   drone: 1.3,
   isle: 9,
   canyon: 60,
} as const;

export const ASSETS = {
   hero: heroModelAsset("riko"),
   keeper: prop("m2BridgeKeeperBoss", SIZE.keeper / BOUNDS.keeper.y, "#94a3b8", 15000, 401824, { rotationY: Math.PI }),
   switch: prop("m2ColorSwitch", SIZE.switch / BOUNDS.switch.x, "#e2e8f0", 4000, 163932),
   anchor: prop("m2BridgeAnchor", SIZE.anchor / BOUNDS.anchor.y, "#cbd5e1", 4000, 109796),
   node: prop("m2EnergyNode", SIZE.node / BOUNDS.node.y, "#f8fafc", 3998, 90360),
   // a light bridge cell: the crystal slab, turned along the bridge, tinted to its colour per copy
   slab: prop("m2CrystalSlabBridge", 1, "#f8fafc", 3000, 87368, { material: { color: "#ffffff", roughness: 0.25, metalness: 0.1, emissive: "#3a3a3a" }, stretch: [SIZE.slab / BOUNDS.slab.x, 0.5, SIZE.slab / BOUNDS.slab.z] }),
   broken: prop("m2BrokenBridgeEnd", 2 / BOUNDS.broken.x, "#a8a29e", 3000, 161924),
   pylon: prop("m2BridgePylon", SIZE.pylon / BOUNDS.pylon.y, "#94a3b8", 3000, 129948),
   isle: prop("m2FloatingRockIsle", SIZE.isle / BOUNDS.isle.x, "#78716c", 3000, 140676),
   canyon: prop("m2CanyonBg", SIZE.canyon / BOUNDS.canyon.z, "#57534e", 3000, 142068),
   prism: prop("m2LaserPrism", SIZE.prism / BOUNDS.prism.y, "#e0f2fe", 3000, 89648),
   drone: prop("m2FactoryDrone", SIZE.drone / BOUNDS.drone.x, "#64748b", 18000, 520636),
};
