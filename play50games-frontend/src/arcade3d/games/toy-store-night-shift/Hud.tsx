"use client";

import { useLevel } from "@/arcade3d/core/level";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { GLYPHS } from "./glyphs";
import { CATEGORIES, type ToyLevel } from "./levels";
import styles from "./Hud.module.css";

/** The toy kinds of this level with their sign (colour + silhouette) and how many are left to shelve. */
export default function Hud() {
   const { config } = useLevel<ToyLevel>();
   const stats = useArcadeStore((s) => s.stats);
   const kinds = CATEGORIES.slice(0, config.categories);
   return (
      <div className={styles.legend} data-arcade-safe-area aria-label="Toys left to shelve">
         {kinds.map((cat) => {
            const g = GLYPHS[cat];
            const n = stats[`left_${cat}`];
            return (
               <div key={cat} className={`${styles.row} ${n === 0 ? styles.done : ""}`}>
                  <span className={styles.chip} style={{ background: g.color }}>
                     <svg viewBox="0 0 64 64" aria-hidden><path d={g.icon} /></svg>
                  </span>
                  <span className={styles.name}>{g.label}</span>
                  <span className={styles.count}>{n === undefined ? "-" : n}</span>
               </div>
            );
         })}
      </div>
   );
}
