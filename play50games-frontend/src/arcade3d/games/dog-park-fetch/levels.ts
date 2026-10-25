// Dog Park Fetch level configs (docs/menu1-new/specs-41-50.md §41). One fenced lawn; throws,
// mowers, patience, tint and lighting change. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface DogLevel {
   width: number;
   depth: number;
   throws: number;
   /** landing distance from the blanket, metres (uniform) */
   throwMin: number;
   throwMax: number;
   mowers: number;
   mowerSpeed: number;
   /** seconds a throw may lie on the grass before the owner fetches it (0 = waits forever) */
   patienceS: number;
   /** the fountain in the middle of the lawn (L2+) */
   fountain: boolean;
   tint: string | null;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
}

export const LEVELS: Record<LevelId, DogLevel> = {
   1: { width: 20, depth: 16, throws: 4, throwMin: 6, throwMax: 10, mowers: 0, mowerSpeed: 0, patienceS: 0, fountain: false, tint: null, durationMs: 90_000, lighting: "day", background: "#bae6fd" },
   2: { width: 26, depth: 20, throws: 6, throwMin: 7, throwMax: 13, mowers: 0, mowerSpeed: 0, patienceS: 0, fountain: true, tint: "#fde68a", durationMs: 120_000, lighting: "day", background: "#7dd3fc" },
   3: { width: 30, depth: 24, throws: 8, throwMin: 8, throwMax: 15, mowers: 1, mowerSpeed: 1.8, patienceS: 0, fountain: true, tint: "#78716c", durationMs: 150_000, lighting: "day", background: "#86efac" },
   4: { width: 32, depth: 26, throws: 10, throwMin: 8, throwMax: 16, mowers: 1, mowerSpeed: 2.2, patienceS: 14, fountain: true, tint: "#f8fafc", durationMs: 150_000, lighting: "sunset", background: "#fdba74" },
   5: { width: 36, depth: 28, throws: 12, throwMin: 9, throwMax: 18, mowers: 2, mowerSpeed: 2.4, patienceS: 12, fountain: true, tint: "#fb923c", durationMs: 180_000, lighting: "day", background: "#fde68a" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Small Park",
   2: "City Park",
   3: "Forest Park",
   4: "Beach Park",
   5: "Dog Festival",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Four throws, learn the blanket.",
   2: "Longer throws around the fountain.",
   3: "Mind the mower.",
   4: "Fetch it before the owner does.",
   5: "Twelve throws, two mowers.",
};
