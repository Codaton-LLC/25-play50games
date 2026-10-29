// Each level's store look (levels.ts STORES[].theme). Plain data, no three.js: the light, sky and fog
// for index.tsx, and the accent colours the Scene tints the shelf banners, the floor stripe and the
// set pieces with. Level 1 ("mini") is today's look.
import type { LightingPreset } from "@/arcade3d/core/types";
import { COLORS, FOG } from "./looks";
import type { StoreTheme } from "./levels";

export interface StoreLook {
   background: string;
   fog: readonly [string, number, number];
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   /** shelf banner / aisle sign tint; null keeps today's */
   banner: string | null;
   /** the stripe painted across the aisles' ends, null for none */
   stripe: string | null;
   /** pallet wood / crate tint for the set pieces */
   pallet: string;
}

export const STORE_LOOKS: Record<StoreTheme, StoreLook> = {
   mini: {
      background: COLORS.bg, fog: [COLORS.fog, FOG.near, FOG.far], lighting: "indoor", skyTop: COLORS.skyTop, skyBottom: COLORS.skyBottom,
      banner: null, stripe: null, pallet: "#a16207",
   },
   // Fresh Food: cool, bright chilled-aisle light, green produce banners
   fresh: {
      background: "#0c1f17", fog: ["#0c1f17", 20, 40], lighting: "snow", skyTop: "#064e3b", skyBottom: "#14532d",
      banner: "#16a34a", stripe: "#4ade80", pallet: "#a16207",
   },
   // Household Aisles: warm evening light, teal cleaning-goods banners
   household: {
      background: "#1a1410", fog: ["#1a1410", 19, 38], lighting: "indoor", skyTop: "#422006", skyBottom: "#78350f",
      banner: "#0d9488", stripe: "#2dd4bf", pallet: "#92400e",
   },
   // Superstore: bright daylight through the roof lights, big orange promo banners
   superstore: {
      background: "#0f1b2e", fog: ["#0f1b2e", 22, 44], lighting: "day", skyTop: "#1d4ed8", skyBottom: "#60a5fa",
      banner: "#ea580c", stripe: "#fb923c", pallet: "#b45309",
   },
   // Closing-Time Rush: the lights are half off, red closing banners
   closing: {
      background: "#05070d", fog: ["#05070d", 16, 34], lighting: "night", skyTop: "#020617", skyBottom: "#1e1b4b",
      banner: "#dc2626", stripe: "#f87171", pallet: "#78350f",
   },
};
