// 3D Arcade grid "/3d". Server component: no three.js here, the game code only loads under /3d/[slug].
import type { Metadata } from "next";
import Link from "next/link";
import HeaderWithAuth from "@/components/Header/HeaderWithAuth";
import Footer from "@/components/Footer/Footer";
import SectionTabs from "@/components/Nav/SectionTabs";
import ArcadeGrid from "@/arcade3d/ui/ArcadeGrid";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD } from "@/arcade3d/flags";
import { ARCADE_GAMES, getLiveGames } from "@/arcade3d/registry";
import { arcadeJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import ArcadeScoreSync from "./ArcadeScoreSync";
import ArcadePrivacyToggle from "./ArcadePrivacyToggle";
import styles from "./page.module.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

export const metadata: Metadata = ARCADE_ENABLED
   ? {
        alternates: { canonical: "/3d" },
     }
   : {
        title: { absolute: "3D Arcade – coming soon | Play50Games" },
        alternates: { canonical: "/3d" },
        robots: { index: false, follow: true },
     };

function ComingSoon() {
   return (
      <section className={styles.soon} aria-labelledby="arcade-title">
         <p className={styles.eyebrow}>New collection</p>
         <h1 id="arcade-title" className={styles.title}>
            3D Arcade is coming soon
         </h1>
         <p className={styles.lead}>
            Ten quick 3D mini-games for keyboard and touch are on the way. They open one at a time, and each one keeps
            its own best score and leaderboard.
         </p>
         <Link href="/classic" className={styles.cta}>
            Play Classic 50 Games
         </Link>
      </section>
   );
}

function ArcadeIntro() {
   const live = getLiveGames().length;
   const total = ARCADE_GAMES.length;
   return (
      <section className={styles.intro} aria-labelledby="arcade-title">
         <h1 id="arcade-title" className={styles.title}>
            3D Arcade
         </h1>
         <p className={styles.lead}>
            Quick 3D mini-games for keyboard and touch. No unlock chain: pick any game, beat your best score and climb
            its leaderboard.
         </p>
         <ul className={styles.facts}>
            <li>{total} mini-games</li>
            <li>Own leaderboard each</li>
            <li>{live > 0 ? `${live} playable now` : "First game coming soon"}</li>
         </ul>
      </section>
   );
}

export default function ArcadePage() {
   const jsonLd = arcadeJsonLd(SITE_URL, getLiveGames(), ARCADE_ENABLED);
   return (
      <div className={styles.page}>
         {jsonLd && (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
         )}
         <div className={styles.header}>
            <HeaderWithAuth />
         </div>

         <main className={styles.content}>
            <SectionTabs active="arcade" />
            {ARCADE_ENABLED ? (
               <>
                  <ArcadeIntro />
                  <ArcadeGrid games={ARCADE_GAMES} />
                  {ARCADE_LEADERBOARD && <ArcadePrivacyToggle />}
               </>
            ) : (
               <ComingSoon />
            )}
         </main>

         <Footer />
         {ARCADE_ENABLED && <ArcadeScoreSync />}
      </div>
   );
}
