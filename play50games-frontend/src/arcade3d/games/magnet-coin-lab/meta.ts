import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 42, World 4 Frost & Sweets. Status "dev" (preview builds only).
// A time game: the finish time minus the orb and flow bonus is the score (README "Scoring").
// order 82 (79 color-rail-grind is the last before it).
const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const magnetCoinLabMeta: ArcadeGameMeta = {
   slug: "magnet-coin-lab",
   title: "Magnet Coin Lab",
   tagline: "Flip your polarity, fly between magnet pads, herd a swarm of steel coins into the bank.",
   description:
      "Zuno's tinker lab is frozen and its coins are scattered. Tap to flip between + and -: an opposite pad pulls you across a gap, a matching one launches you to the high door, and the coins you sweep up follow in a jingling swarm that lags, catches on corners and falls into pits. Polarity gates, sliding metal blocks, coin-stealing drones and Scrap Magnus the golem stand between you and every piggy bank. Pick Zuno, Riko, Nami, Kiro or Vexa.",
   order: 82,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "Arrows / WASD move, Space jumps, tap E or Enter to flip your sign (+ / -), hold it for the hero power",
      touch: "Joystick moves, Jump, tap Flip to switch sign, hold it for the hero power",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: null,
   accent: "#facc15",
   owner: "claude",
};
