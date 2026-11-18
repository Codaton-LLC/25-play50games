// The thin progress ring (docs/design/DESIGN.md §4): a coral arc on a hairline track with the
// count in mono at its centre. A full ring turns gold. Server-safe.
import type { ReactNode } from "react";
import styles from "./ProgressRing.module.css";

export interface ProgressRingProps {
   value: number;
   total: number;
   /** outer size in px */
   size?: number;
   /** what the ring says to a screen reader: "7 of 50 games finished" */
   label: string;
   /** the centre: "07 / 50" */
   children: ReactNode;
}

const STROKE = 6;

export default function ProgressRing({ value, total, size = 132, label, children }: ProgressRingProps) {
   const radius = (size - STROKE) / 2;
   const length = 2 * Math.PI * radius;
   const part = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
   const centre = size / 2;

   return (
      <div
         className={styles.ring}
         style={{ width: size, height: size }}
         role="img"
         aria-label={label}
         data-full={part >= 1 ? "" : undefined}
      >
         <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle className={styles.track} cx={centre} cy={centre} r={radius} strokeWidth={STROKE} />
            {part > 0 ? (
               <circle
                  className={styles.arc}
                  cx={centre}
                  cy={centre}
                  r={radius}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length * part} ${length}`}
                  transform={`rotate(-90 ${centre} ${centre})`}
               />
            ) : null}
         </svg>
         <span className={styles.count} aria-hidden="true">
            {children}
         </span>
      </div>
   );
}
