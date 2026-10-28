import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data (server-safe). Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts), and
// arcade-games.json carries the same five (registry.sync.test.ts). A level clears only on a win
// (every toy on its shelf): there is no clearScore.
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 990, minDurationMs: 4000, maxDurationMs: 120_000, base: 500, maxPointsPerSec: 93 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1405, minDurationMs: 4000, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 57 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1715, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 48 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2110, minDurationMs: 4000, maxDurationMs: 180_000, base: 1400, maxPointsPerSec: 36 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2610, minDurationMs: 4000, maxDurationMs: 210_000, base: 1800, maxPointsPerSec: 28 } },
];

export const toyStoreNightShiftMeta: ArcadeGameMeta = {
   slug: "toy-store-night-shift",
   title: "Toy Store Night Shift",
   tagline: "Every toy on its shelf.",
   description: "Work the night shift in a toy store: pick up the scattered toys and put each one back on its matching shelf before the store opens.",
   order: 48,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to pick up / drop",
      touch: "Joystick to move + Use",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/toy-store-night-shift.webp",
   accent: "#f472b6",
   owner: "kimi",
};
