// "More like this" on a game's lobby (docs/design/DESIGN.md §6 item 3): a few other games close to
// the one on screen. Plain data, server-safe, pure: the same game always gets the same row.
// Only "live" games are ever offered: a "soon" tile cannot be opened and a "dev" game has no page
// on production.
import type { ArcadeGameMeta } from "./types";

export const RELATED_COUNT = 4;

/**
 * How close `other` is to `game`. A shared menu section (collection) counts most, then the way the
 * game is played (control scheme), then a shared time-trial or points board, then the screen
 * orientation and the difficulty.
 */
export function relatedScore(game: ArcadeGameMeta, other: ArcadeGameMeta): number {
   let score = 0;
   if ((game.collection ?? "originals") === (other.collection ?? "originals")) score += 4;
   if (game.controls.scheme === other.controls.scheme) score += 3;
   if (game.scoring.kind === other.scoring.kind) score += game.scoring.kind === "time" ? 2 : 1;
   if (game.orientation === other.orientation) score += 1;
   score += 1 - Math.abs(game.difficulty - other.difficulty) / 2;
   return score;
}

/**
 * Up to `count` live games for the lobby of `game`, the closest first; never the game itself.
 * Ties go to the nearer game in the catalogue's order, so neighbours are not all sent to the same
 * few games.
 */
export function relatedGames(
   game: ArcadeGameMeta,
   games: readonly ArcadeGameMeta[],
   count: number = RELATED_COUNT,
): ArcadeGameMeta[] {
   return games
      .filter((other) => other.status === "live" && other.slug !== game.slug)
      .map((other) => ({ other, score: relatedScore(game, other), gap: Math.abs(other.order - game.order) }))
      .sort((a, b) => b.score - a.score || a.gap - b.gap || a.other.order - b.other.order)
      .slice(0, Math.max(0, count))
      .map((entry) => entry.other);
}
