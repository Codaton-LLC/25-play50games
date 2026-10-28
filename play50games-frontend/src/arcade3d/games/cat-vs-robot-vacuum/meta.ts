import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts), and
// arcade-games.json carries the same five. A level clears only on a win (every treat, then the bed).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 745, minDurationMs: 4000, maxDurationMs: 90_000, base: 380, maxPointsPerSec: 81 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1020, minDurationMs: 4000, maxDurationMs: 120_000, base: 560, maxPointsPerSec: 35 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1355, minDurationMs: 4000, maxDurationMs: 150_000, base: 760, maxPointsPerSec: 51 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 1520, minDurationMs: 4000, maxDurationMs: 150_000, base: 940, maxPointsPerSec: 34 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 1875, minDurationMs: 4000, maxDurationMs: 180_000, base: 1185, maxPointsPerSec: 30 } },
];

export const catVsRobotVacuumMeta: ArcadeGameMeta = {
   slug: "cat-vs-robot-vacuum",
   title: "Cat vs Robot Vacuum",
   tagline: "Snack fast. Stay clean.",
   description: "Sneak around the house as a cat, collect every treat and hop away from the robot vacuums before curling up on the bed.",
   order: 36,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, Space to hop",
      touch: "Joystick to move + Hop",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
         { id: "hop", keys: ["Space"], label: "Hop", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
         { id: "hop", control: "jump", label: "Hop" },
      ],
      steps: [
         { title: "Goal", text: "Collect every treat in the house, then curl up on the bed to finish." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to move the cat.",
            touchText: "Push the joystick to move the cat.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Hop",
            text: "Press Space for a short dodge past a robot vacuum.",
            touchText: "Tap Hop for a short dodge past a robot vacuum.",
            keys: ["hop"],
            touch: ["hop"],
         },
         { title: "Watch out", text: "A vacuum hit costs a life. The sofa blocks its sight; in the open it can see you." },
         {
            title: "Tips",
            text: "Boxes on the floor block you too: plan a way round. Esc or P pauses.",
            touchText: "Boxes on the floor block you too: plan a way round. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#fb923c",
   owner: "kimi",
};
