import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). Level 1 scoring stays byte-for-byte aligned with production.
const SCORING_L1: ScoringRules = {
   kind: "points",
   maxScore: 2500,
   minDurationMs: 9500,
   maxDurationMs: 93000,
   base: 0,
   maxPointsPerSec: 28,
   unitLabel: "pts",
   display: "int"
};

// Levels 2-5: rules.PROPOSED_LEVEL_LIMITS (proof in README.md "Server limits and why they hold").
const levelScoring = (maxScore: number, minDurationMs: number, maxDurationMs: number, maxPointsPerSec: number, base = 0): ScoringRules => ({
   ...SCORING_L1,
   maxScore,
   minDurationMs,
   maxDurationMs,
   base,
   maxPointsPerSec,
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Fruit Catch", scoring: SCORING_L1, clearScore: 600 },
   { id: 2, title: "Snack Catch", scoring: levelScoring(2400, 8620, 123000, 89) },
   { id: 3, title: "Fast Food Mix", scoring: levelScoring(3150, 7890, 153000, 97) },
   { id: 4, title: "Speed Kitchen", scoring: levelScoring(3910, 7940, 183000, 109) },
   { id: 5, title: "Master Catch", scoring: levelScoring(4150, 7270, 183000, 99) },
];

export const foodCatcherMeta: ArcadeGameMeta = {
   slug: "food-catcher",
   title: "Food Catcher 3D",
   tagline: "Catch the good food, dodge the junk.",
   description: "A hungry chef catches falling fruit. Chain catches for a 2x combo, but three bad items and you are out.",
   order: 2,
   status: "live",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "lanes",
      keyboard: "Left / right arrows to move",
      touch: "Hold and drag left / right"
   },
   howTo: {
      keys: [
         { id: "move", keys: ["Left/Right"], label: "Move", main: true, role: "move" },
      ],
      touch: [
         { id: "drag", control: "drag", label: "Hold and drag left / right" },
      ],
      steps: [
         { title: "Goal", text: "Slide the chef and catch the good food." },
         {
            title: "Move",
            text: "Use the Left and Right arrow keys to slide.",
            touchText: "Hold and drag left or right to slide.",
            keys: ["move"],
            touch: ["drag"],
         },
         { title: "Combo", text: "Five catches in a row score double.", keys: ["move"], touch: ["drag"] },
         { title: "Watch out", text: "Socks and tins cost a life. Three and you are out." },
         {
            title: "Tips",
            text: "Golden treats score extra. Esc or P pauses.",
            touchText: "Golden treats score extra. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/food-catcher.webp",
   accent: "#86efac",
   owner: "cursor"
};
