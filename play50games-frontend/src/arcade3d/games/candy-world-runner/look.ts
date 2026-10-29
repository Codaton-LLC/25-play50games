// Candy World Runner's look: one palette (strawberry pink, mint, lemon, chocolate, a frosting blue for
// level 3), the sky per level, the light. Pure.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#fde7f3",
   skyTop: "#f9a8d4",
   skyMid: "#fbcfe8",
   skyBottom: "#fff7ed",
   road: "#fbcfe8",
   roadEdge: "#f472b6",
   laneLine: "#fff7ed",
   ice: "#bae6fd",
   bridge: "#7c2d12",
   field: "#c084fc",
   rail: "#f43f5e",
   frosting: "#e0f2fe",
   ghost: "#c4b5fd",
   gingerbread: "#b45309",
   big: "#f59e0b",
   small: "#38bdf8",
   miss: "#ef4444",
} as const;

export interface CandyLight {
   fog: { color: string; near: number; far: number };
   hemi: number;
   ambient: number;
   key: number;
}

/** The light per level: sunny candy day; level 3 frosty; level 5 the palace's golden dusk. */
export function candyLight(level: LevelId): CandyLight {
   if (level === 3) return { fog: { color: "#dbeafe", near: 40, far: 160 }, hemi: 0.85, ambient: 0.4, key: 1.1 };
   if (level === 5) return { fog: { color: "#fcd34d", near: 40, far: 150 }, hemi: 0.7, ambient: 0.35, key: 1.0 };
   return { fog: { color: "#fbcfe8", near: 45, far: 170 }, hemi: 0.85, ambient: 0.42, key: 1.15 };
}

export function levelEnvironment(level: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "snow" } {
   const l = candyLight(level);
   return { background: COLORS.background, fog: [l.fog.color, l.fog.near, l.fog.far], lighting: level === 5 ? "sunset" : level === 3 ? "snow" : "day" };
}

/** The sky's three colours per level. */
export function skyColors(level: LevelId): [string, string, string] {
   if (level === 3) return ["#93c5fd", "#dbeafe", "#f0f9ff"];
   if (level === 5) return ["#f472b6", "#fcd34d", "#fff7ed"];
   return [COLORS.skyTop, COLORS.skyMid, COLORS.skyBottom];
}
