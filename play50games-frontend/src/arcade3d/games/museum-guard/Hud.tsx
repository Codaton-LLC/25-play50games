"use client";

// Radar over the canvas. Shapes, not colour alone. Updated from the live run, no setState per frame.
import { useEffect, useRef } from "react";
import { COLORS } from "./looks";
import { liveRun, RING, type ExhibitKind, type Run } from "./rules";
import styles from "./Hud.module.css";

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const MAP_R = 7.6;

function shape(kind: ExhibitKind, x: number, y: number): string {
   if (kind === "knight") return `M ${x - 3.1} ${y - 3.1} h 6.2 v 6.2 h -6.2 Z`;
   if (kind === "robot") return `M ${x - 3.2} ${y} a 3.2 3.2 0 1 0 6.4 0 a 3.2 3.2 0 1 0 -6.4 0`;
   if (kind === "penguin") return `M ${x} ${y - 4} L ${x + 3.5} ${y + 3.1} L ${x - 3.5} ${y + 3.1} Z`;
   return `M ${x} ${y - 4.1} L ${x + 3.3} ${y} L ${x} ${y + 4.1} L ${x - 3.3} ${y} Z`;
}

function wedge(yaw: number, half: number): string {
   const R = 44;
   const a0 = yaw - half;
   const a1 = yaw + half;
   const x0 = 50 + Math.sin(a0) * R;
   const y0 = 50 - Math.cos(a0) * R;
   const x1 = 50 + Math.sin(a1) * R;
   const y1 = 50 - Math.cos(a1) * R;
   return `M 50 50 L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function paint(beam: SVGPathElement, blips: Array<SVGPathElement | null>, run: Run) {
   beam.setAttribute("d", wedge(run.yaw, run.half));
   for (let i = 0; i < RING.count; i++) {
      const node = blips[i];
      const ex = run.exhibits[i];
      if (!node || !ex) continue;
      const reach = Math.min(1, Math.hypot(ex.x, ex.z) / MAP_R);
      const angle = Math.atan2(ex.x, ex.z);
      const x = 50 + Math.sin(angle) * reach * 44;
      const y = 50 - Math.cos(angle) * reach * 44;
      node.setAttribute("d", shape(ex.kind, x, y));
      const sneaking = ex.mode === "sneaking";
      const frozen = ex.mode === "frozen";
      const home = ex.mode === "returning";
      node.setAttribute("fill", frozen ? COLORS.frozen : sneaking || home ? "none" : COLORS.still);
      node.setAttribute("stroke", sneaking ? COLORS.sneak : home ? COLORS.accent : frozen ? COLORS.frozen : "none");
      node.setAttribute("stroke-width", sneaking || home ? "1.6" : "0");
      node.setAttribute("opacity", ex.mode === "still" ? "0.4" : "1");
   }
}

export default function Hud() {
   const beam = useRef<SVGPathElement>(null);
   const blips = useRef<Array<SVGPathElement | null>>(Array.from({ length: RING.count }, () => null));

   useEffect(() => {
      let frame = 0;
      const tick = () => {
         frame = requestAnimationFrame(tick);
         const run = liveRun.current;
         if (run && beam.current) paint(beam.current, blips.current, run);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
   }, []);

   return (
      <aside className={styles.radar} style={{ color: COLORS.hud }} data-arcade-safe-area aria-label="Statue radar">
         <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="none" stroke={COLORS.accent} strokeOpacity="0.35" strokeWidth="1" />
            <circle cx="50" cy="50" r="28" fill="none" stroke={COLORS.accent} strokeOpacity="0.15" strokeWidth="0.6" />
            <path ref={beam} fill={COLORS.beam} fillOpacity="0.28" />
            <rect x="90" y="47" width="4" height="6" fill={COLORS.door} />
            <rect x="6" y="47" width="4" height="6" fill={COLORS.door} />
            {SLOTS.map((i) => (
               <path key={i} ref={(node) => { blips.current[i] = node; }} fill="none" />
            ))}
            <circle cx="50" cy="50" r="2.2" fill={COLORS.hud} />
         </svg>
      </aside>
   );
}
