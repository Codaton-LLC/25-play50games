// The classic game page "/games/[id]" (docs/design/DESIGN.md §12). Server component for the site
// chrome: the same header and footer as the hub. The game itself (loading, the unlock check,
// GameEngine) runs on the client in GameView. The metadata lives in layout.tsx.
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import { classicGameJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import { classicOgImagePath } from "@/lib/seo/ogImages";
import { SITE_URL } from "@/lib/seo/site";
import GameView from "./GameView";
import { loadGameSummary } from "./gameSummary";
import styles from "./page.module.css";

export default async function GamePage({ params }: { params: { id: string } }) {
   const gameId = parseInt(params.id, 10);
   const game = await loadGameSummary(gameId);
   // the page's h1 in the server HTML (GameView draws it visually hidden: the board keeps its layout)
   const heading = game?.title ?? (Number.isInteger(gameId) ? `Game ${gameId}` : "Game");

   return (
      <div className={`p50 game-page ${styles.page}`}>
         {game ? (
            <script
               type="application/ld+json"
               dangerouslySetInnerHTML={{
                  __html: serializeJsonLd(
                     classicGameJsonLd(SITE_URL, { ...game, image: classicOgImagePath(game.game_type) }),
                  ),
               }}
            />
         ) : null}
         {/* immersive: the bar scrolls away and phones get no tab bar, the board needs the room */}
         <SiteHeader active="classic" immersive />
         <GameView heading={heading} />
         <SiteFooter />
      </div>
   );
}
