// Tightrope Path's five levels: pure data (no React, no three.js). The design card
// (docs/menu2-super/world-3-wild-temples.md "47 Tightrope Path"): one misty jungle gorge crossed on
// planks, beams and ropes; course.ts lays each level's path; these are the numbers every level shares.
import type { LevelId } from "../../types";

export interface TightLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this (the card: L1 60 s to L5 180 s) */
   targetMs: number;
   /** L2 on: gusts (telegraphed by leaves and mist streaks 1 s ahead) push the needle */
   gusts: boolean;
   /** L3 on: swinging sandbags (period 2.5 s) and swaying ropes */
   sandbags: boolean;
   /** L4: rotating beams and night fog (8 m of sight, lookout-tower torches) */
   night: boolean;
   /** L5: Umbra's rope joust; the win is his defeat */
   boss: boolean;
}

export const LEVELS: Record<LevelId, TightLevel> = {
   1: { id: 1, name: "Wide Beams", durationMs: 150_000, targetMs: 60_000, gusts: false, sandbags: false, night: false, boss: false },
   2: { id: 2, name: "Narrow Beams", durationMs: 200_000, targetMs: 90_000, gusts: true, sandbags: false, night: false, boss: false },
   3: { id: 3, name: "Moving Beams", durationMs: 240_000, targetMs: 120_000, gusts: true, sandbags: true, night: false, boss: false },
   4: { id: 4, name: "Rotating Path", durationMs: 280_000, targetMs: 150_000, gusts: true, sandbags: true, night: true, boss: false },
   5: { id: 5, name: "Balance Master", durationMs: 360_000, targetMs: 180_000, gusts: true, sandbags: false, night: false, boss: true },
};
