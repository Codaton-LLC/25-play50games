"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import type { MansionLevel } from "./levels";
import { KEY_COLORS, KEY_SHAPES } from "./rules";
import styles from "./Hud.module.css";

const SHAPE_GLYPHS = {
   circle: "●",
   square: "■",
   triangle: "▲",
   diamond: "◆",
   star: "★",
} as const;

export default function Hud() {
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
                     title={`${shape} key ${held ? "(held)" : "(missing)"}`}
                  >
                     {SHAPE_GLYPHS[shape]}
                  </span>
               );
            })}
         </div>
      </div>
   );
}
