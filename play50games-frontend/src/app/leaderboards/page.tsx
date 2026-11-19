// Leaderboards "/leaderboards": pick a live game, see its board. Server component; the board
// itself loads on the client. Exists only with the arcade and its leaderboards on (else a 404).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import ui from "@/components/Site/ui.module.css";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD } from "@/arcade3d/flags";
import { getLiveGames } from "@/arcade3d/registry";
import LeaderboardsView from "./LeaderboardsView";
import styles from "./page.module.css";
import { OG_IMAGES } from "@/lib/seo/ogImages";
import { pageSocial } from "@/lib/seo/pageMetadata";

const TITLE = "Leaderboards";
const DESCRIPTION =
   "The top scores of every 3D Arcade game on Play50Games. Each game has its own leaderboard.";

export const metadata: Metadata = {
   title: TITLE,
   description: DESCRIPTION,
   ...pageSocial({ title: TITLE, description: DESCRIPTION, path: "/leaderboards", image: OG_IMAGES.arcade }),
};

export default function LeaderboardsPage() {
   if (!(ARCADE_ENABLED && ARCADE_LEADERBOARD)) notFound();
   const games = getLiveGames();

   return (
      <div className={`p50 ${styles.page}`}>
         <SiteHeader active="leaderboards" />
         <main className={`${ui.wrap} ${styles.main}`}>
            <h1 className={styles.title}>Leaderboards</h1>
            <p className={styles.lead}>Every 3D Arcade game has its own board. Pick a game to see who leads it.</p>
            <LeaderboardsView games={games} />
         </main>
         <SiteFooter />
      </div>
   );
}
