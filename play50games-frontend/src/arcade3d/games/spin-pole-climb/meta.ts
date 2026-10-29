import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 34, World 3 "Wild Temples" (green; lead hero Kiro). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time minus the orb and
// flow bonus is the score (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts, bound.ts). order 71.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Slow Poles",
   2: "Twin Poles",
   3: "Mixed Rotation",
   4: "Fast Tower",
   5: "Spin Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const spinPoleClimbMeta: ArcadeGameMeta = {
   slug: "spin-pole-climb",
   title: "Spin Pole Climb",
   tagline: "Run round the pole. Every lap carries you up.",
   description:
      "Climb ancient stone poles by running round their spiral stairs: every lap lifts you 3 m. The poles turn, carrying you up like an escalator or treadmilling you down, so read the spin and hop to the neighbour pole that turns your way. Jump the sweeper bars, spike collars and gaps, pick Riko, Nami, Kiro, Zuno or Vexa, and on level 5 climb past Coilstone, the Temple Serpent, to ring the gong on top.",
   order: 71,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "A / D or arrows run round the pole (camera-relative), Space jumps; Space while facing another pole and pushing towards it hops across; E or Enter fires the hero power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick runs round the pole, Jump (push towards another pole to hop) and Power buttons; two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#22c55e",
   owner: "claude",
};
