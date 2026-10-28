import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 27, World 2. Status "dev" (preview builds only) until the user signs it off.
// A points game: rings, orbs, the flow bonus, the landing, the speed bonus and on level 5 Cyclone Ray's
// hits (README "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 56 (55 is cloud-hopper).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Wide Rings",
   2: "Moving Rings",
   3: "Updraft Rings",
   4: "Fast Route",
   5: "Perfect Streak",
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

export const ringJumpChallengeMeta: ArcadeGameMeta = {
   slug: "ring-jump-challenge",
   title: "Ring Jump Challenge",
   tagline: "Leap off the column and dive a sea canyon through rings.",
   description: "Leap from a stone column and steer a long free-fall down a sea canyon as a Color Roll Heroes armadillo: thread the rings for points and speed, hit their centres, tuck into a dive to beat the clock, and land on the target pad. Pick Riko, Nami, Kiro, Zuno or Vexa; level 5 ends on Cyclone Ray's tail.",
   order: 56,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to steer, hold Space to dive (Space leaps off the column), E or Enter for the hero power",
      touch: "Joystick to steer, hold Dive, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#22d3ee",
   owner: "claude",
};
