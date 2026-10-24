import type { LevelId } from "@/arcade3d/types";

/** One corridor, the live jump/steer windows, and five seeded spawn configurations. */
export interface OfficeLevel {
   speedBonus: number;
   extraReductionMs: number;
   minObstacles: number;
   movingMm: number;
   motionPeriodMs: number;
   /** Every nth row is an all-printer jump line; zero keeps random rows. */
   printerEvery: number;
   coinPoints: number;
   clearScore: number;
}

export const LEVELS: Record<LevelId, OfficeLevel> = {
   1: { speedBonus: 0, extraReductionMs: 0, minObstacles: 1, movingMm: 0, motionPeriodMs: 2400, printerEvery: 0, coinPoints: 50, clearScore: 760 },
   2: { speedBonus: 0.5, extraReductionMs: 100, minObstacles: 2, movingMm: 0, motionPeriodMs: 2400, printerEvery: 0, coinPoints: 55, clearScore: 1000 },
   3: { speedBonus: 1, extraReductionMs: 200, minObstacles: 2, movingMm: 150, motionPeriodMs: 2400, printerEvery: 5, coinPoints: 60, clearScore: 1330 },
   4: { speedBonus: 1.5, extraReductionMs: 350, minObstacles: 3, movingMm: 150, motionPeriodMs: 1800, printerEvery: 4, coinPoints: 65, clearScore: 1575 },
   5: { speedBonus: 2, extraReductionMs: 500, minObstacles: 3, movingMm: 150, motionPeriodMs: 1200, printerEvery: 3, coinPoints: 70, clearScore: 1870 },
};
