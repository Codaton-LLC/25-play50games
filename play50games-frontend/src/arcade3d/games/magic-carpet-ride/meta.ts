import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and WP
// includes/arcade-games.json (registry.sync.test.ts). A level clears only on a win (the ring quota at the end).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 2700, minDurationMs: 4000, maxDurationMs: 75_000, base: 1900, maxPointsPerSec: 25 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 3400, minDurationMs: 4000, maxDurationMs: 85_000, base: 2550, maxPointsPerSec: 22 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 4250, minDurationMs: 4000, maxDurationMs: 95_000, base: 3350, maxPointsPerSec: 20 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 4750, minDurationMs: 4000, maxDurationMs: 100_000, base: 3820, maxPointsPerSec: 20 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 5710, minDurationMs: 4000, maxDurationMs: 115_000, base: 4710, maxPointsPerSec: 18 } },
];

export const magicCarpetRideMeta: ArcadeGameMeta = {
   slug: "magic-carpet-ride",
   title: "Magic Carpet Ride",
   tagline: "Fly the rings, dodge the flock.",
   description: "Steer a magic carpet through desert skies, a red canyon, the clouds, a lantern-lit night and up to a floating palace: fly through rings for combos, sweep up coin arcs and gems, grab boosts and dodge gulls, balloons, bats, hawks and rocks.",
   order: 47,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows: left, right, up and down",
      touch: "Joystick to steer",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#a78bfa",
   owner: "cursor",
};
