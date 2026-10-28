import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";
// Bounds measured from the ready GLBs' POSITION accessors (GLB units). Every GLB's root node lifts its
// mesh so the base sits on y = 0 (feet-on-zero): a spot's y is the prop's foot.
export const BOUNDS = {
   tower: { x: 0.950322, y: 1.885132, z: 0.953134 },
   trolley: { x: 1.893, y: 1.551, z: 0.53 },
   deck: { x: 1.586225, y: 1.735962, z: 1.878926 },
   mat: { x: 1.898485, y: 0.205613, z: 1.863664 },
   canopy: { x: 1.776573, y: 1.318768, z: 1.842319 },
   boss: { x: 0.505881, y: 1.687229, z: 1.901102 },
   rock: { x: 1.91, y: 0.925, z: 1.761 },
   cliff: { x: 1.898, y: 1.283, z: 1.751 },
   buoy: { x: 1.457, y: 1.845, z: 1.89 },
   lighthouse: { x: 1.8203, y: 1.8968, z: 1.8734 },
   gull: { x: 1.895, y: 1.393, z: 1.403 },
   bell: { x: 1.888, y: 1.429, z: 1.824 },
   orb: { x: 1.901, y: 1.905, z: 0.439 },
};
const prop = (id: string, scale: number, color: string, tris: number, bytes: number): ModelAsset => ({
   id, url: `/models/3d/zipline-rush/${id}.glb`, scale, fallback: "capsule", fallbackColor: color, budget: { tris, bytes },
});
/** Metres as drawn. */
export const SIZE = {
   tower: 7.2,
   trolleyWidth: 0.78,
   pine: 7,
   rock: 1,
   cliff: 1,
   buoy: 2.4,
   lighthouse: 16,
   gull: 1.3,
   bell: 1.1,
   orb: 0.62,
   eel: 9,
} as const;
/** The trolley: the cable runs through its pulley grooves this far over its foot (m, as drawn). */
export const TROLLEY_CABLE_Y = 0.47;
/** The T-grip's height over the trolley's foot (m). */
export const TROLLEY_GRIP_Y = 0.05;
export const ASSETS = {
   hero: heroModelAsset("nami"),
   gull: prop("m2SeaGullDiver", SIZE.gull / BOUNDS.gull.x, "#f8fafc", 15000, 555356),
   bell: { ...prop("serviceBellV2", SIZE.bell / BOUNDS.bell.x, "#fde68a", 5000, 600000), url: "/models/3d/hotel-bellboy-rush/serviceBellV2.glb" },
   orb: prop("m2AquaOrb", SIZE.orb / BOUNDS.orb.y, "#67e8f9", 3000, 142484),
   rock: prop("m2SeaRock", 1, "#6c8a9b", 3000, 167624),
   cliff: prop("m2SeaCliffBg", 1, "#a3876a", 3000, 198824),
   buoy: prop("m2MarkerBuoy", SIZE.buoy / BOUNDS.buoy.y, "#ef4444", 3000, 89736),
   lighthouse: { ...prop("lighthouseV2", SIZE.lighthouse / BOUNDS.lighthouse.y, "#f1f5f9", 3000, 142084), url: "/models/3d/pirate-cannons/lighthouseV2.glb", stretch: [0.62, 1, 0.62] as const },
   tower: prop("m2ZiplineTower", SIZE.tower / BOUNDS.tower.y, "#c08a4e", 3000, 166652),
   trolley: prop("m2ZiplineTrolleyI", SIZE.trolleyWidth / BOUNDS.trolley.x, "#f97316", 5000, 203184),
   deck: { ...prop("m2TreetopDeck", 4.6 / BOUNDS.deck.x, "#c4a373", 3000, 162624), stretch: [1, 0.42, 0.68] as const },
   mat: prop("m2LandingMat", 4.6 / BOUNDS.mat.x, "#4ade80", 3000, 51616),
   canopy: prop("m2ForestCanopyBg", 1, "#4d7c70", 4248, 261888),
   boss: prop("m2VoltEelBoss", SIZE.eel / BOUNDS.boss.z, "#22d3ee", 15000, 622572),
};
