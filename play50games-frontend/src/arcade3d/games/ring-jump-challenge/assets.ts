// Ring Jump Challenge's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/ring-jump-challenge (the card's ready set, m2SeaRock from
// plate-surf and the root spikedBall); m2WindRing is cloud-hopper's file (the card reuses it for the
// boss wake rings) and checkpointBeacon the shared menu2 one. Every GLB is one mesh, feet on y = 0,
// centred on x and z. GLB_SIZE is the real bounds (assets.test.ts measures each mesh).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z), GLB units. */
export const GLB_SIZE = {
   // a flat ring lying on the plane: the opening is RING_INNER across the tube's inner edge
   ring: { x: 1.897854, y: 0.51586, z: 1.899818 },
   // a slim column with a round flat top (the start column, the target pad, the Tide Bell column)
   column: { x: 1.515358, y: 1.883388, z: 1.505831 },
   star: { x: 1.901014, y: 1.850367, z: 0.605222 },
   speed: { x: 1.657185, y: 0.36568, z: 1.898264 },
   spring: { x: 1.891061, y: 0.366084, z: 1.894508 },
   monument: { x: 1.895273, y: 1.39745, z: 1.865789 },
   rock: { x: 1.910413, y: 0.925352, z: 1.760928 },
   spiked: { x: 1.898849, y: 1.916195, z: 1.872651 },
   // an upright hoop (its axis along z): laid flat for the wake rings
   windRing: { x: 1.885271, y: 1.902017, z: 0.859381 },
   beacon: { x: 1.167775, y: 1.902301, z: 0.989259 },
   // Cyclone Ray (m2CycloneRayBoss, image-to-3D): wings along x, tail towards -z
   boss: { x: 1.902118, y: 1.394537, z: 1.768999 },
} as const;

/** m2NeutralRing's opening radius (GLB units, measured: the tube's inner edge; README "Models"). */
export const RING_INNER = 0.6;
/** m2WindRing's opening radius (GLB units). */
export const WIND_INNER = 0.5;
/** the column's round top platform radius (GLB units, measured: y 1.70-1.88; the shaft is 0.31, the base 1.04) */
export const COLUMN_TOP_R = 0.42;
/** rings are drawn this flat (the tube's height over its width, against the GLB's own) */
export const RING_FLAT = 0.45;

/** An orb (the colour orb, m2NeutralStar) is drawn this tall (m), its centre on the rules' pickup point. */
export const ORB_SIZE = 0.95;

/** Cyclone Ray is drawn this wide (m) across the wings. */
export const BOSS_WIDTH = 13;
export const BOSS_SCALE = BOSS_WIDTH / GLB_SIZE.boss.x;
/** The boss model is a character-sized GLB (15k tris, 0.64 MB): the character budget, not a prop's. */
export const BOSS_BUDGET = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, url = `/models/3d/ring-jump-challenge/${id}.glb`): ModelAsset => ({
   id,
   url,
   fallback: "sphere",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("nami"),
   ring: { ...prop("m2NeutralRing", "#e2f3ff"), fallback: "cylinder" },
   column: { ...prop("m2ColumnPlatform", "#cbb89a"), fallback: "cylinder" },
   star: prop("m2NeutralStar", "#fde68a"),
   speed: { ...prop("m2SpeedBoost", "#fb923c"), fallback: "box" },
   spring: { ...prop("m2SpringPad", "#94a3b8"), fallback: "cylinder" },
   monument: { ...prop("m2StoneRingBg", "#a8a29e"), fallback: "box" },
   rock: prop("m2SeaRock", "#78716c"),
   spiked: prop("spikedBall", "#64748b"),
   windRing: prop("m2WindRing", "#7dd3fc", "/models/3d/cloud-hopper/m2WindRing.glb"),
   beacon: { ...prop("checkpointBeacon", "#fbbf24", "/models/3d/menu2/checkpointBeacon.glb"), fallback: "cylinder" },
   boss: { ...prop("m2CycloneRayBoss", "#4338ca"), budget: BOSS_BUDGET },
};
