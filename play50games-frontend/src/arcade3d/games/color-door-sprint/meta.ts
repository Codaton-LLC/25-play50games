import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 46, World 1 Ember Heights. Status "dev" (preview builds only) until
// the user signs it off. A time game: the finish time minus the orb and flow bonus is the score
// (README "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 62: the slot after the Menu 2 games already in the slice and the other agents' branches.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Two Doors",
   2: "Three Doors",
   3: "Fake Door",
   4: "Fast Gates",
   5: "Door Sprint Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const colorDoorSprintMeta: ArcadeGameMeta = {
   slug: "color-door-sprint",
   title: "Color Door Sprint",
   tagline: "Read the rule lamp, commit to the one true door before the wall locks.",
   description: "Sprint down Shadow Plates' Hall of Doors as a Color Roll Heroes armadillo: read the rule lamp (match the colour, match the chime, NOT this colour, or remember the wall after next), change lanes and commit before the doors lock. True doors surge you on, wrong doors bounce you back. Pick Riko, Nami, Kiro, Zuno or Vexa and outrun Flicker, the Fire Spirit.",
   order: 62,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "A / D or left / right to change lane, Space or up to jump, S or down to roll, E or Enter for the hero power (the red rush on level 5)",
      touch: "Swipe left / right to change lane, swipe up or Jump to jump, swipe down to roll, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#ef4444",
   owner: "claude",
};
