import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Level 1 stays the provisional set (Claude tightens it to rules.ts PROPOSED_LIMITS at merge).
// Levels 2-5 are PROPOSED_LEVEL_LIMITS (proof: README "Levels"); levels.test.ts checks they match.
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 6000,
   minDurationMs: 10000,
   maxDurationMs: 92000,
   base: 6000,
   maxPointsPerSec: 6000,
   unitLabel: "pts",
   display: "int",
};

const levelScoring = (
   maxScore: number,
   minDurationMs: number,
   maxDurationMs: number,
   base: number,
   maxPointsPerSec: number,
): ScoringRules => ({ ...SCORING, maxScore, minDurationMs, maxDurationMs, base, maxPointsPerSec });

// A level clears on a win (the quota). No clearScore.
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Basic Sort", scoring: SCORING },
   { id: 2, title: "Shape Sort", scoring: levelScoring(6370, 10000, 122000, 300, 52) },
   { id: 3, title: "Color + Shape", scoring: levelScoring(6370, 10000, 122000, 300, 52) },
   { id: 4, title: "Fast Factory", scoring: levelScoring(5640, 13300, 122000, 120, 62) },
   { id: 5, title: "Overdrive", scoring: levelScoring(6310, 11800, 122000, 120, 70) },
];

export const robotFactoryMeta: ArcadeGameMeta = {
   slug: "robot-factory",
   title: "Robot Factory Sorter",
   tagline: "Right part, right order.",
   description: "Build robots from the blueprint, then on the fast shifts sort each part into the bin with the same colour and icon while the belt speeds up.",
   order: 22,
   status: "dev",
   collection: "skill",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "Space to grab, S / Down to scrap, or click a part. On the fast shifts, keys 1-4 drop into that bin",
      touch: "Tap a part to grab, swipe down to scrap. On the fast shifts, tap the bin with the same colour and icon",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/robot-factory.webp",
   accent: "#7dd3fc",
   owner: "kimi",
};
