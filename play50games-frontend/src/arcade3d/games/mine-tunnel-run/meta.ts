import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 12, World 1 Ember Heights. Status "dev" (preview builds only).
// A time game: the finish time minus the orb and flow bonus is the score (README "Scoring").
// order 64 (56 plate-surf ... 63 sky-hook-swing; 65 robot-factory-run).
const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const mineTunnelRunMeta: ArcadeGameMeta = {
   slug: "mine-tunnel-run",
   title: "Mine Tunnel Run",
   tagline: "Dig your own tunnel. Drop the boulders you loosen exactly where you want them.",
   description:
      "Bore down through a cross-section mine as a Color Roll Heroes armadillo: soft soil gives way fast, packed soil slowly, rock never. Loosen a boulder and it wobbles, then falls on whatever is below: beetles, cracked floors, or Rockjaw the Tunnel Beetle. Pick Riko, Nami, Kiro, Zuno or Vexa and reach the lift.",
   order: 64,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "Arrows / WASD move and dig (Down digs down, Up digs up), Space hops, Down in the air rolls-drops, E or Enter for the hero power",
      touch: "Joystick moves and digs, Jump hops, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: null,
   accent: "#f97316",
   owner: "claude",
};
