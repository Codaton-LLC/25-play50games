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
/** Menu 1 games 31-50 (docs/menu1-new/specs-31-40.md, specs-41-50.md), all "dev" until each one is built and taken live. */
const MENU1_NEW = ARCADE_SLUGS.slice(30, 50);

/** Menu 2 (Color Roll Heroes): the vertical slice so far, after the 50 Menu 1 games, hidden ("dev") until the user signs off. */
/** Owners other than Cursor in the Menu 2 slice. */
const OWNER: Record<string, string> = { "sky-tower-jump": "claude", "plate-surf": "claude", "zipline-rush": "codex", "ring-jump-challenge": "claude", "wind-tunnel-escape": "claude", "roll-cannon-jump": "claude", "robot-factory-run": "codex" };
const MENU2 = ["sky-tower-jump", "rooftop-roll-climb", "flooded-ruins-escape", "lava-pillar-jump", "cloud-hopper", "plate-surf", "zipline-rush", "ring-jump-challenge", "wind-tunnel-escape", "roll-cannon-jump", "robot-factory-run"];

describe("registry for 50 Menu 1 games plus Menu 2", () => {
   it("has 50 Menu 1 slugs plus the Menu 2 ones, each with one meta, a unique order and a loader", () => {
      expect(ARCADE_SLUGS).toHaveLength(50 + MENU2.length);
      expect(ARCADE_SLUGS.slice(50)).toEqual(MENU2);
      expect(new Set(ARCADE_SLUGS).size).toBe(50 + MENU2.length);
      expect(new Set(ARCADE_GAMES.map((g) => g.order)).size).toBe(50 + MENU2.length);
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

   it("puts the 20 expansion games in dev (except the ones gone live), 10 per collection, each thumbnail null or its own webp", () => {
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

   it("adds Menu 1 games 31-50 in plan order, all dev, 10 per collection, five per builder", () => {
      const fresh = ARCADE_GAMES.slice(30, 50);
      expect(fresh.map((g) => g.slug)).toEqual(MENU1_NEW);
      expect(fresh.map((g) => g.order)).toEqual(MENU1_NEW.map((_s, i) => 31 + i));
      expect(MENU1_NEW[0]).toBe("firefighter-rescue");
      expect(MENU1_NEW[19]).toBe("postman-3d");
      expect(fresh.every((g) => g.status === "dev")).toBe(true);
      for (const g of fresh) expect([null, `/images/3d/${g.slug}.webp`]).toContain(g.thumbnail);
      expect(fresh.filter((g) => g.collection === "adventure")).toHaveLength(10);
      expect(fresh.filter((g) => g.collection === "skill")).toHaveLength(10);
      // owner table in docs/menu1-new/specs-41-50.md (2026-10-25); Codex builds none of these
      const perOwner: Record<string, number> = {};
      for (const g of fresh) perOwner[g.owner] = (perOwner[g.owner] ?? 0) + 1;
      expect(perOwner).toEqual({ cursor: 5, antigravity: 5, claude: 5, kimi: 5 });
   });
});

describe("Menu 2", () => {
   it("keeps its games last, in dev, in the rollheroes collection", () => {
      const menu2 = ARCADE_GAMES.slice(50);
      expect(menu2.map((g) => g.slug)).toEqual(MENU2);
      expect(menu2.map((g) => g.order)).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 65]);
      expect(menu2.map((g) => g.owner)).toEqual(["claude", "cursor", "cursor", "cursor", "cursor", "claude", "codex", "claude", "claude", "claude", "codex"]);
      for (const g of menu2) {
         expect(g.status).toBe("dev");
         expect(g.collection).toBe("rollheroes");
         expect(g.owner).toBe(OWNER[g.slug] ?? "cursor");
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
      for (const slug of MENU1_NEW) expect(isGameVisible(getGameMeta(slug)!, false), slug).toBe(false);
      const sections = getVisibleSections(false);
      expect(sections[0].id).toBe("originals");
      expect(sections[0].games).toHaveLength(10);
      expect(sections.reduce((n, s) => n + s.games.length, 0)).toBe(shown.length);
   });

   it("with the preview flag shows all 50 Menu 1 games plus Menu 2 in four sections", () => {
      expect(getVisibleGames(true)).toHaveLength(50 + MENU2.length);
      expect(isGameVisible(getGameMeta("treasure-island")!, true)).toBe(true);
      expect(isGameVisible(getGameMeta("firefighter-rescue")!, true)).toBe(true);
      const sections = getVisibleSections(true);
      expect(sections.map((s) => [s.id, s.games.length])).toEqual([
         ["originals", 10],
         ["adventure", 20],
         ["skill", 20],
         ["rollheroes", MENU2.length],
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
