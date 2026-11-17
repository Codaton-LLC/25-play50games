import { describe, expect, it } from "vitest";
import {
   ARCADE_GAMES,
   gameCollection,
   getGameMeta,
   getVisibleGames,
   getVisibleSections,
   isGameVisible,
} from "./registry";
import { GAME_LOADERS } from "./loaders";
import { ARCADE_SLUGS } from "./types";
import { REUSED_ASSETS } from "./core/sharedAssets";
import { hasModel } from "./core/modelManifest";

const ORIGINALS = ARCADE_SLUGS.slice(0, 10);
/** Menu 1 games 31-50 (docs/menu1-new/specs-31-40.md, specs-41-50.md). Every Menu 1 game is live (user, 2026-11-17: "all of Menu 1"). */
const MENU1_NEW = ARCADE_SLUGS.slice(30);

describe("registry for 50 games", () => {
   it("has 50 slugs, each with one meta, a unique order and a loader", () => {
      expect(ARCADE_SLUGS).toHaveLength(50);
      expect(new Set(ARCADE_SLUGS).size).toBe(50);
      expect(new Set(ARCADE_GAMES.map((g) => g.order)).size).toBe(50);
      expect(Object.keys(GAME_LOADERS).sort()).toEqual([...ARCADE_SLUGS].sort());
      for (const slug of ARCADE_SLUGS) expect(getGameMeta(slug)?.slug).toBe(slug);
   });

   it("keeps the ten originals first, untouched, in the originals collection", () => {
      expect(ARCADE_GAMES.slice(0, 10).map((g) => g.slug)).toEqual(ORIGINALS);
      for (const game of ARCADE_GAMES.slice(0, 10)) {
         expect(game.status).not.toBe("dev");
         expect(game.collection).toBeUndefined();
         expect(gameCollection(game)).toBe("originals");
      }
   });

   it("has the 20 expansion games live, 10 per collection, each thumbnail null or its own webp", () => {
      const fresh = ARCADE_GAMES.slice(10, 30);
      expect(fresh.filter((g) => g.status !== "live").map((g) => g.slug)).toEqual([]);
      for (const g of fresh) expect([null, `/images/3d/${g.slug}.webp`]).toContain(g.thumbnail);
      expect(fresh.filter((g) => g.collection === "adventure")).toHaveLength(10);
      expect(fresh.filter((g) => g.collection === "skill")).toHaveLength(10);
      // five builders, four games each (decision D4); ghost-vacuum, alien-farm (from Kimi) and space-repair (from Antigravity) moved to Codex (user, 2026-10-09)
      const perOwner: Record<string, number> = {};
      for (const g of fresh) perOwner[g.owner] = (perOwner[g.owner] ?? 0) + 1;
      expect(perOwner).toEqual({ claude: 4, codex: 7, antigravity: 3, cursor: 4, kimi: 2 });
   });

   it("adds Menu 1 games 31-50 in plan order, all live, 10 per collection, five per builder", () => {
      const fresh = ARCADE_GAMES.slice(30);
      expect(fresh.map((g) => g.slug)).toEqual(MENU1_NEW);
      expect(fresh.map((g) => g.order)).toEqual(MENU1_NEW.map((_s, i) => 31 + i));
      expect(MENU1_NEW[0]).toBe("firefighter-rescue");
      expect(MENU1_NEW[19]).toBe("postman-3d");
      expect(fresh.filter((g) => g.status !== "live").map((g) => g.slug)).toEqual([]);
      for (const g of fresh) expect([null, `/images/3d/${g.slug}.webp`]).toContain(g.thumbnail);
      expect(fresh.filter((g) => g.collection === "adventure")).toHaveLength(10);
      expect(fresh.filter((g) => g.collection === "skill")).toHaveLength(10);
      // owner table in docs/menu1-new/specs-41-50.md (2026-10-25); Codex builds none of these
      const perOwner: Record<string, number> = {};
      for (const g of fresh) perOwner[g.owner] = (perOwner[g.owner] ?? 0) + 1;
      expect(perOwner).toEqual({ cursor: 5, antigravity: 5, claude: 5, kimi: 5 });
   });
});

describe("visibility of dev games", () => {
   it("without the preview flag shows all 50 Menu 1 games (every one is live) in three sections", () => {
      expect(getVisibleGames(false).map((g) => g.slug)).toEqual(ARCADE_GAMES.map((g) => g.slug));
      expect(isGameVisible(getGameMeta("treasure-island")!, false)).toBe(true);
      expect(isGameVisible(getGameMeta("robot-collector")!, false)).toBe(true);
      for (const slug of MENU1_NEW) expect(isGameVisible(getGameMeta(slug)!, false), slug).toBe(true);
      const sections = getVisibleSections(false);
      expect(sections.map((s) => [s.id, s.games.length])).toEqual([
         ["originals", 10],
         ["adventure", 20],
         ["skill", 20],
      ]);
   });

   it("with the preview flag shows all 50 in three sections", () => {
      expect(getVisibleGames(true)).toHaveLength(50);
      expect(isGameVisible(getGameMeta("treasure-island")!, true)).toBe(true);
      expect(isGameVisible(getGameMeta("firefighter-rescue")!, true)).toBe(true);
      const sections = getVisibleSections(true);
      expect(sections.map((s) => [s.id, s.games.length])).toEqual([
         ["originals", 10],
         ["adventure", 20],
         ["skill", 20],
      ]);
   });
});

describe("REUSED_ASSETS", () => {
   it("points every alias at a GLB that exists (core/modelManifest.ts)", () => {
      for (const [id, asset] of Object.entries(REUSED_ASSETS)) {
         expect(asset.id).toBe(id);
         expect(hasModel(asset.url), asset.url).toBe(true);
      }
   });
});
