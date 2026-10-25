"use client";

import { useLevel } from "@/arcade3d/core/level";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { AquariumLevel } from "./levels";
import styles from "./Hud.module.css";

const ICONS = {
   scrub: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 16l8-8 4 4-8 8H4z" /><path d="M14 6l2-2 4 4-2 2" /></svg>,
   trash: <svg viewBox="0 0 24 24" aria-hidden><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" /></svg>,
   gear: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>,
};

/** The task list (scrub, trash, gear) with ticks, and the air meter. The clock and score are the shell's. */
export default function Hud() {
   const { config } = useLevel<AquariumLevel>();
   const algae = useArcadeStore((s) => s.stats.algae ?? 0);
   const trash = useArcadeStore((s) => s.stats.trash ?? 0);
   const filters = useArcadeStore((s) => s.stats.filters ?? 0);
   const air = useArcadeStore((s) => s.stats.air ?? 100);
   const tasks = useArcadeStore((s) => s.stats.tasks ?? 0);
   const total = config.algae + config.trash + config.filters;
   const width = Math.max(0, Math.min(100, air));
   const row = (icon: keyof typeof ICONS, label: string, done: number, max: number) => (
      <div className={`${styles.row} ${done >= max ? styles.done : ""}`}>
         {ICONS[icon]}
         <span>{label}</span>
         <span className={styles.count}>{done}/{max}</span>
      </div>
   );
   return (
      <div className={styles.tasks} data-arcade-safe-area>
         {row("scrub", "Scrub", algae, config.algae)}
         {row("trash", "Trash", trash, config.trash)}
         {row("gear", "Filters", filters, config.filters)}
         <div className={styles.air}>Air {width}</div>
         <div className={styles.track} aria-hidden>
            <div className={`${styles.fill} ${width < 25 ? styles.low : ""}`} style={{ width: `${width}%` }} />
         </div>
         {tasks >= total && total > 0 && <div className={styles.exit}>Go to the hatch</div>}
      </div>
   );
}
