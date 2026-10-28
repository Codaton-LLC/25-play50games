import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 15, World 1 Ember Heights. Status "dev" until the user signs it off.
// A time game: the finish time minus the orb and flow bonus is the score (README "Scoring").
// order 56 (55 is cloud-hopper).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Red Block",
   2: "Bus Line",
   3: "Rush Hour",
   4: "Night Neon",
   5: "Greyout Avenue",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const colorCitySprintMeta: ArcadeGameMeta = {
   slug: "color-city-sprint",
   title: "Color City Sprint",
   tagline: "Paint a red route through the city and sprint the lap.",
   description: "Race an open pastel city as a Color Roll Heroes armadillo. Beacons light one at a time; the streets you take are painted red, and a later lap is faster on red. Dash a hoarding, ride a bus, or phase a shop, then outrun the Grey Sweeper.",
   order: 56,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move, Space to jump, E or Enter for the hero power. Camera: drag, Q / C turn, R / F tilt, V recenters",
      touch: "Joystick + Jump and Power buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#ef4444",
   owner: "cursor",
};
