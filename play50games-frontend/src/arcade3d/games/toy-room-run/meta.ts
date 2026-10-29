import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 18, World 4 Frost & Sweets. Status "dev" until the user signs it off.
// A time game: the finish time minus the orb and flow bonus is the score (README "Score limits").
// order 76 (the coordinator's slot for it).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Desk Start",
   2: "Book Bridge",
   3: "Race Track",
   4: "Lights Out",
   5: "Toybox Finale",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const toyRoomRunMeta: ArcadeGameMeta = {
   slug: "toy-room-run",
   title: "Toy Room Run",
   tagline: "Knock over the first domino, then run the falling chain like a moving bridge across a giant playroom.",
   description: "Start domino chains and race the toppling wave across a giant toy room: the fallen pieces bridge the gaps between desks, but only for a moment. Push spares into stalled chains, ride a drum's throw to the shelf, dodge race cars, and topple a giant book line onto Jack Wobble.",
   order: 76,
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
   accent: "#facc15",
   owner: "claude",
};
