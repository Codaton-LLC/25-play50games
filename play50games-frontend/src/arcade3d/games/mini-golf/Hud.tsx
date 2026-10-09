"use client";

// The game's HUD panel (README "Accessibility"): the power as a bar and a percent (polled from the
// Scene's HUD_FEED on each animation frame, no React render per frame) and a 6-cell scorecard from
// the store's hole stats; from 9:00 a "Time left" pill. The shell HUD shows Hole, Par and Strokes.
import { useEffect, useRef } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { PARS } from "./course";
import { HUD_FEED } from "./hudFeed";
import styles from "./Hud.module.css";

function Card() {
   const stats = useArcadeStore((s) => s.stats);
   const hole = stats.hole ?? 1;
   return (
      <div className={styles.card} aria-label="Scorecard">
         {PARS.map((par, i) => {
            const strokes = stats[`h${i + 1}`];
            const tone = strokes === undefined ? "" : strokes < par ? styles.under : strokes > par ? styles.over : "";
            return (
               <span key={i} className={`${styles.cell} ${i + 1 === hole && strokes === undefined ? styles.current : ""}`} aria-label={`Hole ${i + 1}, par ${par}${strokes !== undefined ? `, ${strokes} strokes` : ""}`}>
                  <small>{i + 1}</small>
                  <span className={tone}>{strokes ?? "·"}</span>
               </span>
            );
         })}
      </div>
   );
}

export default function MiniGolfHud() {
   const fill = useRef<HTMLSpanElement>(null);
   const value = useRef<HTMLSpanElement>(null);
   const timeLeft = useArcadeStore((s) => s.stats.timeLeft);
   useEffect(() => {
      let raf = 0;
      let last = -1;
      const poll = () => {
         const p = Math.round(HUD_FEED.power * 100);
         if (p !== last && fill.current && value.current) {
            fill.current.style.transform = `scaleX(${p / 100})`;
            value.current.textContent = `${p}%`;
            last = p;
         }
         raf = requestAnimationFrame(poll);
      };
      raf = requestAnimationFrame(poll);
      return () => cancelAnimationFrame(raf);
   }, []);
   return (
      <>
         <div className={styles.panel} data-arcade-safe-area="">
            <span className={styles.power} role="status" aria-label="Putt power">
               <span className={styles.caption}>Power</span>
               <span className={styles.bar}>
                  <span ref={fill} className={styles.fill} />
               </span>
               <span ref={value} className={styles.value}>50%</span>
            </span>
            <Card />
         </div>
         {timeLeft !== undefined && (
            <div className={styles.clock} role="timer" aria-live="polite">
               Time left {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
         )}
      </>
   );
}
