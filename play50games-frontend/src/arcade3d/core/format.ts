// Score formatting shared by GameShell and the arcade UI kit. Server-safe.
import type { ScoringRules } from "../types";

/** 42150 -> "0:42.15" */
export function formatDuration(ms: number): string {
   const totalCs = Math.max(0, Math.round(ms / 10));
   const minutes = Math.floor(totalCs / 6000);
   const seconds = Math.floor((totalCs % 6000) / 100);
   const cs = totalCs % 100;
   return `${minutes}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Text for a score. Time games show the duration when it is known,
 * points games show the number with its unit, e.g. "1,250 pts".
 */
export function formatScore(score: number, scoring: ScoringRules, durationMs?: number | null): string {
   if (scoring.display === "time" && durationMs != null) return formatDuration(durationMs);
   return `${score.toLocaleString("en-US")} ${scoring.unitLabel}`;
}
