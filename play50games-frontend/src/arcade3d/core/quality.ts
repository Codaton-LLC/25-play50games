// Graphics quality tiers for cosmetic detail. Owned by Claude.
// ShellStage derives the tier from drei's PerformanceMonitor (slow periods it reported, "declines")
// and the pointer (a coarse pointer = a phone or tablet) and provides it to the Scene:
//
//    const { tier, particles, decor, water } = useQuality();
//    const trees = Math.round(TREE_SPOTS.length * decor);
//
// Games read it only for cosmetic counts (particles, decor, water waves); rules never depend on it,
// so scores stay fair on every device. The tier only goes down during a visit (declines are never
// forgotten), so pools and decor do not flicker between two sizes.
import { createContext, useContext } from "react";

export type QualityTier = "low" | "mid" | "high";

/** How detailed the water is: "flat" = one quad, no waves; "reduced" = fewer, smaller waves. */
export type WaterQuality = "flat" | "reduced" | "full";

export interface Quality {
   tier: QualityTier;
   /** factor for particle counts (core/fx scales every burst by it) */
   particles: number;
   /** factor for decorative props (trees, rocks, clutter); gameplay objects are never scaled */
   decor: number;
   /** <Water> detail */
   water: WaterQuality;
   /**
    * The tier's device-pixel-ratio cap (06 §10.4). Informational: ShellStage keeps its own adaptive
    * resolution (1.75, 1 after a slow period), which already stays within it for "high" and "low".
    */
   maxDpr: number;
}

export const QUALITY: Readonly<Record<QualityTier, Readonly<Quality>>> = {
   high: { tier: "high", particles: 1, decor: 1, water: "full", maxDpr: 1.75 },
   mid: { tier: "mid", particles: 0.7, decor: 0.8, water: "reduced", maxDpr: 1.5 },
   low: { tier: "low", particles: 0.4, decor: 0.5, water: "flat", maxDpr: 1 },
};

export interface QualityInput {
   /** slow periods PerformanceMonitor reported during this visit */
   declines: number;
   /** a touch-first device ((pointer: coarse)) */
   coarsePointer: boolean;
}

/** high: desktop, no declines; mid: a coarse pointer or one decline; low: two or more declines. */
export function tierFor({ declines, coarsePointer }: QualityInput): QualityTier {
   if (declines >= 2) return "low";
   if (declines >= 1 || coarsePointer) return "mid";
   return "high";
}

export function qualityFor(input: QualityInput): Readonly<Quality> {
   return QUALITY[tierFor(input)];
}

/**
 * `count` scaled by a quality factor, rounded, never below 1 for a positive count (a burst of 3
 * sparkles still shows one on "low") and never above `count`.
 */
export function scaledCount(count: number, factor: number): number {
   if (!(count > 0)) return 0;
   const f = factor > 0 ? Math.min(1, factor) : 0;
   return Math.max(1, Math.min(Math.floor(count), Math.round(count * f)));
}

const QualityContext = createContext<Readonly<Quality>>(QUALITY.high);

/** Provided by ShellStage inside the Canvas. Games never render it. */
export const QualityProvider = QualityContext.Provider;

/**
 * This device's quality (inside a GameShell Scene). Outside the canvas, e.g. in a game's DOM Hud,
 * it is "high".
 */
export function useQuality(): Readonly<Quality> {
   return useContext(QualityContext);
}
