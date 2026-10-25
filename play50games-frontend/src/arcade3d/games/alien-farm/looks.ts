// Alien Farm looks: the palette, the follow camera's window, overlay heights,
// decor positions, distant hills geometry and crop growth / ring math. Pure: no React.
import { BufferAttribute, BufferGeometry } from "three";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { FARM, PLOTS } from "./rules";

/** One unified palette for the whole game: whimsical alien farm at sunset. */
export const COLORS = {
   background: "#120a2e",
   skyTop: "#09041e",
   skyBottom: "#5b21b6",
   fog: "#1e1045",
   soil: "#5b2d82",
   soilDark: "#46206a",
   bed: "#4c1d95",
   bedBorder: "#581c87",
   bedSoil: "#2e1065",
   furrowRidge: "#0e4b56",
   furrowValley: "#082f35",
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
 * Active play area where crops grow: the 9 crop beds.
 * Decor instances stay clear of these beds so crops and harvesting are unobstructed.
 */
export function inPlayArea(x: number, z: number, margin = 0.15): boolean {
   const half = FARM.bedHalf + margin;
   for (const p of PLOTS) {
      if (Math.abs(x - p.x) <= half && Math.abs(z - p.z) <= half) {
         return true;
      }
   }
   return false;
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

// ---------- Decor spots around beds and paths in camera view ----------

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

function buildDecor(): DecorSpot[] {
   const spots: DecorSpot[] = [];

   // Silo: placed northwest just north of bed 0 in full view of the camera
   spots.push({
      kind: "silo",
      tone: 0,
      x: -6.5,
      y: 0,
      z: -5.4,
      rotY: 0.35,
      sx: 1.0,
      sy: 1.0,
      sz: 1.0,
   });

   // Strange rock spires: north perimeter background and flank paths
   const spires = [
      { x: -4.5, z: -5.8, s: 1.3, sy: 1.1 },
      { x: -1.8, z: -5.6, s: 1.4, sy: 1.2 },
      { x: 1.8, z: -5.6, s: 1.4, sy: 1.2 },
      { x: 4.5, z: -5.8, s: 1.3, sy: 1.1 },
      { x: -6.8, z: -0.5, s: 1.2, sy: 1.0 },
      { x: 6.8, z: -0.5, s: 1.2, sy: 1.0 },
      { x: -6.8, z: 3.5, s: 1.2, sy: 1.0 },
      { x: 6.8, z: -2.5, s: 1.2, sy: 1.0 },
   ];
   spires.forEach((sp, i) => {
      spots.push({
         kind: "spire",
         tone: i % 2,
         x: sp.x,
         y: 0,
         z: sp.z,
         rotY: i * 0.8,
         sx: sp.s,
         sy: sp.s * sp.sy,
         sz: sp.s,
      });
   });

   // Glowing alien plants: distributed along paths and around the beds
   const plantPositions = [
      [-3.2, -5.2], [-0.5, -5.4], [0.5, -5.4], [3.2, -5.2],
      [-2.5, -2.0], [2.5, -2.0], [-2.5, 2.0], [2.5, 2.0],
      [-6.5, -1.8], [-6.5, 1.8], [6.5, -1.8], [6.5, 1.8],
      [-3.0, 5.5], [0.0, 5.5], [3.0, 5.5],
   ];
   plantPositions.forEach(([x, z], i) => {
      spots.push({
         kind: "plant",
         tone: i % 2,
         x,
         y: 0,
         z,
         rotY: i * 0.5,
         sx: 0.9,
         sy: 0.9,
         sz: 0.9,
      });
   });

   // Rocks: perimeter path margins
   const rocks = [
      [-6.8, -3.5], [6.8, -4.5], [-6.8, 1.5], [6.8, 2.2], [-4.5, 5.8], [4.5, 5.8],
   ];
   rocks.forEach(([x, z], i) => {
      spots.push({
         kind: "rock",
         tone: 0,
         x,
         y: 0,
         z,
         rotY: i * 1.1,
         sx: 1.0,
         sy: 0.85,
         sz: 1.0,
      });
   });

   // Crates: clustered near southwest path
   spots.push(
      { kind: "crate", tone: 0, x: -6.5, y: 0, z: 4.8, rotY: 0.2, sx: 1, sy: 1, sz: 1 },
      { kind: "crate", tone: 0, x: -6.0, y: 0, z: 5.2, rotY: -0.4, sx: 1, sy: 1, sz: 1 },
      { kind: "crate", tone: 0, x: -6.8, y: 0, z: 5.4, rotY: 0.9, sx: 1, sy: 1, sz: 1 }
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
   rgbOf(COLORS.soilDark),
   rgbOf(COLORS.rockDark),
];

function flatZone(x: number, z: number): boolean {
   return Math.abs(x) <= 12.0 && z >= -10.0 && z <= 10.0;
}

/** 0 on the farm; rises north and along distant flanks, completely flat in south foreground. */
export function hillHeight(x: number, z: number): number {
   if (z >= 7.0 || flatZone(x, z)) return 0;
   const dx = Math.max(0, Math.abs(x) - 12.0);
   const dz = Math.max(0, -10.0 - z);
   const dist = Math.hypot(dx, dz);
   if (dist <= 0) return 0;
   const roll = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(x * 0.24) * Math.cos(z * 0.2));
   const rise = Math.min(1, dist / 8);
   const southTaper = z > 0 ? Math.max(0, (7.0 - z) / 7.0) : 1;
   return Math.min(5.2, rise * rise * (0.8 + 4.4 * roll) * southTaper);
}

function hillFaceColor(x: number, z: number, y: number): [number, number, number] {
   const i = Math.abs(Math.floor(x * 1.5) + Math.floor(z * 2.1) * 3) % 4;
   if (y > 2.5) return HILL_TONES[3];
   if (y > 1.2) return HILL_TONES[1];
   return HILL_TONES[i % 2];
}

export function hillMesh(): ColoredMesh {
   const pos: number[] = [];
   const col: number[] = [];
   const x0 = -44;
   const x1 = 44;
   const z0 = -46;
   const z1 = 8;
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
