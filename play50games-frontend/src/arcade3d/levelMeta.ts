// Pure helpers over a game's levels (docs/arcade-levels.md §1.2). Server-safe: plain data, no
// imports beyond types. Re-exported by registry.ts. A game without `meta.levels` is one level,
// synthesised from `meta.scoring`, so every caller can treat all games the same way.
import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type LevelMeta, type ScoringRules } from "./types";

/** The game's levels: its `meta.levels`, or one level 1 made from `meta.scoring`. */
export function levelsOf(meta: ArcadeGameMeta): readonly LevelMeta[] {
   if (meta.levels && meta.levels.length > 0) return meta.levels;
   return [{ id: 1, title: meta.title, scoring: meta.scoring }];
}

export function levelCount(meta: ArcadeGameMeta): 1 | 5 {
   return meta.levels && meta.levels.length === LEVEL_IDS.length ? 5 : 1;
}

/** true when `value` is one of this game's level ids (a game without levels knows only 1). */
export function isLevelId(meta: ArcadeGameMeta, value: unknown): value is LevelId {
   return typeof value === "number" && levelsOf(meta).some((level) => level.id === value);
}

export function levelMetaFor(meta: ArcadeGameMeta, id: LevelId): LevelMeta {
   const level = levelsOf(meta).find((entry) => entry.id === id);
   if (!level) throw new Error(`${meta.slug} has no level ${id}`);
   return level;
}

/** The limits of one level. Throws on an unknown id. */
export function scoringFor(meta: ArcadeGameMeta, id: LevelId): ScoringRules {
   return levelMetaFor(meta, id).scoring;
}

/** The largest possible points total: the sum of the levels' maxScore. */
export function maxTotal(meta: ArcadeGameMeta): number {
   return levelsOf(meta).reduce((sum, level) => sum + level.scoring.maxScore, 0);
}

const sameRules = (a: ScoringRules, b: ScoringRules): boolean =>
   (Object.keys(a) as Array<keyof ScoringRules>).length === (Object.keys(b) as Array<keyof ScoringRules>).length &&
   (Object.keys(a) as Array<keyof ScoringRules>).every((key) => a[key] === b[key]);

/**
 * Every rule a game's `meta.levels` breaks (empty = fine; a game without levels is always fine):
 * exactly 5, ids 1..5 in order, level 1's scoring equal to `meta.scoring`, one kind / unit /
 * display for all levels, a non-empty title, `clearScore` within `[1, maxScore]`.
 */
export function levelMetaProblems(meta: ArcadeGameMeta): string[] {
   const levels = meta.levels;
   if (!levels) return [];
   const problems: string[] = [];
   if (levels.length !== LEVEL_IDS.length) problems.push(`needs exactly ${LEVEL_IDS.length} levels, has ${levels.length}`);
   levels.forEach((level, index) => {
      const label = `level ${index + 1}`;
      if (level.id !== LEVEL_IDS[index]) problems.push(`${label}: id ${level.id}, expected ${LEVEL_IDS[index]}`);
      if (!level.title.trim()) problems.push(`${label}: empty title`);
      const s = level.scoring;
      if (s.kind !== meta.scoring.kind) problems.push(`${label}: kind ${s.kind}, the game is ${meta.scoring.kind}`);
      if (s.unitLabel !== meta.scoring.unitLabel) problems.push(`${label}: unitLabel differs from the game's`);
      if (s.display !== meta.scoring.display) problems.push(`${label}: display differs from the game's`);
      if (!(s.minDurationMs < s.maxDurationMs)) problems.push(`${label}: minDurationMs must be below maxDurationMs`);
      if (level.clearScore !== undefined && !(level.clearScore >= 1 && level.clearScore <= s.maxScore)) {
         problems.push(`${label}: clearScore ${level.clearScore} outside 1..${s.maxScore}`);
      }
   });
   if (levels[0] && !sameRules(levels[0].scoring, meta.scoring)) problems.push("level 1 scoring must equal meta.scoring");
   return problems;
}
