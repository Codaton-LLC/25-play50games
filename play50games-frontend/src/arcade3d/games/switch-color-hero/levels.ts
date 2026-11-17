// Switch Color Hero's five levels: pure data (the card's level names, speeds and timers). track.ts
// lays out each level's gates and hazards.
import type { LevelId } from "@/arcade3d/types";

export interface SwitchLevel {
   id: LevelId;
   name: string;
   /** the auto-run speed (m/s) */
   speed: number;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this (the card's timer) */
   starTargetMs: number;
   boss: boolean;
}

export const LEVELS: Record<LevelId, SwitchLevel> = {
   1: { id: 1, name: "Two Gates", speed: 9, durationMs: 120_000, starTargetMs: 60_000, boss: false },
   2: { id: 2, name: "Three Colors", speed: 10, durationMs: 150_000, starTargetMs: 75_000, boss: false },
   3: { id: 3, name: "Fast Switching", speed: 11.5, durationMs: 180_000, starTargetMs: 90_000, boss: false },
   4: { id: 4, name: "Mixed Obstacles", speed: 13, durationMs: 210_000, starTargetMs: 105_000, boss: false },
   5: { id: 5, name: "Color Overdrive", speed: 14, durationMs: 300_000, starTargetMs: 120_000, boss: true },
};
