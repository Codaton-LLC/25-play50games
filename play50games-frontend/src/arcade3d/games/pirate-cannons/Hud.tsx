"use client";

// The wind vane (README "Accessibility": an arrow plus a number). The Scene writes the wave's wind
// to the store stats once per wave (windDeg: the screen angle, counter-clockwise from right, up =
// out to sea; wind10: m/s² x 10), so this re-renders once per wave, never per frame.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

export default function WindHud() {
   const deg = useArcadeStore((s) => s.stats.windDeg ?? 90);
   const wind10 = useArcadeStore((s) => s.stats.wind10 ?? 0);
   const strength = (wind10 / 10).toFixed(1);
   return (
      <div className={styles.panel} data-arcade-safe-area="" role="status" aria-live="polite" aria-label={`Wind ${strength} metres per second squared`}>
         <div className={styles.pill}>
            <svg className={styles.arrow} viewBox="-12 -12 24 24" style={{ transform: `rotate(${-deg}deg)` }} aria-hidden="true">
               <path d="M -9 0 L 6 0 M 1 -6 L 8 0 L 1 6" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={styles.label}>
               <span className={styles.caption}>Wind</span>
               <span>{strength}</span>
            </span>
         </div>
      </div>
   );
}
