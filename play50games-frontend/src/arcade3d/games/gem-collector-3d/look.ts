// Gem Collector 3D's look: the Sugarfrost Workshop's Ornament Vault, drained of its gold by Shadow
// Plates. Pale stone and brass under a cool skylight, crystal hills beyond the rim, and the gems the
// one saturated thing on the floor; level 4 (Chest Rush) is the vault at night, lit by the gems, the
// chests and the beacon. One palette and a look per level.
import type { LevelId } from "../../types";
import type { GameDefinition } from "@/arcade3d/core/types";
import type { GemKind } from "./levels";

export const COLORS = {
   floor: "#d9d2c5",
   floorEdge: "#b8ad9c",
   floorNight: "#2d2a3a",
   rimGlow: "#fcd34d",
   beacon: "#f59e0b",
   link: "#fde68a",
   cut: "#f87171",
   lasso: "#a78bfa",
   frostBand: "#bae6fd",
   pit: "#1e1b2e",
   ghost: "#a78bfa",
   shard: "#bae6fd",
   sticker: "#f9a8d4",
   gold: "#facc15",
   wave: "#facc15",
} as const;

/** The gem tint per kind (on the neutral FacetGem). */
export const GEM_TINT: Record<GemKind, string> = { clear: "#f0f9ff", frost: "#7dd3fc", gold: "#fbbf24" };

export interface VaultLook {
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   lighting: "day" | "night" | "indoor";
   floor: string;
   /** the gems' glow (night: the light on the floor) */
   gemGlow: number;
}

const DAY: VaultLook = {
   background: "#cfe3f1",
   fog: "#d7e6f0",
   fogNear: 40,
   fogFar: 120,
   lighting: "day",
   floor: COLORS.floor,
   gemGlow: 0.25,
};

export const LOOKS: Record<LevelId, VaultLook> = {
   1: DAY,
   2: { ...DAY, background: "#d3e2ee" },
   3: { ...DAY, background: "#cde6ee", fog: "#d4ecef" },
   4: { background: "#0f1024", fog: "#14142c", fogNear: 25, fogFar: 85, lighting: "night", floor: COLORS.floorNight, gemGlow: 1.3 },
   5: { ...DAY, background: "#e6d9ef", fog: "#e9dcef", lighting: "indoor" },
};

export function levelEnvironment(id: LevelId): NonNullable<GameDefinition["environment"]> {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
