// Ghost Vacuum modern look pass.
// Pure data: COLORS palette, bounds, and instanced decor spots outside the mansion.
// No React, no Three.js runtime allocations.
import { MANSION } from "./rules";

export const COLORS = {
   // Atmospheric Night & Sky
   skyTop: "#0b0d1e",
   skyBottom: "#1e1b4b",
   fog: "#171836",
   moon: "#fef08a",
   moonHalo: "#fef9c3",
   lawn: "#2a4235",
   lawnBorder: "#345242",
   path: "#57516d",
   pathBorder: "#413b54",
   hillFar: "#12142f",
   hillNear: "#1b1d3d",

   // Exterior Decor
   hedge: "#1e382d",
   hedgeTop: "#2d5242",
   treeTrunk: "#291b22",
   treeBranch: "#1c1217",
   gravestone: "#7b8b9e",
   gravestoneDark: "#556475",

   // Mansion Interior: Cosy-Spooky Victorian Haunted House
   floor: "#966341",
   floorDark: "#6b442b",
   carpetGold: "#d97706",
   wall: "#8e7ca4",
   wallBase: "#3d2b4e",
   wallFaded: "#8e7ca4",

   // Props & Ornaments
   woodDesk: "#52331b",
   woodTrim: "#7c4e2b",
   chairSeat: "#831843",
   chairWood: "#3d2413",
   brass: "#d97706",
   candleFlame: "#fde047",
   lampPool: "#f59e0b",
   clockFace: "#fef3c7",
   clockHands: "#1e1b4b",
   paintingFrame: "#d97706",
   paintingCanvas: "#2e344d",
   bookCoverA: "#991b1b",
   bookCoverB: "#1e40af",
   bookPages: "#fef3c7",
   revealIcon: "#fde047",
   revealCore: "#ffffff",

   // Characters & Feedback
   ghost: "#e0e7ff",
   ghostGold: "#fde047",
   ghostBig: "#c7d2fe",
   ghostShadow: "#0b0618",
   hunterSuit: "#6ee7b7",
   hunterDark: "#334155",
   hunterAccent: "#a78bfa",
   hunterBoots: "#1e293b",
   beamTorch: "#fde68a",
   beamSuction: "#c4b5fd",
} as const;

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio between two #rrggbb colors. */
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

/** Play area bounds (the mansion walls: x [-14, 14], z [-10, 10]). */
export const MANSION_BOUNDS = {
   x0: -MANSION.halfX,
   x1: MANSION.halfX,
   z0: -MANSION.halfZ,
   z1: MANSION.halfZ,
} as const;

/** Checks whether a point lies inside the mansion play bounds. */
export function inMansion(x: number, z: number, margin = 0): boolean {
   return (
      x >= MANSION_BOUNDS.x0 - margin &&
      x <= MANSION_BOUNDS.x1 + margin &&
      z >= MANSION_BOUNDS.z0 - margin &&
      z <= MANSION_BOUNDS.z1 + margin
   );
}

export interface DecorSpot {
   kind: "hedge" | "gravestone" | "tree" | "hill" | "moon";
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
   tone?: number;
}

/**
 * Decor spots strictly OUTSIDE the mansion play bounds.
 * Bare trees, gravestones, hedges, distant hills, and the moon.
 * South garden band is populated with low hedges and gravestones outside the house bounds,
 * keeping the central approach clear and ensuring no sightline to the house interior is blocked.
 */
function buildDecorSpots(): DecorSpot[] {
   const spots: DecorSpot[] = [];

   // --- Garden Hedges (framing the estate perimeter and south approach garden) ---
   // West perimeter row (x = -16.8)
   for (let z = -10; z <= 10; z += 2.5) {
      spots.push({ kind: "hedge", x: -16.8, y: 0.35, z, rotY: 0, sx: 0.9, sy: 0.7, sz: 2.3, tone: 0 });
   }
   // East perimeter row (x = 16.8)
   for (let z = -10; z <= 10; z += 2.5) {
      spots.push({ kind: "hedge", x: 16.8, y: 0.35, z, rotY: 0, sx: 0.9, sy: 0.7, sz: 2.3, tone: 0 });
   }
   // North perimeter row (z = -12.8)
   for (let x = -15.5; x <= 15.5; x += 2.6) {
      spots.push({ kind: "hedge", x, y: 0.35, z: -12.8, rotY: Math.PI / 2, sx: 0.9, sy: 0.7, sz: 2.4, tone: 1 });
   }
   // South front terrace hedges (z = 11.2, low height 0.5m, framing the front terrace, path |x| <= 3.4 clear)
   for (const x of [-13.5, -11.1, -8.7, -6.3, -4.1, 4.1, 6.3, 8.7, 11.1, 13.5]) {
      spots.push({ kind: "hedge", x, y: 0.25, z: 11.2, rotY: Math.PI / 2, sx: 0.85, sy: 0.5, sz: 2.2, tone: 0 });
   }
   // South garden perimeter hedges (z = 14.2, low height 0.5m, framing the front lawn)
   for (const x of [-13.5, -11.1, -8.7, -6.3, -4.1, 4.1, 6.3, 8.7, 11.1, 13.5]) {
      spots.push({ kind: "hedge", x, y: 0.25, z: 14.2, rotY: Math.PI / 2, sx: 0.85, sy: 0.5, sz: 2.2, tone: 1 });
   }

   // --- Spooky Gravestones (old gothic cemetery plots) ---
   // North-West cemetery (x <= -18, z <= -13.5)
   const nwGraves: Array<[number, number, number, number]> = [
      [-19.5, -14.2, 0.15, 0],
      [-22.2, -14.8, -0.2, 1],
      [-18.8, -16.8, 0.05, 0],
      [-21.5, -17.2, 0.3, 1],
      [-23.8, -15.6, -0.1, 0],
      [-20.2, -19.4, 0.25, 1],
      [-23.0, -18.8, -0.3, 0],
   ];
   for (const [x, z, rotY, tone] of nwGraves) {
      spots.push({ kind: "gravestone", x, y: 0, z, rotY, sx: 0.7, sy: 0.85, sz: 0.25, tone });
   }
   // North-East cemetery (x >= 18, z <= -13.5)
   const neGraves: Array<[number, number, number, number]> = [
      [19.5, -14.2, -0.15, 0],
      [22.2, -14.8, 0.2, 1],
      [18.8, -16.8, -0.05, 0],
      [21.5, -17.2, -0.25, 1],
      [23.8, -15.6, 0.1, 0],
      [20.2, -19.4, -0.3, 1],
      [23.0, -18.8, 0.2, 0],
   ];
   for (const [x, z, rotY, tone] of neGraves) {
      spots.push({ kind: "gravestone", x, y: 0, z, rotY, sx: 0.7, sy: 0.85, sz: 0.25, tone });
   }
   // South garden cemetery plots (low tombstones between hedge rows, z = 12.7, y = 0, height 0.65m)
   const southGraves: Array<[number, number, number, number]> = [
      [-12.0, 12.7, 0.1, 0],
      [-9.5, 12.7, -0.2, 1],
      [-7.0, 12.7, 0.15, 0],
      [-4.8, 12.7, -0.1, 1],
      [4.8, 12.7, 0.1, 1],
      [7.0, 12.7, -0.15, 0],
      [9.5, 12.7, 0.2, 1],
      [12.0, 12.7, -0.1, 0],
   ];
   for (const [x, z, rotY, tone] of southGraves) {
      spots.push({ kind: "gravestone", x, y: 0, z, rotY, sx: 0.65, sy: 0.65, sz: 0.22, tone });
   }

   // --- Bare Spooky Trees (twisted silhouettes) ---
   // North backdrop behind the mansion (z <= -15.5)
   const northTrees: Array<[number, number, number, number]> = [
      [-16, -16.5, 1.25, 0.4],
      [-10, -18.5, 1.4, -0.8],
      [-3.5, -17.0, 1.5, 0.2],
      [3.5, -19.2, 1.45, -0.5],
      [10, -17.5, 1.35, 0.9],
      [16, -16.2, 1.3, -0.3],
      [-22, -19.5, 1.55, 1.1],
      [22, -19.0, 1.5, -1.2],
   ];
   for (const [x, z, s, rotY] of northTrees) {
      spots.push({ kind: "tree", x, y: 0, z, rotY, sx: s, sy: s, sz: s, tone: 0 });
   }
   // West flank trees (x <= -19.5)
   const westTrees: Array<[number, number, number, number]> = [
      [-20.5, -8.5, 1.3, 0.5],
      [-23.5, -2.0, 1.45, -0.7],
      [-21.0, 4.5, 1.35, 1.2],
      [-24.0, 10.5, 1.4, -0.4],
   ];
   for (const [x, z, s, rotY] of westTrees) {
      spots.push({ kind: "tree", x, y: 0, z, rotY, sx: s, sy: s, sz: s, tone: 1 });
   }
   // East flank trees (x >= 19.5)
   const eastTrees: Array<[number, number, number, number]> = [
      [20.5, -8.5, 1.3, -0.5],
      [23.5, -2.0, 1.45, 0.7],
      [21.0, 4.5, 1.35, -1.2],
      [24.0, 10.5, 1.4, 0.4],
   ];
   for (const [x, z, s, rotY] of eastTrees) {
      spots.push({ kind: "tree", x, y: 0, z, rotY, sx: s, sy: s, sz: s, tone: 1 });
   }

   // --- The Moon (high in the midnight sky behind the house) ---
   spots.push({
      kind: "moon",
      x: 18,
      y: 26,
      z: -44,
      rotY: 0,
      sx: 3.6,
      sy: 3.6,
      sz: 3.6,
   });

   // --- Distant Rolling Hills (on the far horizon) ---
   const hillSpots: Array<[number, number, number, number, number]> = [
      // Far north horizon
      [-42, -42, 14, 5.5, 12],
      [-28, -46, 16, 6.2, 13],
      [-14, -48, 17, 7.0, 14],
      [0, -50, 18, 7.4, 15],
      [14, -48, 17, 6.8, 14],
      [28, -45, 16, 6.0, 13],
      [42, -42, 14, 5.5, 12],
      // West flanks
      [-46, -24, 15, 6.0, 13],
      [-48, -6, 16, 6.5, 14],
      [-47, 12, 15, 5.8, 13],
      // East flanks
      [46, -24, 15, 6.0, 13],
      [48, -6, 16, 6.5, 14],
      [47, 12, 15, 5.8, 13],
   ];
   for (let i = 0; i < hillSpots.length; i++) {
      const [x, z, sx, sy, sz] = hillSpots[i];
      spots.push({ kind: "hill", x, y: 0, z, rotY: i * 0.45, sx, sy, sz, tone: i % 2 });
   }

   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecorSpots();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter((s) => s.kind === kind && (tone === undefined || s.tone === tone));
}
