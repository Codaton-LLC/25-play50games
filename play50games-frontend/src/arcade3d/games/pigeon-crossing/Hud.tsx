"use client";

import { create } from "zustand";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { GateReason } from "./camera";
import { PREVIEW_MS } from "./rules";
import styles from "./Hud.module.css";

/** Only gate changes publish; animation and per-frame progress never re-render this HUD. */
export const useStreetGate = create<{ reason: GateReason; setReason(reason: GateReason): void }>((set, get) => ({
   reason: null,
   setReason(reason) { if (get().reason !== reason) set({ reason }); },
}));

export default function Hud() {
   const preview = useArcadeStore((state) => state.phase === "playing" && state.elapsedMs < PREVIEW_MS);
   const reason = useStreetGate((state) => state.reason);
   if (!preview && !reason) return null;
   return (
      <div className={styles.root}>
         <div className={styles.hint} role="status" aria-live="polite">
            {reason ? <><strong>{reason === "size" ? "Make the window larger" : "Make the window wider"}</strong><span>Then press Resume to keep crossing.</span></> : <><strong>Watch the gaps</strong><span>Get ready to hop. Grass is safe.</span></>}
         </div>
      </div>
   );
}
