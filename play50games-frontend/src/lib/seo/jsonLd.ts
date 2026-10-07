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

export function serializeJsonLd(data: unknown): string {
   // HTML parsers recognize </script> even inside a JSON string.
   return JSON.stringify(data).replace(/</g, "\\u003c");
}
