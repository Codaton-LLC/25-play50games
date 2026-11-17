import { LEVEL_IDS, type ArcadeGameMeta } from "../../types";
import { LEVELS } from "./levels";
import { LIMITS } from "./rules";

// Plain data (server-safe). Menu 2 game 21, World 6 "Prism Fortress" (all colours), order 92, status
// "dev" until the user signs it off. A time game: the finish time to the crown (L5: the golem's defeat)
// is the submitted time; scoring must equal includes/arcade-games.json (registry.sync.test.ts).
export const colorMatchJumpMeta: ArcadeGameMeta = {
   slug: "color-match-jump",
   title: "Color Match Jump",
   tagline: "Only your own colour holds. Tag the right hero in mid-air.",
   description:
      "Hop across hex pillars over the void, where a landing holds only in your own colour: switch heroes in mid-air so the right one touches down, crack the beacon's colour codes before the field sinks, and reach the crown. Riko dashes the void, Nami double-jumps the tall pillars, Kiro shields through lightning, Zuno pulls orb trails and Vexa phases through ghost pillars. Level 5: the Echo Frost Golem.",
   order: 92,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD / arrows aim, Space hops (hold for a long jump; Space again in the air: Nami's double jump), 1-5 or T tag a hero, E / Enter hero power; drag, Q / C turn, wheel zooms",
      touch: "Joystick aims, Hop (hold = long jump), the hero portraits tag, Power; two fingers turn the camera, pinch zooms",
   },
   scoring: LIMITS[1],
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: LIMITS[id] })),
   thumbnail: null,
   accent: "#f472b6",
   owner: "claude",
};
