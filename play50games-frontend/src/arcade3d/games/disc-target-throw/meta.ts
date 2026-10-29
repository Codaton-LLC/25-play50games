import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 40, World 3 "Wild Temples" (green; lead hero Kiro). Status "dev"
// (preview builds only) until the user signs it off. A points game: targets times the banks before the
// hit, colour order, clean catches, the flow bonus, the speed bonus and on level 5 Mother Snapper's hits
// (README "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 73.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Static Targets",
   2: "Moving Targets",
   3: "Color Targets",
   4: "Fast Combo",
   5: "Accuracy Master",
};

const scoring = (id: LevelId): ScoringRules => {
   const l = PROPOSED_LEVEL_LIMITS[id];
   return {
      kind: "points",
      maxScore: l.maxScore,
      minDurationMs: l.minDurationMs,
      maxDurationMs: l.maxDurationMs,
      base: l.base,
      maxPointsPerSec: l.maxPointsPerSec,
      unitLabel: "pts",
      display: "int",
   };
};

export const discTargetThrowMeta: ArcadeGameMeta = {
   slug: "disc-target-throw",
   title: "Disc Target Throw",
   tagline: "Throw, bank off the stone, catch it coming back.",
   description:
      "Stand in a jungle-ruin courtyard and throw a returning training disc: hook it round pillars, bank it off the carved walls for double and triple points, and be on the spot when it swings back to keep your catch combo. Moving rail targets, colour-order idols, a drifting raft and disc-snatching monkeys, then Mother Snapper on level 5. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 73,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move (camera-relative); hold Space to aim where the camera looks, A / D or the arrows hook, let go to throw; E or Enter fires the hero power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick moves; hold Throw to aim where the camera looks, push the joystick sideways to hook, let go to throw; Power button; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#2e9a7a",
   owner: "claude",
};
