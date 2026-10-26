import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 03. Status "dev" (preview builds only) until the user signs it off.
// A time game: the finish time minus the coin bonus is the score (README "Scoring").
// Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Drain Entry",
   2: "Pipe Maze",
   3: "Valve Shaft",
   4: "Flood Rise",
   5: "Final Escape",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const floodedRuinsEscapeMeta: ArcadeGameMeta = {
   slug: "flooded-ruins-escape",
   title: "Flooded Ruins Escape",
   tagline: "Climb the ruins before the water rises.",
   description: "Climb ancient stone ledges in a flooding ruin as a Color Roll Heroes armadillo. Pick Riko, Nami, Kiro, Zuno or Vexa, grab coins to cut your time, and reach the flood gate before the water does.",
   order: 53,
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
   accent: "#0d9488",
   owner: "cursor",
};
