// Color Orb Defense's five levels: pure data (the card's level names, wave counts and target windows).
// arena.ts lays out each level's lanes, zones and the wave schedule.
import type { LevelId } from "@/arcade3d/types";

export interface DefenseLevel {
   id: LevelId;
   name: string;
   waves: number;
   /** portals (lanes) round the arena */
   lanes: number;
   colors: number;
   /** orb speed (m/s) */
   orbSpeed: number;
   /** ms between two orbs of a wave */
   intervalMs: number;
   /** the drone that sweeps the ring (from level 2) */
   drone: boolean;
   /** blink orbs that change colour (from level 3) */
   blink: boolean;
   /** orbs in pairs (level 4) */
   pairs: boolean;
   boss: boolean;
   /** the run clock's cap (ms) */
   durationMs: number;
}

export const LEVELS: Record<LevelId, DefenseLevel> = {
   1: { id: 1, name: "Two Colors", waves: 4, lanes: 3, colors: 2, orbSpeed: 2.6, intervalMs: 2300, drone: false, blink: false, pairs: false, boss: false, durationMs: 120_000 },
   2: { id: 2, name: "Three Colors", waves: 6, lanes: 4, colors: 3, orbSpeed: 2.8, intervalMs: 2100, drone: true, blink: false, pairs: false, boss: false, durationMs: 150_000 },
   3: { id: 3, name: "Four Colors", waves: 8, lanes: 4, colors: 4, orbSpeed: 2.9, intervalMs: 2100, drone: true, blink: true, pairs: false, boss: false, durationMs: 210_000 },
   4: { id: 4, name: "Fast Waves", waves: 10, lanes: 5, colors: 4, orbSpeed: 3.1, intervalMs: 1850, drone: true, blink: true, pairs: true, boss: false, durationMs: 260_000 },
   5: { id: 5, name: "Orb Defense Master", waves: 12, lanes: 5, colors: 5, orbSpeed: 3.2, intervalMs: 1850, drone: true, blink: true, pairs: true, boss: true, durationMs: 320_000 },
};
