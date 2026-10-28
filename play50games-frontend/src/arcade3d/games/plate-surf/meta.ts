import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 37, World 2. Status "dev" (preview builds only) until the user signs it off.
// A time game: the finish time minus the orb and flow bonus is the score (README "Scoring").
// Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 56: the next slot after the Menu 2 games already in the registry (orders are the slug list's positions).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Training Swell",
   2: "Rocky Path",
   3: "Jump Gates",
   4: "Speed Canyon",
   5: "Plate Surf Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const plateSurfMeta: ArcadeGameMeta = {
   slug: "plate-surf",
   title: "Plate Surf",
   tagline: "Ride a giant rolling wave. Pump for speed, air off the lip, outrun the curl.",
   description: "Surf a curling wave on a hero plate as a Color Roll Heroes armadillo: carve up and down the face to pump for speed, launch off the lip for spins, flips and grabs, and stay ahead of the curl. Pick Riko, Nami, Kiro, Zuno or Vexa and ride to the lagoon.",
   order: 56,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "A / D or left / right to carve down and up the face (S brakes), Space at the lip to air (hold a direction for a trick), E or Enter for the hero power",
      touch: "Joystick to carve, Jump at the lip to air (hold the joystick for a trick), Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#22d3ee",
   owner: "claude",
};
