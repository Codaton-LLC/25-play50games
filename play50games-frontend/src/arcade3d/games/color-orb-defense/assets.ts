// Color Orb Defense's models (public/models/3d/color-orb-defense): from ready/menu2/color-orb-defense the
// arena pillar, the castle wall backdrop, the dome beacon (the core), the energy orb and the zone plate;
// the new Hyper3D set (optimised with tools/hyper3d's optimizeGLB) the orb launcher portal, the shield
// pedestal, the Orb Mortar boss, the orb blob (his core orbs) and the spawn pad. Every GLB has its feet on
// y = 0, centred on x and z. GLB_SIZE is the real mesh (assets.test.ts).
// Code stays for: the arena floor and rim, lane lines, the zones' colour rings and shields (recoloured
// every frame), the drone, the sky.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), metres in the file. */
export const GLB_SIZE = {
   pillar: { x: 0.879, y: 1.894, z: 0.833 },
   wall: { x: 1.898, y: 0.938, z: 0.389 },
   beacon: { x: 0.669, y: 1.898, z: 0.678 },
   orb: { x: 1.874, y: 1.892, z: 1.874 },
   blob: { x: 1.813, y: 1.898, z: 1.869 },
   portal: { x: 1.478, y: 1.897, z: 1.372 },
   mortar: { x: 1.358, y: 1.897, z: 1.271 },
   pedestal: { x: 1.361, y: 1.902, z: 1.366 },
   spawnPad: { x: 1.877, y: 0.177, z: 1.897 },
   zone: { x: 1.896, y: 0.117, z: 1.903 },
} as const;

const prop = (id: string, color: string, url = `/models/3d/color-orb-defense/${id}.glb`): ModelAsset => ({
   id,
   url,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   pillar: { ...prop("m2ArenaPillar", "#cbd5e1"), fallback: "cylinder" },
   wall: prop("m2CastleWallBg", "#94a3b8"),
   beacon: { ...prop("m2DomeBeacon", "#38bdf8"), fallback: "cylinder" },
   orb: { ...prop("m2EnergyOrb", "#f8fafc"), fallback: "sphere" },
   blob: { ...prop("m2OrbBlob", "#fde047"), fallback: "sphere" },
   portal: prop("m2OrbLauncherPortal", "#6366f1"),
   mortar: { ...prop("m2OrbMortarBoss", "#7c3aed"), budget: CHARACTER_BUDGET },
   pedestal: { ...prop("m2ShieldPedestal", "#e2e8f0"), fallback: "cylinder" },
   spawnPad: { ...prop("m2SpawnPad", "#38bdf8"), fallback: "cylinder" },
   zone: { ...prop("m2ZonePlate", "#e2e8f0"), fallback: "cylinder" },
};

export function fit(size: number, metres: number): number {
   return metres / size;
}
