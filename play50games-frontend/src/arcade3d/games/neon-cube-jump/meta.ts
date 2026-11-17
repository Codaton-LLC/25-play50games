import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 7, World 5 "Neon Cosmos" (purple; lead hero Vexa). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time less the orb, coin and
// flow bonus is the submitted time (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts). order 83.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Static Grid",
   2: "Moving Cubes",
   3: "Blink Grid",
   4: "Laser Grid",
   5: "Neon Overdrive",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const neonCubeJumpMeta: ArcadeGameMeta = {
   slug: "neon-cube-jump",
   title: "Neon Cube Jump",
   tagline: "Every jump flips the field. Land on the set you make.",
   description:
      "Neon cubes float over a violet void in two sets, square and triangle, and only one set is solid at a time: every jump flips them, so you plan each jump to land on the set it creates. Walk off an edge without flipping, park sliding cubes, sync to blinking ring cubes, switch lasers with your jumps, then out-think Flipframe, a giant built from the cubes themselves. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 83,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move (camera-relative), Space jumps (and flips the field), E or Enter fires the hero power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick, Jump (flips the field) and Power buttons; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#a855f7",
   owner: "claude",
};
