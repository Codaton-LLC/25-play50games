// The world map's model, pure: each world's nodes with their state and stars, how much of its colour
// is restored, and whether it is open. Rules (00-framework.md, worldMap brief):
// - a game counts as cleared once every one of its levels was cleared (progress `clears`);
// - inside a world the games unlock in order: the first is open, each next one opens when the one
//   before it is cleared;
// - W1-W5 are open from the start; W6 opens once each of W1-W5 is at least W6_UNLOCK_FRACTION cleared;
// - a world's colour fills in by its cleared games;
// - the preview flag (unlockAll) opens every built game.
import { ALL_STARS } from "../stars/stars";
import { gameShards, gameStars, hasPlayed, isGameCleared, type ProgressData } from "../progress/progress";
import { WORLDS, type World, type WorldGame, type WorldId } from "./worlds";

/** W6 opens when each of W1-W5 has at least this fraction of its games cleared. */
export const W6_UNLOCK_FRACTION = 0.5;

/** Levels a game has when its meta says nothing (the five-level rule). */
export const DEFAULT_LEVEL_COUNT = 5;

export type NodeState = "soon" | "locked" | "new" | "unlocked" | "cleared";

export interface BuiltGame {
   levelCount: number;
}

export interface MapNode extends WorldGame {
   state: NodeState;
   stars: number;
   maxStars: number;
   shards: number;
   /** a link is shown (any state but soon / locked) */
   playable: boolean;
}

export interface MapWorld {
   world: World;
   unlocked: boolean;
   nodes: MapNode[];
   cleared: number;
   /** 0..1 cleared games: the colour fill */
   fill: number;
   stars: number;
   maxStars: number;
}

export interface MapOptions {
   /** the games that exist and are visible (registry), by slug */
   built: Readonly<Record<string, BuiltGame>>;
   /** preview builds: every built game is open */
   unlockAll?: boolean;
   worlds?: readonly World[];
}

function levelsOf(opts: MapOptions, slug: string): number {
   return opts.built[slug]?.levelCount ?? DEFAULT_LEVEL_COUNT;
}

export function clearedCount(world: World, data: ProgressData, opts: MapOptions): number {
   return world.games.filter((game) => opts.built[game.slug] && isGameCleared(data, game.slug, levelsOf(opts, game.slug))).length;
}

export function worldFraction(world: World, data: ProgressData, opts: MapOptions): number {
   return world.games.length > 0 ? clearedCount(world, data, opts) / world.games.length : 0;
}

export function isWorldUnlocked(id: WorldId, data: ProgressData, opts: MapOptions): boolean {
   if (id !== 6 || opts.unlockAll) return true;
   const worlds = opts.worlds ?? WORLDS;
   return worlds.filter((w) => w.id !== 6).every((w) => worldFraction(w, data, opts) >= W6_UNLOCK_FRACTION);
}

export function buildWorld(world: World, data: ProgressData, opts: MapOptions): MapWorld {
   const unlocked = isWorldUnlocked(world.id, data, opts);
   let prevCleared = true;
   let stars = 0;
   let maxStars = 0;
   let cleared = 0;
   const nodes = world.games.map((game): MapNode => {
      const built = !!opts.built[game.slug];
      const levels = levelsOf(opts, game.slug);
      const isCleared = built && isGameCleared(data, game.slug, levels);
      const open = built && unlocked && (prevCleared || !!opts.unlockAll);
      prevCleared = isCleared;
      const s = gameStars(data, game.slug);
      const max = levels * 3;
      stars += s;
      maxStars += max;
      if (isCleared) cleared += 1;
      let state: NodeState;
      if (!built) state = "soon";
      else if (!open) state = "locked";
      else if (isCleared) state = "cleared";
      else if (hasPlayed(data, game.slug)) state = "unlocked";
      else state = "new";
      return { ...game, state, stars: s, maxStars: max, shards: gameShards(data, game.slug), playable: state !== "soon" && state !== "locked" };
   });
   return { world, unlocked, nodes, cleared, fill: world.games.length ? cleared / world.games.length : 0, stars, maxStars };
}

export function buildMap(data: ProgressData, opts: MapOptions): MapWorld[] {
   return (opts.worlds ?? WORLDS).map((w) => buildWorld(w, data, opts));
}

/** How many more W1-W5 games to clear before W6 opens (0 = open). */
export function gamesToW6(data: ProgressData, opts: MapOptions): number {
   let need = 0;
   for (const w of (opts.worlds ?? WORLDS).filter((x) => x.id !== 6)) {
      const target = Math.ceil(w.games.length * W6_UNLOCK_FRACTION);
      need += Math.max(0, target - clearedCount(w, data, opts));
   }
   return need;
}

/** Three stars on every level. */
export function isPerfect(node: MapNode): boolean {
   return node.maxStars > 0 && node.stars >= node.maxStars;
}

export { ALL_STARS };
