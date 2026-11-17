import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data only (server-safe). scoring and levels match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts)
// and WP includes/arcade-games.json (registry.sync.test.ts). A level clears on a win (time game).
// Time game: score = max(0, floor((timeBaseMs - durationMs) / 10)).
const T = { kind: "time", base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" } as const;
const SCORING: ScoringRules = { ...T, maxScore: 17_860, minDurationMs: 1400, maxDurationMs: 180_000, timeBaseMs: 180_000 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...T, maxScore: 20_590, minDurationMs: 4100, maxDurationMs: 210_000, timeBaseMs: 210_000 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...T, maxScore: 23_700, minDurationMs: 3000, maxDurationMs: 240_000, timeBaseMs: 240_000 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...T, maxScore: 23_500, minDurationMs: 5000, maxDurationMs: 240_000, timeBaseMs: 240_000 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...T, maxScore: 29_320, minDurationMs: 6800, maxDurationMs: 300_000, timeBaseMs: 300_000 } },
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
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/haunted-mansion-keys.webp",
   accent: "#c4b5fd",
   owner: "antigravity",
};
