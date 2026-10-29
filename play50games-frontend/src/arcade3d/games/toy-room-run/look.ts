// Toy Room Run's look: the Sugarfrost Workshop's toy room, drained of its gold by Shadow Plates.
// Warm timber desks and wallpapered walls under a soft window light (levels 1-3, 5), and a night
// playroom for level 4 (Lights Out: only fallen pieces glow). One palette and a look per level.
import type { LevelId } from "../../types";
import type { GameDefinition } from "@/arcade3d/core/types";

export const COLORS = {
   desk: "#b07a4f",
   deskEdge: "#8a5a36",
   deskNight: "#3a2a22",
   leg: "#7c4a2b",
   carpet: "#5b6c8f",
   carpetNight: "#1d2236",
   wall: "#f3e3c9",
   wallNight: "#2a2440",
   trim: "#d9b98a",
   shelf: "#c49364",
   ledge: "#a8714a",
   glow: "#fde68a",
   bridge: "#fff3c4",
   ghost: "#a78bfa",
   shard: "#bae6fd",
   sticker: "#f9a8d4",
   cascade: "#38bdf8",
   wave: "#facc15",
} as const;

export interface RoomLook {
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   lighting: "day" | "night" | "indoor";
   hemiSky: string;
   hemiGround: string;
   hemi: number;
   desk: string;
   carpet: string;
   wall: string;
   /** how strongly fallen pieces glow (Lights Out: the only light on the bridge) */
   pieceGlow: number;
}

const DAY: RoomLook = {
   background: "#f6e7cf",
   fog: "#f1dfc2",
   fogNear: 45,
   fogFar: 170,
   lighting: "indoor",
   hemiSky: "#fff4dd",
   hemiGround: "#8a7a6a",
   hemi: 0.7,
   desk: COLORS.desk,
   carpet: COLORS.carpet,
   wall: COLORS.wall,
   pieceGlow: 0,
};

export const LOOKS: Record<LevelId, RoomLook> = {
   1: DAY,
   2: { ...DAY, background: "#f3e4cc" },
   3: { ...DAY, background: "#efe0c8", lighting: "day" },
   4: {
      background: "#120f22",
      fog: "#171329",
      fogNear: 22,
      fogFar: 95,
      lighting: "night",
      hemiSky: "#6a5ccf",
      hemiGround: "#110d1c",
      hemi: 0.55,
      desk: COLORS.deskNight,
      carpet: COLORS.carpetNight,
      wall: COLORS.wallNight,
      pieceGlow: 1.6,
   },
   5: { ...DAY, background: "#e9d9c2", fog: "#e3d0b6", fogFar: 120, lighting: "indoor", hemi: 0.75 },
};

export function levelEnvironment(id: LevelId): NonNullable<GameDefinition["environment"]> {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
