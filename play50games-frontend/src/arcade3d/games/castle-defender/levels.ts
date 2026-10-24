// Castle Defender's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// Only what varies: the waves (per wave walkers, shields, runners, crew members), a speed factor on
// every goblin, the gap between wave starts and each wave's clear time. Level 1 is today's game.
import type { LevelId } from "@/arcade3d/types";

export interface CastleLevel {
   /** per wave: walkers, shields, runners, crew members (crews are triples, at most 3 per wave: one per lane) */
   counts: readonly (readonly [number, number, number, number])[];
   /** factor on every goblin speed (TYPES) */
   speed: number;
   /** seconds between wave starts */
   period: number;
   /** seconds after its start a wave is cleared (+200); the last clear wins */
   clearAt: number;
}

export const LEVELS: Record<LevelId, CastleLevel> = {
   // today's game: 98 goblins in 5 waves
   1: { counts: [[8, 0, 0, 0], [10, 4, 0, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6]], speed: 1, period: 28, clearAt: 24 },
   // shields from wave 1, runners from wave 2: 102 goblins, 5 % faster
   2: { counts: [[8, 2, 0, 0], [10, 4, 2, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6]], speed: 1.05, period: 27, clearAt: 23 },
   // a sixth full wave: 128 goblins
   3: { counts: [[8, 0, 0, 0], [10, 4, 0, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6], [12, 6, 6, 6]], speed: 1.08, period: 26, clearAt: 22 },
   // seven waves, a ladder crew in wave 6: 151 goblins
   4: { counts: [[8, 0, 0, 0], [10, 4, 0, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6], [10, 4, 6, 3], [12, 6, 6, 6]], speed: 1.1, period: 25.5, clearAt: 21.5 },
   // eight waves, every kind from wave 2 and ladders from wave 4: 162 goblins
   5: { counts: [[8, 0, 0, 0], [8, 2, 2, 0], [10, 4, 2, 0], [10, 4, 4, 3], [10, 4, 6, 3], [10, 4, 6, 6], [10, 4, 6, 6], [12, 6, 6, 6]], speed: 1.14, period: 25, clearAt: 21.5 },
};
