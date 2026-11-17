// The game metas client code looks up (core/scores.ts, ui/BestScoreBadge) without importing registry.ts:
// the registry imports every game's meta, and many metas compute their limits from the game's rules
// modules, so importing it put all of that into the /3d grid's first-load JS. registry.ts fills this
// table when it loads (server pages, the game mount, tests); the /3d grid fills it from the server's
// compact list (ui/GameMetas.tsx). Plain data, server-safe, no React.
import type { GameScoringMeta } from "./types";

const TABLE = new Map<string, GameScoringMeta>();

/** Adds (or replaces) these games' metas. Idempotent. */
export function provideGameMetas(metas: readonly GameScoringMeta[]): void {
   for (const meta of metas) TABLE.set(meta.slug, meta);
}

/** The meta of a game that has been provided, else undefined (as registry.getGameMeta for an unknown slug). */
export function getGameMeta(slug: string): GameScoringMeta | undefined {
   return TABLE.get(slug);
}

/** The compact form the server hands the browser. */
export function scoringMetaOf(meta: GameScoringMeta): GameScoringMeta {
   const { slug, title, scoring, levels } = meta;
   return levels ? { slug, title, scoring, levels } : { slug, title, scoring };
}
