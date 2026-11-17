// Roll Dash's models (no new Hyper3D model: the World 6 card reuses ready ones). The five heroes are the
// shared Menu 2 armadillos (menu2/heroModels.ts); the active one is drawn. This game's own folder
// public/models/3d/roll-dash holds the ready/menu2/roll-dash set (gold coin, market stall, old-town
// house, street lamp) and its copies of m2ArenaCrate + m2TeslaCoil (energy-core-hunt),
// m2EnergyBarrierWall (switch-color-hero) and m2StormHawkBoss (shared, drawn as the grey "echo").
// Already in the repo and reused by url: m2CityBarrier (color-city-sprint), m2OreCart
// (mine-tunnel-run), skyFortressGate and m2ShadowArmadillo (menu2/). Every GLB is one mesh, feet on
// y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   crate: { x: 1.888, y: 1.534, z: 1.854 },
   tesla: { x: 0.802, y: 1.897, z: 0.797 },
   ghostWall: { x: 1.898, y: 1.217, z: 0.086 },
   coin: { x: 1.893, y: 1.901, z: 0.473 },
   stall: { x: 1.89, y: 1.64, z: 0.991 },
   house: { x: 1.227, y: 1.895, z: 1.03 },
   lamp: { x: 0.428, y: 1.9, z: 0.556 },
   hawk: { x: 1.895, y: 1.42, z: 1.217 },
   barrier: { x: 1.319, y: 0.876, z: 1.899 },
   cart: { x: 1.07, y: 1.018, z: 1.89 },
   gate: { x: 1.895, y: 1.346, z: 1.071 },
   roller: { x: 1.298, y: 1.535, z: 1.895 },
} as const;

/** Drawn sizes (m): a lock is about a lane wide; a coin 0.6 m; the Hawk 7 m across its wings. */
export const LOCK_W = 1.9;
export const COIN_SIZE = 0.6;
export const HAWK_SPAN = 7;

const own = (id: string, color: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({ id, url: `/models/3d/roll-dash/${id}.glb`, fallback: "box", fallbackColor: color, budget });
const at = (dir: string, id: string, color: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({ id, url: `/models/3d/${dir}/${id}.glb`, fallback: "box", fallbackColor: color, budget });

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   crate: own("m2ArenaCrate", "#a16207"),
   tesla: own("m2TeslaCoil", "#64748b"),
   ghostWall: own("m2EnergyBarrierWall", "#8b5cf6"),
   coin: { ...own("m2GoldCoin", "#facc15"), fallback: "sphere" },
   stall: own("m2MarketStall", "#b45309"),
   house: own("m2OldTownHouseBg", "#64748b"),
   lamp: own("m2StreetLamp", "#475569"),
   hawk: own("m2StormHawkBoss", "#94a3b8", CHARACTER_BUDGET),
   barrier: at("color-city-sprint", "m2CityBarrier", "#2563eb"),
   cart: at("mine-tunnel-run", "m2OreCart", "#475569"),
   gate: at("menu2", "skyFortressGate", "#64748b"),
   roller: at("menu2", "m2ShadowArmadillo", "#1f2937", CHARACTER_BUDGET),
};
