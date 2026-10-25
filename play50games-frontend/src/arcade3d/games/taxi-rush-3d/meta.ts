import type { ArcadeGameMeta, ArcadeSlug, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts). Claude copies
// them into arcade-games.json. A level clears only on a win (every fare dropped off).
const PTS = { kind: "points", unitLabel: "pts", display: "int", minDurationMs: 1200 } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 1250, maxDurationMs: 120_000, base: 600, maxPointsPerSec: 40 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1600, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 28 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1900, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 22 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2100, maxDurationMs: 180_000, base: 1200, maxPointsPerSec: 18 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2600, maxDurationMs: 210_000, base: 1600, maxPointsPerSec: 14 } },
];

export const taxiRushMeta: ArcadeGameMeta = {
   // Claude adds this slug to ARCADE_SLUGS, loaders.ts and arcade-games.json.
   slug: "taxi-rush-3d" as ArcadeSlug,
   title: "Taxi Rush 3D",
   tagline: "Stop for the fare. Stop for the drop.",
   description: "Drive a cab on a small street grid. Stop in the gold pad to pick up, then stop in the destination pad to drop off.",
   order: 32,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "WASD / arrows drive. Stop in a pad to pick up or drop off",
      touch: "Joystick drives. Stop in a pad to pick up or drop off",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/taxi-rush-3d.webp",
   accent: "#facc15",
   owner: "cursor",
};
