// Penalty Hero's five levels: pure data, no React or three.js (docs/arcade-levels.md §6.3).
// One pitch and the same six goal zones. Level 1 is today's live game, unchanged. Levels 2-5
// adapt the plan to that built game: more attempts, moving/smaller targets, a keeper that can
// read a shot, tighter timing, gusts, and richer streaks. No level adds an asset or a control.
import type { LevelId } from "@/arcade3d/types";

export interface PenaltyLevel {
   /** shots in a full run; the shot dots and shell HUD use the same count */
   shots: number;
   /** goals needed to win; 0 is Level 1's legacy always-win ending */
   goalsToWin: number;
   /** points for a goal after the first in a streak (the first is always 100) */
   nextGoalPoints: number;
   /** probability that a second seeded draw redirects a different dive to the shot's zone */
   keeperRead: number;
   /** target tile width/height and reticle travel, relative to Level 1 */
   targetScale: number;
   /** absolute reticle offset accepted as accurate; identical for touch and keyboard */
   reticleBand: number;
   /** seconds of the main timing-ring oscillation */
   reticlePeriodS: number;
   /** milliseconds per target drift cycle; 0 disables movement */
   movePeriodMs: number;
   /** amplitude of the visible crosswind gust added to the timing ring */
   wind: number;
   /** per-shot aim timeout in simulation milliseconds */
   aimTimeoutMs: number;
}

export const LEVELS: Record<LevelId, PenaltyLevel> = {
   // Today's game: ten shots, no goal target, no read, stationary full-size zones, no gust.
   1: { shots: 10, goalsToWin: 0, nextGoalPoints: 150, keeperRead: 0, targetScale: 1, reticleBand: 0.25, reticlePeriodS: 1.2, movePeriodMs: 0, wind: 0, aimTimeoutMs: 20_000 },
   // Local Cup: moving targets and the first keeper reads.
   2: { shots: 12, goalsToWin: 7, nextGoalPoints: 150, keeperRead: 0.04, targetScale: 0.92, reticleBand: 0.23, reticlePeriodS: 1.12, movePeriodMs: 2400, wind: 0, aimTimeoutMs: 18_000 },
   // Night Match: a richer 175-point streak and tighter timing.
   3: { shots: 14, goalsToWin: 9, nextGoalPoints: 175, keeperRead: 0.07, targetScale: 0.84, reticleBand: 0.21, reticlePeriodS: 1.04, movePeriodMs: 2000, wind: 0, aimTimeoutMs: 16_000 },
   // Semi Final: smaller/faster targets and a visible crosswind gust.
   4: { shots: 16, goalsToWin: 10, nextGoalPoints: 175, keeperRead: 0.1, targetScale: 0.76, reticleBand: 0.19, reticlePeriodS: 0.96, movePeriodMs: 1600, wind: 0.12, aimTimeoutMs: 14_000 },
   // Final Shootout: every hazard, the strictest attempt window and 200-point streak goals.
   5: { shots: 18, goalsToWin: 12, nextGoalPoints: 200, keeperRead: 0.12, targetScale: 0.68, reticleBand: 0.17, reticlePeriodS: 0.88, movePeriodMs: 1200, wind: 0.2, aimTimeoutMs: 12_000 },
};
