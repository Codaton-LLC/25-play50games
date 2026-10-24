// Alien Farm looks: the palette, the follow camera's window, overlay heights,
// decor positions, distant hills geometry and crop growth / ring math. Pure: no React.
import { BufferAttribute, BufferGeometry } from "three";
import { rngNext } from "@/arcade3d/core/math";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { FARM, PLOTS } from "./rules";

/** One unified palette for the whole game: whimsical alien farm at sunset. */
export const COLORS = {
   background: "#120a2e",
   skyTop: "#09041e",
   skyBottom: "#4c1d95",
   fog: "#1c0d3f",
   soil: "#260742",
   soilDark: "#18032b",
   bed: "#3b0764",
   bedBorder: "#581c87",
   bedSoil: "#1e1b4b",
   furrowRidge: "#0d9488",
   furrowValley: "#134e4a",
   channel: "#22d3ee",
   channelGlow: "#06b6d4",
   rim: "#4c1d95",
   rock: "#7c3aed",
   rockDark: "#4c1d95",
   spire: "#581c87",
   spireTip: "#c084fc",
   plantStalk: "#4338ca",
   plantCap: "#2dd4bf",
   plantGlow: "#a7f3d0",
   siloBody: "#cbd5e1",
   siloDark: "#475569",
   siloGlow: "#38bdf8",
   moon: "#e9d5ff",
   moonMinor: "#67e8f9",
   mint: "#4ade80",
   cyan: "#22d3ee",
   gold: "#fde68a",
   coral: "#fb7185",
   spore: "#a3e635",
   beam: "#67e8f9",
   seed: "#a78bfa",
   alien: "#4ade80",
   overalls: "#2563eb",
   shirt: "#fef3c7",
   boot: "#0f172a",
   basket: "#d97706",
   basketDark: "#92400e",
   hull: "#cbd5e1",
   hullDark: "#64748b",
   dome: "#a5f3fc",
} as const;

/** Overlay heights (m): every overlay clearly above its surface, none coincident. */
export const HEIGHTS = {
   channel: 0.02,
   beamRing: 0.04,
   bedTop: 0.08,
   ring: 0.12,
   spore: 0.14,
   cooldown: 0.05,
} as const;

export const PITCH = (50 * Math.PI) / 180;
export const FOV = 45;

/** Linear fog. Near is past the camera follow distance so the farm stays crisp. */
export const FOG = { near: 32, far: 85 } as const;

/**
 * Play area bounds (m): the farm ground area.
 * Walkable farmer area is ±10.1 x ±8.1; farm boundary is ±10.5 x ±8.5.
 * All decor instances stay strictly outside this box.
 */
export const PLAY_BOUNDS = {
   xMin: -10.5,
   xMax: 10.5,
   zMin: -8.5,
   zMax: 8.5,
} as const;

export function inPlayArea(x: number, z: number): boolean {
   return (
      x >= PLAY_BOUNDS.xMin &&
      x <= PLAY_BOUNDS.xMax &&
      z >= PLAY_BOUNDS.zMin &&
      z <= PLAY_BOUNDS.zMax
   );
}

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

/** Top of the bed's soil slab: crops root here and the farmer stands on it. */
export const BED_SURFACE = 0.1;

/** The drawn ground under a point: the raised soil (0.10) over a bed, else the farm floor (0). */
export function groundAt(x: number, z: number): number {
   for (const p of PLOTS) {
      if (Math.abs(x - p.x) <= FARM.bedHalf && Math.abs(z - p.z) <= FARM.bedHalf) {
         return BED_SURFACE;
      }
   }
   return 0;
}

// ---------- Decor spots outside play bounds ----------

export interface DecorSpot {
   kind: "spire" | "plant" | "silo" | "rock" | "crate";
   tone: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

function tooClose(spots: readonly DecorSpot[], x: number, z: number, minDist: number): boolean {
   const minSq = minDist * minDist;
   for (const s of spots) {
      const dx = s.x - x;
      const dz = s.z - z;
      if (dx * dx + dz * dz < minSq) return true;
   }
   return false;
}

function buildDecor(): DecorSpot[] {
   const rng = { s: 0x411e4 };
   const spots: DecorSpot[] = [];
   const rand = () => rngNext(rng);

   const scatter = (
      kind: DecorSpot["kind"],
      count: number,
      box: { x0: number; x1: number; z0: number; z1: number },
      scaleRange: [number, number],
      minGap: number,
      toneOf: (i: number) => number,
      squashY = 1
   ) => {
      let placed = 0;
      for (let attempt = 0; placed < count && attempt < 3000; attempt++) {
         const x = box.x0 + rand() * (box.x1 - box.x0);
         const z = box.z0 + rand() * (box.z1 - box.z0);
         if (inPlayArea(x, z) || tooClose(spots, x, z, minGap)) continue;
         const s = scaleRange[0] + rand() * (scaleRange[1] - scaleRange[0]);
         spots.push({
            kind,
            tone: toneOf(placed),
            x,
            y: 0,
            z,
            rotY: rand() * Math.PI * 2,
            sx: s,
            sy: s * squashY,
            sz: s,
         });
         placed++;
      }
      if (placed < count) {
         throw new Error(`alien-farm look: placed ${placed}/${count} ${kind}`);
      }
   };

   // Silo: placed in the northwest background (behind the farm, clear of all camera rays)
   spots.push({
      kind: "silo",
      tone: 0,
      x: -14.0,
      y: 0,
      z: -12.5,
      rotY: 0.35,
      sx: 1.0,
      sy: 1.0,
      sz: 1.0,
   });

   // Strange rock spires: north background and flanks (never south)
   scatter("spire", 6, { x0: -18, x1: 18, z0: -24, z1: -12.5 }, [1.4, 2.5], 3.0, (i) => i % 2, 1.2);
   scatter("spire", 2, { x0: 13.8, x1: 22, z0: -8, z1: 4 }, [1.3, 2.0], 3.0, (i) => i % 2, 1.1);
   scatter("spire", 2, { x0: -22, x1: -13.8, z0: -8, z1: 4 }, [1.3, 2.0], 3.0, (i) => i % 2, 1.1);

   // Glowing alien plants: north perimeter and flanks
   scatter("plant", 8, { x0: -17, x1: 17, z0: -20, z1: -11.0 }, [0.8, 1.4], 1.8, (i) => i % 2);
   scatter("plant", 3, { x0: 12.8, x1: 19, z0: -7, z1: 5 }, [0.75, 1.25], 1.8, (i) => i % 2);
   scatter("plant", 3, { x0: -19, x1: -12.8, z0: -7, z1: 5 }, [0.75, 1.25], 1.8, (i) => i % 2);

   // Rocks: flank positions outside play area
   for (const z of [-7, 0, 7]) {
      for (const x of [-12.5, 12.5]) {
         spots.push({
            kind: "rock",
            tone: 0,
            x,
            y: 0,
            z,
            rotY: rand() * Math.PI * 2,
            sx: 1.0,
            sy: 0.85,
            sz: 1.0,
         });
      }
   }

   // Crates: clustered near southwest storage area
   spots.push(
      { kind: "crate", tone: 0, x: -11.8, y: 0, z: 8.8, rotY: 0.2, sx: 1, sy: 1, sz: 1 },
      { kind: "crate", tone: 0, x: -11.2, y: 0, z: 9.2, rotY: -0.4, sx: 1, sy: 1, sz: 1 },
      { kind: "crate", tone: 0, x: -11.8, y: 0, z: 7.8, rotY: 0.9, sx: 1, sy: 1, sz: 1 }
   );

   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecor();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter((s) => s.kind === kind && (tone === undefined || s.tone === tone));
}

// ---------- Distant hills mesh ----------

export interface ColoredMesh {
   positions: Float32Array;
   colors: Float32Array;
   triangles: number;
}

function rgbOf(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const HILL_TONES = [
   rgbOf(COLORS.soil),
   rgbOf(COLORS.soilDark),
   rgbOf(COLORS.rim),
   rgbOf(COLORS.rockDark),
];

function flatZone(x: number, z: number): boolean {
   return Math.abs(x) <= 12.0 && z >= -10.0 && z <= 10.0;
}

/** 0 on the farm; rises outside it into low-poly alien ridges. */
export function hillHeight(x: number, z: number): number {
   if (flatZone(x, z)) return 0;
   const dx = Math.max(0, Math.abs(x) - 12.0);
   const dz = Math.max(0, -10.0 - z, z - 10.0);
   const dist = Math.hypot(dx, dz);
   const roll = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(x * 0.24) * Math.cos(z * 0.2));
   const rise = Math.min(1, dist / 8);
   return Math.min(5.2, rise * rise * (0.8 + 4.4 * roll));
}

function hillFaceColor(x: number, z: number, y: number): [number, number, number] {
   const i = Math.abs(Math.floor(x * 1.5) + Math.floor(z * 2.1) * 3) % 4;
   if (y > 2.5) return HILL_TONES[3];
   if (y > 1.2) return HILL_TONES[2];
   return HILL_TONES[i % 2];
}

export function hillMesh(): ColoredMesh {
   const pos: number[] = [];
   const col: number[] = [];
   const x0 = -44;
   const x1 = 44;
   const z0 = -46;
   const z1 = 30;
   const step = 2.4;

   const push = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number
   ) => {
      const avgY = (ay + by + cy) / 3;
      const tone = hillFaceColor((ax + bx + cx) / 3, (az + bz + cz) / 3, avgY);
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      for (let k = 0; k < 3; k++) col.push(tone[0], tone[1], tone[2]);
   };

   for (let z = z0; z < z1 - 1e-5; z += step) {
      for (let x = x0; x < x1 - 1e-5; x += step) {
         const x2 = Math.min(x1, x + step);
         const z2 = Math.min(z1, z + step);
         const h00 = hillHeight(x, z);
         const h10 = hillHeight(x2, z);
         const h01 = hillHeight(x, z2);
         const h11 = hillHeight(x2, z2);
         if (h00 + h10 + h01 + h11 < 1e-4) continue;
         // CCW from above, normal pointing up
         push(x, h00, z, x, h01, z2, x2, h10, z);
         push(x2, h10, z, x, h01, z2, x2, h11, z2);
      }
   }
   return {
      positions: Float32Array.from(pos),
      colors: Float32Array.from(col),
      triangles: pos.length / 9,
   };
}

export function coloredGeometry(data: ColoredMesh): BufferGeometry {
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
   geometry.setAttribute("color", new BufferAttribute(data.colors, 3));
   geometry.computeVertexNormals();
   return geometry;
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio between two hex colours (#rrggbb). */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return (
         0.2126 * channel((n >> 16) & 255) +
         0.7152 * channel((n >> 8) & 255) +
         0.0722 * channel(n & 255)
      );
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}
