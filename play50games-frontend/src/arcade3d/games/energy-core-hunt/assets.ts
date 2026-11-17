// Energy Core Hunt's models. The five heroes are the shared Menu 2 GLBs (menu2/heroModels.ts). This
// game's props live in public/models/3d/energy-core-hunt: the ready set from
// ~/.play50/hyper3d/ready/menu2/energy-core-hunt (the card's energy core, arena crate and core gate, plus
// the core capsule, core pylon, tesla coil, the reactor columns and the Core Sprite, the level 5 boss);
// the orb and the beacon are the shared Menu 2 ones. Every GLB is one mesh, feet on y = 0, centred on x
// and z. GLB_SIZE is the real bounds (misc.test.ts). No new Hyper3D generation (no credits spent).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   crate: { x: 1.8878, y: 1.5344, z: 1.8544 },
   capsule: { x: 1.2614, y: 1.3149, z: 1.893 },
   gate: { x: 1.5554, y: 1.898, z: 1.3131 },
   pylon: { x: 0.6672, y: 1.8946, z: 0.6768 },
   sprite: { x: 1.4107, y: 1.8933, z: 1.3592 },
   core: { x: 1.7187, y: 1.8941, z: 1.729 },
   reactor: { x: 1.3938, y: 1.9003, z: 1.289 },
   tesla: { x: 0.8016, y: 1.8967, z: 0.7965 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
   orb: { x: 1.7668, y: 1.9012, z: 1.7699 },
} as const;

/** A core stands 0.8 m tall; the Core Sprite 2.6 m; an orb 0.55 m. */
export const CORE_SIZE = 0.8;
export const SPRITE_H = 2.6;
export const ORB_SIZE = 0.55;

const BIG = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, folder = "energy-core-hunt"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   crate: prop("m2ArenaCrate", "#64748b"),
   capsule: prop("m2CoreCapsule", "#94a3b8"),
   gate: prop("m2CoreGate", "#334155"),
   pylon: prop("m2CorePylon", "#475569"),
   sprite: { ...prop("m2CoreSprite", "#a855f7"), budget: BIG },
   core: prop("m2EnergyCore", "#e2e8f0"),
   reactor: prop("m2ReactorBg", "#1e293b"),
   tesla: prop("m2TeslaCoil", "#38bdf8"),
   beacon: prop("checkpointBeacon", "#fbbf24", "menu2"),
   orb: prop("scoreOrb", "#f59e0b", "menu2"),
};
