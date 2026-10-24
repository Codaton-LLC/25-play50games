"use client";
import type { CSSProperties } from "react";
import { TimingRing } from "@/arcade3d/core/hud";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { liveHud, readNeedle } from "./liveHud";
import { COLORS } from "./palette";
import styles from "./Hud.module.css";

const NO_ZONES = [{ start: 0.42, end: 0.58 }];
export default function Hud() {
   const power = useArcadeStore((s) => s.stats.power ?? 100), remaining = useArcadeStore((s) => s.stats.remaining ?? 120);
   const repairs = useArcadeStore((s) => s.stats.repairs ?? 0), docked = useArcadeStore((s) => s.stats.docked ?? -1);
   const waiting = useArcadeStore((s) => s.stats.waiting ?? 0), feedback = useArcadeStore((s) => s.stats.feedback ?? 0);
   const hits = useArcadeStore((s) => s.stats.hits ?? 0), required = useArcadeStore((s) => s.stats.required ?? 0);
   const bonus = useArcadeStore((s) => s.stats.powerBonus ?? 0);
   const safe = useSafeArea(), landscape = safe.width > safe.height && safe.height > 0 && safe.height <= 520;
   const size = landscape ? 96 : 112;
   const leftControl = safe.controls.find((r) => r.left < safe.width / 2);
   const rightControl = safe.controls.find((r) => r.left >= safe.width / 2);
   const ringLeft = landscape ? safe.width - size - 18 : leftControl && rightControl ? (leftControl.right + rightControl.left - size) / 2 : (safe.width - size) / 2;
   const ringTop = landscape && rightControl ? rightControl.top - size - 8 : leftControl ? (leftControl.top + leftControl.bottom - size) / 2 : safe.height - size - 24;
   const ringStyle = { left: Math.max(8, ringLeft), top: Math.max(68, ringTop) } as CSSProperties;
   const zones = docked >= 0 && liveHud.run ? liveHud.run.modules[docked].zones : NO_ZONES;
   return <>
      <div className={styles.stats} data-arcade-safe-area data-low={power < 25}>
         <div className={styles.power}><span>POWER <b>{power}%</b></span><progress max={100} value={power} aria-label="Station power" /></div>
         <div><span>REMAINING</span><b>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</b></div>
         <div><span>REPAIRS</span><b>{repairs}</b></div>
      </div>
      <div className={styles.ring} style={ringStyle} data-arcade-safe-area data-docked={docked >= 0}>
         <TimingRing size={size} source={readNeedle} zones={zones} perfectShare={1 / 3} zoneColor={COLORS.mint} perfectColor={COLORS.white} label={waiting ? "WAIT" : docked >= 0 ? "REPAIR" : "BRAKE"} />
         <div className={styles.caption} aria-live="polite">{docked >= 0 ? feedback === 5 ? "GOOD HIT" : `#${docked + 1} · ${hits}/${required}` : "Find a dock"}</div>
      </div>
      <div className={styles.feedback} aria-live="polite">{bonus > 0 ? `POWER BONUS +${bonus}` : feedback === 3 ? "MISS · reset & retry" : feedback === 2 ? "PERFECT REPAIR" : feedback === 1 ? "REPAIRED" : feedback === 4 ? "POWER CELL +25" : power < 25 ? "LOW POWER · repair a module" : ""}</div>
   </>;
}
