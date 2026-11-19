// Landing hub "/" (docs/design/DESIGN.md §6). Server component: the H1, the worlds and the game
// tiles are in the server HTML. No three.js here; the 3D Arcade code only loads under /3d/[slug].
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import ClassicPath from "@/components/Site/ClassicPath";
import SquadArt from "@/components/Site/SquadArt";
import { SQUAD, WORLDS } from "@/components/Site/siteData";
import ui from "@/components/Site/ui.module.css";
import HubHero from "@/components/Hub/HubHero";
import JumpBackIn from "@/components/Hub/JumpBackIn";
import HubBoards from "@/components/Hub/HubBoards";
import WorldsAccordion, { type WorldPanel } from "@/components/Hub/WorldsAccordion";
import ArcadeCardLive from "@/arcade3d/ui/ArcadeCardLive";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD, SQUAD_TEASER } from "@/arcade3d/flags";
import { getLiveGames, getVisibleGames } from "@/arcade3d/registry";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { hubJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import { OG_IMAGES, ogImage } from "@/lib/seo/ogImages";
import { SITE_URL } from "@/lib/seo/site";
import styles from "./page.module.css";


const HUB_TITLE = "Play50Games – classic brain games and a 3D Arcade";
const HUB_DESCRIPTION =
   "Play 50 classic brain games and earn your certificate, or jump into the 3D Arcade: quick 3D mini-games that each keep their own best score. Free in your browser.";
const HUB_IMAGE = ogImage(SITE_URL, OG_IMAGES.hub, "Play50Games - classic brain games and a 3D Arcade");

export const metadata: Metadata = {
   title: { absolute: HUB_TITLE },
   description: HUB_DESCRIPTION,
   alternates: {
      canonical: "/",
   },
   openGraph: {
      type: "website",
      locale: "en_US",
      url: `${SITE_URL}/`,
      siteName: "Play50Games",
      title: HUB_TITLE,
      description: HUB_DESCRIPTION,
      images: [HUB_IMAGE],
   },
   twitter: {
      card: "summary_large_image",
      title: HUB_TITLE,
      description: HUB_DESCRIPTION,
      images: [HUB_IMAGE.url],
   },
};

/** Games the hero stage prefers, after any new game (order > 10). The rest fill up by order. */
const STAGE_PICKS = ["obstacle-race", "office-escape", "robot-collector", "tower-climb"];
const STAGE_SIZE = 4;
const BENTO_SIZE = 5;
const BOARD_GAMES = 3;

function stageGames(live: ArcadeGameMeta[]): ArcadeGameMeta[] {
   const withArt = live.filter((game) => game.thumbnail);
   const fresh = withArt.filter((game) => game.order > 10).sort((a, b) => b.order - a.order);
   const picks = STAGE_PICKS.map((slug) => withArt.find((game) => game.slug === slug)).filter(
      (game): game is ArcadeGameMeta => game !== undefined,
   );
   const all = [...fresh, ...picks, ...withArt];
   return all.filter((game, index) => all.indexOf(game) === index).slice(0, STAGE_SIZE);
}

const STEPS = [
   {
      title: "Pick a world",
      text: ARCADE_ENABLED
         ? "The full Classic 50 challenge, or a quick round in the 3D Arcade."
         : "Start with the full Classic 50 challenge. The 3D Arcade opens soon.",
   },
   {
      title: "Play at your pace",
      text: "Classic games unlock one after another. Arcade games are open from the start.",
   },
   {
      title: "Save your scores",
      text: "Log in to keep your progress on every device. All 50 classic games earn your certificate.",
   },
];

function InlineArt({ src }: { src: string | null | undefined }) {
   // eslint-disable-next-line @next/next/no-img-element
   return src ? <img className={styles.h1Art} src={src} alt="" /> : null;
}

export default function HubPage() {
   const visible = ARCADE_ENABLED ? getVisibleGames() : [];
   const live = ARCADE_ENABLED ? getLiveGames() : [];
   const stage = stageGames(live);
   // newest first: the bento's large tile is the newest game
   const bento = [...visible].sort((a, b) => b.order - a.order).slice(0, BENTO_SIZE);
   const hasNew = bento.some((game) => game.order > 10);
   const artA = stage[1]?.thumbnail ?? stage[0]?.thumbnail;
   const artB = stage[2]?.thumbnail ?? stage[0]?.thumbnail;

   const copy = (
      <>
         <p className={`${ui.label} ${styles.eyebrow}`}>
            {live.length > 0 ? (
               <>
                  <i className={ui.dot} />
                  {live.length} 3D games live, free in your browser
               </>
            ) : (
               "Free in your browser"
            )}
         </p>
         <h1 className={styles.h1}>
            {!ARCADE_ENABLED ? (
               "Fifty brain games. One certificate."
            ) : SQUAD_TEASER ? (
               <>
                  Fifty brain games, <InlineArt src={artA} /> a 3D arcade <InlineArt src={artB} /> and Pangoroll Worlds.
               </>
            ) : (
               <>
                  Fifty brain games <InlineArt src={artA} /> and a 3D arcade <InlineArt src={artB} /> in one place.
               </>
            )}
         </h1>
         {artA && artB ? (
            <div className={styles.h1Row} aria-hidden="true">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={artA} alt="" />
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={artB} alt="" />
            </div>
         ) : null}
         <p className={styles.sub}>
            {ARCADE_ENABLED
               ? "Classic games with a certificate at the end, and quick 3D mini-games with their own leaderboards. Nothing to download."
               : "Fifty games across logic, memory, speed and skill. Finish them all to earn your certificate. Nothing to download."}
         </p>
      </>
   );

   const facts = (
      <ul className={styles.facts}>
         <li>
            <b>50</b>classic games
         </li>
         {visible.length > 0 ? (
            <li>
               <b>{visible.length}</b>3D games
            </li>
         ) : null}
         <li>
            <b>1</b>certificate
         </li>
      </ul>
   );

   const worlds: WorldPanel[] = [
      {
         id: "classic",
         plate: WORLDS.classic.plate,
         name: WORLDS.classic.label,
         title: WORLDS.classic.title,
         text: "Fifty brain games across logic, memory, speed and skill. Each one unlocks the next. Finish all fifty to earn your certificate.",
         stats: ["50 games", "5 categories", "1 certificate"],
         href: "/classic",
         cta: "Play Classic 50",
         art: <ClassicPath />,
      },
      {
         id: "arcade",
         plate: WORLDS.arcade.plate,
         name: WORLDS.arcade.label,
         title: WORLDS.arcade.title,
         text: ARCADE_ENABLED
            ? "Quick 3D mini-games for keyboard and touch. No unlock chain: pick any game and chase your best score."
            : "Quick 3D mini-games for keyboard and touch are on the way. They open one at a time, each with its own leaderboard.",
         stats: ARCADE_ENABLED
            ? [`${visible.length} games`, `${live.length} live now`, ...(ARCADE_LEADERBOARD ? ["1 leaderboard each"] : [])]
            : ["Opens soon"],
         href: ARCADE_ENABLED ? "/3d" : undefined,
         cta: "Enter 3D Arcade",
         soon: !ARCADE_ENABLED,
         art:
            stage.length > 0 ? (
               <div className={styles.mosaic}>
                  {stage.map((game) => (
                     // eslint-disable-next-line @next/next/no-img-element
                     <img key={game.slug} src={game.thumbnail ?? ""} alt="" loading="lazy" />
                  ))}
               </div>
            ) : (
               <div className={styles.plateArt} aria-hidden="true">
                  3D
               </div>
            ),
      },
      ...(SQUAD_TEASER
         ? [
              {
                 id: "squad",
                 plate: WORLDS.squad.plate,
                 name: WORLDS.squad.label,
                 title: WORLDS.squad.title,
                 text: WORLDS.squad.text,
                 stats: SQUAD.map((hero) => (
                    <>
                       <i className={`${ui.ring} ${styles.statRing}`} style={{ "--ring": hero.color } as CSSProperties} />
                       {hero.name}
                    </>
                 )),
                 href: "/pangoroll-worlds",
                 cta: "Meet the squad",
                 soon: true,
                 art: <SquadArt />,
              } satisfies WorldPanel,
           ]
         : []),
   ];

   return (
      <div className={`p50 ${styles.page}`}>
         <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(hubJsonLd(SITE_URL, ARCADE_ENABLED)) }}
         />
         <SiteHeader active="home" />

         <main className={styles.main}>
            <section className={ui.wrap} aria-label="Play50Games">
               <HubHero copy={copy} facts={facts} games={stage} />
            </section>

            {ARCADE_ENABLED ? <JumpBackIn games={visible} /> : null}

            <section className={ui.wrap} aria-labelledby="hub-worlds">
               <div className={ui.secHead}>
                  <h2 id="hub-worlds" className={ui.h2}>
                     {worlds.length === 3 ? "Three worlds" : "The worlds"}
                  </h2>
                  <p className={ui.secNote}>One account for all of them</p>
               </div>
               <WorldsAccordion worlds={worlds} initial={ARCADE_ENABLED ? "arcade" : "classic"} />
            </section>

            {bento.length >= 3 ? (
               <section className={ui.wrap} aria-labelledby="hub-arcade">
                  <div className={ui.secHead}>
                     <h2 id="hub-arcade" className={ui.h2}>
                        {hasNew ? "New in the arcade" : "In the arcade"}
                     </h2>
                     <Link href="/3d" className={styles.more}>
                        All {visible.length} games
                     </Link>
                  </div>
                  <ul className={styles.bento}>
                     {bento.map((game, index) => (
                        <li key={game.slug} className={index === 0 ? styles.bentoXl : styles.bentoItem}>
                           <ArcadeCardLive meta={game} size={index === 0 ? "xl" : "md"} />
                        </li>
                     ))}
                  </ul>
               </section>
            ) : null}

            {ARCADE_ENABLED && ARCADE_LEADERBOARD && live.length > 0 ? (
               <HubBoards games={live.slice(0, BOARD_GAMES)} />
            ) : null}

            <section className={ui.wrap} aria-labelledby="hub-how">
               <h2 id="hub-how" className={ui.srOnly}>
                  How it works
               </h2>
               <ol className={styles.steps}>
                  {STEPS.map((step, index) => (
                     <li key={step.title} className={styles.step}>
                        <span className={styles.stepNumber} aria-hidden="true">
                           {index + 1}
                        </span>
                        <h3 className={styles.stepTitle}>{step.title}</h3>
                        <p className={styles.stepText}>{step.text}</p>
                     </li>
                  ))}
               </ol>
            </section>
         </main>

         <SiteFooter />
      </div>
   );
}
