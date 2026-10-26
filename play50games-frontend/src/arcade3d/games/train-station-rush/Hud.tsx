"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { platformLook, type PlatformShape } from "./looks";
import styles from "./Hud.module.css";

/** The platform's shape as a small SVG (the same shapes as the pads and the signs). */
export function ShapeIcon({ shape, color, size = 18 }: { shape: PlatformShape; color: string; size?: number }) {
   const paths: Record<PlatformShape, string> = {
      circle: "M12 3a9 9 0 1 0 0.001 0Z",
      square: "M4 4h16v16H4Z",
      triangle: "M12 3l10 18H2Z",
      diamond: "M12 2l10 10-10 10L2 12Z",
      star: "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6Z",
      drop: "M12 2C12 2 5 10.5 5 15a7 7 0 0 0 14 0C19 10.5 12 2 12 2Z",
   };
   return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
         <path d={paths[shape]} fill={color} stroke="#0f172a" strokeWidth={1.2} />
      </svg>
   );
}

function TaskRow({ slot }: { slot: 0 | 1 }) {
   const platform = useArcadeStore((s) => s.stats[`t${slot}p`] ?? -1);
   const kind = useArcadeStore((s) => s.stats[`t${slot}k`] ?? 0);
   const left = useArcadeStore((s) => s.stats[`t${slot}l`] ?? 0);
   const held = useArcadeStore((s) => (s.stats[`t${slot}h`] ?? 0) > 0);
   const inNow = useArcadeStore((s) => (s.stats[`t${slot}a`] ?? 0) > 0);
   const dwell = useArcadeStore((s) => s.stats.dwell ?? 20);
   if (platform < 0) return null;
   const look = platformLook(platform);
   const seconds = Math.max(0, left / 4);
   const share = inNow ? Math.max(0, Math.min(1, seconds / dwell)) : 1;
   return (
      <div className={held ? styles.rowHeld : styles.row}>
         <ShapeIcon shape={look.shape} color={look.color} />
         <span className={styles.platform}>{platform + 1}</span>
         <span className={styles.kind}>{kind ? "Passenger" : "Bag"}</span>
         <span className={styles.time}>{inNow ? `${Math.ceil(seconds)} s` : "arriving"}</span>
         <div className={styles.track} aria-hidden>
            <div className={share > 0.5 ? styles.fillGood : styles.fill} style={{ width: `${share * 100}%` }} />
         </div>
      </div>
   );
}

/**
 * The open tasks: the platform's shape and number, bag or passenger, and the train's wait (green
 * above half: the +50). Score, time, lives and Delivered are the shell's chips.
 */
export default function Hud() {
   const any = useArcadeStore((s) => (s.stats.t0p ?? -1) >= 0 || (s.stats.t1p ?? -1) >= 0);
   if (!any) return null;
   return (
      <div className={styles.board} data-arcade-safe-area>
         <span className={styles.title}>Departures</span>
         <TaskRow slot={0} />
         <TaskRow slot={1} />
      </div>
   );
}
