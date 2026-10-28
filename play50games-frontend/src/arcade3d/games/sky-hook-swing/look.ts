"use client";

// Sky Hook Swing's sky. Levels 1-3 are a clear day. Levels 4 and 5 pull toward dusk so the long
// gaps and the galleon read as later in the flight. Fog bands are stable (no per-frame colour).
export const COLORS = {
   skyTop: "#7ec8ff",
   skyMid: "#d7ecff",
   skyBottom: "#fff6ea",
   fog: "#d5e8f8",
   background: "#b9d7f5",
   sun: "#fff7e8",
   island: "#f8fafc",
   islandShade: "#94a3b8",
   rope: "#f8fafc",
   peak: "#4ade80",
   orb: "#fbbf24",
   magnet: "#38bdf8",
   pad: "#fde68a",
   turret: "#1e293b",
   bell: "#fbbf24",
   water: "#7dd3fc",
} as const;

export const DUSK = {
   background: "#c4b5fd",
   fog: "#d8c4ea",
   levels: { 4: { near: 34, far: 140 }, 5: { near: 28, far: 120 } },
} as const;

export function isDuskLevel(id: number): id is 4 | 5 {
   return id === 4 || id === 5;
}

export function levelEnvironment(id: number): { background: string; fog: [string, number, number]; lighting: "day" } | null {
   if (!isDuskLevel(id)) return null;
   const band = DUSK.levels[id];
   return { background: DUSK.background, fog: [DUSK.fog, band.near, band.far], lighting: "day" };
}
