"use client";

// One transient message: the opening guidance (countdown and the 350 ms hold), a short notice on a
// new checkpoint and the early-fall message until the result panel. Score / Time / Height are the
// shell HUD. The slot is a fixed box marked data-arcade-safe-area and laid out in every phase, out of
// the column's way (Hud.module.css, hint.ts HINT_SLOT), so a message never moves the camera fit.
import { useEffect, useState } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { towerHint } from "./hint";
import styles from "./Hud.module.css";

export default function Hud() {
   const checkpoint = useArcadeStore(s => s.stats.checkpoint ?? 0);
   // the run time the current checkpoint was reached at (the stat changes once per checkpoint)
   const [mark, setMark] = useState({ checkpoint: 0, atMs: 0 });
   useEffect(() => {
      if (checkpoint !== mark.checkpoint) setMark({ checkpoint, atMs: useArcadeStore.getState().elapsedMs });
   }, [checkpoint, mark.checkpoint]);
   const shown = checkpoint === mark.checkpoint ? checkpoint : 0;
   const message = useArcadeStore(s => towerHint(s.phase, s.elapsedMs, s.stats.fallen === 1, shown, mark.atMs));
   return (
      <div className={styles.slot} data-arcade-safe-area="" role="status" aria-live="polite">
         {message !== null && <span className={styles.pill}>{message}</span>}
      </div>
   );
}
