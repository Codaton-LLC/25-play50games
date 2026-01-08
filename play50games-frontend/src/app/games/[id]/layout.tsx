import { Metadata } from "next";
import { getGame } from "@/lib/api/games";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

async function fetchGame(
   gameId: number
): Promise<{ title: string; description: string; game_type: string } | null> {
   try {
      // Use the same getGame function that works in page.tsx
      // Don't pass guestId for metadata (server-side)
      const game = await getGame(gameId);

      if (!game) {
         return null;
      }

      if (!game.title) {
         return null;
      }

      return {
         title: game.title || `Game ${gameId}`,
         description:
            game.description || `Play game ${gameId} and test your skills!`,
         game_type: game.game_type || "logic",
      };
   } catch (error: any) {
      return null;
   }
}

export async function generateMetadata({
   params,
}: {
   params: { id: string };
}): Promise<Metadata> {
   const gameId = parseInt(params.id);

   // Try to fetch game data
   const game = await fetchGame(gameId);

   // If game not found, use fallback metadata
   if (!game) {
      // Fallback: Use generic title with game ID (template will add "| Play50Games")
      const fallbackTitle = `Game ${gameId}`;
      const fallbackDescription = `Play game ${gameId} and challenge yourself! Complete this game to unlock more games and earn your certificate.`;

      return {
         title: fallbackTitle,
         description: fallbackDescription,
         keywords: [
            `game ${gameId}`,
            "browser game",
            "online game",
            "brain training",
            "cognitive game",
            "play50games",
         ],
         openGraph: {
            title: `${fallbackTitle} | Play50Games`,
            description: fallbackDescription,
            url: `${SITE_URL}/games/${gameId}`,
            type: "website",
            siteName: "Play50Games",
            images: [
               {
                  url: `${SITE_URL}/images/play50games-cover.jpg`,
                  width: 1200,
                  height: 630,
                  alt: `Game ${gameId}`,
               },
            ],
         },
         twitter: {
            card: "summary_large_image",
            title: `${fallbackTitle} | Play50Games`,
            description: fallbackDescription,
            images: [`${SITE_URL}/images/play50games-cover.jpg`],
         },
         alternates: {
            canonical: `${SITE_URL}/games/${gameId}`,
         },
      };
   }

   // Map game_type to category labels
   const gameTypeLabels: Record<string, string> = {
      logic: "Logic Game",
      memory: "Memory Game",
      speed: "Speed Game",
      skill: "Skill Game",
      final: "Final Challenge",
   };

   // Get category label from game_type
   const gameTypeLabel = gameTypeLabels[game.game_type] || "Game";

   // Format: "Game Title - Category | Play50Games" (template adds "| Play50Games")
   const title = `${game.title} - ${gameTypeLabel}`;
   const description =
      game.description ||
      `Play ${
         game.title
      } and challenge yourself! Complete this ${gameTypeLabel.toLowerCase()} to unlock more games and earn your certificate.`;

   return {
      title,
      description,
      keywords: [
         game.title.toLowerCase(),
         gameTypeLabel.toLowerCase(),
         "browser game",
         "online game",
         "brain training",
         "cognitive game",
         "play50games",
      ],
      openGraph: {
         title: `${title} | Play50Games`,
         description,
         url: `${SITE_URL}/games/${gameId}`,
         type: "website",
         siteName: "Play50Games",
         images: [
            {
               url: `${SITE_URL}/images/play50games-cover.jpg`,
               width: 1200,
               height: 630,
               alt: game.title,
            },
         ],
      },
      twitter: {
         card: "summary_large_image",
         title: `${title} | Play50Games`,
         description,
         images: [`${SITE_URL}/images/play50games-cover.jpg`],
      },
      alternates: {
         canonical: `${SITE_URL}/games/${gameId}`,
      },
   };
}

export default function GameLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
