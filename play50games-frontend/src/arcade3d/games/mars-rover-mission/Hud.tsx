"use client";

// The mission card: what to do now (the objective list with a tick per step, the distance to the next
// target), the action's progress while the rover works, a low-battery warning and short toasts for what
// just happened. The shell HUD keeps score, time, lives and the counter / battery chips. The card is a
// fixed box marked data-arcade-safe-area so its text changes never move anything else.
import { useEffect, useState } from "react";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { useLevel } from "@/arcade3d/core/level";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS, MISSION_WORDS, type MarsLevel } from "./levels";
import { MISSION_COLOR } from "./looks";
import styles from "./Hud.module.css";

/** stats.goal: what the guide points to */
export const GOAL = { site: 0, base: 1, charger: 2 } as const;
/** stats.toast codes (stats.toastN counts them, so the same toast can show twice) */
export const TOAST = { done: 1, perfect: 2, fell: 3, rock: 4, boulder: 5, full: 6, allDone: 7, delivered: 8 } as const;

function toastText(code: number, level: MarsLevel): string {
   const w = MISSION_WORDS[level.mission];
   switch (code) {
      case TOAST.done:
         return `${w.done}!`;
      case TOAST.perfect:
         return `${w.done}! Perfect stop +60`;
      case TOAST.fell:
         return "Fell into a crevasse!";
      case TOAST.rock:
         return "Crash! Slow down near rocks";
      case TOAST.boulder:
         return "Hit by a sliding rock!";
      case TOAST.full:
         return "Battery full";
      case TOAST.allDone:
         return "All done! Drive back to the lander";
      case TOAST.delivered:
         return level.mission === "crystal" ? "Samples delivered!" : "Mission complete!";
      default:
         return "";
   }
}

function GameHud() {
   const { config } = useLevel<MarsLevel>();
   const level = config ?? LEVELS[1];
   const words = MISSION_WORDS[level.mission];
   const done = useArcadeStore((s) => s.stats.samples ?? 0);
   const battery = useArcadeStore((s) => s.stats.battery ?? 100);
   const dist = useArcadeStore((s) => s.stats.dist ?? 0);
   const goal = useArcadeStore((s) => s.stats.goal ?? GOAL.site);
   const work = useArcadeStore((s) => s.stats.work ?? 0);
   const toast = useArcadeStore((s) => s.stats.toast ?? 0);
   const toastN = useArcadeStore((s) => s.stats.toastN ?? 0);
   const [shown, setShown] = useState<{ code: number; n: number } | null>(null);
   useEffect(() => {
      if (!toastN || !toast) return;
      setShown({ code: toast, n: toastN });
      const t = setTimeout(() => setShown(null), 1900);
      return () => clearTimeout(t);
   }, [toast, toastN]);

   const allDone = done >= level.sites;
   const low = battery < 30;
   const color = MISSION_COLOR[level.mission];
   const delivering = level.mission === "crystal" ? "Bring the samples to the lander" : "Drive back to the lander";

   return (
      <>
         <div className={styles.card} data-arcade-safe-area="" role="status" aria-live="polite" style={{ ["--mission" as string]: color }}>
            <div className={styles.title}>Mission</div>
            <div className={`${styles.row} ${allDone ? styles.rowDone : styles.rowNow}`}>
               <span className={styles.tick} aria-hidden="true">{allDone ? "✓" : ""}</span>
               <span className={styles.text}>
                  {words.verb} {level.sites} {level.sites === 1 ? words.one : `${words.one}s`}
               </span>
               <span className={styles.count}>
                  {done}/{level.sites}
               </span>
            </div>
            <div className={`${styles.row} ${allDone ? styles.rowNow : styles.rowLater}`}>
               <span className={styles.tick} aria-hidden="true" />
               <span className={styles.text}>{delivering}</span>
            </div>
            <div className={styles.next}>
               {work > 0 ? (
                  <span className={styles.working}>
                     {words.doing}… <span className={styles.bar}><span style={{ width: `${Math.min(100, work)}%` }} /></span>
                  </span>
               ) : goal === GOAL.charger ? (
                  <span className={styles.charge}>Charge pad · {dist} m</span>
               ) : goal === GOAL.base ? (
                  <span>Lander · {dist} m</span>
               ) : (
                  <span>
                     Next {words.one} · {dist} m
                  </span>
               )}
            </div>
         </div>
         {low && (
            <div className={styles.low} role="alert">
               Low battery! Stop on a green charge pad
            </div>
         )}
         {shown && (
            <div key={shown.n} className={styles.toast}>
               {toastText(shown.code, level)}
            </div>
         )}
      </>
   );
}

/** The mission card plus the core 📷 camera-view button. The card is top-left, so the button stays bottom-right. */
export default function MarsHud() {
   return (
      <>
         <CameraViewButton />
         <GameHud />
      </>
   );
}
