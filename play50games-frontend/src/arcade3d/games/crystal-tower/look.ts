// Crystal Tower's look: World 5 Neon Cosmos, a dark crystal spire over the void of space, its
// colour drained by Shadow Plates and brought back one tier at a time. Deep indigo sky and fog,
// neon crystals, the pads glowing faintly at their rims. One palette and a look per level: the
// first two tiers bright and readable, the glass tower cooler, Moving Crystals a magenta dusk,
// Memory Tower the darkest, with Prism Shade's violet above the summit.
import type { LevelId } from "../../types";
import type { GameDefinition } from "@/arcade3d/core/types";

export const COLORS = {
   core: "#2e1065",
   coreEdge: "#6d28d9",
   pad: "#3b2a6b",
   padRim: "#a855f7",
   padGlass: "#60a5fa",
   padCrumble: "#7c2d12",
   beacon: "#c084fc",
   beaconOff: "#4c1d95",
   void: "#0b0520",
   glow: "#e879f9",
   shard: "#a5f3fc",
   sticker: "#f9a8d4",
   storm: "#93c5fd",
   drone: "#f472b6",
   wave: "#e879f9",
   wall: "#1e1b4b",
   gate: "#7c3aed",
   gem: "#fde68a",
   wrong: "#f87171",
} as const;

export interface TowerLook {
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   lighting: "night" | "space";
   hemiSky: string;
   hemiGround: string;
   hemi: number;
   /** the key light's colour and strength */
   key: string;
   keyIntensity: number;
   /** how strongly the pads' rims glow */
   rimGlow: number;
}

const BASE: TowerLook = {
   background: "#120a2e",
   fog: "#150c36",
   fogNear: 30,
   fogFar: 150,
   lighting: "night",
   hemiSky: "#a78bfa",
   hemiGround: "#1e1240",
   hemi: 0.9,
   key: "#f5d0fe",
   keyIntensity: 0.7,
   rimGlow: 0.8,
};

export const LOOKS: Record<LevelId, TowerLook> = {
   1: BASE,
   2: { ...BASE, background: "#0f0a2a", fog: "#120c32" },
   3: { ...BASE, background: "#0a1030", fog: "#0d1438", hemiSky: "#93c5fd", key: "#dbeafe", rimGlow: 1 },
   4: { ...BASE, background: "#1a0a2a", fog: "#1d0c30", fogNear: 24, fogFar: 120, hemiSky: "#f0abfc", hemiGround: "#2a0f3a", key: "#fbcfe8", keyIntensity: 0.6, rimGlow: 1.2 },
   5: { ...BASE, background: "#07041a", fog: "#0a0620", fogNear: 22, fogFar: 110, lighting: "space", hemiSky: "#8b5cf6", hemiGround: "#0a0520", hemi: 0.8, key: "#e9d5ff", keyIntensity: 0.9, rimGlow: 1.4 },
};

export function levelEnvironment(id: LevelId): NonNullable<GameDefinition["environment"]> {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
