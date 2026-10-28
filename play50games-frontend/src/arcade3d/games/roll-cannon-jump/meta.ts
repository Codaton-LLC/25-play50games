import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 43, World 1 "Ember Heights" (red). Status "dev" (preview builds
// only) until the user signs it off. A time game: the finish time minus the orb and flow bonus is
// the score (README "Scoring", M3). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts). order 57: the next slot after plate-surf (56).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Short Launch",
   2: "Angle Practice",
   3: "Moving Pads",
   4: "Long Distance",
   5: "Big Top Finale",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const rollCannonJumpMeta: ArcadeGameMeta = {
   slug: "roll-cannon-jump",
   title: "Roll Cannon Jump",
   tagline: "Aim, time the pulse, and fire yourself cannon-to-cannon under the big top.",
   description: "A grey, colour-drained circus: climb into the cannons, aim the yaw and pitch, let the power ring pulse, and fire yourself ballistically across the big top. Catch the moving cannons, bounce the trampolines, pop the balloon bunches, and reach the finish ring before the show ends. Pick Riko, Nami, Kiro, Zuno or Vexa; level 5 is a boss fight against Ashbag, the Smoke Blimp.",
   order: 57,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows turn the barrel, Space fires on the power ring; in flight Space again (held) roll-dives and WASD nudges; E or Enter for the hero power",
      touch: "Joystick (aim / nudge) + Fire (then hold to roll-dive) and Power buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#ef4444",
   owner: "claude",
};
