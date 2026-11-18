// Menu 2 progress (00-framework.md "Shared systems"): XP, stars, no-hit badges, colour shards and
// stickers per game and level. Saved locally under `play50games_m2_progress:<user>` (guest or u<id>,
// as core/scores.ts does) through a small storage adapter; the WordPress backend comes later through
// ProgressSync. Games never touch localStorage: they call recordLevelResult (progressStore.ts).
//
// Everything here is pure: it takes and returns plain data, never throws on bad input.
import { mergeStarMask, newStarMask, starCount } from "../stars/stars";
import type { SecretKind } from "../secrets/secrets";

export const PROGRESS_VERSION = 1;

/** XP is paid only for firsts (no grinding): a new star, the first no-hit, a new secret, the first clear. */
export const XP = { clear: 50, star: 100, noHit: 50, shard: 25, sticker: 50 } as const;

export interface LevelProgress {
   /** STAR_BIT mask, every star ever earned */
   stars: number;
   noHit: boolean;
   /** times cleared */
   clears: number;
   shards: string[];
   stickers: string[];
}

export interface GameProgress {
   levels: Record<string, LevelProgress>;
   xp: number;
}

export interface ProgressData {
   v: number;
   xp: number;
   games: Record<string, GameProgress>;
   /** ms since epoch of the last change (sync uses it) */
   updatedAt: number;
}

export interface LevelResult {
   slug: string;
   level: number;
   cleared: boolean;
   /** this run's STAR_BIT mask */
   stars: number;
   noHit: boolean;
   /** secrets found this run */
   secrets: ReadonlyArray<{ id: string; kind: SecretKind }>;
}

export interface RecordSummary {
   data: ProgressData;
   xpGained: number;
   /** stars earned for the first time (mask) */
   newStars: number;
   firstClear: boolean;
   firstNoHit: boolean;
   newSecrets: string[];
}

export function emptyProgress(): ProgressData {
   return { v: PROGRESS_VERSION, xp: 0, games: {}, updatedAt: 0 };
}

export function emptyLevel(): LevelProgress {
   return { stars: 0, noHit: false, clears: 0, shards: [], stickers: [] };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const nat = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 64))] : []);

function parseLevel(raw: unknown): LevelProgress | null {
   if (!isObj(raw)) return null;
   return {
      stars: nat(raw.stars) & 7,
      noHit: raw.noHit === true,
      clears: nat(raw.clears),
      shards: ids(raw.shards),
      stickers: ids(raw.stickers),
   };
}

/** Reads stored JSON (or anything) into valid progress; unknown or broken parts are dropped. */
export function parseProgress(raw: string | null | undefined): ProgressData {
   if (!raw) return emptyProgress();
   let parsed: unknown;
   try {
      parsed = JSON.parse(raw);
   } catch {
      return emptyProgress();
   }
   if (!isObj(parsed) || !isObj(parsed.games)) return emptyProgress();
   const games: Record<string, GameProgress> = {};
   for (const [slug, g] of Object.entries(parsed.games)) {
      if (!isObj(g) || !isObj(g.levels) || !/^[a-z0-9-]+$/.test(slug)) continue;
      const levels: Record<string, LevelProgress> = {};
      for (const [lv, l] of Object.entries(g.levels)) {
         const level = parseLevel(l);
         if (level && /^[1-9]\d?$/.test(lv)) levels[lv] = level;
      }
      games[slug] = { levels, xp: nat(g.xp) };
   }
   return { v: PROGRESS_VERSION, xp: nat(parsed.xp), games, updatedAt: nat(parsed.updatedAt) };
}

export function levelOf(data: ProgressData, slug: string, level: number): LevelProgress | null {
   return data.games[slug]?.levels[String(level)] ?? null;
}

/** Applies one finished run. Returns new data (the input is not changed) and what was new. */
export function applyLevelResult(data: ProgressData, r: LevelResult, now = Date.now()): RecordSummary {
   const prevGame = data.games[r.slug] ?? { levels: {}, xp: 0 };
   const prev = prevGame.levels[String(r.level)] ?? emptyLevel();
   const stars = r.cleared ? r.stars & 7 : 0;
   const newStars = newStarMask(prev.stars, stars);
   const firstClear = r.cleared && prev.clears === 0;
   const firstNoHit = r.cleared && r.noHit && !prev.noHit;
   const shards = new Set(prev.shards);
   const stickers = new Set(prev.stickers);
   const newSecrets: string[] = [];
   let xpGained = 0;
   for (const s of r.secrets) {
      const set = s.kind === "shard" ? shards : stickers;
      if (set.has(s.id)) continue;
      set.add(s.id);
      newSecrets.push(s.id);
      xpGained += s.kind === "shard" ? XP.shard : XP.sticker;
   }
   if (firstClear) xpGained += XP.clear;
   if (firstNoHit) xpGained += XP.noHit;
   xpGained += starCount(newStars) * XP.star;
   const level: LevelProgress = {
      stars: mergeStarMask(prev.stars, stars),
      noHit: prev.noHit || (r.cleared && r.noHit),
      clears: prev.clears + (r.cleared ? 1 : 0),
      shards: [...shards],
      stickers: [...stickers],
   };
   const game: GameProgress = { levels: { ...prevGame.levels, [String(r.level)]: level }, xp: prevGame.xp + xpGained };
   const next: ProgressData = { ...data, xp: data.xp + xpGained, games: { ...data.games, [r.slug]: game }, updatedAt: now };
   return { data: next, xpGained, newStars, firstClear, firstNoHit, newSecrets };
}

/** Stars earned on one game (all levels). */
export function gameStars(data: ProgressData, slug: string): number {
   const g = data.games[slug];
   if (!g) return 0;
   let n = 0;
   for (const l of Object.values(g.levels)) n += starCount(l.stars);
   return n;
}

export function gameShards(data: ProgressData, slug: string): number {
   const g = data.games[slug];
   if (!g) return 0;
   let n = 0;
   for (const l of Object.values(g.levels)) n += l.shards.length;
   return n;
}

/** Every level 1..levelCount cleared at least once. */
export function isGameCleared(data: ProgressData, slug: string, levelCount: number): boolean {
   const g = data.games[slug];
   if (!g || levelCount < 1) return false;
   for (let lv = 1; lv <= levelCount; lv++) if ((g.levels[String(lv)]?.clears ?? 0) < 1) return false;
   return true;
}

export function hasPlayed(data: ProgressData, slug: string): boolean {
   return !!data.games[slug] && Object.keys(data.games[slug].levels).length > 0;
}

export function totals(data: ProgressData): { xp: number; stars: number; shards: number; stickers: number } {
   let stars = 0;
   let shards = 0;
   let stickers = 0;
   for (const g of Object.values(data.games)) {
      for (const l of Object.values(g.levels)) {
         stars += starCount(l.stars);
         shards += l.shards.length;
         stickers += l.stickers.length;
      }
   }
   return { xp: data.xp, stars, shards, stickers };
}

/** The XP level shown on the map: 500 XP per level, then 10 % more each level. */
export function xpLevel(xp: number): { level: number; into: number; need: number } {
   let level = 1;
   let need = 500;
   let left = Math.max(0, Math.floor(xp));
   while (left >= need) {
      left -= need;
      level += 1;
      need = Math.round(need * 1.1);
   }
   return { level, into: left, need };
}

/**
 * Merges two copies (this device and the server, later): the union of stars, badges and secrets, the
 * larger clear count. XP is recomputed from the merged levels' firsts, so merging never double-pays.
 */
export function mergeProgress(a: ProgressData, b: ProgressData): ProgressData {
   const games: Record<string, GameProgress> = {};
   const slugs = new Set([...Object.keys(a.games), ...Object.keys(b.games)]);
   let xp = 0;
   for (const slug of slugs) {
      const la = a.games[slug]?.levels ?? {};
      const lb = b.games[slug]?.levels ?? {};
      const levels: Record<string, LevelProgress> = {};
      let gameXp = 0;
      for (const key of new Set([...Object.keys(la), ...Object.keys(lb)])) {
         const x = la[key] ?? emptyLevel();
         const y = lb[key] ?? emptyLevel();
         const level: LevelProgress = {
            stars: mergeStarMask(x.stars, y.stars),
            noHit: x.noHit || y.noHit,
            clears: Math.max(x.clears, y.clears),
            shards: [...new Set([...x.shards, ...y.shards])],
            stickers: [...new Set([...x.stickers, ...y.stickers])],
         };
         levels[key] = level;
         gameXp += levelXp(level);
      }
      games[slug] = { levels, xp: gameXp };
      xp += gameXp;
   }
   return { v: PROGRESS_VERSION, xp, games, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
}

/** The XP a level's firsts are worth (what applyLevelResult paid for them). */
export function levelXp(l: LevelProgress): number {
   return (l.clears > 0 ? XP.clear : 0) + starCount(l.stars) * XP.star + (l.noHit ? XP.noHit : 0) + l.shards.length * XP.shard + l.stickers.length * XP.sticker;
}
