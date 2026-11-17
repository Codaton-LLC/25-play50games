import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data (server-safe). The numbers equal rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and
// WP includes/arcade-games.json (registry.sync.test.ts). A level clears only on a win (every rescue made).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 1110, minDurationMs: 4000, maxDurationMs: 120_000, base: 500, maxPointsPerSec: 107 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Small Beach", scoring: SCORING },
   { id: 2, title: "Busy Beach", scoring: { ...PTS, maxScore: 1490, minDurationMs: 4000, maxDurationMs: 150_000, base: 750, maxPointsPerSec: 64 } },
   { id: 3, title: "Resort", scoring: { ...PTS, maxScore: 1860, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 46 } },
   { id: 4, title: "Waterpark", scoring: { ...PTS, maxScore: 2130, minDurationMs: 4000, maxDurationMs: 180_000, base: 1250, maxPointsPerSec: 50 } },
   { id: 5, title: "Stormy Beach", scoring: { ...PTS, maxScore: 2510, minDurationMs: 4000, maxDurationMs: 210_000, base: 1500, maxPointsPerSec: 44 } },
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
   thumbnail: "/images/3d/beach-lifeguard.webp",
   accent: "#fb7185",
   owner: "antigravity",
};
