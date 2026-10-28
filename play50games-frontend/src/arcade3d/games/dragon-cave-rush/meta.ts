import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 14, World 1 Ember Heights. Status "dev" (preview builds only) until the
// user signs it off. A time game: the finish time minus the orb and flow bonus is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 66 (the coordinator's slot).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Crystal Entry",
   2: "Rockfall",
   3: "Glow Tunnel",
   4: "Deep Cave",
   5: "Dragon Hoard",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const dragonCaveRushMeta: ArcadeGameMeta = {
   slug: "dragon-cave-rush",
   title: "Dragon Cave Rush",
   tagline: "Ride the mine cart, lean into the curves, keep ahead of the dragon.",
   description: "Ride a mine cart through a crystal cave with Cindermaw the drained dragon on your tail: lean into curves for speed, hop gaps and rocks, duck beams and breath, swap tracks round falling crystals and lavafalls. Pick Riko, Nami, Kiro, Zuno or Vexa, break the dragon's grey collar and bring her egg home.",
   order: 66,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "A / D or arrows: lean (hold) and swap track (tap), Space hop, S or Down duck, E or Enter the hero power",
      touch: "Joystick: lean and duck (pull down); swipe left / right to swap track; Jump hops; Power",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#f97316",
   owner: "claude",
};
