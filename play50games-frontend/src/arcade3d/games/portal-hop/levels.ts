// Rift Hop's five levels: pure data (no React, no three.js). The design card
// (scratchpad m2b/w5-neon-cosmos.md "24 Rift Hop"): floating void ruins crossed through portals; you
// pick where the exit opens, and the speed you carry in is the speed you carry out. course.ts places
// each level's islands, portals, anchors, orbs and the bot's route.
import type { LevelId } from "../../types";

export interface PortalLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the third star: the finish time at or under this (the card: L1 45 s) */
   targetMs: number;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** "Rift Economy": finish with no more anchor switches than this (a sticker) */
   parSwitches: number;
   /** L3: anchors ride round their island (rad/s) */
   orbit: number;
   /** L4: void-crystal cargo blocks and pressure switches */
   cargo: boolean;
   /** level 5: the Rift Serpent; the win is its defeat */
   boss: boolean;
}

const DEG = Math.PI / 180;

export const LEVELS: Record<LevelId, PortalLevel> = {
   1: { id: 1, name: "Two Rifts", targetMs: 45_000, durationMs: 150_000, parSwitches: 2, orbit: 0, cargo: false, boss: false },
   2: { id: 2, name: "Two Pairs", targetMs: 60_000, durationMs: 180_000, parSwitches: 3, orbit: 0, cargo: false, boss: false },
   3: { id: 3, name: "Moving Rifts", targetMs: 75_000, durationMs: 210_000, parSwitches: 2, orbit: 20 * DEG, cargo: false, boss: false },
   4: { id: 4, name: "Cargo", targetMs: 90_000, durationMs: 240_000, parSwitches: 4, orbit: 0, cargo: true, boss: false },
   5: { id: 5, name: "Rift Master", targetMs: 150_000, durationMs: 300_000, parSwitches: 8, orbit: 0, cargo: false, boss: true },
};
