import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.

/** Level 1 = today's live game: these are the limits already on the server. Do not change. */
const SCORING_L1: ScoringRules = {
   kind: "points",
   maxScore: 1470,
   minDurationMs: 12500,
   maxDurationMs: 62000,
   base: 600,
   maxPointsPerSec: 120,
   unitLabel: "pts",
   display: "int"
};

// Levels 2-5: the limits of rules.ts PROPOSED_LEVEL_LIMITS (proof: README.md "Levels"); levels.test.ts
// checks the two tables are equal, registry.sync.test.ts that they equal arcade-games.json `levels`.
// A level is cleared by a win (all its batteries): no `clearScore`.
const levelScoring = (maxScore: number, minDurationMs: number, maxDurationMs: number): ScoringRules => ({
   ...SCORING_L1,
   maxScore,
   minDurationMs,
   maxDurationMs
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Training Bay", scoring: SCORING_L1 },
   { id: 2, title: "Small Warehouse", scoring: levelScoring(1740, 14900, 72000) },
   { id: 3, title: "Conveyor Zone", scoring: levelScoring(2010, 17400, 82000) },
   { id: 4, title: "Dark Storage", scoring: levelScoring(2240, 19900, 87000) },
   { id: 5, title: "Mega Warehouse", scoring: levelScoring(2460, 22300, 92000) }
];

export const robotCollectorMeta: ArcadeGameMeta = {
   slug: "robot-collector",
   title: "Robot Collector",
   tagline: "Grab 10 batteries before the clock runs out.",
   description: "Steer a tiny warehouse robot and collect all 10 batteries before the timer hits zero. Every second left is bonus points.",
   order: 1,
   status: "live",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move",
      touch: "Joystick to move"
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
      ],
      steps: [
         { title: "Goal", text: "Collect every battery before the clock runs out." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to drive the robot.",
            touchText: "Push the joystick to drive the robot.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Grab in pairs",
            text: "Batteries light up two at a time: grab both and the next pair appears.",
            keys: ["move"],
            touch: ["joystick"],
         },
         { title: "Watch out", text: "Oil patches slow you down; conveyor belts carry you along their arrows." },
         {
            title: "Tips",
            text: "Finish early: every second left pays +10. Esc or P pauses.",
            touchText: "Finish early: every second left pays +10. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/robot-collector.webp",
   accent: "#7dd3fc",
   owner: "claude"
};
