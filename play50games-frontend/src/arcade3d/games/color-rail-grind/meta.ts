import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 35, World 4 "Frost and Sweets" (yellow; lead hero Zuno). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time less the orb, ring,
// relight and flow bonus is the score (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts). order 79.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Station Yard",
   2: "Village Loop",
   3: "Ice Bridge",
   4: "Night Express",
   5: "Runaway Express",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const colorRailGrindMeta: ArcadeGameMeta = {
   slug: "color-rail-grind",
   title: "Color Rail Grind",
   tagline: "Grind the toy train line and throw the switches to build your own route.",
   description:
      "Grind the Sugarfrost Workshop's toy train line as a Color Roll Heroes armadillo: hop between parallel rails, jump the gaps, and throw the track switches ahead to pick your branch: orbs, shortcuts, dead ends with buffer stops, hidden spurs. Frozen switches need a stomp, toy trains follow the switches too, and Riko, Nami, Kiro, Zuno and Vexa each find their own line. Level 5: route the runaway Clockwork Express into its buffers and ride its roof.",
   order: 79,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "A / D or left / right to hop rails, Space or up to jump, S or down to crouch, E or Enter throws the lit switch (else the hero power); click the view to throw a switch too",
      touch: "Swipe left / right to hop rails, swipe up or Jump to jump, swipe down to crouch, tap the view to throw the lit switch, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#facc15",
   owner: "claude",
};
