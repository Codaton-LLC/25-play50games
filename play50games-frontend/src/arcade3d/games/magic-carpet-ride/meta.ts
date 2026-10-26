import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts).
// A level clears only on a win (ring quota and star quota at the arch).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 1000, minDurationMs: 4000, maxDurationMs: 120_000, base: 640, maxPointsPerSec: 9 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1420, minDurationMs: 4000, maxDurationMs: 150_000, base: 960, maxPointsPerSec: 8 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1780, minDurationMs: 4000, maxDurationMs: 180_000, base: 1250, maxPointsPerSec: 8 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2060, minDurationMs: 4000, maxDurationMs: 180_000, base: 1540, maxPointsPerSec: 8 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2650, minDurationMs: 4000, maxDurationMs: 240_000, base: 1910, maxPointsPerSec: 9 } },
];

export const magicCarpetRideMeta: ArcadeGameMeta = {
   slug: "magic-carpet-ride",
   title: "Magic Carpet Ride",
   tagline: "Through the rings, among the stars.",
   description: "Fly a magic carpet along a winding route, pass through the rings, collect the stars and steer clear of the floating rocks.",
   order: 47,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to steer, hold Space to boost",
      touch: "Joystick to steer + hold Boost",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#a78bfa",
   owner: "cursor",
};
