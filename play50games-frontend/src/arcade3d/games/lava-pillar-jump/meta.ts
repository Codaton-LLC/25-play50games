import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 04. Status "dev" (preview builds only) until the user signs it off.
// A time game: the finish time minus the ember bonus is the score (README "Scoring").
// Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// Order 54 leaves 53 for flooded-ruins-escape, which is built on another branch.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Warm Cavern",
   2: "Pillar Field",
   3: "Falling Rocks",
   4: "Fast Lava",
   5: "Volcano Core",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const lavaPillarJumpMeta: ArcadeGameMeta = {
   slug: "lava-pillar-jump",
   title: "Lava Pillar Jump",
   tagline: "Climb the pillars before the lava does.",
   description: "Out-climb a lava tide that surges on the volcano's heartbeat as a Color Roll Hero. Basalt tops heat under your feet and crumble, geysers fire on the beat, and Kalder the Magma Golem waits in the core.",
   order: 54,
   status: "dev",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move, Space to jump, E or Enter for the hero power",
      touch: "Joystick + Jump and Power buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#f97316",
   owner: "cursor",
};
