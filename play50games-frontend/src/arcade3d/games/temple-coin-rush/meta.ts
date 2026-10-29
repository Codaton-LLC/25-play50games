import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 16, World 3 "Wild Temples" (green; lead hero Kiro). Status "dev"
// (preview builds only) until the user signs it off. A points game: the banked coins x2, plus on a win
// the finish bonus and the time bonus (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts). order 69.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Temple Entry",
   2: "Coin Hall",
   3: "Broken Floors",
   4: "Rolling Hazards",
   5: "Temple Sprint",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   unitLabel: "pts",
   display: "int",
});

export const templeCoinRushMeta: ArcadeGameMeta = {
   slug: "temple-coin-rush",
   title: "Temple Coin Rush",
   tagline: "Grab the coins, pay the gates, outrun the boulder. Or bank it all.",
   description:
      "Run from a rolling boulder through a collapsing jungle temple as a Color Roll Heroes armadillo. Grab coins and pay the toll gates that open the fast lanes, or keep them: unspent coins score double at the finish. Spike tiles, falling floors and side-ramp boulders, and Riko, Nami, Kiro, Zuno or Vexa each find their own way through. Level 5: outrun Coilstone, the Temple Serpent, and pay the bells that bring it down.",
   order: 69,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "A / D or left / right to change lane, Space or up to jump, S or down to roll, E or Enter for the hero power",
      touch: "Swipe left / right to change lane, swipe up or Jump to jump, swipe down to roll, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#22c55e",
   owner: "claude",
};
