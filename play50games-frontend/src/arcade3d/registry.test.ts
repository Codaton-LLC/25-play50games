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

describe("registry for 30 games", () => {
   it("has 30 slugs, each with one meta, a unique order and a loader", () => {
      expect(ARCADE_SLUGS).toHaveLength(30);
      expect(new Set(ARCADE_SLUGS).size).toBe(30);
      expect(new Set(ARCADE_GAMES.map((g) => g.order)).size).toBe(30);
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

   it("puts the 20 new games in dev, 10 per collection, with no thumbnail yet", () => {
      const fresh = ARCADE_GAMES.slice(10);
      expect(fresh.every((g) => g.status === "dev" && g.thumbnail === null)).toBe(true);
      expect(fresh.filter((g) => g.collection === "adventure")).toHaveLength(10);
      expect(fresh.filter((g) => g.collection === "skill")).toHaveLength(10);
      // five builders, four games each (decision D4)
      const perOwner = new Map<string, number>();
      for (const g of fresh) perOwner.set(g.owner, (perOwner.get(g.owner) ?? 0) + 1);
      expect([...perOwner.values()]).toEqual([4, 4, 4, 4, 4]);
   });
});

describe("visibility of dev games", () => {
   it("without the preview flag shows exactly the ten originals", () => {
      expect(getVisibleGames(false).map((g) => g.slug)).toEqual(ORIGINALS);
      expect(isGameVisible(getGameMeta("treasure-island")!, false)).toBe(false);
      expect(isGameVisible(getGameMeta("robot-collector")!, false)).toBe(true);
      const sections = getVisibleSections(false);
      expect(sections.map((s) => s.id)).toEqual(["originals"]);
      expect(sections[0].games).toHaveLength(10);
   });

   it("with the preview flag shows all 30 in three sections", () => {
      expect(getVisibleGames(true)).toHaveLength(30);
      expect(isGameVisible(getGameMeta("treasure-island")!, true)).toBe(true);
      const sections = getVisibleSections(true);
      expect(sections.map((s) => [s.id, s.games.length])).toEqual([
         ["originals", 10],
         ["adventure", 10],
         ["skill", 10],
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
