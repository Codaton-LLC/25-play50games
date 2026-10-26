import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts).
// Claude copies them into arcade-games.json at the gate. A level clears only on a win.
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 1260, minDurationMs: 4000, maxDurationMs: 120_000, base: 760, maxPointsPerSec: 64 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1710, minDurationMs: 4000, maxDurationMs: 150_000, base: 1140, maxPointsPerSec: 28 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 2110, minDurationMs: 4000, maxDurationMs: 180_000, base: 1520, maxPointsPerSec: 12 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2350, minDurationMs: 4000, maxDurationMs: 180_000, base: 1900, maxPointsPerSec: 8 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2760, minDurationMs: 4000, maxDurationMs: 210_000, base: 2280, maxPointsPerSec: 8 } },
];

export const wizardPotionLabMeta: ArcadeGameMeta = {
   slug: "wizard-potion-lab",
   title: "Wizard Potion Lab",
   tagline: "Mix it in the right order.",
   description: "Grab ingredients off the shelves and drop them into the cauldron in recipe order to brew every potion.",
   order: 38,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to use",
      touch: "Joystick to move + Use",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#c4b5fd",
   owner: "cursor",
};
