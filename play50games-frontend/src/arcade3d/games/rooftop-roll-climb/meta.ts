import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 02. Status "dev" (preview builds only) until the user signs it off.
// A time game: the finish time minus the coin and flow bonus is the score (README "Scoring").
// Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Low Roofs",
   2: "Office Roofs",
   3: "Moving Rooftops",
   4: "Night Skyline",
   5: "High-Rise Climb",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const rooftopRollClimbMeta: ArcadeGameMeta = {
   slug: "rooftop-roll-climb",
   title: "Rooftop Roll Climb",
   tagline: "Bank speed down slanted roofs, then leap the street.",
   description: "Climb a zigzag city skyline as a Color Roll Heroes armadillo: curl into a ball on the slanted tin roofs to bank speed, then spend it on huge leaps across the streets. Pick Riko, Nami, Kiro, Zuno or Vexa, grab coins to cut your time, and beat Ashback on the helipad.",
   order: 52,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move, Space to jump, E or Enter for the hero power",
      touch: "Joystick + Jump and Power buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#f59e0b",
   owner: "cursor",
};
