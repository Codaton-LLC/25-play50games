// Each level's own bay (README "Levels"): its light and fog, what the four wall screens show, and a
// row of level props on the back floor strip behind the belts (z -1.75 .. -2.35, below the screens).
// Pure data; FactorySets.tsx draws it. Everything stands outside PLAY_BOUNDS (factorySets.test.ts).
import type { LightingPreset } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";

export interface FactoryTheme {
   lighting: LightingPreset;
   background: string;
   /** what the wall screens show: today's telemetry, shapes, colour swatches, the bin chart, the alarm */
   screen: "telemetry" | "shapes" | "swatches" | "bins" | "alarm";
   /** extra coloured key light over the bay (null = today's three lights only) */
   accent: string | null;
   /** red rotating beacons and wall sparks (Overdrive) */
   alarm: boolean;
}

export const FACTORY_THEMES: Record<LevelId, FactoryTheme> = {
   1: { lighting: "indoor", background: "#0f172a", screen: "telemetry", accent: null, alarm: false },
   // Shape Sort: a bright skylit bay, the screens teach the four shapes
   2: { lighting: "day", background: "#1e3a5f", screen: "shapes", accent: null, alarm: false },
   // Color + Shape: a warm paint shop, colour swatches on the screens
   3: { lighting: "sunset", background: "#3b1d2e", screen: "swatches", accent: "#f472b6", alarm: false },
   // Fast Factory: a cool green logistics hall with a bin rack and the sorting chart
   4: { lighting: "indoor", background: "#052e2b", screen: "bins", accent: "#34d399", alarm: false },
   // Overdrive: the night shift under red alarm light, beacons turning and sparks on the wall
   5: { lighting: "night", background: "#1a0505", screen: "alarm", accent: "#ef4444", alarm: true },
};

export type PropKind = "shapeCube" | "shapeCone" | "shapeBall" | "shapeTube" | "drum" | "rack" | "beacon";

export interface PropSpot {
   kind: PropKind;
   x: number;
   z: number;
   /** footprint half-width (x), half-depth (z) and top (m), for the bounds and sightline checks */
   hw: number;
   hd: number;
   h: number;
   /** palette index (looks.ts COLORS.parts) or -1 */
   tone: number;
}

const BACK_Z = -2.05;
/** The front corners beside the bay (outside x +-3.5, so nothing stands between the camera and the belts). */
const L = -3.75;
const R = 3.7;
const FZ = 2.0;

export const FACTORY_PROPS: Record<LevelId, readonly PropSpot[]> = {
   1: [],
   2: [
      { kind: "shapeCube", x: L, z: FZ, hw: 0.3, hd: 0.3, h: 0.55, tone: 0 },
      { kind: "shapeCone", x: L - 0.75, z: FZ + 0.2, hw: 0.3, hd: 0.3, h: 0.7, tone: 1 },
      { kind: "shapeBall", x: R, z: FZ, hw: 0.3, hd: 0.3, h: 0.6, tone: 2 },
      { kind: "shapeTube", x: R + 0.75, z: FZ + 0.2, hw: 0.28, hd: 0.28, h: 0.65, tone: 3 },
      { kind: "shapeCone", x: -0.8, z: BACK_Z, hw: 0.35, hd: 0.35, h: 0.75, tone: 1 },
      { kind: "shapeBall", x: 0.8, z: BACK_Z, hw: 0.35, hd: 0.35, h: 0.65, tone: 2 },
   ],
   3: [
      { kind: "drum", x: L, z: FZ, hw: 0.3, hd: 0.3, h: 0.8, tone: 0 },
      { kind: "drum", x: L - 0.7, z: FZ + 0.15, hw: 0.3, hd: 0.3, h: 0.8, tone: 1 },
      { kind: "drum", x: R, z: FZ, hw: 0.3, hd: 0.3, h: 0.8, tone: 2 },
      { kind: "drum", x: R + 0.7, z: FZ + 0.15, hw: 0.3, hd: 0.3, h: 0.8, tone: 3 },
      { kind: "shapeCone", x: -0.6, z: BACK_Z, hw: 0.3, hd: 0.3, h: 0.6, tone: 2 },
      { kind: "shapeCube", x: 0.6, z: BACK_Z, hw: 0.3, hd: 0.3, h: 0.5, tone: 0 },
   ],
   4: [
      { kind: "rack", x: -1.9, z: BACK_Z - 0.1, hw: 1.05, hd: 0.3, h: 1.3, tone: -1 },
      { kind: "rack", x: 1.9, z: BACK_Z - 0.1, hw: 1.05, hd: 0.3, h: 1.3, tone: -1 },
      { kind: "rack", x: L - 0.45, z: FZ + 0.1, hw: 1.05, hd: 0.3, h: 1.3, tone: -1 },
      { kind: "rack", x: R + 0.45, z: FZ + 0.1, hw: 1.05, hd: 0.3, h: 1.3, tone: -1 },
   ],
   5: [
      { kind: "beacon", x: L, z: FZ, hw: 0.2, hd: 0.2, h: 0.9, tone: -1 },
      { kind: "beacon", x: R, z: FZ, hw: 0.2, hd: 0.2, h: 0.9, tone: -1 },
      { kind: "beacon", x: 0, z: -2.3, hw: 0.2, hd: 0.2, h: 0.9, tone: -1 },
      { kind: "drum", x: L - 0.7, z: FZ + 0.15, hw: 0.3, hd: 0.3, h: 0.8, tone: 2 },
      { kind: "drum", x: R + 0.7, z: FZ + 0.15, hw: 0.3, hd: 0.3, h: 0.8, tone: 2 },
   ],
};

/** The painted floor sign in front of the bay (flat, so it hides nothing): one per level 2-5. */
export const FLOOR_SIGN = { x: 0, z: 2.3, w: 5.4, d: 1.3 } as const;

/** Where the alarm sparks fly from (the back wall, over the screens). */
export const SPARK_SPOTS = [
   { x: -2.8, y: 3.1, z: -2.5 },
   { x: 1.0, y: 3.3, z: -2.5 },
   { x: 2.8, y: 3.0, z: -2.5 },
] as const;
