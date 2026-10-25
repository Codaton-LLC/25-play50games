// One city, five configurations. L1 is the live game, including its original RNG stream.
import type { LevelId } from "../../types";

export interface CleanLevel {
   items: number;
   spacing: number;
   durationMs: number;
   extraBins: number;
   delivery: boolean;
   hazards: number;
   matching: boolean;
   combo: boolean;
   points: number;
   bonus: number;
}

export const LEVELS: Record<LevelId, CleanLevel> = {
   1: { items: 20, spacing: 5.4, durationMs: 240000, extraBins: 0, delivery: false, hazards: 0, matching: false, combo: false, points: 50, bonus: 10 },
   2: { items: 24, spacing: 4.5, durationMs: 235000, extraBins: 1, delivery: true, hazards: 0, matching: false, combo: false, points: 75, bonus: 5 },
   3: { items: 28, spacing: 4.2, durationMs: 230000, extraBins: 2, delivery: true, hazards: 1, matching: false, combo: false, points: 75, bonus: 5 },
   4: { items: 32, spacing: 3.9, durationMs: 225000, extraBins: 3, delivery: true, hazards: 2, matching: true, combo: false, points: 75, bonus: 5 },
   5: { items: 36, spacing: 3.6, durationMs: 220000, extraBins: 4, delivery: true, hazards: 3, matching: true, combo: true, points: 75, bonus: 5 },
};

/** Nested obstacles, drawn with the existing bin GLB. All stay clear of the start pad. */
export const EXTRA_BINS = [
   { x: -12, z: -11 }, { x: 12, z: 11 }, { x: -12, z: 11 }, { x: 12, z: -11 },
] as const;
/** Moving maintenance bins cross open lanes. Their amber ring slows, never pushes or teleports. */
export const HAZARDS = [
   { x: 0, z: -3, amplitude: 2 }, { x: 0, z: 7, amplitude: 1.5 }, { x: 0, z: 1, amplitude: 2 },
] as const;
export const HAZARD_RADIUS = 1.5;
export const HAZARD_SLOW = 0.6;
export const COMBO_WINDOW_MS = 4000;
export const COMBO_POINTS = 10;
