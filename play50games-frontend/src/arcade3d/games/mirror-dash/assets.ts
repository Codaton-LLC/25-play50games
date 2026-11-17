import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";

// Bounds measured from the ready GLBs' POSITION accessors (GLB units). Each GLB's root node lifts its
// mesh so the base sits on y = 0: a spot's y is the prop's foot.
export const BOUNDS = {
   runway: { x: 1.002, y: 0.135, z: 1.9 },
   stand: { x: 0.906, y: 1.898, z: 0.532 },
   hazard: { x: 1.845, y: 1.825, z: 1.904 },
   hall: { x: 1.528, y: 1.889, z: 1.424 },
   gate: { x: 1.385, y: 1.899, z: 0.222 },
   sentinel: { x: 1.649, y: 1.903, z: 0.77 },
   laser: { x: 1.843, y: 1.891, z: 0.258 },
   spike: { x: 1.77, y: 1.887, z: 1.707 },
   crystal: { x: 1.712, y: 1.902, z: 1.805 },
};

const prop = (id: string, scale: number, color: string, tris: number, bytes: number, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id,
   url: `/models/3d/mirror-dash/${id}.glb`,
   scale,
   fallback: "box",
   fallbackColor: color,
   budget: { tris, bytes },
   ...extra,
});

/** Metres as drawn (a lane is 1.4 m wide, a runway tile 2 m long). */
export const SIZE = {
   tileW: 1.4,
   tileL: 2,
   stand: 2.6,
   block: 1.15,
   spike: 0.62,
   laser: 1.25,
   gate: 3.4,
   hall: 14,
   sentinel: 11,
   orb: 0.5,
} as const;

export const ASSETS = {
   hero: heroModelAsset("vexa"),
   runway: prop("m2RunwayPlatform", 1, "#3b2a5c", 3000, 77628, { stretch: [SIZE.tileW / BOUNDS.runway.x, 1, SIZE.tileL / BOUNDS.runway.z] }),
   stand: prop("m2MirrorStand", SIZE.stand / BOUNDS.stand.y, "#c4b5fd", 3000, 135900),
   block: prop("m2HazardBlock", SIZE.block / BOUNDS.hazard.y, "#7c3aed", 3000, 72868),
   cracked: prop("m2HazardBlock", SIZE.block / BOUNDS.hazard.y, "#f97316", 3000, 72868, { id: "m2HazardBlockCracked", material: { color: "#fdba74", roughness: 0.6, metalness: 0.1, emissive: "#9a3412" } }),
   spike: prop("m2NeonSpikeBlock", 1, "#e879f9", 3000, 115560, { stretch: [1.2 / BOUNDS.spike.x, SIZE.spike / BOUNDS.spike.y, 0.9 / BOUNDS.spike.z] }),
   laser: prop("m2LaserWall", 1, "#f43f5e", 3000, 109636, { stretch: [1.3 / BOUNDS.laser.x, SIZE.laser / BOUNDS.laser.y, 1] }),
   gate: prop("m2MirrorGate", SIZE.gate / BOUNDS.gate.y, "#a78bfa", 1500, 70648),
   hall: prop("m2MirrorHallBg", SIZE.hall / BOUNDS.hall.y, "#312e81", 3000, 118012),
   crystal: prop("m2Crystal", SIZE.orb / BOUNDS.crystal.y, "#e879f9", 1500, 76060),
   sentinel: prop("m2GlassSentinelBoss", SIZE.sentinel / BOUNDS.sentinel.y, "#a5b4fc", 15000, 793528),
};
