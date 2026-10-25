"use client";

// Key / Book / Battery, or one short message, in a single fixed panel. The shell HUD
// already shows the clock and Found n/3. This panel is the safe-area checklist.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import { ITEM_LABELS, type EscapeLevel } from "./levels";
import styles from "./Hud.module.css";

const HINTS = ["", "Find all three", "Empty", "Opening", "Taking", "Unlocking"];

export default function Checklist() {
   const { config } = useLevel<EscapeLevel>();
   const next = useArcadeStore((s) => s.stats.nextItem ?? 0);
   const ready = useArcadeStore((s) => s.stats.exitReady ?? 1);
   const searched = useArcadeStore((s) => s.stats.searched ?? 0);
   const mask = useArcadeStore((s) => s.stats.mask ?? 0);
   const hint = useArcadeStore((s) => s.stats.hint ?? 0);
   const text = hint === 1 && config.id !== 1 ? "Check clues, all containers and exit power" : HINTS[hint] ?? "";
   return (
      <div className={`${styles.panel} ${config.id === 1 ? "" : styles.expanded}`} data-arcade-safe-area="" role="status" aria-live="polite">
         <div className={styles.pill}>
            {text ? (
               text
            ) : (
               <>
                  {ITEM_LABELS.slice(0, config.items).map((name, id) => <span key={name} className={mask & (1 << id) ? styles.got : undefined}>{name}</span>)}
                  {config.id !== 1 ? <span>Searched: {searched}/{config.containers}</span> : null}
                  {config.ordered && next >= 0 ? <span>Next: {ITEM_LABELS[next]}</span> : null}
                  {config.returnSwitch && next < 0 && !ready ? <span>Return to first drawer</span> : null}
               </>
            )}
         </div>
      </div>
   );
}
