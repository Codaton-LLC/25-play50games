import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 41, World 2 Sky & Sea. Status "dev" (preview builds only) until the
// user signs it off. A time game: the finish time minus the orb and flow bonus is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 91 (50 Menu 1 games + card index 41).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Gentle Wind",
   2: "Cross Wind",
   3: "Vertical Lift",
   4: "Moving Fans",
   5: "Storm Tunnel",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const windTunnelEscapeMeta: ArcadeGameMeta = {
   slug: "wind-tunnel-escape",
   title: "Wind Tunnel Escape",
   tagline: "Turn the fans, ride your own currents, outrun the storm.",
   description: "Escape a storm tunnel as a Color Roll Heroes armadillo: turn the fans and switch the vents so the currents chain across gaps and up shafts, ride them out, and stay ahead of the violet storm front. Pick Riko, Nami, Kiro, Zuno or Vexa, then jam the Gale Engine and ring the Tide Bell in the open sky.",
   order: 91,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move, Space to jump, E or Enter next to a fan: tap to turn it, hold to switch it off / on (vents: tap); away from fans E is the hero power",
      touch: "Joystick, Jump and the Fan / Power button (tap turns, hold switches); two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#38bdf8",
   owner: "claude",
};
