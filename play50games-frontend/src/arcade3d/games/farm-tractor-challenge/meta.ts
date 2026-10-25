import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts).
// A level clears only on a win (every trip parked). Owner stays the stub's "kimi".
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 1000, minDurationMs: 4000, maxDurationMs: 120_000, base: 600, maxPointsPerSec: 22 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1340, minDurationMs: 4000, maxDurationMs: 150_000, base: 900, maxPointsPerSec: 13 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1740, minDurationMs: 4000, maxDurationMs: 180_000, base: 1200, maxPointsPerSec: 12 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 1960, minDurationMs: 4000, maxDurationMs: 180_000, base: 1500, maxPointsPerSec: 9 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2280, minDurationMs: 4000, maxDurationMs: 210_000, base: 1800, maxPointsPerSec: 8 } },
];

export const farmTractorChallengeMeta: ArcadeGameMeta = {
   slug: "farm-tractor-challenge",
   title: "Farm Tractor Challenge",
   tagline: "Hitch, haul, park.",
   description: "Drive a tractor across the farm, roll gently into hay bales to load the trailer and park them in the barn bay.",
   order: 35,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "WASD / arrows to drive",
      touch: "Joystick to drive",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#eab308",
   owner: "kimi",
};
