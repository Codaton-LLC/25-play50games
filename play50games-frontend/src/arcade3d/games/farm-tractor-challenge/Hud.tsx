"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { GUIDE } from "./guide";
import styles from "./Hud.module.css";

/** Bales on the trailer this trip and the next-step hint line (guide.ts). Score, time, lives and Trips are the shell's chips. */
export default function Hud() {
   const loaded = useArcadeStore((s) => s.stats.loaded ?? 0);
   const size = useArcadeStore((s) => s.stats.load ?? 1);
   return (
      <>
         <CameraViewButton />
         <HintLine signal={GUIDE} />
         <div className={`${styles.load} ${loaded >= size ? styles.full : ""}`} data-arcade-safe-area>
            <span>Load</span>
            <strong>{loaded}/{size}</strong>
            {loaded >= size && <em>to the bay</em>}
         </div>
      </>
   );
}
