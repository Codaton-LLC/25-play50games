import type { ArcadeGameMeta, ArcadeSlug, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts). Claude copies
// them into arcade-games.json. A level clears only on a win (every fire out, every neighbour out).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 1100, minDurationMs: 4000, maxDurationMs: 120_000, base: 400, maxPointsPerSec: 96 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1650, minDurationMs: 4000, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 40 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 2200, minDurationMs: 4000, maxDurationMs: 180_000, base: 1200, maxPointsPerSec: 32 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2550, minDurationMs: 4000, maxDurationMs: 180_000, base: 1600, maxPointsPerSec: 24 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 3050, minDurationMs: 4000, maxDurationMs: 210_000, base: 2000, maxPointsPerSec: 20 } },
];

export const firefighterRescueMeta: ArcadeGameMeta = {
   // Claude adds this slug to ARCADE_SLUGS, loaders.ts and arcade-games.json.
   slug: "firefighter-rescue" as ArcadeSlug,
   title: "Firefighter Rescue",
   tagline: "Put the fires out. Walk the neighbours clear.",
   description: "Enter one floor, hold a spray on each fire, and walk one neighbour at a time out to the exit sign.",
   order: 31,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows move, hold E or Enter to spray, Space hops",
      touch: "Joystick moves, Spray, Hop",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/firefighter-rescue.webp",
   accent: "#f97316",
   owner: "cursor",
};
