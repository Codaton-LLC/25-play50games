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

export const wallRunTempleMeta: ArcadeGameMeta = {
   slug: "wall-run-temple",
   title: "Wall Run Temple",
   tagline: "No floor. Run the walls, kick across, whip round the columns.",
   description: "Cross a cliff temple with no floor: jump onto the glyph walls and run along them, kick from wall to wall before the run droops, and whip round stone columns at the corners. Sliding panels, spike panels, crumbling walls and swinging rams. Pick any Color Roll Hero. Level 5 is Umbra, the rival wall runner.",
   order: 70,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move and steer, Space to jump and wall-kick, E or Enter to roll on a wall (hero power off it)",
      touch: "Joystick, Jump (kick) and Roll buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: null,
   accent: "#4ade80",
   owner: "claude",
};
