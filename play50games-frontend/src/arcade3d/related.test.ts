// "More like this": only live games, never the game itself, the closest first, stable.
import { describe, expect, it } from "vitest";
import type { ArcadeGameMeta } from "./types";
import { ARCADE_GAMES } from "./registry";
import { RELATED_COUNT, relatedGames, relatedScore } from "./related";

const game = (patch: Omit<Partial<ArcadeGameMeta>, "slug"> & { slug: string; order: number }): ArcadeGameMeta =>
   ({
      title: patch.slug,
      status: "live",
      difficulty: 2,
      orientation: "any",
      controls: { scheme: "joystick", keyboard: "", touch: "" },
      scoring: { kind: "points" },
      ...patch,
   }) as unknown as ArcadeGameMeta;

const scheme = (name: string) => ({ scheme: name, keyboard: "", touch: "" }) as ArcadeGameMeta["controls"];

describe("relatedGames", () => {
   it("offers only live games and never the game itself, for every game in the registry", () => {
      for (const meta of ARCADE_GAMES) {
         const related = relatedGames(meta, ARCADE_GAMES);
         expect(related.every((other) => other.status === "live")).toBe(true);
         expect(related.map((other) => other.slug)).not.toContain(meta.slug);
         expect(new Set(related.map((other) => other.slug)).size).toBe(related.length);
         expect(related.length).toBeLessThanOrEqual(RELATED_COUNT);
      }
   });

   it("fills the row while enough live games exist", () => {
      const live = ARCADE_GAMES.filter((meta) => meta.status === "live");
      expect(live.length).toBeGreaterThan(RELATED_COUNT);
      for (const meta of live) expect(relatedGames(meta, ARCADE_GAMES)).toHaveLength(RELATED_COUNT);
   });

   it("leaves out soon and dev games however close they are", () => {
      const current = game({ slug: "a", order: 1, collection: "skill" });
      const games = [
         current,
         game({ slug: "dev-twin", order: 2, collection: "skill", status: "dev" }),
         game({ slug: "soon-twin", order: 3, collection: "skill", status: "soon" }),
         game({ slug: "far", order: 40, collection: "adventure", difficulty: 1, controls: scheme("steer") }),
      ];
      expect(relatedGames(current, games).map((other) => other.slug)).toEqual(["far"]);
      expect(relatedGames({ ...current, status: "dev" }, games).map((other) => other.slug)).toEqual(["far"]);
   });

   it("puts the same section and the same controls first, then the nearer game", () => {
      const current = game({ slug: "a", order: 10, collection: "adventure" });
      const sameAll = game({ slug: "same-all", order: 30, collection: "adventure" });
      const sameSection = game({ slug: "same-section", order: 11, collection: "adventure", controls: scheme("steer") });
      const sameControls = game({ slug: "same-controls", order: 12, collection: "skill" });
      const near = game({ slug: "near", order: 9, collection: "skill", controls: scheme("hop") });
      const far = game({ slug: "far", order: 50, collection: "skill", controls: scheme("hop") });
      const games = [far, near, sameControls, sameSection, sameAll, current];
      expect(relatedGames(current, games, 5).map((other) => other.slug)).toEqual([
         "same-all",
         "same-section",
         "same-controls",
         "near",
         "far",
      ]);
      expect(relatedScore(current, sameAll)).toBeGreaterThan(relatedScore(current, sameSection));
      expect(relatedGames(current, games, 2)).toHaveLength(2);
      expect(relatedGames(current, games, 0)).toEqual([]);
   });

   it("an omitted collection is Originals", () => {
      const current = game({ slug: "a", order: 1 });
      expect(relatedScore(current, game({ slug: "b", order: 2, collection: "originals" }))).toBe(
         relatedScore(current, game({ slug: "c", order: 2 })),
      );
   });

   it("does not reorder its input and returns the same row every time", () => {
      const before = ARCADE_GAMES.map((meta) => meta.slug);
      const first = relatedGames(ARCADE_GAMES[0], ARCADE_GAMES).map((meta) => meta.slug);
      expect(relatedGames(ARCADE_GAMES[0], ARCADE_GAMES).map((meta) => meta.slug)).toEqual(first);
      expect(ARCADE_GAMES.map((meta) => meta.slug)).toEqual(before);
   });
});
