// Pangoroll Worlds "/pangoroll-worlds": the third world (Menu 2, the "rollheroes" collection in code).
// Server component: no three.js here. Lists its games with the /3d card grid (the game pages stay at
// /3d/[slug], so links and leaderboards never move) and the five heroes with their powers.
// Shown whenever the arcade is on, like the 3D Arcade; a 404 while it is off.
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import SquadArt from "@/components/Site/SquadArt";
import { SQUAD, WORLDS } from "@/components/Site/siteData";
import ui from "@/components/Site/ui.module.css";
import ArcadeGrid from "@/arcade3d/ui/ArcadeGrid";
import GameMetas from "@/arcade3d/ui/GameMetas";
// the Menu 2 world map (preview builds only) loads as its own chunk, outside the first load
import WorldMap from "@/arcade3d/menu2/worldMap/WorldMapLazy";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD, ARCADE_PREVIEW } from "@/arcade3d/flags";
import { getWorldGames, scoringMetas } from "@/arcade3d/registry";
import { arcadeJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import { OG_IMAGES } from "@/lib/seo/ogImages";
import { pageSocial } from "@/lib/seo/pageMetadata";
import { SITE_URL } from "@/lib/seo/site";
import ArcadeScoreSync from "@/app/3d/ArcadeScoreSync";
import ArcadePrivacyToggle from "@/app/3d/ArcadePrivacyToggle";
import styles from "./page.module.css";

const TITLE = "Pangoroll Worlds";
const DESCRIPTION =
   "Pangoroll Worlds: fifty free 3D roll-and-jump games in your browser. Five pangolin heroes roll into a ball, each with its own power: Dash, Double Jump, Shield, Coin Magnet and Phase.";

export const metadata: Metadata = ARCADE_ENABLED
   ? {
        title: TITLE,
        description: DESCRIPTION,
        ...pageSocial({ title: TITLE, description: DESCRIPTION, path: "/pangoroll-worlds", image: OG_IMAGES.arcade }),
     }
   : { title: TITLE, robots: { index: false, follow: true } };

export default function PangorollWorldsPage() {
   if (!ARCADE_ENABLED) notFound();

   const games = getWorldGames("squad");
   const live = games.filter((game) => game.status === "live").length;
   const jsonLd = arcadeJsonLd(SITE_URL, games, ARCADE_ENABLED);

   return (
      <GameMetas metas={scoringMetas()}>
         <div className={`p50 ${styles.page}`}>
            {jsonLd && (
               <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
            )}
            <SiteHeader active="squad" provideMetas={false} />

            <main className={`${ui.wrap} ${styles.main}`}>
               <section className={styles.hero} aria-labelledby="squad-title">
                  <div className={styles.copy}>
                     <span className={`${ui.plate} ${ui.plateLg}`} aria-hidden="true">
                        {WORLDS.squad.plate}
                     </span>
                     <h1 id="squad-title" className={styles.title}>
                        Pangoroll Worlds
                     </h1>
                     <p className={styles.lead}>{WORLDS.squad.text}</p>
                     <ul className={styles.facts}>
                        <li>
                           <b>{games.length}</b>games
                        </li>
                        <li>
                           <b>{live}</b>
                           {live > 0 ? "playable now" : "playable yet"}
                        </li>
                        <li>
                           <b>{SQUAD.length}</b>heroes
                        </li>
                     </ul>
                     <a href="#squad-games" className={`${ui.btn} ${ui.btnPrimary}`}>
                        Play Pangoroll Worlds
                     </a>
                  </div>
                  <div className={styles.art}>
                     <SquadArt />
                  </div>
               </section>

               <section aria-labelledby="squad-five">
                  <div className={ui.secHead}>
                     <h2 id="squad-five" className={ui.h2}>
                        The five heroes
                     </h2>
                     <p className={ui.secNote}>One hero, one colour, one power</p>
                  </div>
                  <ol className={styles.heroes}>
                     {SQUAD.map((hero) => (
                        <li key={hero.name} className={styles.heroRow}>
                           <i className={ui.ring} style={{ "--ring": hero.color } as CSSProperties} aria-hidden="true" />
                           <span className={styles.heroName}>{hero.name}</span>
                           <span className={styles.power}>{hero.ability}</span>
                        </li>
                     ))}
                  </ol>
               </section>

               {ARCADE_PREVIEW && games.length > 0 ? (
                  <section aria-labelledby="squad-map">
                     <div className={ui.secHead}>
                        <h2 id="squad-map" className={ui.h2}>
                           World map
                        </h2>
                        <p className={ui.secNote}>Preview builds only</p>
                     </div>
                     <WorldMap games={games} preview />
                  </section>
               ) : null}

               <section id="squad-games" className={styles.games} aria-labelledby="squad-games-title">
                  <div className={ui.secHead}>
                     <h2 id="squad-games-title" className={ui.h2}>
                        All {games.length} games
                     </h2>
                     <p className={ui.secNote}>Pick any game and beat your best score</p>
                  </div>
                  <ArcadeGrid games={games} />
                  {ARCADE_LEADERBOARD && <ArcadePrivacyToggle />}
               </section>
            </main>

            <SiteFooter />
            <ArcadeScoreSync />
         </div>
      </GameMetas>
   );
}
