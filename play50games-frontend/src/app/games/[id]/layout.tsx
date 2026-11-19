import { Metadata } from "next";
import { classicOgImagePath } from "@/lib/seo/ogImages";
import { pageSocial } from "@/lib/seo/pageMetadata";
import { gameTypeLabel, loadGameSummary } from "./gameSummary";

export async function generateMetadata({
   params,
}: {
   params: { id: string };
}): Promise<Metadata> {
   const gameId = parseInt(params.id, 10);
   // the canonical keeps the address as asked when the id is not a number
   const path = `/games/${Number.isInteger(gameId) ? gameId : encodeURIComponent(params.id)}`;

   const game = await loadGameSummary(gameId);

   // If game not found, use fallback metadata
   if (!game) {
      // Fallback: Use generic title with game ID (template will add "| Play50Games")
      const fallbackTitle = Number.isInteger(gameId) ? `Game ${gameId}` : "Game";
      const fallbackDescription = `Play ${fallbackTitle.toLowerCase()} and challenge yourself! Complete this game to unlock more games and earn your certificate.`;

      return {
         title: fallbackTitle,
         description: fallbackDescription,
         keywords: [
            fallbackTitle.toLowerCase(),
            "browser game",
            "online game",
            "brain training",
            "cognitive game",
            "play50games",
         ],
         // an address that is not a game number is never a game; a numbered one may only be
         // unreachable for a moment, so it stays indexable
         ...(Number.isInteger(gameId) ? {} : { robots: { index: false, follow: true } }),
         ...pageSocial({
            title: fallbackTitle,
            description: fallbackDescription,
            path,
            image: classicOgImagePath(undefined),
         }),
      };
   }

   const typeLabel = gameTypeLabel(game.game_type);

   // Format: "Game Title - Category | Play50Games" (template adds "| Play50Games")
   const title = `${game.title} - ${typeLabel}`;
   // an empty description in the CMS falls back to a sentence that still names the game
   const description =
      game.description ||
      `Play ${game.title} and challenge yourself! Complete this ${typeLabel.toLowerCase()} to unlock more games and earn your certificate.`;

   return {
      title,
      description,
      keywords: [
         game.title.toLowerCase(),
         typeLabel.toLowerCase(),
         "browser game",
         "online game",
         "brain training",
         "cognitive game",
         "play50games",
      ],
      // the share card of the game's category (public/images/og/classic)
      ...pageSocial({ title, description, path, image: classicOgImagePath(game.game_type) }),
   };
}

export default function GameLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
