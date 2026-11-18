// Art of the Pangoroll Worlds world: the group picture of the five heroes. Behind it (and whenever
// SQUAD_PICTURE is null) the five are drawn in CSS as rolled-up balls in their own colours.
// Server-safe.
import type { CSSProperties } from "react";
import { SQUAD, SQUAD_PICTURE } from "./siteData";
import styles from "./SquadArt.module.css";

export default function SquadArt() {
   return (
      <div className={styles.art} role="img" aria-label="The five heroes of Pangoroll Worlds">
         {SQUAD_PICTURE ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.picture} src={SQUAD_PICTURE} alt="" loading="lazy" />
         ) : (
            SQUAD.map((hero, index) => (
               <i
                  key={hero.name}
                  className={styles.ball}
                  style={{ "--c": hero.color, "--i": index } as CSSProperties}
                  aria-hidden="true"
               />
            ))
         )}
      </div>
   );
}
