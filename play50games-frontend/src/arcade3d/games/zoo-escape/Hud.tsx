"use client";

// Zoo Escape's own HUD (DOM): the opaque caught card (what happened, the 5 s penalty) and the
// stage toast. Both are transient and never cover the play area while it matters, so they are not
// marked data-arcade-safe-area (the camera fit ignores them).
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { CATCH, STATS } from "./rules";
import styles from "./Hud.module.css";

const REASONS = ["", "Spotted by a keeper!", "Caught in the searchlight!", "Found in the bush!", "Bumped into a keeper!"];
const STAGE_NAMES = ["", "The enclosure", "Stage 2: the visitor plaza", "Stage 3: the parking lot at dusk"];

export default function Hud() {
   const card = useArcadeStore((s) => s.stats[STATS.card] ?? 0);
   const catches = useArcadeStore((s) => s.stats[STATS.catches] ?? 0);
   const level = useArcadeStore((s) => s.level);
   const phase = useArcadeStore((s) => s.phase);
   const live = phase === "playing" || phase === "paused";
   return (
      <>
         {live && level >= 2 && level <= 3 && (
            <div key={level} className={styles.toast} role="status">
               {STAGE_NAMES[level]}
            </div>
         )}
         {live && card > 0 && (
            <div className={styles.card} role="alert">
               <div className={styles.cardInner}>
                  <div className={styles.bang} aria-hidden="true">!</div>
                  <div className={styles.reason}>{REASONS[card]}</div>
                  <div className={styles.sub}>
                     -{CATCH.penalty} s · back to the stage start · {CATCH.max - catches} {CATCH.max - catches === 1 ? "chance" : "chances"} left
                  </div>
               </div>
            </div>
         )}
      </>
   );
}
