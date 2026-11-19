// 3D Arcade catalogue "/3d". Server component: no three.js here, the game code only loads under /3d/[slug].
import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import ui from "@/components/Site/ui.module.css";
import ArcadeGrid from "@/arcade3d/ui/ArcadeGrid";
// the Menu 2 world map (preview builds only) loads as its own chunk, outside the /3d first load
import WorldMap from "@/arcade3d/menu2/worldMap/WorldMapLazy";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD, ARCADE_PREVIEW } from "@/arcade3d/flags";
import { gameCollection, getLiveGames, getVisibleGames, getVisibleSections, scoringMetas } from "@/arcade3d/registry";
import GameMetas from "@/arcade3d/ui/GameMetas";
import type { ArcadeCollection } from "@/arcade3d/types";
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
        title: { absolute: "3D Arcade: coming soon | Play50Games" },
        alternates: { canonical: "/3d" },
        robots: { index: false, follow: true },
     };

function ComingSoon() {
   const total = getVisibleGames().length;
   return (
      <section className={styles.intro} aria-labelledby="arcade-title">
         <p className={ui.label}>New collection</p>
         <h1 id="arcade-title" className={styles.title}>
            3D Arcade is coming soon
         </h1>
         <p className={styles.lead}>
            {total} quick 3D mini-games for keyboard and touch are on the way. They open one at a time, and each one keeps
            its own best score and leaderboard.
         </p>
         <Link href="/classic" className={`${ui.btn} ${ui.btnPrimary} ${styles.cta}`}>
            Play Classic 50
         </Link>
      </section>
   );
}

function ArcadeIntro() {
   const live = getLiveGames().length;
   const total = getVisibleGames().length;
   return (
      <section className={styles.intro} aria-labelledby="arcade-title">
         <div className={styles.head}>
            <span className={`${ui.plate} ${ui.plateLg}`} aria-hidden="true">
               3D
            </span>
            <h1 id="arcade-title" className={styles.title}>
               3D Arcade
            </h1>
         </div>
         <p className={styles.lead}>
            Quick 3D mini-games for keyboard and touch. No unlock chain: pick any game, beat your best score and climb
            its leaderboard.
         </p>
         <ul className={styles.facts}>
            <li>
               <b>{total}</b>games
            </li>
            <li>
               <b>{live}</b>
               {live > 0 ? "playable now" : "playable yet"}
            </li>
            <li>
               <b>1</b>leaderboard each
            </li>
         </ul>
      </section>
   );
}

/** Section copy for the collection chips on /3d. */
const COLLECTION_INFO = [
   { id: "originals", title: "Originals", blurb: "The first ten games. Each one keeps its own best score." },
   { id: "adventure", title: "Adventure", blurb: "Explore, collect and escape in little toy worlds." },
   { id: "skill", title: "Skill", blurb: "Aim, time and steer: short runs that reward a steady hand." },
   { id: "rollheroes", title: "Pangoroll Worlds", blurb: "Five pangolin heroes who roll into a ball: sky towers, caves and races." },
] as const satisfies ReadonlyArray<{ id: ArcadeCollection; title: string; blurb: string }>;

// One grid with sections and filter chips; while only one collection shows (production today: the
// originals), a plain grid without chips or headings.
function ArcadeSections() {
   const games = getVisibleGames();
   const grouped = getVisibleSections().length > 1;
   // Menu 2 (Pangoroll Worlds on the site, "rollheroes" in code) is drawn as its world map on preview builds; the other sections keep the card grid
   const heroes = games.filter((game) => gameCollection(game) === "rollheroes");
   const sectionViews = ARCADE_PREVIEW && grouped && heroes.length > 0 ? { rollheroes: <WorldMap games={heroes} preview /> } : undefined;
   return <ArcadeGrid games={games} collections={grouped ? [...COLLECTION_INFO] : undefined} sectionViews={sectionViews} />;
}

export default function ArcadePage() {
   const jsonLd = arcadeJsonLd(SITE_URL, getLiveGames(), ARCADE_ENABLED);
   return (
      <GameMetas metas={scoringMetas()}>
         <div className={`p50 ${styles.page}`}>
            {jsonLd && (
               <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
            )}
            <SiteHeader active="arcade" provideMetas={false} />

            <main className={`${ui.wrap} ${styles.content}`}>
               {ARCADE_ENABLED ? (
                  <>
                     <ArcadeIntro />
                     <ArcadeSections />
                     {ARCADE_LEADERBOARD && <ArcadePrivacyToggle />}
                  </>
               ) : (
                  <ComingSoon />
               )}
            </main>

            <SiteFooter />
            {ARCADE_ENABLED && <ArcadeScoreSync />}
         </div>
      </GameMetas>
   );
}
