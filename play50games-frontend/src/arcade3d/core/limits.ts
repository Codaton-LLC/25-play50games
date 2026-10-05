// The server's plausibility check for points games, mirrored for rules.ts and its tests.
// Owned by Claude. Pure (types only). docs/arcade-api.md §7: the server rejects a run unless
//    score <= maxScore, minDurationMs <= duration_ms <= maxDurationMs and
//    score * 1000 <= base * 1000 + maxPointsPerSec * duration_ms   (integers, duration in whole ms)
// A points game proves in its README that real runs stay inside, tests it with
// withinServerLimits, and may trim its final score with capScore as a safety net.
import type { ScoringRules } from "../types";

/** The duration the server sees: GameShell (core/scores.ts normalizeRun) submits whole ms. */
export const submittedMs = (durationMs: number): number => Math.max(0, Math.round(durationMs));

/** Would the server accept `score` for a run of `durationMs` (rounded like the submitted run)? */
export function withinServerLimits(score: number, durationMs: number, rules: ScoringRules): boolean {
   const d = submittedMs(durationMs);
   return (
      Number.isInteger(score) &&
      score >= 0 &&
      score <= rules.maxScore &&
      d >= rules.minDurationMs &&
      d <= rules.maxDurationMs &&
      score * 1000 <= rules.base * 1000 + rules.maxPointsPerSec * d
   );
}

/**
 * Safety net only: trims a score to what the server accepts for this duration (the store's raw
 * elapsedMs, rounded here exactly as GameShell rounds it before submitting). A game's proof should
 * show real runs never reach the cap, and its tests that capScore stays a no-op.
 */
export function capScore(score: number, durationMs: number, rules: ScoringRules): number {
   const plausible = Math.floor((rules.base * 1000 + rules.maxPointsPerSec * submittedMs(durationMs)) / 1000);
   return Math.max(0, Math.min(score, rules.maxScore, plausible));
}
