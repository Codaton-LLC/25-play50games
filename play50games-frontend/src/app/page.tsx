// Landing hub "/". Server component: the H1 and both collection panels are in the server HTML.
// No three.js here; the 3D Arcade code only loads under /3d/[slug].
import type { Metadata } from "next";
import HeaderWithAuth from "@/components/Header/HeaderWithAuth";
import Footer from "@/components/Footer/Footer";
import SectionTabs from "@/components/Nav/SectionTabs";
import HubHero, { type HubCta } from "@/components/Hub/HubHero";
import CollectionPanel from "@/components/Hub/CollectionPanel";
import ArcadeTeaserStrip from "@/components/Hub/ArcadeTeaserStrip";
import ClassicProgressBadge from "@/components/Hub/ClassicProgressBadge";
import { ARCADE_ENABLED } from "@/arcade3d/flags";
import { ARCADE_GAMES } from "@/arcade3d/registry";
import styles from "./page.module.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

const HUB_TITLE = "Play50Games – classic brain games and a 3D Arcade";
const HUB_DESCRIPTION =
   "Play 50 classic brain games and earn your certificate, or jump into the 3D Arcade: quick 3D mini-games that each keep their own best score. Free in your browser.";

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
      images: [
         {
            url: `${SITE_URL}/images/play50games-cover.jpg`,
            width: 1200,
            height: 630,
            alt: "Play50Games - classic brain games and a 3D Arcade",
         },
      ],
   },
   twitter: {
      card: "summary_large_image",
      title: HUB_TITLE,
      description: HUB_DESCRIPTION,
      images: [`${SITE_URL}/images/play50games-cover.jpg`],
   },
};

const ARCADE_CTA: HubCta = ARCADE_ENABLED
   ? { label: "Enter the 3D Arcade", href: "/3d" }
   : { label: "3D Arcade coming soon", href: "/3d", disabled: true };

const STEPS = [
   {
      title: "Pick a collection",
      text: ARCADE_ENABLED
         ? "Take on the full Classic 50 challenge, or jump into the 3D Arcade for a quick round."
         : "Start with the full Classic 50 challenge. The 3D Arcade opens soon for quick rounds.",
   },
   {
      title: "Play at your own pace",
      text: "Classic games unlock one after another. Arcade games are open from the start and remember your best score.",
   },
   {
      title: "Save your progress",
      text: "Log in to keep your progress on every device. Finish all 50 classic games to earn your certificate.",
   },
];

export default function HubPage() {
   return (
      <div className={styles.page}>
         <div className={styles.header}>
            <HeaderWithAuth />
         </div>

         <main>
            <HubHero
               title="Play50Games"
               subtitle="50 classic brain games. 10 new 3D arcade worlds. One place to play."
               primaryCta={{ label: "Play Classic 50 Games", href: "/classic" }}
               secondaryCta={ARCADE_CTA}
            />

            <div className={styles.content}>
               <SectionTabs active="home" />

               <div className={styles.panels}>
                  <CollectionPanel
                     id="classic"
                     title="Play Classic 50 Games"
                     description="Fifty brain games across logic, memory, speed and skill. Unlock them one by one and finish all 50 to earn your certificate."
                     href="/classic"
                     ctaLabel="Play Classic 50 Games"
                     stats={[
                        { label: "games", value: "50" },
                        { label: "categories", value: "5" },
                        { label: "certificate", value: "1" },
                     ]}
                  >
                     <ClassicProgressBadge />
                  </CollectionPanel>

                  <CollectionPanel
                     id="arcade"
                     title="3D Arcade"
                     description="Quick 3D mini-games for keyboard and touch. No unlock chain: pick any game and chase your best score."
                     href={ARCADE_ENABLED ? "/3d" : "#arcade"}
                     ctaLabel={ARCADE_ENABLED ? "Enter the 3D Arcade" : "Coming soon"}
                     stats={[
                        { label: "mini-games", value: "10" },
                        { label: "leaderboard per game", value: "1" },
                        { label: "unlocks needed", value: "0" },
                     ]}
                  >
                     {ARCADE_ENABLED ? (
                        <ArcadeTeaserStrip games={ARCADE_GAMES} />
                     ) : (
                        <p className={styles.soon}>
                           Ten 3D mini-games are on the way. They launch one at a
                           time, each with its own leaderboard.
                        </p>
                     )}
                  </CollectionPanel>
               </div>

               <section className={styles.how} aria-labelledby="how-it-works-title">
                  <h2 id="how-it-works-title" className={styles.howTitle}>
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
            </div>
         </main>

         <Footer />
      </div>
   );
}
