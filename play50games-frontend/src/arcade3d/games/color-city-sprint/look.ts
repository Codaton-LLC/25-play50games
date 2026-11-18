// Color City Sprint's look: Ember Heights' street city drained to ash grey by Shadow Plates. The
// buildings start grey and take their colour back as the streets round them turn red. Levels 1-3
// are a hazy ember day, level 4 a neon night (only streetlamps and your red lanes are lit), level 5
// a stormy dusk for Greyout. One palette (COLORS) and a look per level.
import type { LevelId } from "../../types";
import type { GameDefinition } from "@/arcade3d/core/types";

export const COLORS = {
   lane: "#ef4444",
   laneGlow: "#ff6b6b",
   leg: "#fda4af",
   asphalt: "#4b4f5c",
   asphaltNight: "#23202e",
   pavement: "#a8a29e",
   pavementNight: "#3f3a4a",
   kerb: "#d6d3d1",
   line: "#f5f5f4",
   plaza: "#d6c7b8",
   lot: "#57534e",
   sludge: "#3f4654",
   sludgeGlow: "#64748b",
   rail: "#cbd5e1",
   railGlow: "#fb7185",
   ghost: "#a78bfa",
   shard: "#bae6fd",
   sticker: "#f9a8d4",
   drain: "#1f2937",
   grey: "#9ca3af",
   background: "#e9c6b8",
} as const;

export interface CityLook {
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   lighting: "day" | "night" | "sunset";
   hemiSky: string;
   hemiGround: string;
   hemi: number;
   sun: string;
   sunI: number;
   asphalt: string;
   pavement: string;
   /** emissive strength of the red lanes */
   laneGlow: number;
   /** streetlamp light strength (night) */
   lamps: number;
}

const DAY: CityLook = {
   background: "#ecc9b9",
   fog: "#e7c2b4",
   fogNear: 40,
   fogFar: 150,
   lighting: "day",
   hemiSky: "#fff1e6",
   hemiGround: "#8b7d7a",
   hemi: 0.75,
   sun: "#fff4e6",
   sunI: 1.25,
   asphalt: COLORS.asphalt,
   pavement: COLORS.pavement,
   laneGlow: 0.55,
   lamps: 0,
};

export const LOOKS: Record<LevelId, CityLook> = {
   1: DAY,
   2: { ...DAY, background: "#f0cdb0", fog: "#ecc7ad", sun: "#ffedd5" },
   3: { ...DAY, background: "#e6bfa8", fog: "#dfb59f", lighting: "sunset", sun: "#fdba74", sunI: 1.1, fogFar: 140 },
   4: {
      background: "#140f2b",
      fog: "#1b1438",
      fogNear: 26,
      fogFar: 110,
      lighting: "night",
      hemiSky: "#6d5bd0",
      hemiGround: "#120d1f",
      hemi: 0.6,
      sun: "#a5b4fc",
      sunI: 0.3,
      asphalt: COLORS.asphaltNight,
      pavement: COLORS.pavementNight,
      laneGlow: 1.6,
      lamps: 1,
   },
   5: {
      background: "#2c2338",
      fog: "#352a43",
      fogNear: 30,
      fogFar: 120,
      lighting: "night",
      hemiSky: "#c4a7e7",
      hemiGround: "#1c1525",
      hemi: 0.65,
      sun: "#fca5a5",
      sunI: 0.55,
      asphalt: "#2b2833",
      pavement: "#4a4453",
      laneGlow: 1.3,
      lamps: 0.8,
   },
};

export function isNightLevel(id: LevelId): boolean {
   return LOOKS[id].lighting === "night";
}

export function levelEnvironment(id: LevelId): NonNullable<GameDefinition["environment"]> {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
