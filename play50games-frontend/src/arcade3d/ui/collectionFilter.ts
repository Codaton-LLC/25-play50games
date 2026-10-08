import type { ArcadeCollection, ArcadeGameMeta } from "../types";

export const COLLECTION_FILTERS = ["all", "originals", "adventure", "skill"] as const;

export type CollectionFilter = (typeof COLLECTION_FILTERS)[number];

export interface CollectionInfo {
   id: ArcadeCollection;
   title: string;
   blurb: string;
}

export interface CollectionChip {
   id: CollectionFilter;
   label: string;
}

export interface PopulatedCollection extends CollectionInfo {
   games: ArcadeGameMeta[];
}

/** Omitted collection on the first ten games is Originals. */
export function collectionIdOf(game: ArcadeGameMeta): ArcadeCollection {
   return game.collection ?? "originals";
}

export function storedCollectionFilter(value: string | null): CollectionFilter {
   if (value === "all" || value === "originals" || value === "adventure" || value === "skill") return value;
   return "all";
}

/** Sections in the given order, empty ones left out, games sorted by rollout order. */
export function sectionsWithGames(games: readonly ArcadeGameMeta[], collections: readonly CollectionInfo[]): PopulatedCollection[] {
   return collections
      .map((section) => ({
         ...section,
         games: games.filter((game) => collectionIdOf(game) === section.id).sort((a, b) => a.order - b.order),
      }))
      .filter((section) => section.games.length > 0);
}

/** "All" plus one chip per collection that actually has games. */
export function collectionChips(sections: readonly { id: ArcadeCollection; title: string }[]): CollectionChip[] {
   return [{ id: "all", label: "All" }, ...sections.map((section) => ({ id: section.id, label: section.title }))];
}

/** A stored filter for a collection with no games falls back to All. */
export function activeCollectionFilter(filter: CollectionFilter, sections: readonly { id: ArcadeCollection }[]): CollectionFilter {
   if (filter === "all") return "all";
   return sections.some((section) => section.id === filter) ? filter : "all";
}

export function sectionsForFilter(sections: readonly PopulatedCollection[], filter: CollectionFilter): PopulatedCollection[] {
   const active = activeCollectionFilter(filter, sections);
   if (active === "all") return [...sections];
   return sections.filter((section) => section.id === active);
}
