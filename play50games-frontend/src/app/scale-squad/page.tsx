// Scale Squad teaser "/scale-squad" (the third world, Menu 2). Server component.
// Shown only with NEXT_PUBLIC_SQUAD_TEASER; otherwise a 404. Not indexed until the world opens.
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/Site/SiteHeader";
import SiteFooter from "@/components/Site/SiteFooter";
import SquadArt from "@/components/Site/SquadArt";
import { SQUAD, WORLDS } from "@/components/Site/siteData";
import ui from "@/components/Site/ui.module.css";
import { ARCADE_ENABLED, SQUAD_TEASER } from "@/arcade3d/flags";
import styles from "./page.module.css";

export const metadata: Metadata = {
   title: "Scale Squad",
   description: "Scale Squad: five pangolin heroes who roll into a ball, each with its own colour and power. Opens soon on Play50Games.",
   alternates: { canonical: "/scale-squad" },
   robots: { index: false, follow: true },
};

export default function ScaleSquadPage() {
   if (!SQUAD_TEASER) notFound();

   return (
      <div className={`p50 ${styles.page}`}>
         <SiteHeader active="squad" />

         <main className={`${ui.wrap} ${styles.main}`}>
            <section className={styles.hero} aria-labelledby="squad-title">
               <div className={styles.copy}>
                  <div className={styles.head}>
                     <span className={`${ui.plate} ${ui.plateLg}`} aria-hidden="true">
                        {WORLDS.squad.plate}
                     </span>
                     <span className={styles.soon}>Soon</span>
                  </div>
                  <h1 id="squad-title" className={styles.title}>
                     Scale Squad
                  </h1>
                  <p className={styles.lead}>{WORLDS.squad.text}</p>
                  {ARCADE_ENABLED ? (
                     <Link href="/3d" className={`${ui.btn} ${ui.btnQuiet}`}>
                        Play the 3D Arcade meanwhile
                     </Link>
                  ) : (
                     <Link href="/classic" className={`${ui.btn} ${ui.btnQuiet}`}>
                        Play Classic 50 meanwhile
                     </Link>
                  )}
               </div>
               <div className={styles.art}>
                  <SquadArt />
               </div>
            </section>

            <section aria-labelledby="squad-five">
               <div className={ui.secHead}>
                  <h2 id="squad-five" className={ui.h2}>
                     The five
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
         </main>

         <SiteFooter />
      </div>
   );
}
