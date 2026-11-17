import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 19, World 4 Frost & Sweets. Status "dev" (preview builds only) until the
// user signs it off. A time game: the finish time minus the orb and flow bonus is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 77 (the coordinator's slot).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Candy Lane",
   2: "Cookie Road",
   3: "Sorbet Slopes",
   4: "Gummy Grove",
   5: "Bonbon Palace",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const candyWorldRunnerMeta: ArcadeGameMeta = {
   slug: "candy-world-runner",
   title: "Candy World Runner",
   tagline: "Eat sweets to grow, burn them off to shrink: your size is the key.",
   description: "An auto-runner on three candy lanes where your size decides everything: eat candy coins to grow from Small to Normal to Big, sugar-burn roll to shrink, and arrive at each obstacle at the size it needs. Big smashes jelly cubes and chocolate walls, Small slips under cookie arches. Cross cracking chocolate bridges, frosted ice and gummy monsters, then chase King Bonbon through his palace. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 77,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "Left / right (A / D or arrows): change lane, S or Down held: sugar-burn roll (shrink), Space jump, E or Enter the hero power",
      touch: "Swipe or flick the stick left / right to change lane, pull the stick down to roll; Jump; Power",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#f472b6",
   owner: "claude",
};
