import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 29, World 5 Neon Cosmos. Status "dev" (preview builds only) until the
// user signs it off. A time game: the finish time minus the orb and flow bonus is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 96 (the coordinator's slot).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Simple Hunt",
   2: "Mixed Colors",
   3: "Larger Arena",
   4: "Moving Cores",
   5: "Core Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const energyCoreHuntMeta: ArcadeGameMeta = {
   slug: "energy-core-hunt",
   title: "Energy Core Hunt",
   tagline: "Fill the order: grab exactly the colored energy cores it asks for, then out through the gate.",
   description: "A third-person mission arena: the order asks for a mix of colored energy cores, and they drop into the reactor arena in waves. Take exactly what the order wants (a core of a color that is already full jolts you), dodge crates, flickering decoys and tesla coils, open the sealed capsules, catch the cores circling their pylons, then leave through the core gate. On the last level the Core Sprite holds the final cores. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 96,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move, Space jumps, E or Enter opens a capsule (or uses the hero power)",
      touch: "The stick moves; Jump; Action opens a capsule (or uses the power)",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#2dd4bf",
   owner: "claude",
};
