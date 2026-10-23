"use client";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { PLANETS } from "./rules";
import styles from "./Hud.module.css";
export default function Hud() {
   const planet = useArcadeStore((s) => s.level);
   const fuel = useArcadeStore((s) => s.stats.fuel ?? 100);
   const vx = useArcadeStore((s) => s.stats.vx ?? 0);
   const vy = useArcadeStore((s) => s.stats.vy ?? 0);
   const tilt = useArcadeStore((s) => s.stats.tilt ?? 0);
   const hold = useArcadeStore((s) => s.stats.hold ?? 0);
   const award = useArcadeStore((s) => s.stats.award ?? 0);
   const soft = useArcadeStore((s) => s.stats.soft ?? 0), centre = useArcadeStore((s) => s.stats.centre ?? 0), reserve = useArcadeStore((s) => s.stats.reserve ?? 0);
   const safe = useArcadeStore((s) => s.stats.landingSafe === 1);
   return <div className={styles.wrap}>
      <div className={styles.flight} data-arcade-safe-area>
         <span>{PLANETS[Math.max(0, Math.min(4, planet - 1))].name} {planet || 1}/5</span>
         <span className={styles.fuel}>Fuel {fuel}<meter min={0} max={100} value={fuel} aria-label="Fuel remaining percent" /></span>
         <span title="Pad-relative horizontal speed: below 1 m/s">↔ {(vx / 10).toFixed(1)}</span>
         <span title="Descending speed: below 2 m/s">↕ {(vy / 10).toFixed(1)}</span>
         <span title="Tilt: below 10 degrees">{tilt}°</span>
         <span className={safe ? styles.good : styles.warn} aria-label={safe ? "Gentle approach" : "Adjust approach"}>{hold === 2 ? "CRASH" : hold === 1 ? `+${award}` : safe ? "✓" : "×"}</span>
      </div>
      <div className={styles.award} data-arcade-safe-area style={{ visibility: hold === 1 ? "visible" : "hidden" }} aria-hidden={hold !== 1}>Soft {soft} · Centre {centre} · Fuel {reserve}</div>
   </div>;
}
