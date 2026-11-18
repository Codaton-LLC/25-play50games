import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS, PROPOSED_LEVEL_LIMITS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 33, World 5 Neon Cosmos. Status "dev" (preview builds only).
// A time game: the finish time minus the orb and flow bonus is the score (README "Scoring").
// order 88 (85 alien-lane-escape is the last before it).
const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const mirrorDashMeta: ArcadeGameMeta = {
   slug: "mirror-dash",
   title: "Mirror Dash",
   tagline: "One input, two runners: your hero and its glass reflection, where left and right are swapped.",
   description:
      "Run two runways at once through a hall of mirrors. Your hero takes the left one, its glass reflection the right one, and every lane change you make is mirrored for it. Find the one move that saves both bodies, through merging roads, frosted glass that copies instead of mirrors, echoes that repeat you half a second late, and the Glass Sentinel at the end of the hall. Pick Vexa, Riko, Nyla, Kiro or Zuno.",
   order: 88,
   status: "live",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "Left / Right (A / D) change lane (the reflection mirrors you), Up / W / Space jump, Down / S slide, E or Enter for the hero power",
      touch: "Swipe or flick the stick left / right to change lane, swipe up or Jump to jump, swipe down to slide, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: "/images/3d/mirror-dash.webp",
   accent: "#a78bfa",
   owner: "claude",
};
