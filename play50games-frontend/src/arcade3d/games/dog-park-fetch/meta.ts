import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts), and
// arcade-games.json carries the same five. A level clears only on a win (every throw back, all but one).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 890, minDurationMs: 4000, maxDurationMs: 90_000, base: 680, maxPointsPerSec: 10 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1240, minDurationMs: 4000, maxDurationMs: 120_000, base: 960, maxPointsPerSec: 8 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1590, minDurationMs: 4000, maxDurationMs: 150_000, base: 1300, maxPointsPerSec: 5 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 1820, minDurationMs: 4000, maxDurationMs: 150_000, base: 1640, maxPointsPerSec: 2 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2150, minDurationMs: 4000, maxDurationMs: 180_000, base: 1920, maxPointsPerSec: 2 } },
];

export const dogParkFetchMeta: ArcadeGameMeta = {
   slug: "dog-park-fetch",
   title: "Dog Park Fetch",
   tagline: "Fetch it. Bring it back.",
   description: "Chase balls, sticks and frisbees around the park as a happy dog and bring each one back to your owner.",
   order: 41,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to run, Space to jump",
      touch: "Joystick to run + Jump",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#f59e0b",
   owner: "kimi",
};
