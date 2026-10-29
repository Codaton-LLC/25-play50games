// Neon Cube Jump's five levels: pure data (no React, no three.js). The design card
// (scratchpad m2b/w5-neon-cosmos.md "7 Neon Cube Jump"): one neon cube field over the violet void where
// every jump flips which cube set is solid. course.ts lays each level's cubes; these are the numbers
// every level shares.
import type { LevelId } from "../../types";

export interface NeonLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this (the card: L1 45 s up to L5 110 s) */
   targetMs: number;
   /** L2: B cubes slide on rails, but only while solid */
   moving: boolean;
   /** L3: rogue ring cubes flip on their own 1.6 s clock */
   rogue: boolean;
   /** L4: laser walls join the sets; sentry drones patrol */
   lasers: boolean;
   /** L5: Flipframe; the win is its defeat */
   boss: boolean;
}

export const LEVELS: Record<LevelId, NeonLevel> = {
   1: { id: 1, name: "Static Grid", durationMs: 150_000, targetMs: 45_000, moving: false, rogue: false, lasers: false, boss: false },
   2: { id: 2, name: "Moving Cubes", durationMs: 180_000, targetMs: 60_000, moving: true, rogue: false, lasers: false, boss: false },
   3: { id: 3, name: "Blink Grid", durationMs: 200_000, targetMs: 75_000, moving: false, rogue: true, lasers: false, boss: false },
   4: { id: 4, name: "Laser Grid", durationMs: 220_000, targetMs: 90_000, moving: false, rogue: false, lasers: true, boss: false },
   5: { id: 5, name: "Neon Overdrive", durationMs: 300_000, targetMs: 110_000, moving: false, rogue: false, lasers: false, boss: true },
};
