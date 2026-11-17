// Alien Lane Escape's models. The five heroes are the shared Menu 2 GLBs (menu2/heroModels.ts). This
// game's props live in public/models/3d/alien-lane-escape: the ready set from
// ~/.play50/hyper3d/ready/menu2/alien-lane-escape (incl. the card's NICE m2ScannerDrone) plus the shared
// m2AlienMothership (the boss) and m2AlienBlob (level 5's drops) from ready/menu2/shared; the orb and the
// checkpoint beacon are the shared Menu 2 ones. Every GLB is one mesh, feet on y = 0, centred on x and z.
// GLB_SIZE is the real bounds (misc.test.ts). No new Hyper3D generation (no credits spent).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   blob: { x: 1.8599, y: 1.8962, z: 1.2453 },
   crystal: { x: 1.5571, y: 1.9072, z: 1.4064 },
   goo: { x: 1.8941, y: 0.6511, z: 1.8839 },
   slab: { x: 1.893, y: 0.3085, z: 1.1557 },
   mothership: { x: 1.898, y: 1.5097, z: 1.8672 },
   plant: { x: 1.3104, y: 1.8638, z: 0.9171 },
   pod: { x: 1.7403, y: 1.8857, z: 1.743 },
   spires: { x: 1.8914, y: 1.9331, z: 1.8007 },
   saucer: { x: 1.8696, y: 0.4172, z: 1.9049 },
   meteor: { x: 1.8993, y: 1.7312, z: 1.6963 },
   drone: { x: 1.9013, y: 1.2877, z: 1.399 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
   orb: { x: 1.7668, y: 1.9012, z: 1.7699 },
} as const;

/** The Mothership spans 11 m; a cover fills most of a lane; an orb 0.55 m. */
export const MOTHERSHIP_W = 11;
export const COVER_W = 2.0;
export const ORB_SIZE = 0.55;

const BIG = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, folder = "alien-lane-escape"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   blob: { ...prop("m2AlienBlob", "#a3e635"), budget: BIG },
   crystal: prop("m2AlienCrystal", "#c084fc"),
   goo: prop("m2AlienGooPuddle", "#84cc16"),
   slab: prop("m2AlienLaneSlab", "#6d28d9"),
   mothership: { ...prop("m2AlienMothership", "#7c3aed"), budget: BIG },
   plant: prop("m2AlienPlant", "#22d3ee"),
   pod: prop("m2AlienPod", "#a78bfa"),
   spires: prop("m2AlienSpiresBg", "#4c1d95"),
   saucer: prop("m2FlyingSaucer", "#94a3b8"),
   meteor: prop("m2MeteorRock", "#78716c"),
   drone: { ...prop("m2ScannerDrone", "#c4b5fd"), budget: BIG },
   beacon: prop("checkpointBeacon", "#fbbf24", "menu2"),
   orb: prop("scoreOrb", "#f59e0b", "menu2"),
};
