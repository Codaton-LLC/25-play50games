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
/** Expansion games the user took live (go-live batch 1, 2026-10-24). */
const GONE_LIVE = ["museum-guard", "knight-arena", "castle-defender"];

/** Menu 2 (Color Shell Ninjas): the vertical slice so far, hidden ("dev") until the user signs off. */
const MENU2 = ["sky-tower-jump"];

describe("registry for 31 games", () => {
   it("has 31 slugs, each with one meta, a unique order and a loader", () => {
      expect(ARCADE_SLUGS).toHaveLength(31);
      expect(new Set(ARCADE_SLUGS).size).toBe(31);
      expect(new Set(ARCADE_GAMES.map((g) => g.order)).size).toBe(31);
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

   it("puts the 20 new games in dev (except the ones gone live), 10 per collection, each thumbnail null or its own webp", () => {
      const fresh = ARCADE_GAMES.slice(10, 30);
      expect(fresh.filter((g) => g.status !== "dev").map((g) => g.slug).sort()).toEqual([...GONE_LIVE].sort());
      expect(fresh.every((g) => g.status === "dev" || g.status === "live")).toBe(true);
      for (const g of fresh) expect([null, `/images/3d/${g.slug}.webp`]).toContain(g.thumbnail);
      expect(fresh.filter((g) => g.collection === "adventure")).toHaveLength(10);
      expect(fresh.filter((g) => g.collection === "skill")).toHaveLength(10);
      // five builders, four games each (decision D4); ghost-vacuum, alien-farm (from Kimi) and space-repair (from Antigravity) moved to Codex (user, 2026-10-09)
      const perOwner: Record<string, number> = {};
      for (const g of fresh) perOwner[g.owner] = (perOwner[g.owner] ?? 0) + 1;
      expect(perOwner).toEqual({ claude: 4, codex: 7, antigravity: 3, cursor: 4, kimi: 2 });
   });
});

describe("Menu 2", () => {
   it("keeps its games last, in dev, in the ninjas collection, owned by Claude", () => {
      const menu2 = ARCADE_GAMES.slice(30);
      expect(menu2.map((g) => g.slug)).toEqual(MENU2);
      for (const g of menu2) {
         expect(g.status).toBe("dev");
         expect(g.collection).toBe("ninjas");
         expect(g.owner).toBe("claude");
         expect(isGameVisible(g, false)).toBe(false);
         expect(isGameVisible(g, true)).toBe(true);
      }
   });
});

describe("visibility of dev games", () => {
   it("without the preview flag shows the ten originals plus the expansion games gone live", () => {
      const shown = ARCADE_GAMES.filter((g) => ORIGINALS.includes(g.slug) || GONE_LIVE.includes(g.slug)).map((g) => g.slug);
      expect(getVisibleGames(false).map((g) => g.slug)).toEqual(shown);
      expect(isGameVisible(getGameMeta("treasure-island")!, false)).toBe(false);
      expect(isGameVisible(getGameMeta("robot-collector")!, false)).toBe(true);
      for (const slug of GONE_LIVE) expect(isGameVisible(getGameMeta(slug)!, false)).toBe(true);
      const sections = getVisibleSections(false);
      expect(sections[0].id).toBe("originals");
      expect(sections[0].games).toHaveLength(10);
      expect(sections.reduce((n, s) => n + s.games.length, 0)).toBe(shown.length);
   });

   it("with the preview flag shows all 31 in four sections", () => {
      expect(getVisibleGames(true)).toHaveLength(31);
      expect(isGameVisible(getGameMeta("treasure-island")!, true)).toBe(true);
      const sections = getVisibleSections(true);
      expect(sections.map((s) => [s.id, s.games.length])).toEqual([
         ["originals", 10],
         ["adventure", 10],
         ["skill", 10],
         ["ninjas", MENU2.length],
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
