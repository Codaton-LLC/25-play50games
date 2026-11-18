// The classic game page "/games/[id]" (docs/design/DESIGN.md §12). Server component for the site
// chrome: the same header and footer as the hub. The game itself (loading, the unlock check,
// GameEngine) runs on the client in GameView. The metadata lives in layout.tsx.
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import GameView from "./GameView";
import styles from "./page.module.css";

export default function GamePage() {
   return (
      <div className={`p50 game-page ${styles.page}`}>
         {/* immersive: the bar scrolls away and phones get no tab bar, the board needs the room */}
         <SiteHeader active="classic" immersive />
         <GameView />
         <SiteFooter />
      </div>
   );
}
