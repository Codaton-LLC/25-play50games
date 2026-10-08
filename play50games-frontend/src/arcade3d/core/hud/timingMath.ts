// Timing-ring math (core/hud <TimingRing>: a needle sweeping a ring with target zones, for "press
// when the needle is in the green"). Pure, no DOM. Positions are fractions of one turn, 0..1,
// clockwise from the top (12 o'clock). Tested in hud.test.ts.

/** A target arc on the ring; `end` may be below `start` to wrap through the top. */
export interface TimingZone {
   start: number;
   end: number;
}

export type TimingGrade = "perfect" | "good" | "miss";

const wrap01 = (v: number) => v - Math.floor(v);

/**
 * The needle's position at `t` seconds for one turn every `period` seconds. "loop" goes round and
 * round; "pingpong" sweeps 0 -> 1 -> 0 (a back-and-forth gauge, `period` = there and back).
 */
export function needlePosition(t: number, period: number, mode: "loop" | "pingpong" = "loop"): number {
   if (!(period > 0) || !Number.isFinite(t)) return 0;
   const k = wrap01(t / period);
   return mode === "pingpong" ? 1 - Math.abs(1 - 2 * k) : k;
}

/** The zone's length (a wrapping zone counts through the top). */
export function zoneLength(zone: TimingZone): number {
   const s = wrap01(zone.start);
   const e = wrap01(zone.end);
   if (zone.end - zone.start >= 1) return 1;
   return e >= s ? e - s : 1 - s + e;
}

/** How far into the zone `pos` is, 0 at its start .. 1 at its end, or -1 outside. */
export function zoneProgress(pos: number, zone: TimingZone): number {
   const length = zoneLength(zone);
   if (length >= 1) return wrap01(pos - zone.start);
   const into = wrap01(pos - zone.start);
   return into <= length ? (length > 0 ? into / length : 0) : -1;
}

export function inZone(pos: number, zone: TimingZone): boolean {
   return zoneProgress(pos, zone) >= 0;
}

/**
 * The grade of a press at `pos`: "perfect" in the middle `perfectShare` of the zone, "good" in the
 * rest of it, "miss" outside. With several zones, the best grade wins.
 */
export function judgeTiming(pos: number, zones: TimingZone | readonly TimingZone[], perfectShare = 0.3): TimingGrade {
   const list = Array.isArray(zones) ? zones : [zones as TimingZone];
   let best: TimingGrade = "miss";
   for (const zone of list) {
      const k = zoneProgress(pos, zone);
      if (k < 0) continue;
      if (Math.abs(k - 0.5) <= perfectShare / 2) return "perfect";
      best = "good";
   }
   return best;
}

/** The point at `pos` on a circle (SVG axes: y down), clockwise from the top. */
export function ringPoint(pos: number, cx: number, cy: number, r: number, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
   const a = pos * Math.PI * 2;
   out.x = cx + Math.sin(a) * r;
   out.y = cy - Math.cos(a) * r;
   return out;
}

/** An SVG path of the arc of `zone` on a circle (clockwise, through the top when it wraps). */
export function arcPath(zone: TimingZone, cx: number, cy: number, r: number): string {
   const length = zoneLength(zone);
   if (length >= 1) {
      // a whole circle: two half arcs
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
   }
   const a = ringPoint(zone.start, cx, cy, r);
   const b = ringPoint(zone.start + length, cx, cy, r);
   const large = length > 0.5 ? 1 : 0;
   const f = (v: number) => Math.round(v * 100) / 100;
   return `M ${f(a.x)} ${f(a.y)} A ${r} ${r} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`;
}
