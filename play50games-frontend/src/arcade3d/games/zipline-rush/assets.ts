import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";
// Bounds measured from the ready GLBs' POSITION accessors. Meshes are centred, not feet-on-zero.
export const BOUNDS = {
   tower: { x: 0.950322, y: 1.885132, z: 0.953134, minY: -0.945689 },
   trolley: { x: 1.378662, y: 1.906747, z: 0.967576, minY: -0.954245 },
   deck: { x: 1.586225, y: 1.735962, z: 1.878926, minY: -0.857515 },
   mat: { x: 1.898485, y: 0.205613, z: 1.863664, minY: -0.097770 },
   canopy: { x: 1.776573, y: 1.318768, z: 1.842319, minY: -0.692168 },
   boss: { x: 0.505881, y: 1.687229, z: 1.901102, minY: -0.842234 },
};
const prop = (id: string, scale: number, color: string, tris: number, bytes: number): ModelAsset => ({
   id, url: `/models/3d/zipline-rush/${id}.glb`, scale, fallback: "capsule", fallbackColor: color, budget: { tris, bytes },
});
export const ASSETS = {
   hero: heroModelAsset("nami"),
   gull: prop("m2SeaGullDiver", 0.65, "#f8fafc", 15000, 555356),
   bell: { ...prop("serviceBellV2", 0.65, "#fde68a", 5000, 600000), url: "/models/3d/hotel-bellboy-rush/serviceBellV2.glb" },
   orb: prop("m2AquaOrb", 0.32, "#67e8f9", 3000, 142484),
   rock: prop("m2SeaRock", 9, "#6c8a9b", 3000, 167624),
   tower: prop("m2ZiplineTower", 6 / BOUNDS.tower.y, "#e2e8f0", 3000, 166652),
   trolley: prop("m2ZiplineTrolley", 0.8 / BOUNDS.trolley.y, "#94a3b8", 3000, 138244),
   deck: { ...prop("m2TreetopDeck", 6 / BOUNDS.deck.x, "#c4a373", 3000, 162624), stretch: [1, 0.15, 0.8] as const },
   mat: prop("m2LandingMat", 5 / BOUNDS.mat.x, "#4ade80", 3000, 51616),
   canopy: prop("m2ForestCanopyBg", 14 / BOUNDS.canopy.x, "#4d7c70", 4248, 261888),
   boss: prop("m2VoltEelBoss", 7 / BOUNDS.boss.z, "#22d3ee", 15000, 622572),
};
