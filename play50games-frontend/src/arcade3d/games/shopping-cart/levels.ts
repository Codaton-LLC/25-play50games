// Crazy Shopping Cart's five levels: pure data, no React, no three.js (docs/arcade-levels.md §6.3).
// Only what varies across levels: shopping list item count, run duration, shopper D activation time,
// shopper speed and waypoint wait time, and minimum tour distance.
// Level 1 is today's game and never changes.
//
// Each level is also its own store floor (STORES, README "Levels"): set-piece obstacles in the aisles
// (produce stands, stock pallets, promo bakery islands), extra wet floor, floor scrubbers and stock
// pallets on patrol, and at closing time a checkout lane that shuts. The 24 shelf slots, the start,
// the checkout and the finish stay where they are, so every level's limit proof (a shortest route over
// those points, which a new obstacle can only lengthen) still holds.
import type { LevelId } from "@/arcade3d/types";

/** Which drawn set the Scene uses (storeLooks.ts THEMES). Visual only. */
export type StoreTheme = "mini" | "fresh" | "household" | "superstore" | "closing";

/** A solid set piece: its footprint is its rules box (x, z centre; w along x, d along z). */
export interface SetPiece {
   kind: "fruitStand" | "crates" | "bakery" | "cooler";
   x: number;
   z: number;
   w: number;
   d: number;
   /** drawn height, m */
   h: number;
}

/** A floor machine on patrol (a stun on contact, like a shopper). */
export interface MoverSpec {
   kind: "scrubber" | "pallet";
   path: readonly (readonly [number, number])[];
   speed: number;
   wait: number;
}

export interface StoreArena {
   theme: StoreTheme;
   pieces: readonly SetPiece[];
   /** wet floor on top of rules SPILLS (same grip rule) */
   spills: readonly { x: number; z: number; radius: number; spawnS: number }[];
   movers: readonly MoverSpec[];
   /** seconds when the west checkout lane shuts (0 = never) */
   closeLaneAt: number;
}

const crates = (x: number, z: number, w: number, d: number): SetPiece => ({ kind: "crates", x, z, w, d, h: 1.3 });
/** the aisle-2 zigzag of stock pallets (household, superstore, closing) */
const AISLE2_ZIGZAG: readonly SetPiece[] = [crates(-5.8, -3.35, 2.4, 0.9), crates(-7.2, 0.3, 2.4, 0.8)];
const SCRUBBER_AISLE1: MoverSpec = { kind: "scrubber", path: [[-13.3, -7.2], [-13.3, 3.2]], speed: 1.3, wait: 0.8 };
const PALLET_AISLE5: MoverSpec = { kind: "pallet", path: [[8.3, -6.2], [8.3, 3.4]], speed: 1.6, wait: 0.6 };

export const STORES: Record<LevelId, StoreArena> = {
   1: { theme: "mini", pieces: [], spills: [], movers: [], closeLaneAt: 0 },
   // produce stands in the entrance aisle, chilled cases on the east wall, and the misters wet the floor from the start
   2: {
      theme: "fresh",
      pieces: [
         { kind: "fruitStand", x: -13.4, z: -4.2, w: 1.7, d: 1.55, h: 1.4 },
         { kind: "fruitStand", x: -13.4, z: 0.6, w: 1.7, d: 1.55, h: 1.4 },
         { kind: "cooler", x: 14.85, z: -8.4, w: 1.0, d: 1.4, h: 2 },
         { kind: "cooler", x: 14.85, z: 6.6, w: 1.0, d: 1.4, h: 2 },
      ],
      spills: [{ x: -12.3, z: -7.6, radius: 1.1, spawnS: 0 }, { x: 12.8, z: -6.2, radius: 1.1, spawnS: 0 }],
      movers: [],
      closeLaneAt: 0,
   },
   // stock pallets zigzag aisles 2 and 5; a floor scrubber patrols the entrance aisle
   3: {
      theme: "household",
      pieces: [...AISLE2_ZIGZAG, crates(7.5, -3.35, 1.8, 0.9)],
      spills: [],
      movers: [SCRUBBER_AISLE1],
      closeLaneAt: 0,
   },
   // promo bakery islands, the aisle-2 zigzag and a stock pallet on the move in aisle 5
   4: {
      theme: "superstore",
      pieces: [...AISLE2_ZIGZAG, { kind: "bakery", x: -13.0, z: -2.0, w: 1.9, d: 2.0, h: 2.4 }, { kind: "bakery", x: 13.2, z: 6.0, w: 1.9, d: 2.0, h: 2.4 }],
      spills: [],
      movers: [PALLET_AISLE5],
      closeLaneAt: 0,
   },
   // closing time: the scrubber and the pallet both out, mop water by the freezers, the west lane shuts at 60 s
   5: {
      theme: "closing",
      pieces: [...AISLE2_ZIGZAG],
      spills: [{ x: -6.5, z: -9.0, radius: 1.1, spawnS: 0 }, { x: 8.8, z: 6.2, radius: 1.1, spawnS: 30 }],
      movers: [SCRUBBER_AISLE1, PALLET_AISLE5],
      closeLaneAt: 60,
   },
};

export interface ShoppingCartLevel {
   /** number of items on the shopping list */
   listCount: number;
   /** run duration in milliseconds */
   durationMs: number;
   /** seconds when the 4th shopper (shopperD) activates (0 = active from start) */
   shopperDActiveS: number;
   /** shopper walking speed (m/s) */
   shopperSpeed: number;
   /** shopper waypoint wait time (s) */
   shopperWait: number;
   /** minimum tour distance gate for list generation (m) */
   minTourDistance: number;
   /** the store floor (STORES) */
   store: StoreArena;
}

export const LEVELS: Record<LevelId, ShoppingCartLevel> = {
   // Level 1 — Mini Market: today's game unchanged (6 items, 75 s)
   1: {
      listCount: 6,
      durationMs: 75_000,
      shopperDActiveS: 40.0,
      shopperSpeed: 1.8,
      shopperWait: 0.6,
      minTourDistance: 52.0,
      store: STORES[1],
   },
   // Level 2 — Fresh Food: 7 items, 100 s, faster shoppers
   2: {
      listCount: 7,
      durationMs: 100_000,
      shopperDActiveS: 30.0,
      shopperSpeed: 1.9,
      shopperWait: 0.5,
      minTourDistance: 52.0,
      store: STORES[2],
   },
   // Level 3 — Household Aisles: 9 items, 150 s, shopperD active at 20 s
   3: {
      listCount: 9,
      durationMs: 150_000,
      shopperDActiveS: 20.0,
      shopperSpeed: 2.0,
      shopperWait: 0.4,
      minTourDistance: 52.0,
      store: STORES[3],
   },
   // Level 4 — Superstore: 12 items, 150 s, shopperD active at 15 s
   4: {
      listCount: 12,
      durationMs: 150_000,
      shopperDActiveS: 15.0,
      shopperSpeed: 2.1,
      shopperWait: 0.3,
      minTourDistance: 52.0,
      store: STORES[4],
   },
   // Level 5 — Closing-Time Rush: 15 items, 180 s, all 4 shoppers active from start
   5: {
      listCount: 15,
      durationMs: 180_000,
      shopperDActiveS: 0.0,
      shopperSpeed: 2.2,
      shopperWait: 0.2,
      minTourDistance: 52.0,
      store: STORES[5],
   },
};
