// Penalty Hero's look. Pure data: palette, golden hour lighting, pitch and ground
// dimensions, and every decorative position outside the play area.
// No React, no three.js — the scene and decor components upload these buffers.
import { rngNext } from "@/arcade3d/core/math";
import type { LightingPreset } from "@/arcade3d/core/types";

/**
 * Playable area bounding box: goal guard, keeper dive range, ball flight path,
 * and striker animated bounds. Decor instances MUST stay strictly outside this box.
 */
export const PLAY_BOUNDS = {
   xMin: -4.06,
   xMax: 4.06,
   yMin: -0.4,
   yMax: 2.84,
   zMin: -1.8,
   zMax: 12.1,
} as const;

/** Safety margin around play bounds for decor placement. */
export const DECOR_CLEARANCE = 1.2;

/**
 * Returns true if the (x, z) spot is inside the play area (with optional margin).
 */
export function inPlayArea(x: number, z: number, margin = 0): boolean {
   return (
      x >= PLAY_BOUNDS.xMin - margin &&
      x <= PLAY_BOUNDS.xMax + margin &&
      z >= PLAY_BOUNDS.zMin - margin &&
      z <= PLAY_BOUNDS.zMax + margin
   );
}

/** Unified color palette for Penalty Hero: golden hour tournament stadium. */
export const COLORS = {
   // Sky and lighting (golden hour)
   skyTop: "#1e1b4b",
   skyBottom: "#fb923c",
   fog: "#f59e0b",
   sun: "#fed7aa",

   // Pitch & turf
   grass: "#22823b",
   grassLight: "#2ca048",
   grassShade: "#1a6b30",
   line: "#f8fafc",
   turfApron: "#185327",
   groundOuter: "#123d1d",

   // Goal frame
   frame: "#ffffff",
   frameJoint: "#f1f5f9",
   frameSupport: "#475569",
   frameAnchor: "#334155",
   net: "#f1f5f9",

   // Advertising boards (modern LED boards, no text)
   boardBody: "#0f172a",
   boardTrimBlue: "#0284c7",
   boardGlowBlue: "#38bdf8",
   boardTrimAmber: "#f59e0b",
   boardGlowAmber: "#fde68a",
   boardBase: "#1e293b",

   // Stadium stands & structure
   standConcrete: "#1e293b",
   standEdge: "#334155",
   standRailing: "#64748b",
   standCanopy: "#0f172a",

   // Floodlight towers
   floodlightMast: "#475569",
   floodlightHead: "#1e293b",
   floodlightLamp: "#fef08a",
   floodlightGlow: "#fef9c3",

   // Crowd spectators (multi-toned stadium supporters)
   crowdBlue: "#2563eb",
   crowdGreen: "#16a34a",
   crowdYellow: "#eab308",
   crowdOrange: "#f97316",
   crowdWhite: "#f8fafc",
   crowdRed: "#dc2626",

   // Existing footballer stand-in colors (preserved for fallback primitives)
   skin: "#e8b48f",
   hair: "#3f2a1d",
   strikerKit: "#2563eb",
   strikerShorts: "#1e3a8a",
   strikerSocks: "#1d4ed8",
   strikerBoots: "#f8fafc",
   keeperKit: "#16a34a",
   keeperShorts: "#14532d",
   keeperSocks: "#15803d",
   keeperBoots: "#0f172a",
   gloves: "#facc15",
   eye: "#0f172a",
} as const;

/** Fog distance: starts past the play bounds so the arena is crisp and un-fogged. */
export const FOG = { near: 45, far: 110 } as const;

/** Pitch playing surface dimensions. */
export const PITCH = {
   width: 60,
   depth: 50,
   zCenter: 10,
   z0: -15,
   z1: 35,
} as const;

/** Large ground surround plane ensuring no sky/void shows at any fitted camera aspect ratio. */
export const GROUND = {
   width: 160,
   depth: 160,
   y: -0.015,
   zCenter: 20,
} as const;

// ---------- Decor spots outside play bounds ----------

export interface DecorSpot {
   kind: "board" | "stand" | "crowd" | "floodlight" | "flag";
   tone?: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

/** North advertising boards behind the goal line (z = -3.8) */
function buildNorthBoards(): DecorSpot[] {
   const spots: DecorSpot[] = [];
   const count = 24;
   const width = 2.4;
   const startX = -((count * width) / 2) + width / 2;
   for (let i = 0; i < count; i++) {
      spots.push({
         kind: "board",
         tone: i % 2,
         x: startX + i * width,
         y: 0.4,
         z: -3.8,
         rotY: 0,
         sx: width * 0.96,
         sy: 0.8,
         sz: 0.16,
      });
   }
   return spots;
}

/** Side advertising boards along the west and east touchlines (|x| = 8.6) */
function buildSideBoards(): DecorSpot[] {
   const spots: DecorSpot[] = [];
   const length = 2.4;
   const startZ = -3.5;
   const endZ = 25.5;
   const count = Math.floor((endZ - startZ) / length);
   for (const side of [-1, 1]) {
      const x = side * 8.6;
      for (let i = 0; i < count; i++) {
         const z = startZ + i * length + length / 2;
         spots.push({
            kind: "board",
            tone: (i + (side > 0 ? 1 : 0)) % 2,
            x,
            y: 0.4,
            z,
            rotY: (side * Math.PI) / 2,
            sx: length * 0.96,
            sy: 0.8,
            sz: 0.16,
         });
      }
   }
   return spots;
}

/** North stadium stand tiers behind the goal (z = -6.0 to -24.0) */
function buildNorthStandTiers(): DecorSpot[] {
   const spots: DecorSpot[] = [];
   const tiers = 7;
   const tierDepth = 2.4;
   const tierHeight = 1.1;
   const standWidth = 64;
   for (let t = 0; t < tiers; t++) {
      const z = -6.0 - t * tierDepth;
      const y = (t + 1) * tierHeight * 0.5;
      spots.push({
         kind: "stand",
         x: 0,
         y,
         z,
         rotY: 0,
         sx: standWidth,
         sy: (t + 1) * tierHeight,
         sz: tierDepth * 0.98,
      });
   }
   return spots;
}

/** Side stadium stands (west and east, |x| = 11.5 to 25.5) */
function buildSideStandTiers(): DecorSpot[] {
   const spots: DecorSpot[] = [];
   const tiers = 5;
   const tierWidth = 2.8;
   const tierHeight = 1.2;
   const standLength = 40;
   const zCenter = 10;
   for (const side of [-1, 1]) {
      for (let t = 0; t < tiers; t++) {
         const x = side * (11.5 + t * tierWidth);
         const y = (t + 1) * tierHeight * 0.5;
         spots.push({
            kind: "stand",
            x,
            y,
            z: zCenter,
            rotY: 0,
            sx: tierWidth * 0.98,
            sy: (t + 1) * tierHeight,
            sz: standLength,
         });
      }
   }
   return spots;
}

/** Crowd spectators seated on the stadium tiers */
function buildCrowdSpots(): DecorSpot[] {
   const spots: DecorSpot[] = [];
   const rng = { s: 0x4f3a91 };
   const rand = () => rngNext(rng);

   // North stand crowd (behind goal, tiers 0..6)
   const tiers = 7;
   const tierDepth = 2.4;
   const tierHeight = 1.1;
   for (let t = 0; t < tiers; t++) {
      const z = -6.0 - t * tierDepth;
      const y = (t + 1) * tierHeight + 0.35;
      const fansInRow = 36;
      const spanX = 56;
      for (let col = 0; col < fansInRow; col++) {
         if (rand() < 0.08) continue; // slight irregularity
         const jitterX = (rand() - 0.5) * 0.3;
         const x = -spanX / 2 + (col / (fansInRow - 1)) * spanX + jitterX;
         const tone = Math.floor(rand() * 5); // 0..4 tones
         spots.push({
            kind: "crowd",
            tone,
            x,
            y,
            z,
            rotY: (rand() - 0.5) * 0.25,
            sx: 0.44 + rand() * 0.08,
            sy: 0.65 + rand() * 0.1,
            sz: 0.44 + rand() * 0.08,
         });
      }
   }

   // Side stands crowd (west and east)
   for (const side of [-1, 1]) {
      for (let t = 0; t < 5; t++) {
         const x = side * (11.5 + t * 2.8);
         const y = (t + 1) * 1.2 + 0.35;
         const fansInRow = 24;
         const spanZ = 34;
         for (let row = 0; row < fansInRow; row++) {
            if (rand() < 0.1) continue;
            const jitterZ = (rand() - 0.5) * 0.35;
            const z = -6 + (row / (fansInRow - 1)) * spanZ + jitterZ;
            const tone = Math.floor(rand() * 5);
            spots.push({
               kind: "crowd",
               tone,
               x,
               y,
               z,
               rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
               sx: 0.44 + rand() * 0.08,
               sy: 0.65 + rand() * 0.1,
               sz: 0.44 + rand() * 0.08,
            });
         }
      }
   }

   return spots;
}

/** 4 Floodlight towers at the outer stadium corners */
export const FLOODLIGHT_TOWERS: readonly DecorSpot[] = [
   { kind: "floodlight", x: -22, y: 0, z: -10, rotY: 0.45, sx: 1, sy: 1, sz: 1 },
   { kind: "floodlight", x: 22, y: 0, z: -10, rotY: -0.45, sx: 1, sy: 1, sz: 1 },
   { kind: "floodlight", x: -23, y: 0, z: 24, rotY: 1.15, sx: 1, sy: 1, sz: 1 },
   { kind: "floodlight", x: 23, y: 0, z: 24, rotY: -1.15, sx: 1, sy: 1, sz: 1 },
] as const;

/** Cheering supporters flags placed on the front tier of the north stand */
export const DYNAMIC_FLAGS: readonly { x: number; y: number; z: number; color: string; speed: number; phase: number }[] = [
   { x: -14, y: 1.6, z: -5.7, color: COLORS.crowdBlue, speed: 3.2, phase: 0 },
   { x: -8, y: 1.6, z: -5.7, color: COLORS.crowdYellow, speed: 2.8, phase: 1.2 },
   { x: 8, y: 1.6, z: -5.7, color: COLORS.crowdGreen, speed: 3.0, phase: 2.4 },
   { x: 14, y: 1.6, z: -5.7, color: COLORS.crowdOrange, speed: 3.5, phase: 3.8 },
] as const;

function buildAllDecor(): DecorSpot[] {
   return [
      ...buildNorthBoards(),
      ...buildSideBoards(),
      ...buildNorthStandTiers(),
      ...buildSideStandTiers(),
      ...buildCrowdSpots(),
      ...FLOODLIGHT_TOWERS,
   ];
}

export const ALL_DECOR: readonly DecorSpot[] = buildAllDecor();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return ALL_DECOR.filter((s) => s.kind === kind && (tone === undefined || s.tone === tone));
}

// ---------- Helper functions for contrast & validation ----------

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}
