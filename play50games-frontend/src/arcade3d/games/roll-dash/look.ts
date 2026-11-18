// Roll Dash's look: World 6 "Prism Fortress" (the card): Greytown's causeway in smoked grey (slate
// #64748B to graphite #1F2937) with the five hero colours the only saturated tones, so every lock reads
// at a glance; the street repaints in colour behind every correct unlock. Each colour also carries its
// glyph (chevron, wave, hexagon, horseshoe, spiral): never colour alone. Plain data.
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";

export const COLORS = {
   slate: "#64748b",
   graphite: "#1f2937",
   street: "#4b5563",
   kerb: "#94a3b8",
   line: "#e2e8f0",
   gold: "#facc15",
   echo: "#9ca3af",
   glass: "#cbd5e1",
} as const;

export const HERO_COLOURS: Record<HeroId, string> = { riko: "#EF4444", nami: "#2563EB", kiro: "#22C55E", zuno: "#FACC15", vexa: "#8B5CF6" };

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   skyTop: string;
   skyBottom: string;
   /** stalls along the kerbs (Market Lane, Old Town) */
   stalls: boolean;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#9aa6b8", fog: "#a8b2c2", fogNear: 40, fogFar: 150, skyTop: "#7b8aa3", skyBottom: "#d7dde6", stalls: false },
   2: { lighting: "day", background: "#a3a0a8", fog: "#b2adb3", fogNear: 40, fogFar: 150, skyTop: "#8b8798", skyBottom: "#e2dccf", stalls: true },
   3: { lighting: "sunset", background: "#8d8496", fog: "#a0909b", fogNear: 35, fogFar: 130, skyTop: "#5f5a78", skyBottom: "#e3b98f", stalls: true },
   4: { lighting: "night", background: "#151a2b", fog: "#1b2135", fogNear: 25, fogFar: 95, skyTop: "#0a0d1a", skyBottom: "#2b3352", stalls: false },
   5: { lighting: "sunset", background: "#4b5563", fog: "#5b6573", fogNear: 35, fogFar: 140, skyTop: "#2d3442", skyBottom: "#a7b0bf", stalls: false },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
