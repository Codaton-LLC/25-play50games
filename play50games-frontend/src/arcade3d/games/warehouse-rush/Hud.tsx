"use client";

// Warehouse Rush's own HUD: the order panel ("BLUE box → Zone B"). The shell HUD already shows the
// score, the time and the right deliveries. Two layers (README "HUD"):
// - The wrapper is the one element marked data-arcade-safe-area: a fixed 260 x 44 px box, always
//   mounted, never keyed, never transformed or animated, so every safe-area measure returns the
//   same rect and the camera fit never changes mid-run. It is also the live region.
// - The inner pill carries everything that moves. It is keyed by the delivery count, so every
//   delivery restarts its flash (green on +50, red with a shake on a wrong zone); a remount inside
//   the wrapper only re-measures the unchanged wrapper rect. Paused, the animation waits.
// The Scene publishes stats.order and stats.carry on mount (so the panel is filled during the
// countdown) and order, carry, drops and delta after every step that changes them.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { CSSProperties } from "react";
import { COLOURS } from "./rules";
import styles from "./Hud.module.css";

export default function OrderHud() {
   const order = useArcadeStore((s) => s.stats.order);
   const carrying = useArcadeStore((s) => (s.stats.carry ?? 0) > 0);
   const drops = useArcadeStore((s) => s.stats.drops ?? 0);
   const right = useArcadeStore((s) => (s.stats.delta ?? 0) > 0);
   const paused = useArcadeStore((s) => s.phase === "paused");
   const colour = order !== undefined && order >= 0 && order < COLOURS.length ? COLOURS[order] : null;

   const pillClass = [styles.pill, drops > 0 ? (right ? styles.right : styles.wrong) : "", paused ? styles.paused : ""]
      .filter(Boolean)
      .join(" ");
   const pillStyle = colour ? ({ "--order": colour.hex } as CSSProperties) : undefined;

   return (
      <div className={styles.panel} data-arcade-safe-area="" role="status" aria-live="polite">
         <div key={drops} className={pillClass} style={pillStyle} aria-hidden="true">
            <span className={styles.text}>
               {colour ? (
                  <>
                     <span className={styles.colour}>{colour.name}</span> box {"→"} Zone {colour.zone}
                  </>
               ) : (
                  "Get ready"
               )}
            </span>
            <span className={carrying ? `${styles.icon} ${styles.carrying}` : styles.icon}>{carrying ? "✓" : ""}</span>
         </div>
         {/* keyed by the delivery, so a repeated order is announced again */}
         <span key={`sr-${drops}`} className={styles.srOnly}>
            {colour ? `Deliver ${colour.name.toLowerCase()} box to zone ${colour.zone}` : ""}
         </span>
      </div>
   );
}
