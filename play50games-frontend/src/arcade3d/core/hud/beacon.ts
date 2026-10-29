// TargetBeacon's pure parts (TargetBeacon.tsx): the variant looks, the bob and pulse over time and
// the on-screen size floor. Three-free and allocation-free, so clarity.test.ts pins them.

export type BeaconVariant = "pick" | "drop-here" | "danger";

export interface BeaconStyle {
   /** default colour when the game passes none */
   color: string;
   /** a down arrow over the target */
   arrow: boolean;
   /** a filled, faint disc inside the ring */
   disc: boolean;
   /** pulses per second */
   pulseHz: number;
   /** the pulse ring grows outward (1) or shrinks inward onto the spot (-1: "land here") */
   pulseDir: 1 | -1;
   /** arrow bob amplitude, m (before scaling) */
   bob: number;
}

export const BEACON_STYLES: Readonly<Record<BeaconVariant, Readonly<BeaconStyle>>> = {
   pick: { color: "#fde047", arrow: true, disc: false, pulseHz: 0.9, pulseDir: 1, bob: 0.16 },
   "drop-here": { color: "#4ade80", arrow: true, disc: true, pulseHz: 0.8, pulseDir: -1, bob: 0.12 },
   danger: { color: "#f87171", arrow: false, disc: true, pulseHz: 1.6, pulseDir: 1, bob: 0 },
};

/** The arrow sprite's height in world units at scale 1, m. */
export const BEACON_ARROW_SIZE = 0.62;
/** Smallest on-screen arrow, CSS px (fine pointer / touch). */
export const BEACON_MIN_PX = { fine: 36, coarse: 40 } as const;
/** Largest distance scale-up (far camera views, the top view). */
export const BEACON_MAX_SCALE = 3.2;

export interface BeaconMotion {
   /** arrow offset above its rest height, m (before scaling) */
   bob: number;
   /** pulse ring scale, relative to the ring radius */
   pulse: number;
   /** pulse ring opacity 0..1 */
   pulseOpacity: number;
   /** main ring opacity 0..1 (a soft breathe) */
   ringOpacity: number;
}

/**
 * The bob and pulse at animation time `t` (s). Reduced motion: no bob, no pulse ring (opacity 0),
 * a steady ring, so the beacon still marks the spot without moving.
 */
export function beaconMotion(t: number, variant: BeaconVariant, reduced: boolean, out: BeaconMotion): BeaconMotion {
   const style = BEACON_STYLES[variant];
   if (reduced) {
      out.bob = 0;
      out.pulse = 1;
      out.pulseOpacity = 0;
      out.ringOpacity = 0.85;
      return out;
   }
   const phase = (((t * style.pulseHz) % 1) + 1) % 1;
   out.bob = style.bob * Math.sin(t * Math.PI * 2 * style.pulseHz);
   // outward: 1 -> 1.7 fading out; inward: 1.8 -> 1 fading in then out
   out.pulse = style.pulseDir === 1 ? 1 + 0.7 * phase : 1.8 - 0.8 * phase;
   out.pulseOpacity = style.pulseDir === 1 ? 0.7 * (1 - phase) : 0.7 * Math.sin(phase * Math.PI);
   out.ringOpacity = 0.7 + 0.25 * Math.sin(t * Math.PI * 2 * style.pulseHz);
   return out;
}

/**
 * How much to scale a beacon so its arrow (`worldSize` m at scale 1) is at least `minPx` CSS px tall
 * on screen, `distance` m from a perspective camera with vertical fov `fovDeg` on a canvas `viewportPx`
 * tall. Never below 1 (near the camera it keeps its world size), never above `maxScale`.
 */
export function beaconScale(distance: number, fovDeg: number, viewportPx: number, minPx: number, worldSize = BEACON_ARROW_SIZE, maxScale = BEACON_MAX_SCALE): number {
   if (!(distance > 0) || !(viewportPx > 0) || !(fovDeg > 0) || !(worldSize > 0)) return 1;
   const worldPerPx = (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / viewportPx;
   const needed = (minPx * worldPerPx) / worldSize;
   return Math.min(maxScale, Math.max(1, needed));
}

/** The label text drawn over the arrow: numbers as-is, strings trimmed to 14 characters. */
export function beaconLabel(label: string | number | null | undefined): string {
   if (label === null || label === undefined) return "";
   const text = String(label).trim();
   return text.length > 14 ? `${text.slice(0, 13)}…` : text;
}
