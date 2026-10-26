import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVEL1_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 01, the vertical slice: status "dev" (preview builds only) until the user signs it off.
// A time game: the finish time minus the orb bonus is the score (README "Scoring").
// Every level row still carries level 1's shipped limits. PROPOSED_LEVEL_LIMITS in rules.ts is the
// per-level proof; Claude copies levels 2-5 into meta and arcade-games.json together.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Training Sky",
   2: "Cloud Steps",
   3: "Moving Platforms",
   4: "Storm Heights",
   5: "Infinite Tower",
};

const scoring = (_id: LevelId): ScoringRules => ({
   ...LEVEL1_LIMITS,
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const skyTowerJumpMeta: ArcadeGameMeta = {
   slug: "sky-tower-jump",
   title: "Sky Tower Jump",
   tagline: "Jump the floating islands to the top of the sky.",
   description: "Climb a tower of floating islands as a Color Roll Heroes armadillo. Pick Riko, Nami, Kiro, Zuno or Vexa, grab orbs to cut your time, and reach the sky gate.",
   order: 31,
   status: "dev",
   collection: "rollheroes",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move, Space to jump, E or Enter for the hero power",
      touch: "Joystick + Jump and Power buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/sky-tower-jump.webp",
   accent: "#ef4444",
   owner: "claude",
};
