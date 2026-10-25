"use client";

// DOM half of the intro: the title, the level name and Skip. Render it in the shell frame,
// over the canvas, not inside the Canvas. Pointer events on this overlay are the taps that skip.
import type { ReactNode } from "react";
import styles from "./GameIntroOverlay.module.css";

export interface GameIntroOverlayProps {
   title: string;
   levelName: string;
   /** Full intro: true only in the title phase. Short intro: true the whole time. */
   showsTitle: boolean;
   onSkip: () => void;
}

export function GameIntroOverlay({ title, levelName, showsTitle, onSkip }: GameIntroOverlayProps): ReactNode {
   return (
      <div className={styles.overlay} data-arcade-intro="" role="group" aria-label="Intro">
         {showsTitle && (
            <div className={styles.titles}>
               {levelName ? <p className={styles.level}>{levelName}</p> : null}
               <h1 className={styles.title}>{title}</h1>
            </div>
         )}
         <button type="button" className={styles.skip} data-arcade-intro-skip="" onClick={onSkip}>
            Skip
         </button>
      </div>
   );
}
