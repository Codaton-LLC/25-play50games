import type { ArcadeGameMeta, LevelMeta } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data (server-safe). The five limits equal rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and
// play50games-backend/play50games/includes/arcade-games.json (registry.sync.test.ts); README has the
// proof. A level clears only on a win (every bag delivered), so no clearScore.
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: { ...PTS, maxScore: 910, minDurationMs: 2000, maxDurationMs: 122_000, base: 360, maxPointsPerSec: 58 } },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1250, minDurationMs: 2000, maxDurationMs: 152_000, base: 600, maxPointsPerSec: 33 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1575, minDurationMs: 2000, maxDurationMs: 182_000, base: 840, maxPointsPerSec: 23 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 1745, minDurationMs: 2000, maxDurationMs: 182_000, base: 1080, maxPointsPerSec: 15 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2100, minDurationMs: 2000, maxDurationMs: 212_000, base: 1440, maxPointsPerSec: 9 } },
];

export const hotelBellboyRushMeta: ArcadeGameMeta = {
   slug: "hotel-bellboy-rush",
   title: "Hotel Bellboy Rush",
   tagline: "Right bag, right door.",
   description: "Push the luggage trolley through the hotel, ride the elevator and deliver every bag to the room on its key card.",
   order: 37,
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
   accent: "#fbbf24",
   owner: "claude",
};
