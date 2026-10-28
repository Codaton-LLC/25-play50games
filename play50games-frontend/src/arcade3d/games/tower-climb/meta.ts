import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Level limits are rules.ts PROPOSED_LEVEL_LIMITS (README "Levels"). Level 1 is today's live scoring.
// A level clears when the score reaches the plan's height (10 points per metre). Level 5 has nothing to unlock.

const scoring = (maxScore: number, maxPointsPerSec: number): ScoringRules => ({
   kind: "points",
   maxScore,
   minDurationMs: 3000,
   maxDurationMs: 1800000,
   base: 0,
   maxPointsPerSec,
   unitLabel: "pts",
   display: "int",
});

const SCORING_L1: ScoringRules = scoring(19000, 11);

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Training Tower", scoring: SCORING_L1, clearScore: 500 },
   { id: 2, title: "Stone Tower", scoring: scoring(19000, 11), clearScore: 800 },
   { id: 3, title: "Clock Tower", scoring: scoring(19350, 13), clearScore: 1200 },
   { id: 4, title: "Storm Tower", scoring: scoring(19850, 18), clearScore: 1700 },
   { id: 5, title: "Sky Tower", scoring: scoring(20200, 19) },
];

export const towerClimbMeta: ArcadeGameMeta = {
   slug: "tower-climb",
   title: "Tower Climb",
   tagline: "Jump higher. Do not look down.",
   description: "Climb a tower of moving and falling platforms, grab coins and reach checkpoints.",
   order: 7,
   status: "live",
   difficulty: 2,
   orientation: "portrait",
   controls: {
      scheme: "platformer",
      keyboard: "A/D or Left/Right to move; Space, W or Up to jump",
      touch: "Joystick + Jump button, or swipe up"
   },
   howTo: {
      keys: [
         { id: "move", keys: ["A/D", "Left/Right"], label: "Run", main: true, role: "move" },
         { id: "jump", keys: ["Space", "W", "Up"], label: "Jump", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Run" },
         { id: "jump", control: "jump", label: "Jump" },
      ],
      steps: [
         { title: "Goal", text: "Climb the tower as high as you can. There are no respawns." },
         {
            title: "Run",
            text: "A / D or Left / Right to run.",
            touchText: "Push the joystick left or right to run.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Jump",
            text: "Space, W or Up jumps, once per press.",
            touchText: "Tap Jump, or swipe up.",
            keys: ["jump"],
            touch: ["jump"],
         },
         { title: "Watch out", text: "Orange spurs crack and fall after contact. Follow the cyan and violet slabs." },
         {
            title: "Tips",
            text: "Yellow flags mark safe checkpoint ledges. Esc or P pauses.",
            touchText: "Yellow flags mark safe checkpoint ledges. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/tower-climb.webp",
   accent: "#06b6d4",
   owner: "codex"
};
