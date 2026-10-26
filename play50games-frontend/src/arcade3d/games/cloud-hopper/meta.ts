import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 05. Status "dev" (preview builds only) until the user signs it off.
// A time game: the finish time minus the star bonus is the score (README "Scoring").
// Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 55: 54 is lava-pillar-jump on another branch.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Soft Clouds",
   2: "Moving Clouds",
   3: "Wind Zone",
   4: "Fading Clouds",
   5: "Sky Sprint",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const cloudHopperMeta: ArcadeGameMeta = {
   slug: "cloud-hopper",
   title: "Cloud Hopper",
   tagline: "Bounce the clouds and hop to the top of the sky.",
   description: "Hop a helix of soft clouds as a Color Roll Heroes armadillo. Pick Riko, Nami, Kiro, Zuno or Vexa, bounce off the springy clouds, ride a drifting chain, and reach the rainbow arch.",
   order: 55,
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
   accent: "#38bdf8",
   owner: "cursor",
};
