// Fits for the shared GLBs. The bust in assets.spec.json is not loaded.
import type { MaterialOverride, MaterialPreset } from "@/arcade3d/core/materials";
import { MATERIAL_PRESETS } from "@/arcade3d/core/materials";
import {
   EXPANSION_ASSETS,
   EXPANSION_CHARACTERS,
   EXPANSION_CHARACTER_GLB_HEIGHT,
   REUSED_ASSETS,
   REUSED_GLB_SIZE,
   SHARED_ASSETS,
} from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { COLORS } from "./looks";
import type { ExhibitKind, ExhibitMode } from "./rules";

/** 1.6 m on the measured knight GLB (1.884). */
export const KNIGHT_SCALE = 1.6 / EXPANSION_CHARACTER_GLB_HEIGHT.knight;
/** Design literal 1.72. The mesh is 1.7152, so the drawn height is about 1.197. */
export const ROBOT_SCALE = 1.2 / 1.72;
export const DOOR_SCALE = 2.1 / REUSED_GLB_SIZE.door.height;
/** About 2 m wide. Height follows the GLB. */
export const BENCH_SCALE = 2 / REUSED_GLB_SIZE.bench.width;

const STILL: Record<ExhibitKind, MaterialPreset> = {
   knight: "stone",
   robot: "gold",
   penguin: "bronze",
   dino: "bone",
};

function glow(preset: MaterialPreset, emissive: string): MaterialOverride {
   const base = MATERIAL_PRESETS[preset];
   return { color: base.color, roughness: base.roughness, metalness: base.metalness, emissive };
}

export const EXHIBIT_LOOK: Record<ExhibitKind, Record<ExhibitMode, MaterialOverride>> = {
   knight: { still: "stone", returning: "stone", sneaking: glow("stone", COLORS.sneak), frozen: glow("stone", COLORS.frozen) },
   robot: { still: "gold", returning: "gold", sneaking: glow("gold", COLORS.sneak), frozen: glow("gold", COLORS.frozen) },
   penguin: { still: "bronze", returning: "bronze", sneaking: glow("bronze", COLORS.sneak), frozen: glow("bronze", COLORS.frozen) },
   dino: { still: "bone", returning: "bone", sneaking: glow("bone", COLORS.sneak), frozen: glow("bone", COLORS.frozen) },
};

export const ASSETS = {
   knight: { ...EXPANSION_CHARACTERS.knight, id: "museum-knight", material: STILL.knight, scale: KNIGHT_SCALE },
   robot: { ...SHARED_ASSETS.robot, id: "museum-robot", material: STILL.robot, scale: ROBOT_SCALE },
   penguin: { ...EXPANSION_ASSETS.penguin, id: "museum-penguin", material: STILL.penguin },
   dino: { ...EXPANSION_ASSETS.dino, id: "museum-dino", material: STILL.dino },
   door: { ...REUSED_ASSETS.door, id: "museum-door", scale: DOOR_SCALE },
   bench: { ...REUSED_ASSETS.bench, id: "museum-bench", scale: BENCH_SCALE },
} as const satisfies Record<string, ModelAsset>;

/** One asset per pedestal so each clone can take its own glow. Same url as the kind. */
export function statueAsset(kind: ExhibitKind, index: number): ModelAsset {
   const base = ASSETS[kind];
   return { ...base, id: `${base.id}-${index}` };
}
