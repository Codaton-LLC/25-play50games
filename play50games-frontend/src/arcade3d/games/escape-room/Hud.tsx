"use client";

// Key / Book / Battery, or one short message, in a single fixed panel. The shell HUD
// already shows the clock and Found n/3. This panel is the safe-area checklist.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

const HINTS = ["", "Find all three", "Empty", "Opening", "Taking", "Unlocking"];

export default function Checklist() {
   const mask = useArcadeStore((s) => s.stats.mask ?? 0);
   const hint = useArcadeStore((s) => s.stats.hint ?? 0);
   const text = HINTS[hint] ?? "";
   return (
      <div className={styles.panel} data-arcade-safe-area="" role="status" aria-live="polite">
         <div className={styles.pill}>
            {text ? (
               text
            ) : (
               <>
                  <span className={mask & 1 ? styles.got : undefined}>Key</span>
                  <span className={mask & 2 ? styles.got : undefined}>Book</span>
                  <span className={mask & 4 ? styles.got : undefined}>Battery</span>
               </>
            )}
         </div>
      </div>
   );
}
