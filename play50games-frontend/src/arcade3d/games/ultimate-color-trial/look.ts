// Ultimate Color Trial's look: World 6 Prism Fortress, Shadow Plates' stronghold, every colour at
// once. A dark prism corridor over the void, neon strips along the walls, the floor's light bands
// in the five colours, and a look per level: bright and readable for the first trials, cooler for
// the colour trial, high contrast for the mixed one, the finale cinematic with the Sentinel's
// magenta.
import type { LevelId } from "../../types";
import type { GameDefinition } from "@/arcade3d/core/types";

export const COLORS = {
   floor: "#1b1636",
   floorEdge: "#2e2a5a",
   wall: "#15112c",
   wallStrip: "#f472b6",
   pad: "#2a2152",
   padRim: "#60a5fa",
   gate: "#e2e8f0",
   gateShut: "#f472b6",
   gateOpen: "#4ade80",
   ring: "#fde68a",
   ringNext: "#ffffff",
   ringDone: "#4ade80",
   beam: "#f87171",
   emitter: "#fca5a5",
   orb: "#c084fc",
   core: "#67e8f9",
   receptor: "#a5f3fc",
   beacon: "#f0abfc",
   void: "#07041a",
   glow: "#f472b6",
   shard: "#a5f3fc",
   sticker: "#f9a8d4",
   gem: "#fde68a",
   wrong: "#f87171",
   checkpoint: "#60a5fa",
} as const;

export interface TrialLook {
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   lighting: "night" | "space";
   hemiSky: string;
   hemiGround: string;
   hemi: number;
   key: string;
   keyIntensity: number;
   /** how strongly the floor's colour bands and the wall strips glow */
   neon: number;
}

const BASE: TrialLook = {
   background: "#120b2e",
   fog: "#150d36",
   fogNear: 34,
   fogFar: 150,
   lighting: "night",
   hemiSky: "#c4b5fd",
   hemiGround: "#1a1238",
   hemi: 0.95,
   key: "#fdf2f8",
   keyIntensity: 0.7,
   neon: 0.8,
};

export const LOOKS: Record<LevelId, TrialLook> = {
   1: BASE,
   2: { ...BASE, background: "#0f0b2a", fog: "#120d32", neon: 0.9 },
   3: { ...BASE, background: "#0a1030", fog: "#0d1438", hemiSky: "#93c5fd", key: "#dbeafe", neon: 1 },
   4: { ...BASE, background: "#190a2a", fog: "#1c0c30", fogNear: 26, fogFar: 125, hemiSky: "#f0abfc", hemiGround: "#2a0f3a", key: "#fbcfe8", keyIntensity: 0.6, neon: 1.2 },
   5: { ...BASE, background: "#07041a", fog: "#0a0620", fogNear: 24, fogFar: 115, lighting: "space", hemiSky: "#a78bfa", hemiGround: "#0a0520", hemi: 0.85, key: "#fce7f3", keyIntensity: 0.9, neon: 1.4 },
};

export function levelEnvironment(id: LevelId): NonNullable<GameDefinition["environment"]> {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
