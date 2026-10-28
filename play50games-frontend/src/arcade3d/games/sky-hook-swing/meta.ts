import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const skyHookSwingMeta: ArcadeGameMeta = {
   slug: "sky-hook-swing",
   title: "Sky Hook Swing",
   tagline: "Aim, reel, release. Chain the rings across the docks.",
   description: "Swing an analytic rope between grapple rings over the sky docks. Reel in to clear a wall, release on the green flash for a faster fling, and chain four releases without touching down. Pick any Color Roll Hero. Level 5 is the Gust Galleon.",
   order: 56,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move and reel, Space to jump, E or Enter to hook and release",
      touch: "Joystick, Jump and Hook buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: null,
   accent: "#38bdf8",
   owner: "cursor",
};
