// Alien Farm looks worth a test: the palette, the follow camera's window, overlay heights and the
// crop growth / ring math the drawing uses. Pure: no three.js, no React.
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { FARM, PLOTS } from "./rules";

/** One palette for the whole game: purple dusk, mint and cyan crops, gold for perfect, coral for a miss. */
export const COLORS = {
   background: "#120a2e",
   skyTop: "#0b0624",
   skyBottom: "#5b21b6",
   fog: "#1e1045",
   soil: "#3b0764",
   soilDark: "#2e1065",
   bed: "#4c1d95",
   bedTop: "#6b21a8",
   channel: "#22d3ee",
   rim: "#581c87",
   rock: "#7c3aed",
   moon: "#e9d5ff",
   mint: "#4ade80",
   cyan: "#22d3ee",
   gold: "#fde68a",
   coral: "#fb7185",
   spore: "#a3e635",
   beam: "#67e8f9",
   seed: "#a78bfa",
   alien: "#4ade80",
   overalls: "#3b82f6",
   shirt: "#fef3c7",
   boot: "#1e293b",
   basket: "#d97706",
   basketDark: "#92400e",
   hull: "#cbd5e1",
   hullDark: "#64748b",
   dome: "#a5f3fc",
} as const;

/** Overlay heights (m): every overlay clearly above its surface, none coincident. */
export const HEIGHTS = { channel: 0.02, beamRing: 0.04, bedTop: 0.08, ring: 0.12, spore: 0.14, cooldown: 0.05 } as const;

export const PITCH = (50 * Math.PI) / 180;
export const FOV = 45;

/**
 * The follow camera keeps a 6 x 6 m window around the farmer (README "Scene and camera", decision
 * C: neighbour plots may sit off screen; the arrows and the hum lead to them). The rig follows the
 * farmer fully, so the window is origin-local.
 */
export const VIEW: FittedViewOptions = {
   area: { min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 1.6, z: 3 } },
   pitch: PITCH,
   yaws: [0],
   focus: [{ x: 0, y: 0, z: 0 }],
   fov: FOV,
   margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
};

/** Crop drawing scale for growth g (0..1): height 0.5 -> 1.0, width never under 0.75 of it. */
export function cropScale(g: number, out: { xz: number; y: number }): { xz: number; y: number } {
   const k = g < 0 ? 0 : g > 1 ? 1 : g;
   out.y = 0.5 + 0.5 * k;
   out.xz = Math.max(0.75, out.y);
   return out;
}

/** Tint brightness for ring fill q (README: 0.65 + 0.35 q). */
export const cropBrightness = (q: number): number => 0.65 + 0.35 * (q < 0 ? 0 : q > 1 ? 1 : q);

/** The saucer's bob and the beam's pulse are cosmetic: amplitude (m) and rate (rad/s). */
export const HOVER = { amplitude: 0.12, rate: 1.7, spin: 0.6 } as const;

/** The drawn ground under a point: the raised soil (0.10) over a bed, else the farm floor (0). */
export function groundAt(x: number, z: number): number {
   for (const p of PLOTS) if (Math.abs(x - p.x) <= FARM.bedHalf && Math.abs(z - p.z) <= FARM.bedHalf) return BED_SURFACE;
   return 0;
}
/** Top of the bed's soil slab (Farm.tsx): crops root here and the farmer stands on it. */
export const BED_SURFACE = 0.1;
