"use client";

// The Classic 50 path as a picture: numbered nodes, the finished ones filled, the next one ringed.
// Used as the art of the Classic world (hub panel, mega panel). Decorative: one text label for readers.
import { CLASSIC_TOTAL, useClassicCompleted } from "./hooks";
import styles from "./ClassicPath.module.css";

export interface ClassicPathProps {
   /** how many nodes to draw (the mega panel shows a shorter strip) */
   count?: number;
   /** false = do not read progress yet (hooks.ts useClassicCompleted) */
   enabled?: boolean;
   size?: "md" | "sm";
}

export default function ClassicPath({ count = CLASSIC_TOTAL, enabled = true, size = "md" }: ClassicPathProps) {
   const completed = useClassicCompleted(enabled);
   const done = completed ?? 0;
   const label =
      completed === null ? "The Classic 50 path" : `${done} of ${CLASSIC_TOTAL} classic games finished`;

   return (
      <div className={size === "sm" ? `${styles.path} ${styles.sm}` : styles.path} role="img" aria-label={label}>
         {Array.from({ length: count }, (_, index) => {
            const state = index < done ? styles.done : index === done ? styles.now : "";
            return (
               <i key={index} className={state ? `${styles.node} ${state}` : styles.node} aria-hidden="true">
                  {index + 1}
               </i>
            );
         })}
      </div>
   );
}
