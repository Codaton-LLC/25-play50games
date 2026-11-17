// Switch Color Hero's models: the game's own set in public/models/3d/switch-color-hero (the gate arch, the
// energy barrier wall, the energy pickup, the checkpoint flag and pad, the switch platform, the sci-fi
// spires), the shared heroes, and Chroma: ice-peak-jumper's FrostGolemBoss recoloured at runtime. Every GLB
// has its feet on y = 0, centred on x and z. GLB_SIZE is the real mesh (assets.test.ts).
// Code stays for: the track (glowing lane strips), the gates' energy fields (recoloured every frame), the
// beams and sweepers (light bars), the gaps' edges, shapes on the gates and the sky.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), metres in the file. */
export const GLB_SIZE = {
   flag: { x: 0.599, y: 1.901, z: 0.352 },
   pad: { x: 1.898, y: 0.207, z: 1.896 },
   arch: { x: 1.646, y: 1.901, z: 0.871 },
   archThin: { x: 1.488, y: 1.899, z: 0.264 },
   barrier: { x: 1.898, y: 1.217, z: 0.086 },
   pickup: { x: 1.077, y: 1.895, z: 1.133 },
   spire: { x: 0.823, y: 1.894, z: 0.827 },
   platform: { x: 1.869, y: 0.438, z: 1.904 },
   chroma: { x: 1.575, y: 1.903, z: 0.731 },
} as const;

const prop = (id: string, color: string, url = `/models/3d/switch-color-hero/${id}.glb`): ModelAsset => ({
   id,
   url,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   flag: prop("m2CheckpointFlagPad", "#f8fafc"),
   pad: { ...prop("m2CheckpointFlagPadV2", "#38bdf8"), fallback: "cylinder" },
   arch: prop("m2ColorGateArch", "#334155"),
   archThin: prop("m2ColorGateArchV2", "#334155"),
   barrier: prop("m2EnergyBarrierWall", "#f472b6"),
   pickup: { ...prop("m2EnergyPickup", "#facc15"), fallback: "sphere" },
   spire: prop("m2SciFiSpireBg", "#64748b"),
   platform: prop("m2SwitchPlatform", "#475569"),
   chroma: { ...prop("m2FrostGolemBoss", "#a5f3fc", "/models/3d/ice-peak-jumper/m2FrostGolemBoss.glb"), budget: CHARACTER_BUDGET },
};

export function fit(size: number, metres: number): number {
   return metres / size;
}
