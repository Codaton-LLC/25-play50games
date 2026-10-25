// Construction Worker's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One building site, five configurations of the same three buildings (36 pieces, 240 s). Level 1 is
// today's game and must never change: gusts only on the tower (building 3), wind 3 m/s² for 1 s of
// every 7, today's landing bands, today's stability costs. levels.test.ts pins it.
//
// The level brief proposed a 3-piece level 1 with today's full shift as level 5; level 1 must stay
// today's game, so every level is the full shift and a harder level makes the same work harder: the
// wind gusts from an earlier building, blow harder and more often, the landing bands shrink and good
// or ok landings cost more stability (a miss still costs 12, so a collapse still needs 9 misses).
// The plan's walking fetch-and-place loop, parallel objectives and work zones are not built.
import type { LevelId } from "@/arcade3d/types";

export interface CraneLevel {
   /** gusts blow from this building (0 house, 1 shop, 2 tower) on */
   gustFrom: number;
   /** gust strength, m/s² */
   wind: number;
   /** a gust blows for the first second of every `gustPeriod` s of windy building time */
   gustPeriod: number;
   /** factor on the perfect / good / ok landing bands */
   band: number;
   /** factor on the stability cost of a good or ok landing (a miss stays 12) */
   stab: number;
}

export const LEVELS: Record<LevelId, CraneLevel> = {
   // Garden Shed: today's game.
   1: { gustFrom: 2, wind: 3, gustPeriod: 7, band: 1, stab: 1 },
   // Tiny House: the wind starts at the shop, slightly smaller bands.
   2: { gustFrom: 1, wind: 3, gustPeriod: 7, band: 0.97, stab: 1.05 },
   // Garage: a little stronger wind from the shop on.
   3: { gustFrom: 1, wind: 3.25, gustPeriod: 7, band: 0.95, stab: 1.1 },
   // Shop Front: the wind blows from the first piece.
   4: { gustFrom: 0, wind: 3.25, gustPeriod: 7, band: 0.93, stab: 1.1 },
   // Mini Tower: stronger, more frequent gusts, the smallest bands.
   5: { gustFrom: 0, wind: 3.5, gustPeriod: 6, band: 0.92, stab: 1.15 },
};
