import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Level 1 is today's fight. Levels 2-5 equal rules.ts PROPOSED_LEVEL_LIMITS (README "Levels").
// A level clears on a win (all three rivals out). There is no clearScore.
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 2550,
   minDurationMs: 10000,
   maxDurationMs: 92000,
   base: 600,
   maxPointsPerSec: 190,
   unitLabel: "pts",
   display: "int",
};

const levelScoring = (minDurationMs: number, maxPointsPerSec: number): ScoringRules => ({
   ...SCORING,
   minDurationMs,
   maxPointsPerSec,
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Snow Yard", scoring: SCORING },
   { id: 2, title: "Frozen Park", scoring: SCORING },
   { id: 3, title: "Snow Fort", scoring: levelScoring(8000, 230) },
   { id: 4, title: "Ice Village", scoring: levelScoring(8000, 230) },
   { id: 5, title: "Championship Arena", scoring: levelScoring(5000, 348) },
];

export const snowballBattleMeta: ArcadeGameMeta = {
   slug: "snowball-battle",
   title: "Snowball Battle",
   tagline: "Duck, scoop, throw.",
   description: "A friendly 1-vs-3 snowball fight: duck behind snow forts, scoop snowballs and tag the rival kids before they tag you.",
   order: 17,
   status: "dev",
   collection: "adventure",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, mouse to aim; hold E or Enter to scoop, Space to throw",
      touch: "Joystick to move, hold Scoop to pack a snowball, tap a rival to throw",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/snowball-battle.webp",
   accent: "#bae6fd",
   owner: "cursor",
};
