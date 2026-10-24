// The level rules the shell applies (docs/arcade-levels.md §1.4-1.6, §3; core/README.md "Levels").
// Pure: no React, no storage. A game without levels is one level, so everything here works for it.
import { ARCADE_LEVELS } from "../flags";
import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type LevelKey, type LevelMeta } from "../types";
import { levelCount, levelMetaFor, levelsOf } from "../levelMeta";
import type { EndReason, GameDefinition, LevelSpec } from "./types";
import type { RunConfig } from "./useArcadeStore";
import type { LocalLevelEntry } from "./scores";

/**
 * The level system is on for this game: the NEXT_PUBLIC_ARCADE_LEVELS flag and five levels in
 * meta.ts. Off = level 1 only, exactly the game as it was (no tiles, no chip, totals = level 1).
 */
export function levelsActive(meta: ArcadeGameMeta, enabled: boolean = ARCADE_LEVELS): boolean {
   return enabled && levelCount(meta) === 5;
}

/**
 * The shell shows the level UI (tiles, HUD chip, result buttons, `?level=`) and plays levels 2-5:
 * levels active for the game, and the server known to support them (`supported` from
 * levelSupport.ts; null = not known yet = not yet).
 */
export function levelUiEnabled(meta: ArcadeGameMeta, supported: boolean | null, enabled: boolean = ARCADE_LEVELS): boolean {
   return levelsActive(meta, enabled) && supported === true;
}

/** A run clears its level by a win, or by reaching the level's clearScore (score-attack levels). */
export function isLevelCleared(endReason: EndReason | null, score: number, level: LevelMeta): boolean {
   return endReason === "win" || (level.clearScore !== undefined && score >= level.clearScore);
}

export const levelKey = (id: LevelId): LevelKey => `${id}` as LevelKey;

export function levelSpecFor<C>(definition: GameDefinition<C>, id: LevelId): LevelSpec<C> | null {
   return definition.levels?.find((spec) => spec.id === id) ?? null;
}

/** The store's run config for one level: the level's overrides over the definition's values. */
export function levelRunConfig(definition: GameDefinition, id: LevelId): Partial<RunConfig> {
   const spec = levelSpecFor(definition, id);
   return {
      durationMs: spec?.durationMs ?? definition.durationMs,
      lives: spec?.lives ?? definition.lives,
      resultDelayMs: spec?.resultDelayMs ?? definition.resultDelayMs,
   };
}

/** The environment of one level: { ...definition.environment, ...spec.environment }. */
export function levelEnvironment(definition: GameDefinition, id: LevelId): GameDefinition["environment"] {
   const override = levelSpecFor(definition, id)?.environment;
   if (!override) return definition.environment;
   return { ...(definition.environment ?? { background: "#0b1020", lighting: "day" }), ...override };
}

/** The start card's instructions for one level. */
export function levelInstructions(definition: GameDefinition, id: LevelId): string[] {
   return levelSpecFor(definition, id)?.instructions ?? definition.instructions;
}

/** The HUD's stat chips for one level. */
export function levelHudStats(definition: GameDefinition, id: LevelId): GameDefinition["hudStats"] {
   return levelSpecFor(definition, id)?.hudStats ?? definition.hudStats;
}

/** What useLevel() returns. */
export interface ActiveLevel<C = unknown> {
   id: LevelId;
   meta: LevelMeta;
   /** null for a game without levels */
   spec: LevelSpec<C> | null;
   /** spec.config (undefined for a game without levels) */
   config: C;
}

export function resolveActiveLevel<C = unknown>(meta: ArcadeGameMeta, definition: GameDefinition<C>, id: LevelId): ActiveLevel<C> {
   const known = levelsOf(meta).some((level) => level.id === id) ? id : 1;
   const spec = levelSpecFor(definition, known);
   return { id: known, meta: levelMetaFor(meta, known), spec, config: spec?.config as C };
}

/** meta.levels and definition.levels are both present or both absent, with the same ids in order. */
export function definitionLevelProblems(meta: ArcadeGameMeta, definition: GameDefinition): string[] {
   const metaIds = meta.levels?.map((level) => level.id) ?? null;
   const specIds = definition.levels?.map((spec) => spec.id) ?? null;
   if (metaIds === null && specIds === null) return [];
   if (metaIds === null) return ["definition.levels is set but meta.levels is not"];
   if (specIds === null) return ["meta.levels is set but definition.levels is not"];
   if (metaIds.join() !== specIds.join()) return [`level ids differ: meta ${metaIds.join(",")}, definition ${specIds.join(",")}`];
   return definition.levels!.filter((spec) => !spec.description.trim()).map((spec) => `level ${spec.id}: empty description`);
}

/** Local per-level entries, keyed "1".."5". */
export type LocalLevels = Partial<Record<LevelKey, LocalLevelEntry>>;

/**
 * The game's totals from its level entries (docs/arcade-levels.md §3, user decisions 3 and 4):
 * - levels off (or a one-level game): level 1's best and best time, exactly as before levels;
 * - points games: the sum of the levels' bests (the board value); a summed time only when every
 *   scored level has one;
 * - time games: the sum of the best finishing times, only once all 5 levels have one; until then
 *   no total (best 0, bestDurationMs null: "Finish all 5 levels to rank"). `best` is then the sum
 *   of the levels' time scores, so higher stays better.
 */
export function levelTotals(
   meta: ArcadeGameMeta,
   levels: LocalLevels | undefined,
   active: boolean = levelsActive(meta)
): { best: number; bestDurationMs: number | null } {
   if (!active) {
      const first = levels?.["1"];
      return { best: first?.best ?? 0, bestDurationMs: first?.bestDurationMs ?? null };
   }
   const entries = LEVEL_IDS.map((id) => levels?.[levelKey(id)]).filter((entry): entry is LocalLevelEntry => !!entry);
   const best = entries.reduce((sum, entry) => sum + entry.best, 0);
   const durations = entries.every((entry) => entry.bestDurationMs !== null);
   const summedTime = entries.reduce((sum, entry) => sum + (entry.bestDurationMs ?? 0), 0);
   if (meta.scoring.kind === "time") {
      const complete = entries.length === LEVEL_IDS.length && durations;
      return complete ? { best, bestDurationMs: summedTime } : { best: 0, bestDurationMs: null };
   }
   return { best, bestDurationMs: entries.length > 0 && durations ? summedTime : null };
}
