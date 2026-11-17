// Gem Collector 3D's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts). This
// game's own props are in public/models/3d/gem-collector-3d (from ready/menu2/gem-collector-3d, plus
// m2GummyMonster from ready/menu2/shared); the ice slime and the ice crystal are Ice Peak Jumper's and
// the mini-gummy is Plate Surf's slime blob (reused by url, already in the manifest). Every GLB is one
// mesh, feet on y = 0, centred on x and z. GLB_SIZE is the measured raw bounds; each fit below turns
// it into the rules' metres.
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { CHEST_R, PED_R, SLIME_R } from "./arena";
import { MINI_R } from "./rules";

export const GLB_SIZE = {
   gem: { x: 1.897, y: 1.904, z: 1.861 },
   beacon: { x: 1.219, y: 1.894, z: 1.19 },
   pedestal: { x: 1.589, y: 1.892, z: 1.613 },
   chest: { x: 1.892, y: 1.651, z: 1.453 },
   tile: { x: 1.903, y: 1.892, z: 0.379 },
   rim: { x: 1.902, y: 0.65, z: 0.735 },
   hill: { x: 1.903, y: 1.218, z: 1.805 },
   gummy: { x: 1.701, y: 1.903, z: 1.033 },
   slime: { x: 1.9, y: 1.524, z: 1.156 },
   mini: { x: 1.901, y: 1.674, z: 1.294 },
   crystal: { x: 1.344, y: 1.912, z: 1.21 },
} as const;

/** a gem on the floor or in the train: this tall (m) */
export const GEM_H = 0.55;
/** the beacon's height and the pedestal's (the rules' pedestal top is the spec's h) */
export const BEACON_H = 2.6;
export const RIM_H = 0.85;
/** one rim wall segment spans this much of the circle (m) */
export const RIM_SPAN = 2.4;
export const BOSS_H = 2.8;

const own = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/gem-collector-3d/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

const PED_S = (PED_R * 2) / GLB_SIZE.pedestal.x;
const RIM_S = RIM_SPAN / GLB_SIZE.rim.x;

/**
 * The pedestal's height is set per placement (the spec's h) through its stretch; the tiles lie flat
 * (the GLB stands on edge) and are scaled per cell; the rim segments follow the circle.
 */
export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("zuno"),
   gem: { ...own("m2FacetGemI", "#e0f2fe"), scale: GEM_H / GLB_SIZE.gem.y },
   beacon: { ...own("m2ScoreBeacon", "#f59e0b"), scale: BEACON_H / GLB_SIZE.beacon.y },
   pedestal: { ...own("m2GemPedestal", "#d4a017"), scale: PED_S },
   chest: { ...own("m2TreasureChest", "#a16207"), scale: (CHEST_R * 2) / GLB_SIZE.chest.x },
   tile: own("m2ArenaTileV2", "#d6cfc4"),
   rim: { ...own("m2ArenaRimWall", "#cbd5e1"), scale: RIM_S, stretch: [1, RIM_H / (GLB_SIZE.rim.y * RIM_S), 1] },
   hill: own("m2CrystalHillBg", "#7dd3fc"),
   gummy: { ...own("m2GummyMonster", "#ef4444", CHARACTER_BUDGET), scale: BOSS_H / GLB_SIZE.gummy.y },
   slime: { id: "m2IceSlime", url: "/models/3d/ice-peak-jumper/m2IceSlime.glb", fallback: "box", fallbackColor: "#7dd3fc", budget: CHARACTER_BUDGET, scale: (SLIME_R * 2.2) / GLB_SIZE.slime.x },
   mini: { id: "m2SlimeBlob", url: "/models/3d/plate-surf/m2SlimeBlob.glb", fallback: "box", fallbackColor: "#f472b6", budget: CHARACTER_BUDGET, scale: (MINI_R * 2.4) / GLB_SIZE.mini.x },
   crystal: { id: "m2IceCrystal", url: "/models/3d/ice-peak-jumper/m2IceCrystal.glb", fallback: "box", fallbackColor: "#bae6fd", budget: PROP_BUDGET },
};

/** The boss's body radius, as drawn (the rules' BOSS_R). */
export const BOSS_DRAWN_R = (GLB_SIZE.gummy.x * (BOSS_H / GLB_SIZE.gummy.y)) / 2;
