import type { ArcadeGameMeta, LevelMeta } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data (server-safe). The five limits equal rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and
// play50games-backend/play50games/includes/arcade-games.json (registry.sync.test.ts); README has the
// proof. A level clears only on a win (every task resolved, at most one train missed), so no clearScore.
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: { ...PTS, maxScore: 1110, minDurationMs: 17_200, maxDurationMs: 122_000, base: 600, maxPointsPerSec: 30 } },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1520, minDurationMs: 25_900, maxDurationMs: 152_000, base: 900, maxPointsPerSec: 24 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1915, minDurationMs: 22_900, maxDurationMs: 182_000, base: 1200, maxPointsPerSec: 20 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2170, minDurationMs: 26_900, maxDurationMs: 182_000, base: 1500, maxPointsPerSec: 15 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2530, minDurationMs: 26_900, maxDurationMs: 212_000, base: 1800, maxPointsPerSec: 12 } },
];

export const trainStationRushMeta: ArcadeGameMeta = {
   slug: "train-station-rush",
   title: "Train Station Rush",
   tagline: "Every bag on the right train.",
   description: "Carry luggage and guide passengers to the right platforms before each train pulls out of the station.",
   order: 44,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to use",
      touch: "Joystick to move + Use",
   },
   scoring: LEVELS[0].scoring,
   levels: LEVELS,
   thumbnail: null,
   accent: "#38bdf8",
   owner: "claude",
};
