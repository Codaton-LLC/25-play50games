import type { ArcadeGameMeta } from "@/arcade3d/types";

// Explicit inputs keep these builders pure and safe to use in server components.
export function hubJsonLd(siteUrl: string, arcadeEnabled: boolean) {
   const collections = [{ name: "Classic 50 Games", path: "/classic" }];
   if (arcadeEnabled) collections.push({ name: "3D Arcade", path: "/3d" });

   return [
      {
         "@context": "https://schema.org",
         "@type": "WebSite",
         name: "Play50Games",
         url: new URL("/", siteUrl).href,
      },
      {
         "@context": "https://schema.org",
         "@type": "ItemList",
         numberOfItems: collections.length,
         itemListElement: collections.map((collection, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
               "@type": "CollectionPage",
               name: collection.name,
               url: new URL(collection.path, siteUrl).href,
            },
         })),
      },
   ];
}

function videoGame(siteUrl: string, game: ArcadeGameMeta) {
   return {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: game.title,
      description: game.description,
      url: new URL(`/3d/${game.slug}`, siteUrl).href,
      ...(game.thumbnail ? { image: new URL(game.thumbnail, siteUrl).href } : {}),
      genre: "Arcade",
      gamePlatform: "Web browser",
      applicationCategory: "Game",
      operatingSystem: "Any",
      isAccessibleForFree: true,
   };
}

export function arcadeJsonLd(siteUrl: string, games: readonly ArcadeGameMeta[], arcadeEnabled: boolean) {
   if (!arcadeEnabled) return null;
   const live = games.filter((game) => game.status === "live");
   return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      numberOfItems: live.length,
      itemListElement: live.map((game, index) => ({
         "@type": "ListItem",
         position: index + 1,
         item: videoGame(siteUrl, game),
      })),
   };
}

export function gameJsonLd(siteUrl: string, game: ArcadeGameMeta | undefined, arcadeEnabled: boolean) {
   if (!arcadeEnabled || game?.status !== "live") return null;
   return videoGame(siteUrl, game);
}

/** The site's publisher, on every page (root layout). */
export function organizationJsonLd(siteUrl: string) {
   return {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Play50Games",
      url: new URL("/", siteUrl).href,
      logo: new URL("/images/logo/play50games.png", siteUrl).href,
      email: "support@play50.games",
   };
}

/** A breadcrumb trail; each crumb is a name and a site path, in order from the hub down. */
export function breadcrumbJsonLd(siteUrl: string, crumbs: readonly { name: string; path: string }[]) {
   return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
         "@type": "ListItem",
         position: index + 1,
         name: crumb.name,
         item: new URL(crumb.path, siteUrl).href,
      })),
   };
}

const CLASSIC_GENRES: Record<string, string> = {
   logic: "Logic",
   memory: "Memory",
   speed: "Speed",
   skill: "Skill",
   final: "Puzzle",
};

export interface ClassicGameLdInput {
   id: number;
   title: string;
   /** left out of the JSON-LD when empty */
   description?: string;
   game_type?: string;
   /** the game's share card, a site path */
   image?: string;
}

/** One classic game page: the game itself and its trail Home > Classic 50 > game. */
export function classicGameJsonLd(siteUrl: string, game: ClassicGameLdInput) {
   const path = `/games/${game.id}`;
   return [
      {
         "@context": "https://schema.org",
         "@type": "VideoGame",
         name: game.title,
         ...(game.description ? { description: game.description } : {}),
         url: new URL(path, siteUrl).href,
         ...(game.image ? { image: new URL(game.image, siteUrl).href } : {}),
         genre: CLASSIC_GENRES[game.game_type ?? ""] ?? "Puzzle",
         gamePlatform: "Web browser",
         applicationCategory: "Game",
         operatingSystem: "Any",
         isAccessibleForFree: true,
      },
      breadcrumbJsonLd(siteUrl, [
         { name: "Play50Games", path: "/" },
         { name: "Classic 50", path: "/classic" },
         { name: game.title, path },
      ]),
   ];
}

export function serializeJsonLd(data: unknown): string {
   // HTML parsers recognize </script> even inside a JSON string.
   return JSON.stringify(data).replace(/</g, "\\u003c");
}
