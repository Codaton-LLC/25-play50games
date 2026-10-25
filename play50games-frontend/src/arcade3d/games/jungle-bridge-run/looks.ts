// Visuals, palette and camera configuration for Jungle Bridge Run.
// Follows core guidelines: one palette, modern premium look, no void at screen edges.
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { JungleLevel } from "./levels";

export const COLORS = {
   planks: "#a16207",
   planksDark: "#78350f",
   moss: "#4d7c0f",
   foliage: "#15803d",
   foliageDark: "#166534",
   water: "#0e7490",
   waterDeep: "#155e75",
   accent: "#22c55e",
   stone: "#78716c",
   stoneDark: "#57534e",
   gem: "#22d3ee",
   gemGlow: "#06b6d4",
   lava: "#ef4444",
   lavaGlow: "#f97316",
   lavaRock: "#1c1917",
   logBark: "#854d0e",
   rope: "#b45309",
   white: "#ffffff",
   cliff: "#44403c",
   sand: "#ca8a04",
} as const;

export const PITCH_DEG = 28;
export const PITCH_RAD = (PITCH_DEG * Math.PI) / 180;
export const LOOK_AHEAD_Z = 8;
export const FOV = 50;

/** Camera offset relative to the look-ahead target (0, 0, player.z + 8). */
export const CAMERA_OFFSET: [number, number, number] = [0, 5.4, -10.15];

/** Fixed area around look-ahead point for useFittedView. */
export const VIEW_CONFIG: FittedViewOptions = {
   area: {
      min: { x: -3.6, y: -1, z: -10 },
      max: { x: 3.6, y: 3.5, z: 12 },
   },
   pitch: PITCH_RAD,
   yaws: [0],
   fov: FOV,
   padding: 8,
   shift: true,
   margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 },
};

export function fogConfigFor(level: JungleLevel): [string, number, number] {
   const fogNear = Math.max(10, level.fogFar - 35);
   return [level.background, fogNear, level.fogFar];
}
