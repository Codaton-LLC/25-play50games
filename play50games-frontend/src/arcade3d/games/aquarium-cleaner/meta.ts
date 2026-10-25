import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data (server-safe). Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts), and
// arcade-games.json carries the same five (registry.sync.test.ts). A level clears on a win or when
// every task is done (clearScore = 120 x tasks, the objective points without the air bonus).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 925, minDurationMs: 4000, maxDurationMs: 120_000, base: 450, maxPointsPerSec: 52 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING, clearScore: 360 },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1180, minDurationMs: 4000, maxDurationMs: 150_000, base: 600, maxPointsPerSec: 41 }, clearScore: 480 },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1450, minDurationMs: 4000, maxDurationMs: 180_000, base: 750, maxPointsPerSec: 46 }, clearScore: 600 },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 1580, minDurationMs: 4000, maxDurationMs: 180_000, base: 900, maxPointsPerSec: 32 }, clearScore: 720 },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 1990, minDurationMs: 4000, maxDurationMs: 210_000, base: 1200, maxPointsPerSec: 27 } },
];

export const aquariumCleanerMeta: ArcadeGameMeta = {
   slug: "aquarium-cleaner",
   title: "Aquarium Cleaner",
   tagline: "Scrub, collect, keep breathing.",
   description: "Walk the floor of a giant aquarium as a diver, scrub the algae, collect the trash and check the machines before your air runs low.",
   order: 49,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, hold E or Enter to work, Space to float up",
      touch: "Joystick to move + hold Work + Float",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#2dd4bf",
   owner: "kimi",
};
