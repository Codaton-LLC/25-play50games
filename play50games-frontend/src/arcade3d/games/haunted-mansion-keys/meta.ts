import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Time game: score = max(0, floor((timeBaseMs - durationMs) / 10)).
export const PROPOSED_LEVEL_LIMITS: Record<1 | 2 | 3 | 4 | 5, ScoringRules> = {
   1: { kind: "time", maxScore: 17_800, minDurationMs: 2000, maxDurationMs: 180_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 180_000, unitLabel: "time", display: "time" },
   2: { kind: "time", maxScore: 20_750, minDurationMs: 2500, maxDurationMs: 210_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 210_000, unitLabel: "time", display: "time" },
   3: { kind: "time", maxScore: 23_600, minDurationMs: 4000, maxDurationMs: 240_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 240_000, unitLabel: "time", display: "time" },
   4: { kind: "time", maxScore: 23_500, minDurationMs: 5000, maxDurationMs: 240_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 240_000, unitLabel: "time", display: "time" },
   5: { kind: "time", maxScore: 29_500, minDurationMs: 5000, maxDurationMs: 300_000, base: 0, maxPointsPerSec: 0, timeBaseMs: 300_000, unitLabel: "time", display: "time" },
};

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: PROPOSED_LEVEL_LIMITS[1] },
   { id: 2, title: LEVEL_TITLES[2], scoring: PROPOSED_LEVEL_LIMITS[2] },
   { id: 3, title: LEVEL_TITLES[3], scoring: PROPOSED_LEVEL_LIMITS[3] },
   { id: 4, title: LEVEL_TITLES[4], scoring: PROPOSED_LEVEL_LIMITS[4] },
   { id: 5, title: LEVEL_TITLES[5], scoring: PROPOSED_LEVEL_LIMITS[5] },
];

export const hauntedMansionKeysMeta: ArcadeGameMeta = {
   slug: "haunted-mansion-keys",
   title: "Haunted Mansion Keys",
   tagline: "Find the keys. Find the way out.",
   description: "Search a dark mansion room by room for coloured keys, open the matching doors and escape as fast as you can.",
   order: 39,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to use",
      touch: "Joystick to move + Use",
   },
   scoring: PROPOSED_LEVEL_LIMITS[1],
   levels: LEVELS,
   thumbnail: null,
   accent: "#c4b5fd",
   owner: "antigravity",
};
