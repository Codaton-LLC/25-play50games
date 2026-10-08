"use client";

// A timing ring for a game's HUD (plain DOM, SVG): a track, target arcs and a needle, for "press
// when the needle is in the zone" (space-repair). The game owns the timing: it reads the same
// needlePosition / judgeTiming (hud/timingMath.ts) in rules.ts and useRunFrame, so the drawing and
// the grading agree.
//
//    const needle = useRef(0);                                       // the game writes it every frame
//    useRunFrame((s) => { needle.current = needlePosition(time.play, 1.6); });
//    <TimingRing source={() => needle.current} zones={[{ start: 0.62, end: 0.74 }]} />   // in definition.Hud
//    // on Space: judgeTiming(needle.current, zones) -> "perfect" | "good" | "miss"
//
// `source` is polled on every animation frame and only the needle's transform changes (no React
// render per frame); `value` instead draws a fixed position (re-render to move it).
import { useEffect, useRef } from "react";
import { arcPath, zoneLength, type TimingZone } from "./timingMath";

export interface TimingRingProps {
   /** read on every animation frame: the needle position 0..1 (clockwise from the top) */
   source?: () => number;
   /** a fixed needle position, when there is no `source` */
   value?: number;
   zones: readonly TimingZone[];
   /** CSS px (default 120) */
   size?: number;
   /** the middle `perfectShare` of each zone is drawn brighter (default 0.3, as judgeTiming) */
   perfectShare?: number;
   zoneColor?: string;
   perfectColor?: string;
   needleColor?: string;
   trackColor?: string;
   /** text in the middle (e.g. "SPACE") */
   label?: string;
   className?: string;
}

export function TimingRing({
   source,
   value = 0,
   zones,
   size = 120,
   perfectShare = 0.3,
   zoneColor = "#22c55e",
   perfectColor = "#bbf7d0",
   needleColor = "#f8fafc",
   trackColor = "rgba(148,163,184,0.35)",
   label,
   className,
}: TimingRingProps) {
   const needle = useRef<SVGGElement>(null);
   const sourceRef = useRef(source);
   sourceRef.current = source;

   useEffect(() => {
      if (!source) return;
      let frame = 0;
      let last = NaN;
      const tick = () => {
         const read = sourceRef.current;
         const pos = read ? read() : 0;
         if (pos !== last && needle.current) {
            needle.current.setAttribute("transform", `rotate(${(pos * 360).toFixed(2)} 50 50)`);
            last = pos;
         }
         frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
   }, [source]);

   const r = 40;
   return (
      <svg className={className} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label ?? "timing ring"}>
         <circle cx={50} cy={50} r={r} fill="rgba(2,6,23,0.55)" stroke={trackColor} strokeWidth={9} />
         {zones.map((zone, i) => {
            const length = zoneLength(zone);
            const mid = zone.start + length / 2;
            const perfect = { start: mid - (length * perfectShare) / 2, end: mid + (length * perfectShare) / 2 };
            return (
               <g key={i}>
                  <path d={arcPath(zone, 50, 50, r)} stroke={zoneColor} strokeWidth={9} fill="none" strokeLinecap="butt" />
                  {perfectShare > 0 && <path d={arcPath(perfect, 50, 50, r)} stroke={perfectColor} strokeWidth={9} fill="none" />}
               </g>
            );
         })}
         <g ref={needle} transform={source ? undefined : `rotate(${(value * 360).toFixed(2)} 50 50)`}>
            <line x1={50} y1={50} x2={50} y2={50 - r - 6} stroke={needleColor} strokeWidth={3.5} strokeLinecap="round" />
         </g>
         <circle cx={50} cy={50} r={5} fill={needleColor} />
         {label && (
            <text x={50} y={72} textAnchor="middle" fontSize={11} fontWeight={700} fill="#e2e8f0" fontFamily="system-ui, sans-serif">
               {label}
            </text>
         )}
      </svg>
   );
}
