"use client";

// Office Escape's own HUD: a short "Faster!" notice each time the corridor speeds up (every 20 s;
// the lane stripes flash amber at the same moment). The shell HUD already shows the score (1 point
// per metre), the time played and the coins.
// The live region is always mounted, like every game HUD panel, so nothing re-lays out mid-run.
// It is deliberately NOT marked data-arcade-safe-area: the notice shows for 1.6 s, inside the HUD
// row on wide screens and over the ceiling band on narrow ones, and marking it would move the
// chase camera's fit (camera.ts) on phones for a notice that is gone again in a moment.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { SPEED } from "./rules";
import styles from "./Hud.module.css";

export default function OfficeHud() {
   const stage = useArcadeStore((s) => Math.max(0, s.level - 1));
   const paused = useArcadeStore((s) => s.phase === "paused");
   return (
      <div className={styles.notice} role="status" aria-live="polite">
         {stage > 0 && (
            // keyed by the stage: every speed-up restarts the animation
            <span key={stage} className={`${styles.toast} ${paused ? styles.paused : ""}`}>
               Faster! <strong>{SPEED.start + stage} m/s</strong>
            </span>
         )}
      </div>
   );
}
