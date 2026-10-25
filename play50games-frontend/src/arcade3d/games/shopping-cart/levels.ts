// Crazy Shopping Cart's five levels: pure data, no React, no three.js (docs/arcade-levels.md §6.3).
// Only what varies across levels: shopping list item count, run duration, shopper D activation time,
// shopper speed and waypoint wait time, and minimum tour distance.
// Level 1 is today's game and never changes.
import type { LevelId } from "@/arcade3d/types";

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
   },
   // Level 2 — Fresh Food: 7 items, 100 s, faster shoppers
   2: {
      listCount: 7,
      durationMs: 100_000,
      shopperDActiveS: 30.0,
      shopperSpeed: 1.9,
      shopperWait: 0.5,
      minTourDistance: 52.0,
   },
   // Level 3 — Household Aisles: 9 items, 150 s, shopperD active at 20 s
   3: {
      listCount: 9,
      durationMs: 150_000,
      shopperDActiveS: 20.0,
      shopperSpeed: 2.0,
      shopperWait: 0.4,
      minTourDistance: 52.0,
   },
   // Level 4 — Superstore: 12 items, 150 s, shopperD active at 15 s
   4: {
      listCount: 12,
      durationMs: 150_000,
      shopperDActiveS: 15.0,
      shopperSpeed: 2.1,
      shopperWait: 0.3,
      minTourDistance: 52.0,
   },
   // Level 5 — Closing-Time Rush: 15 items, 180 s, all 4 shoppers active from start
   5: {
      listCount: 15,
      durationMs: 180_000,
      shopperDActiveS: 0.0,
      shopperSpeed: 2.2,
      shopperWait: 0.2,
      minTourDistance: 52.0,
   },
};
