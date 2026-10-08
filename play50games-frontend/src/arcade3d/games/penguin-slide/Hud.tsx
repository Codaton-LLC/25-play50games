"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { TimingRing } from "@/arcade3d/core/hud";
import { useSafeArea, type SafeArea } from "@/arcade3d/core/safeArea";
import { AIR } from "./rules";
import styles from "./Hud.module.css";

const LANDING_ZONE = [{ start: 1 - AIR.tolerance / 360, end: AIR.tolerance / 360 }];
const rotation = () => ((useArcadeStore.getState().stats.yaw ?? 0) % 360 + 360) % 360 / 360;
const panelTop = (area: SafeArea) => {
   const minimum = area.height > 520 ? 84 : 64;
   let bottom = minimum - 8;
   for (const rect of area.hud) if (rect.top < minimum - 1) bottom = Math.max(bottom, rect.bottom);
   return bottom + 8;
};

export default function Hud() {
   const assist = useArcadeStore((s) => s.stats.assist ?? 0);
   const time = useArcadeStore((s) => s.stats.time ?? 30);
   const air = useArcadeStore((s) => s.stats.air ?? 0);
   const alignment = useArcadeStore((s) => s.stats.alignment ?? 0);
   const top = useSafeArea(panelTop);
   return <aside style={{ top }} className={`${styles.panel} ${time <= 5 ? styles.low : ""}`} data-arcade-safe-area aria-label="Slide assist and landing">
      <span>Auto-hop <strong>{assist ? "On" : "Off"}</strong></span>
      {air > 0 && <><TimingRing source={rotation} zones={LANDING_ZONE} size={40} label="↑" needleColor="var(--text)" />
         <span className={alignment ? styles.aligned : styles.turn}>{alignment ? "Aligned — land straight" : "Turn to face forward"}</span></>}
   </aside>;
}
