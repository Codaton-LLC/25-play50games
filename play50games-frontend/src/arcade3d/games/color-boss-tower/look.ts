// Color Boss Tower's look: the Prism Spire, a hollow stone tower drained grey by the Shadow Plates.
// Its inner wall carries the spiral of ledges; the guardian stands in the open shaft at its heart.
// Each level its own light: dusk (L1), a storm (L2), embers through the cracks (L3), a neon night for
// the fast switches (L4), and the eclipse prism of the Grand Color Guardian (L5).
import type { LevelId } from "../../types";
import type { GameDefinition, LightingPreset } from "@/arcade3d/core/types";
import type { TagColour } from "@/arcade3d/menu2/heroTag/rules";

export const COLORS = {
   stone: "#6b6f80",
   stoneDark: "#3f4252",
   ledgeEdge: "#a5a9bb",
   shaft: "#151826",
   guide: "#f8fafc",
   orb: "#fde68a",
   shard: "#bae6fd",
   sticker: "#f9a8d4",
   arm: "#f97316",
   heart: "#e5e7eb",
} as const;

/** The claw, cannon and plate colours (the heroes' own). */
export const TAG_HEX: Record<TagColour, string> = {
   red: "#ef4444",
   blue: "#3b82f6",
   green: "#22c55e",
   yellow: "#facc15",
   purple: "#a855f7",
};

export interface TowerLook {
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   lighting: LightingPreset;
   wall: string;
   ledge: string;
   /** the shaft's glow from below (the guardian's light) */
   shaftGlow: string;
   /** cracks in the wall glowing (embers, neon) */
   crackGlow: string;
   crack: number;
   /** rain streaks in the open top (L2) */
   rain: boolean;
   /** the sky disc above the open top */
   sky: string;
}

export const LOOKS: Record<LevelId, TowerLook> = {
   1: { background: "#2d2448", fog: "#3a2f58", fogNear: 30, fogFar: 120, lighting: "sunset", wall: "#7a7184", ledge: "#9b93a6", shaftGlow: "#fb923c", crackGlow: "#fdba74", crack: 0.2, rain: false, sky: "#f59e0b" },
   2: { background: "#1c2433", fog: "#253044", fogNear: 24, fogFar: 100, lighting: "night", wall: "#5d6677", ledge: "#8791a3", shaftGlow: "#60a5fa", crackGlow: "#93c5fd", crack: 0.25, rain: true, sky: "#475569" },
   3: { background: "#22140f", fog: "#2e1a12", fogNear: 22, fogFar: 95, lighting: "night", wall: "#5b4a44", ledge: "#86726a", shaftGlow: "#f97316", crackGlow: "#fb923c", crack: 1, rain: false, sky: "#7c2d12" },
   4: { background: "#0d0b1f", fog: "#141033", fogNear: 22, fogFar: 95, lighting: "night", wall: "#3d3a5a", ledge: "#6a6690", shaftGlow: "#22d3ee", crackGlow: "#e879f9", crack: 0.8, rain: false, sky: "#1e1b4b" },
   5: { background: "#120a1e", fog: "#1b1030", fogNear: 26, fogFar: 120, lighting: "night", wall: "#4a4458", ledge: "#7a7390", shaftGlow: "#f0abfc", crackGlow: "#fef08a", crack: 0.6, rain: false, sky: "#f0abfc" },
};

export function levelEnvironment(id: LevelId): NonNullable<GameDefinition["environment"]> {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
