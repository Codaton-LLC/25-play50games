// The player card "/progress" (docs/design/DESIGN.md §6 item 7). Server component for the site
// chrome and the slim list of arcade games; the card itself (classic progress, local arcade
// scores) loads on the client in PlayerCard. The metadata lives in layout.tsx.
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import { isPlayable, toSiteGame } from "@/components/Site/siteData";
import ui from "@/components/Site/ui.module.css";
import { ARCADE_ENABLED } from "@/arcade3d/flags";
import { getVisibleGames } from "@/arcade3d/registry";
import ArcadeScoreSync from "@/app/3d/ArcadeScoreSync";
import PlayerCard from "./PlayerCard";
import styles from "./page.module.css";

export default function ProgressPage() {
   const games = ARCADE_ENABLED ? getVisibleGames().map(toSiteGame).filter(isPlayable) : [];

   return (
      <div className={`p50 ${styles.page}`}>
         {/* the header hands the browser the games' scoring metas the card reads (GameMetas) */}
         <SiteHeader active="other" />
         <main className={`${ui.wrap} ${styles.main}`}>
            <PlayerCard games={games} />
         </main>
         <SiteFooter />
         {ARCADE_ENABLED && <ArcadeScoreSync />}
      </div>
   );
}
