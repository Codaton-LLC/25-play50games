// Crazy Shopping Cart's visual design & modern supermarket look.
// Pure data: colors, fog, store floor layout, instanced decor spots, and occlusion math.
// No React, no three.js - loaded by Scene.tsx, Decor.tsx, and tests.

export const PLAY_BOUNDS = { x0: -16, x1: 16, z0: -12, z1: 12 } as const;

/** Extended concourse & parking lot floor size (covers full viewport at all screen sizes; no voids). */
export const FLOOR = {
   storeWidth: 32,
   storeDepth: 24,
   concourseWidth: 140,
   concourseDepth: 140,
   concourseY: -0.02,
   pavementWidth: 38,
   pavementDepth: 30,
   pavementY: -0.01,
} as const;

/** Exterior ground boundaries covered by the parking lot plane. */
export const GROUND_BOUNDS = {
   x0: -FLOOR.concourseWidth / 2,
   x1: FLOOR.concourseWidth / 2,
   z0: -FLOOR.concourseDepth / 2,
   z1: FLOOR.concourseDepth / 2,
} as const;

/**
 * Supermarket linear fog.
 * near is past the far supermarket wall (z = -12) from the fitted camera,
 * so the entire play area stays crisp and bright while distant concourse fades.
 */
export const FOG = { near: 18, far: 38 } as const;

/** Unified color palette for Crazy Shopping Cart. */
export const COLORS = {
   // Environment & Atmosphere
   bg: "#0b1220",
   skyTop: "#0f172a",
   skyBottom: "#1e293b",
   fog: "#0b1220",

   // Floor & Ground
   floorTile: "#f8fafc",
   floorGrout: "#e2e8f0",
   floorAccent: "#f1f5f9",
   concourseFloor: "#1c2637", // Slate asphalt tarmac (>6.4 contrast with finishGreen)

   // Parking Lot & Exterior Ground
   parkingAsphalt: "#1c2637",
   parkingLine: "#f8fafc",
   parkingLineYellow: "#facc15",
   pavementConcrete: "#94a3b8",
   kerbStone: "#475569",
   kerbAccent: "#cbd5e1",
   carBlue: "#2563eb",
   carRed: "#dc2626",
   carWhite: "#f1f5f9",
   carSilver: "#94a3b8",
   carBlack: "#1e293b",
   carWindow: "#0f172a",
   carWheel: "#0f172a",
   lightPole: "#475569",

   // Walls & Supermarket Structure
   wall: "#cbd5e1",
   wallTrim: "#94a3b8",
   wallFascia: "#0f172a",
   wallBanner: "#fb923c",
   ceilingPanel: "#fef08a",
   ceilingPanelGlow: "#fef9c3",
   ceilingFrame: "#334155",

   // Shelving & Aisle Fixtures
   shelfBody: "#f8fafc",
   shelfBase: "#334155",
   shelfEdge: "#cbd5e1",
   shelfBanner: "#fb923c",
   categoryGreen: "#10b981",
   categoryBlue: "#0ea5e9",
   categoryOrange: "#f97316",
   categoryRed: "#ef4444",

   // Fruit / Produce Island
   produceWood: "#78350f",
   produceWoodDark: "#451a03",
   produceCrate: "#b45309",
   produceGreen: "#15803d",
   produceApple: "#ef4444",
   produceOrange: "#ea580c",
   produceLemon: "#eab308",

   // Freezer Row along North wall
   freezerBody: "#e2e8f0",
   freezerGlass: "#bae6fd",
   freezerGlow: "#38bdf8",
   freezerBase: "#1e293b",

   // Checkout & Finish Zone
   checkoutBody: "#475569",
   checkoutTop: "#334155",
   checkoutBelt: "#0f172a",
   registerScreen: "#22c55e",
   finishGreen: "#22c55e",
   finishGreenGlow: "#16a34a",
   finishInactive: "#94a3b8",

   // Hazards & Pyramids
   canSilver: "#cbd5e1",
   canGold: "#f59e0b",
   canRed: "#ef4444",
   spillWater: "#38bdf8",
   coneYellow: "#facc15",
   coneBlack: "#1e293b",

   // Cart & Runner Stand-in Primitive
   cartChrome: "#e2e8f0",
   cartFrame: "#64748b",
   cartRed: "#ef4444",
   cartHandle: "#dc2626",
   cartWheel: "#1e293b",

   // Shopper Stand-in Primitives
   shopperA: "#c084fc",
   shopperB: "#5eead4",
   shopperC: "#fb923c",
   shopperSkin: "#fed7aa",
   shopperDark: "#334155",
   shopperBasket: "#f97316",

   // Products (10 kinds, multi-tone)
   productApple: "#ef4444",
   productBanana: "#facc15",
   productBurger: "#d97706",
   productTinCan: "#94a3b8",
   productBottle: "#38bdf8",
   productBag: "#b45309",
   productSock: "#a78bfa",
   productBattery: "#22c55e",
   productFish: "#fb923c",
   productGourd: "#10b981",

   // Exterior Decor outside play area
   doorGlass: "#93c5fd",
   doorFrame: "#334155",
   signYellow: "#fde047",
   signOrange: "#fb923c",
   signDark: "#0f172a",

   // Beacons & Halos
   halo: "#fb923c",
   badge: "#f97316",
} as const;

/** Checks if a coordinate pair lies inside the play bounds. */
export function inPlayArea(x: number, z: number, margin = 0): boolean {
   return (
      x >= PLAY_BOUNDS.x0 - margin &&
      x <= PLAY_BOUNDS.x1 + margin &&
      z >= PLAY_BOUNDS.z0 - margin &&
      z <= PLAY_BOUNDS.z1 + margin
   );
}

// ---------- Decor Outside Play Area ----------

export interface DecorSpot {
   kind:
      | "wall_shelving"
      | "entrance_door"
      | "promo_sign"
      | "cart_corral"
      | "checkout_decor"
      | "ceiling_light"
      | "parked_car";
   tone: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

/**
 * Builds the instanced decor instances surrounding the supermarket.
 * Every spot is strictly OUTSIDE PLAY_BOUNDS (tested in looks.test.ts),
 * and every spot stands directly on the ground (y - sy/2 === 0).
 */
function buildDecor(): DecorSpot[] {
   const spots: DecorSpot[] = [];

   // 1. Wall Shelving / Pallet Racks along outer perimeter
   // North storage racks behind North wall (z = -14.5)
   for (const x of [-13, -9, -5, -1, 3, 7, 11]) {
      spots.push({
         kind: "wall_shelving",
         tone: Math.abs(x) % 2,
         x,
         y: 1.6,
         z: -14.5,
         rotY: 0,
         sx: 2.6,
         sy: 3.2,
         sz: 1.1,
      });
   }
   // East outer shelving (x = 18.5)
   for (const z of [-9, -5, -1, 3, 7]) {
      spots.push({
         kind: "wall_shelving",
         tone: Math.abs(z) % 2,
         x: 18.5,
         y: 1.5,
         z,
         rotY: Math.PI / 2,
         sx: 2.4,
         sy: 3.0,
         sz: 1.0,
      });
   }
   // West outer shelving (x = -18.5)
   for (const z of [-9, -5, -1, 3, 7]) {
      spots.push({
         kind: "wall_shelving",
         tone: Math.abs(z) % 2,
         x: -18.5,
         y: 1.5,
         z,
         rotY: -Math.PI / 2,
         sx: 2.4,
         sy: 3.0,
         sz: 1.0,
      });
   }

   // 2. Entrance & Exit Doors
   // South entrance sliding glass doors outside checkout exit (z = 14.5)
   for (const x of [-8, 0, 8]) {
      spots.push({
         kind: "entrance_door",
         tone: 0,
         x,
         y: 1.4,
         z: 14.5,
         rotY: 0,
         sx: 2.8,
         sy: 2.8,
         sz: 0.4,
      });
   }
   // North warehouse delivery doors (z = -13.2)
   for (const x of [-7, 7]) {
      spots.push({
         kind: "entrance_door",
         tone: 1,
         x,
         y: 1.3,
         z: -13.2,
         rotY: Math.PI,
         sx: 2.4,
         sy: 2.6,
         sz: 0.3,
      });
   }

   // 3. Promotional Signs & Totems
   // South entrance lobby promo boards (z = 15.5)
   spots.push(
      { kind: "promo_sign", tone: 0, x: -12, y: 0.9, z: 15.5, rotY: 0.15, sx: 0.9, sy: 1.8, sz: 0.3 },
      { kind: "promo_sign", tone: 1, x: -4, y: 0.9, z: 15.5, rotY: -0.1, sx: 0.9, sy: 1.8, sz: 0.3 },
      { kind: "promo_sign", tone: 0, x: 4, y: 0.9, z: 15.5, rotY: 0.1, sx: 0.9, sy: 1.8, sz: 0.3 },
      { kind: "promo_sign", tone: 1, x: 12, y: 0.9, z: 15.5, rotY: -0.15, sx: 0.9, sy: 1.8, sz: 0.3 }
   );
   // East & West concourse promo totems
   spots.push(
      { kind: "promo_sign", tone: 0, x: 19.5, y: 1.0, z: -4, rotY: -Math.PI / 2, sx: 1.0, sy: 2.0, sz: 0.3 },
      { kind: "promo_sign", tone: 1, x: 19.5, y: 1.0, z: 4, rotY: -Math.PI / 2, sx: 1.0, sy: 2.0, sz: 0.3 },
      { kind: "promo_sign", tone: 0, x: -19.5, y: 1.0, z: -4, rotY: Math.PI / 2, sx: 1.0, sy: 2.0, sz: 0.3 },
      { kind: "promo_sign", tone: 1, x: -19.5, y: 1.0, z: 4, rotY: Math.PI / 2, sx: 1.0, sy: 2.0, sz: 0.3 }
   );

   // 4. Shopping Cart Return Corrals / Trolley Bays (outside South entrance and in parking lot)
   spots.push(
      { kind: "cart_corral", tone: 0, x: -9.5, y: 0.45, z: 16.5, rotY: 0, sx: 1.6, sy: 0.9, sz: 3.0 },
      { kind: "cart_corral", tone: 1, x: 9.5, y: 0.45, z: 16.5, rotY: 0, sx: 1.6, sy: 0.9, sz: 3.0 },
      { kind: "cart_corral", tone: 0, x: -15.5, y: 0.45, z: 21.0, rotY: 0, sx: 1.6, sy: 0.9, sz: 3.0 },
      { kind: "cart_corral", tone: 1, x: 15.5, y: 0.45, z: 21.0, rotY: 0, sx: 1.6, sy: 0.9, sz: 3.0 }
   );

   // 5. Exterior Checkout Decor / Kiosks (South lobby at z = 17.5)
   spots.push(
      { kind: "checkout_decor", tone: 0, x: -4.5, y: 0.5, z: 17.5, rotY: 0, sx: 1.8, sy: 1.0, sz: 0.8 },
      { kind: "checkout_decor", tone: 1, x: 4.5, y: 0.5, z: 17.5, rotY: 0, sx: 1.8, sy: 1.0, sz: 0.8 }
   );

   // 6. Perimeter Light Poles standing on the ground (sy = 4.4, y = 2.2 -> rests on y = 0)
   // North perimeter
   for (const x of [-10, -3, 4, 11]) {
      spots.push({
         kind: "ceiling_light",
         tone: 0,
         x,
         y: 2.2,
         z: -14.5,
         rotY: 0,
         sx: 0.8,
         sy: 4.4,
         sz: 0.8,
      });
   }
   // East & West perimeter
   for (const z of [-7, 0, 7]) {
      spots.push(
         { kind: "ceiling_light", tone: 0, x: 18.5, y: 2.2, z, rotY: 0, sx: 0.8, sy: 4.4, sz: 0.8 },
         { kind: "ceiling_light", tone: 0, x: -18.5, y: 2.2, z, rotY: 0, sx: 0.8, sy: 4.4, sz: 0.8 }
      );
   }

   // 7. Parked Cars in Parking Lot (all rest on ground y = 0, y: 0.75, sy: 1.5)
   // South parking lot row (z = 24.5)
   spots.push(
      { kind: "parked_car", tone: 0, x: -12, y: 0.75, z: 24.5, rotY: 0, sx: 2.2, sy: 1.5, sz: 4.4 },
      { kind: "parked_car", tone: 1, x: -6, y: 0.75, z: 24.5, rotY: 0, sx: 2.2, sy: 1.5, sz: 4.4 },
      { kind: "parked_car", tone: 2, x: 6, y: 0.75, z: 24.5, rotY: 0, sx: 2.2, sy: 1.5, sz: 4.4 },
      { kind: "parked_car", tone: 3, x: 12, y: 0.75, z: 24.5, rotY: 0, sx: 2.2, sy: 1.5, sz: 4.4 }
   );
   // East customer parking row (x = 23.5)
   spots.push(
      { kind: "parked_car", tone: 0, x: 23.5, y: 0.75, z: -4, rotY: Math.PI / 2, sx: 2.2, sy: 1.5, sz: 4.4 },
      { kind: "parked_car", tone: 1, x: 23.5, y: 0.75, z: 4, rotY: Math.PI / 2, sx: 2.2, sy: 1.5, sz: 4.4 }
   );
   // West customer parking row (x = -23.5)
   spots.push(
      { kind: "parked_car", tone: 2, x: -23.5, y: 0.75, z: -4, rotY: -Math.PI / 2, sx: 2.2, sy: 1.5, sz: 4.4 },
      { kind: "parked_car", tone: 3, x: -23.5, y: 0.75, z: 4, rotY: -Math.PI / 2, sx: 2.2, sy: 1.5, sz: 4.4 }
   );

   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecor();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter((s) => s.kind === kind && (tone === undefined || s.tone === tone));
}

// ---------- Accessibility & Contrast Helpers ----------

function srgbToLinear(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
   const clean = hex.startsWith("#") ? hex.slice(1) : hex;
   const n = Number.parseInt(clean, 16);
   const r = (n >> 16) & 255;
   const g = (n >> 8) & 255;
   const b = n & 255;
   return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two hex colors (1:1 to 21:1). */
export function contrastRatio(hexA: string, hexB: string): number {
   const l1 = relativeLuminance(hexA);
   const l2 = relativeLuminance(hexB);
   const hi = Math.max(l1, l2);
   const lo = Math.min(l1, l2);
   return (hi + 0.05) / (lo + 0.05);
}

// ---------- Ray-AABB Occlusion Test Helper ----------

export interface AABB3D {
   min: { x: number; y: number; z: number };
   max: { x: number; y: number; z: number };
}

/** Computes the axis-aligned bounding box of a decor spot. */
export function decorAABB(spot: DecorSpot): AABB3D {
   const hx = spot.sx / 2;
   const hy = spot.sy / 2;
   const hz = spot.sz / 2;
   // Handle 90-degree rotations in XZ plane
   const isQuarterTurn = Math.abs(Math.sin(spot.rotY)) > 0.7;
   const spanX = isQuarterTurn ? hz : hx;
   const spanZ = isQuarterTurn ? hx : hz;
   return {
      min: { x: spot.x - spanX, y: spot.y - hy, z: spot.z - spanZ },
      max: { x: spot.x + spanX, y: spot.y + hy, z: spot.z + spanZ },
   };
}

/**
 * Tests whether the line segment from `p0` to `p1` intersects an AABB.
 * Used to verify that camera sightlines to play area objects are never occluded.
 */
export function segmentIntersectsAABB(
   p0: { x: number; y: number; z: number },
   p1: { x: number; y: number; z: number },
   box: AABB3D
): boolean {
   let tmin = 0;
   let tmax = 1;
   const dx = p1.x - p0.x;
   const dy = p1.y - p0.y;
   const dz = p1.z - p0.z;

   for (const [p, d, bmin, bmax] of [
      [p0.x, dx, box.min.x, box.max.x],
      [p0.y, dy, box.min.y, box.max.y],
      [p0.z, dz, box.min.z, box.max.z],
   ] as const) {
      if (Math.abs(d) < 1e-8) {
         if (p < bmin || p > bmax) return false;
      } else {
         const t1 = (bmin - p) / d;
         const t2 = (bmax - p) / d;
         const near = Math.min(t1, t2);
         const far = Math.max(t1, t2);
         tmin = Math.max(tmin, near);
         tmax = Math.min(tmax, far);
         if (tmin > tmax) return false;
      }
   }
   return true;
}
