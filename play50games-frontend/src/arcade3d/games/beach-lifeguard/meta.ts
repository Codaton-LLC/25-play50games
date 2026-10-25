import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts).
// Clear condition: rescues saved.
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = {
   ...PTS,
   maxScore: 1020,
   minDurationMs: 4000,
   maxDurationMs: 120_000,
   base: 500,
   maxPointsPerSec: 21,
};

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1360, minDurationMs: 4000, maxDurationMs: 150_000, base: 750, maxPointsPerSec: 16 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1690, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 14 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 1880, minDurationMs: 4000, maxDurationMs: 180_000, base: 1250, maxPointsPerSec: 10 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2190, minDurationMs: 4000, maxDurationMs: 210_000, base: 1500, maxPointsPerSec: 9 } },
];

export const beachLifeguardMeta: ArcadeGameMeta = {
   slug: "beach-lifeguard",
   title: "Beach Lifeguard",
   tagline: "Run, swim, rescue.",
   description: "Sprint across the sand, wade into the water, grab the swimmer in trouble and bring them back to the beach before the alert runs out.",
   order: 34,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to grab",
      touch: "Joystick to move + Grab",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#fb7185",
   owner: "antigravity",
};
