// Food Catcher's five kitchen configurations. Level 1 is today's live run unchanged.
import type { LevelId } from "../../types";

export interface FoodCatcherLevel {
   durationMs: number;
   /** Level 1 remains score-attack; levels 2-5 win after this many good catches. */
   targetGood: number;
   /** Scales the existing spawn gaps; a smaller gap is denser. */
   gapFactor: number;
   /** Scales the existing fall speeds. */
   speedFactor: number;
   /** Added to the existing junk chance, capped at 1. */
   badChanceBoost: number;
   /** Every nth spawn is golden; only the first bonusLimit golden snacks award +10. */
   goldenEvery: number;
   /** Maximum number of +10 golden awards in a run; bounds level score from its objective. */
   bonusLimit: number;
}

export const LEVELS: Record<LevelId, FoodCatcherLevel> = {
   1: { durationMs: 90_000, targetGood: 0, gapFactor: 1, speedFactor: 1, badChanceBoost: 0, goldenEvery: 0, bonusLimit: 0 },
   2: { durationMs: 120_000, targetGood: 25, gapFactor: 0.9, speedFactor: 1.08, badChanceBoost: 0.04, goldenEvery: 8, bonusLimit: 3 },
   3: { durationMs: 150_000, targetGood: 35, gapFactor: 0.82, speedFactor: 1.18, badChanceBoost: 0.07, goldenEvery: 7, bonusLimit: 5 },
   4: { durationMs: 180_000, targetGood: 45, gapFactor: 0.74, speedFactor: 1.32, badChanceBoost: 0.1, goldenEvery: 6, bonusLimit: 7 },
   5: { durationMs: 180_000, targetGood: 60, gapFactor: 0.68, speedFactor: 1.48, badChanceBoost: 0.12, goldenEvery: 5, bonusLimit: 12 },
};
