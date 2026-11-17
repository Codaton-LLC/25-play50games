import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 17, World 5 Neon Cosmos. Status "dev" (preview builds only) until the
// user signs it off. A time game: the finish time minus the orb and flow bonus is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 85 (the coordinator's slot).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Alien Meadow",
   2: "Crystal Route",
   3: "Meteor Zone",
   4: "Glow Plants",
   5: "Planet Escape",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const alienLaneEscapeMeta: ArcadeGameMeta = {
   slug: "alien-lane-escape",
   title: "Alien Lane Escape",
   tagline: "Outrun the mothership: be in a shadow when its scan line passes.",
   description: "A three-lane runner across an alien valley with a mothership behind you. Its violet scan lines sweep forward over the track: break line of sight by being in a crystal's or a rock's shadow when a line passes, slide into low shadows, jump rocks and slide under energy bars. Hide behind drifting pods, fresh meteor craters and glow plants that wash shadows out, then bring the Mothership down on the planet escape. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 85,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "Left / right (A / D or arrows): change lane, S or Down held: slide, Space or Up jump, E or Enter the hero power",
      touch: "Swipe or flick the stick left / right to change lane, pull the stick down to slide; Jump; Power",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#a855f7",
   owner: "claude",
};
