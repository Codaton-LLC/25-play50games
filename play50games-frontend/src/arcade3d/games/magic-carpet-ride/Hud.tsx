"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { hintFor } from "./guide";
import styles from "./Hud.module.css";

const LINES = Array.from({ length: 18 }, (_v, i) => i);

/**
 * The flight's own HUD: the route's progress to the palace (bottom centre), the combo of rings in a
 * row, speed lines while a boost lasts, and, on a finish short of the quota, what was missing. The
 * shell's chips show the score, the clock, lives, rings and gems.
 */
function GameHud() {
   const phase = useArcadeStore((s) => s.phase);
   const reason = useArcadeStore((s) => s.endReason);
   const progress = useArcadeStore((s) => s.stats.progress ?? 0);
   const combo = useArcadeStore((s) => s.stats.combo ?? 0);
   const boost = useArcadeStore((s) => (s.stats.boost ?? 0) > 0);
   const need = useArcadeStore((s) => s.stats.need ?? 0);
   const flying = phase === "playing" || phase === "paused" || phase === "countdown";
   const hint = hintFor(need, boost);
   const missed = phase === "over" && reason === "lose" && progress >= 100 && need > 0;
   return (
      <>
         {flying && <HintLine text={hint.text} tone={hint.tone} />}
         {boost && phase === "playing" && (
            <div className={styles.speed} aria-hidden>
               {LINES.map((i) => (
                  <span key={i} style={{ transform: `rotate(${i * 20}deg)`, animationDelay: `${(i * 37) % 300}ms` }} />
               ))}
            </div>
         )}
         {flying && (
            <div className={styles.route} data-arcade-safe-area aria-label={`Route ${progress}%`}>
               <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${progress}%` }} />
                  <div className={styles.carpet} style={{ left: `${progress}%` }} />
               </div>
               <span className={styles.goal}>{need > 0 ? `${need} ring${need === 1 ? "" : "s"} to go` : "Palace"}</span>
            </div>
         )}
         {flying && combo >= 2 && (
            <div key={combo} className={styles.combo} aria-live="polite">
               {combo} rings in a row
            </div>
         )}
         {missed && (
            <div className={styles.miss} data-arcade-safe-area>
               {need} more ring{need === 1 ? "" : "s"} needed to clear.
            </div>
         )}
      </>
   );
}

/** The flight HUD plus the core 📷 button. On a phone the route sits under the chips, so the button stays bottom-right. */
export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <GameHud />
      </>
   );
}
