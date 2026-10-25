"use client";

// The game HUD, after the concept board: orbs and height on the left, the title and the level in a
// banner at the top centre with the run clock (finish time so far, orb bonus taken off) under it.
// The shell keeps Mute / Pause (top right); its own clock chip is off (index.tsx clockChip: false).
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import { STAT, runTimeMs } from "./rules";
import type { SkyLevel } from "./levels";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

export default function Hud() {
   const { config } = useLevel<SkyLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const height = useArcadeStore((s) => s.stats[STAT.height] ?? 0);
   // a tenth of a second is enough for the clock: 10 renders a second, not one per frame
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const shown = runTimeMs(tenths * 100, orbs);
   const level = config?.id ?? 1;
   return (
      <>
         <div className={styles.left} data-arcade-safe-area="">
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`Height ${height} metres`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 20 L9 8 L13 14 L16 10 L22 20 Z" fill="#7dd3fc" />
                  <path d="M9 8 L11 11.5 L9.8 12.4 L8.4 11 Z" fill="#fff" />
               </svg>
               <span className={styles.value}>{height} m</span>
            </div>
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Sky Tower Jump</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Training Sky"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
         </div>
      </>
   );
}
