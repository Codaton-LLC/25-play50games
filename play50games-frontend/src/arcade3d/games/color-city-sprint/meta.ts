import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 15, World 1 Ember Heights. Status "dev" until the user signs it off.
// A time game: the finish time minus the orb and flow bonus is the score (README "Scoring").
// order 61: after the Menu 2 games on the slice (plate-surf 56 ... roll-cannon-jump 60).
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
   tagline: "Pick your own line through an open city. The streets you run turn red, and red is fast next lap.",
   description: "Race an open city drained grey by Shadow Plates. Beacons light one at a time and you choose the route; the streets you run between them turn red, and on the next lap a red street is 30 % faster. Ramp onto buses, dash through hoardings, phase through ghost shops, then beat Greyout, the Street Sweeper.",
   order: 61,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move (camera-relative), Space to jump, E or Enter for the hero power. Camera: drag, wheel, Q / C turn, R / F tilt, V recenters",
      touch: "Joystick, Jump and Power buttons; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#ef4444",
   owner: "claude",
};
