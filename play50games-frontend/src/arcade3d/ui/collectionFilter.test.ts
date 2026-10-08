import { describe, expect, it } from "vitest";
import type { ArcadeCollection, ArcadeGameMeta, ArcadeSlug, ArcadeStatus } from "../types";
import {
   activeCollectionFilter,
   collectionChips,
   collectionIdOf,
   sectionsForFilter,
   sectionsWithGames,
   storedCollectionFilter,
   type CollectionInfo,
} from "./collectionFilter";

const COLLECTIONS: CollectionInfo[] = [
   { id: "originals", title: "Originals", blurb: "The first ten." },
   { id: "adventure", title: "Adventure", blurb: "Explore." },
   { id: "skill", title: "Skill", blurb: "Aim and time it." },
];

function game(slug: ArcadeSlug, order: number, status: ArcadeStatus, collection?: ArcadeCollection): ArcadeGameMeta {
   return {
      slug,
      title: slug,
      tagline: "",
      description: "",
      order,
      status,
      collection,
      difficulty: 1,
      orientation: "any",
      controls: { scheme: "joystick", keyboard: "", touch: "" },
      scoring: {
         kind: "points",
         maxScore: 1,
         minDurationMs: 1,
         maxDurationMs: 2,
         base: 0,
         maxPointsPerSec: 1,
         unitLabel: "pts",
         display: "int",
      },
      thumbnail: null,
      accent: "#7dd3fc",
      owner: "cursor",
   };
}

describe("collection filter", () => {
   const games = [
      game("treasure-island", 11, "dev", "adventure"),
      game("robot-collector", 1, "live"),
      game("luggage-rush", 13, "dev", "adventure"),
      game("mini-golf", 21, "dev", "skill"),
      game("food-catcher", 2, "soon"),
   ];

   it("treats a missing collection as Originals and drops empty sections", () => {
      expect(collectionIdOf(games[1])).toBe("originals");
      const sections = sectionsWithGames(games, COLLECTIONS);
      expect(sections.map((section) => section.id)).toEqual(["originals", "adventure", "skill"]);
      expect(sections[0].games.map((meta) => meta.slug)).toEqual(["robot-collector", "food-catcher"]);
      expect(sections[1].games.map((meta) => meta.order)).toEqual([11, 13]);
   });

   it("offers All and only the collections that have games", () => {
      const sections = sectionsWithGames(
         games.filter((meta) => meta.collection !== "skill"),
         COLLECTIONS,
      );
      expect(collectionChips(sections)).toEqual([
         { id: "all", label: "All" },
         { id: "originals", label: "Originals" },
         { id: "adventure", label: "Adventure" },
      ]);
   });

   it("filters to one collection and falls back to All when that collection is empty", () => {
      const sections = sectionsWithGames(games, COLLECTIONS);
      expect(sectionsForFilter(sections, "skill").map((section) => section.id)).toEqual(["skill"]);
      expect(activeCollectionFilter("skill", sections.filter((section) => section.id !== "skill"))).toBe("all");
      expect(sectionsForFilter(sectionsWithGames(games.filter((meta) => meta.collection !== "skill"), COLLECTIONS), "skill").map((section) => section.id)).toEqual([
         "originals",
         "adventure",
      ]);
   });

   it("reads only the four stored filter ids", () => {
      expect(storedCollectionFilter("adventure")).toBe("adventure");
      expect(storedCollectionFilter("all")).toBe("all");
      expect(storedCollectionFilter(null)).toBe("all");
      expect(storedCollectionFilter("Adventure")).toBe("all");
      expect(storedCollectionFilter("")).toBe("all");
   });
});
