// Temple Coin Rush's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/temple-coin-rush, copied from ready/menu2/temple-coin-rush
// (the gate, the coin, the offering bowl, the boulder, the stone block, the spike tile, the broken tile,
// the fire-jet pillar, the step pyramid) and ready/menu2/shared (m2CoilstoneHead, m2CoilstoneSegment:
// World 3's shared boss, also used by 34 and 36). The low beam, the ledge, the brazier and the temple
// tower are World 3's own set, already shipped with temple-lantern-jump (its manifest lines; no copy).
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { LANE_W } from "./temples";

/** Raw GLB bounds (x, y, z), measured on the meshopt-decoded meshes. */
export const GLB_SIZE = {
   // a carved stone arch with a gold-trimmed opening, front towards +z
   gate: { x: 1.771, y: 1.903, z: 1.5787 },
   // a gold coin lying flat
   coin: { x: 1.8849, y: 0.2399, z: 1.8955 },
   // a stone offering basin on a short pedestal
   bowl: { x: 1.881, y: 1.1125, z: 1.8985 },
   // a carved boulder (squat: drawn round with a stretch)
   boulder: { x: 1.8449, y: 1.1384, z: 1.9076 },
   // a mossy stone block
   block: { x: 1.8485, y: 1.0406, z: 1.5548 },
   // a floor tile with spikes
   spike: { x: 1.9014, y: 0.3321, z: 1.9069 },
   // a cracked floor tile
   broken: { x: 1.8546, y: 0.4447, z: 1.8935 },
   // a stone pillar with fire nozzles
   jet: { x: 0.9901, y: 1.897, z: 0.9956 },
   // a step pyramid (background)
   pyramid: { x: 1.6184, y: 1.505, z: 1.897 },
   // Coilstone's head, front towards +z, and one body ring
   head: { x: 1.3716, y: 1.5493, z: 1.909 },
   segment: { x: 1.9165, y: 1.7947, z: 1.6191 },
   // World 3's set (temple-lantern-jump): a carved lintel beam, a stone ledge, a brazier, a temple tower
   beam: { x: 1.902, y: 0.533, z: 0.4048 },
   ledge: { x: 1.8996, y: 0.4025, z: 1.7984 },
   brazier: { x: 1.8963, y: 1.0489, z: 1.8807 },
   tower: { x: 1.3455, y: 1.8114, z: 1.8929 },
} as const;

/** A toll gate arch spans its lane (m), and stands this tall. */
export const GATE_W = LANE_W - 0.1;
export const GATE_SCALE = GATE_W / GLB_SIZE.gate.x;
export const GATE_H = GLB_SIZE.gate.y * GATE_SCALE;
/** A coin is drawn 0.62 m across; a block 0.85 m tall (BLOCK_CLEAR) across its lane; the boulder 2.7 m round (it fills the lower view behind the hero). */
export const COIN_D = 0.62;
export const BLOCK_H = 0.85;
export const BOULDER_D = 2.7;
/** Coilstone: its head about 3.1 m tall (it rears behind the hero), each body ring 2.6 m across (the card: colossal). */
export const HEAD_SCALE = 3.1 / GLB_SIZE.head.y;
export const SEGMENT_SCALE = 2.6 / GLB_SIZE.segment.x;

const prop = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET, folder = "temple-coin-rush"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   gate: prop("m2TempleGate", "#c4ad88"),
   coin: { ...prop("m2TempleCoin", "#f5c542"), fallback: "cylinder" },
   bowl: prop("m2OfferingBowl", "#b8a17e"),
   boulder: { ...prop("m2RollingBoulder", "#8a7f6c"), fallback: "sphere" },
   block: prop("m2StoneObstacle", "#9c8f78"),
   spike: prop("m2SpikeTrapTile", "#7a7466"),
   broken: prop("m2BrokenTile", "#a08c6c"),
   jet: prop("m2FireJetPillar", "#8a7f6c"),
   pyramid: prop("m2StepPyramidBg", "#8f8a7c"),
   // Coilstone is two 15k-triangle character-class models: the character budget
   head: { ...prop("m2CoilstoneHead", "#4f9a7c", CHARACTER_BUDGET), fallback: "capsule" },
   segment: { ...prop("m2CoilstoneSegment", "#4f9a7c", CHARACTER_BUDGET), fallback: "sphere" },
   beam: prop("m2TempleBeam", "#8a7254", PROP_BUDGET, "temple-lantern-jump"),
   ledge: prop("m2TempleLedge", "#a89070", PROP_BUDGET, "temple-lantern-jump"),
   brazier: prop("m2StoneBrazier", "#8a7f6c", PROP_BUDGET, "temple-lantern-jump"),
   tower: prop("m2TempleTowerBg", "#8f8a7c", PROP_BUDGET, "temple-lantern-jump"),
};
