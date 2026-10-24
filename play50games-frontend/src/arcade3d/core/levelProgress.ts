// The player's progress through a game's levels (docs/arcade-levels.md §2.1-2.2): per-level bests,
// cleared and unlocked flags, the total, the level to open on, and their texts. Pure.
//
// Unlock rule (user decision 2, the same for guests and accounts): level 1 is always open; level n
// opens once level n-1 is cleared, or when level n already has a score (another device, a synced
// best); a level never locks again. Cleared = a stored win / clearScore flag, a best that reaches
// the level's clearScore (also true for server-synced bests), or any stored best of a time game
// (time games save finished runs only, so every stored time is a win).
import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type LevelMeta, type ScoringRules } from "../types";
import { levelsOf } from "../levelMeta";
import { levelKey, levelsActive } from "./levels";
import { formatDuration, formatScore } from "./format";
import type { LocalLevelEntry, LocalScoreEntry } from "./scores";

export interface LevelProgress {
   id: LevelId;
   title: string;
   /** this level's best (score; time games: the time score), null = never scored */
   best: number | null;
   bestDurationMs: number | null;
   plays: number;
   cleared: boolean;
   unlocked: boolean;
}

export interface LevelProgressSummary {
   levels: LevelProgress[];
   /** the game's total (LocalScoreEntry.best): points = sum of the bests; time = only once all 5 are finished */
   total: number;
   /** time games: the summed best time once all 5 levels are finished, else null */
   totalDurationMs: number | null;
   /** how many levels are cleared */
   cleared: number;
   /** every level has a score (time games: a finishing time) */
   complete: boolean;
}

/** One level entry counts as cleared (see the unlock rule above). */
export function levelEntryCleared(meta: ArcadeGameMeta, level: LevelMeta, entry: LocalLevelEntry | undefined): boolean {
   if (!entry) return false;
   if (entry.cleared || meta.scoring.kind === "time") return true;
   return level.clearScore !== undefined && entry.best >= level.clearScore;
}

/**
 * The tiles' data. `active` false (levels off, or a one-level game) gives level 1 only, with the
 * game's best as today.
 */
export function levelProgress(
   meta: ArcadeGameMeta,
   entry: LocalScoreEntry | null | undefined,
   active: boolean = levelsActive(meta)
): LevelProgressSummary {
   const metas = active ? levelsOf(meta) : levelsOf(meta).slice(0, 1);
   const levels: LevelProgress[] = [];
   metas.forEach((level, index) => {
      const stored = entry?.levels?.[levelKey(level.id)];
      const cleared = levelEntryCleared(meta, level, stored);
      const previous = levels[index - 1];
      levels.push({
         id: level.id,
         title: level.title,
         best: stored ? stored.best : null,
         bestDurationMs: stored?.bestDurationMs ?? null,
         plays: stored?.plays ?? 0,
         cleared,
         unlocked: index === 0 || !!stored || !!previous?.cleared,
      });
   });
   const complete = levels.every((level) => (meta.scoring.kind === "time" ? level.bestDurationMs !== null : level.best !== null));
   return {
      levels,
      total: entry?.best ?? 0,
      totalDurationMs: meta.scoring.kind === "time" && complete ? (entry?.bestDurationMs ?? null) : null,
      cleared: levels.filter((level) => level.cleared).length,
      complete,
   };
}

/**
 * The level the start card opens on: a requested level (?level=n) when unlocked, else the highest
 * unlocked level below it; with no request the last played level (when unlocked), else the lowest
 * unlocked level not cleared yet, else level 5.
 */
export function pickInitialLevel(progress: readonly LevelProgress[], requested: number | null, lastPlayed: LevelId | null): LevelId {
   const unlocked = (id: number) => progress.some((level) => level.id === id && level.unlocked);
   if (progress.length <= 1) return 1;
   if (requested !== null && Number.isInteger(requested) && requested >= 1) {
      for (let id = Math.min(requested, LEVEL_IDS.length); id >= 1; id -= 1) if (unlocked(id)) return id as LevelId;
      return 1;
   }
   if (lastPlayed !== null && unlocked(lastPlayed)) return lastPlayed;
   const open = progress.find((level) => level.unlocked && !level.cleared);
   return open ? open.id : (progress[progress.length - 1].id as LevelId);
}

/** A tile's best: the points, or the time for a time game; "–" when never scored. */
export function levelBestText(level: Pick<LevelProgress, "best" | "bestDurationMs">, scoring: ScoringRules): string {
   if (level.best === null) return "–";
   if (scoring.display === "time") return level.bestDurationMs !== null ? formatDuration(level.bestDurationMs) : "–";
   return formatScore(level.best, scoring);
}

/** "Total 3,420 pts", "Total time 4:12.33", or the time game's "Finish all 5 levels to rank". */
export function levelTotalText(meta: ArcadeGameMeta, summary: LevelProgressSummary): string {
   if (meta.scoring.kind === "time") {
      return summary.totalDurationMs !== null ? `Total time ${formatDuration(summary.totalDurationMs)}` : "Finish all 5 levels to rank";
   }
   return `Total ${formatScore(summary.total, meta.scoring)}`;
}

/** "2 of 5 levels cleared" */
export const levelClearedText = (summary: LevelProgressSummary): string =>
   `${summary.cleared} of ${summary.levels.length} levels cleared`;

/** The /3d card's line for a game whose levels are on: "Total 3,420 pts · 2/5". */
export const levelCardText = (meta: ArcadeGameMeta, summary: LevelProgressSummary): string =>
   `${levelTotalText(meta, summary)} · ${summary.cleared}/${summary.levels.length}`;
