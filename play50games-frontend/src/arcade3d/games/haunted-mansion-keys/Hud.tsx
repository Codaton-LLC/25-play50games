"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import type { MansionLevel } from "./levels";
import { GUIDE, KEY_NAMES, SHAPE_GLYPHS } from "./guide";
import { KEY_COLORS, KEY_SHAPES } from "./rules";
import styles from "./Hud.module.css";

function KeyRing() {
   const { config } = useLevel<MansionLevel>();
   const keyMask = useArcadeStore((s) => s.stats.keyMask ?? 0);
   const keysTotal = config.keys;

   return (
      <div className={styles.container} data-arcade-safe-area>
         <div className={styles.title}>Key Ring</div>
         <div className={styles.keysRow} aria-label="Keys collected">
            {KEY_SHAPES.slice(0, keysTotal).map((shape, i) => {
               const held = (keyMask & (1 << i)) !== 0;
               const color = KEY_COLORS[i];
               return (
                  <span
                     key={shape}
                     className={`${styles.keyBadge} ${held ? styles.held : ""}`}
                     style={{ color }}
                     title={`${KEY_NAMES[i]} ${shape} key ${held ? "(held)" : "(missing)"}`}
                  >
                     {SHAPE_GLYPHS[shape]}
                  </span>
               );
            })}
         </div>
      </div>
   );
}

/** The key ring, the next-step hint line (guide.ts) and the core 📷 camera-view button (core/camera). */
export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <HintLine signal={GUIDE} />
         <KeyRing />
      </>
   );
}
