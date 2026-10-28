import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data. Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts), and
// arcade-games.json carries the same five. A level clears only on a win (every fire out, every neighbour out).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 1100, minDurationMs: 4000, maxDurationMs: 120_000, base: 400, maxPointsPerSec: 96 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1650, minDurationMs: 4000, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 40 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 2200, minDurationMs: 4000, maxDurationMs: 180_000, base: 1200, maxPointsPerSec: 32 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2550, minDurationMs: 4000, maxDurationMs: 180_000, base: 1600, maxPointsPerSec: 24 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 3050, minDurationMs: 4000, maxDurationMs: 210_000, base: 2000, maxPointsPerSec: 20 } },
];

export const firefighterRescueMeta: ArcadeGameMeta = {
   slug: "firefighter-rescue",
   title: "Firefighter Rescue",
   tagline: "Put the fires out. Walk the neighbours clear.",
   description: "Enter one floor, hold a spray on each fire, and walk one neighbour at a time out to the exit sign.",
   order: 31,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows move, hold E or Enter to spray, Space hops",
      touch: "Joystick moves, Spray, Hop",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
         { id: "spray", keys: ["E", "Enter"], label: "Spray", hold: true, main: true },
         { id: "hop", keys: ["Space"], label: "Hop" },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
         { id: "spray", control: "action", label: "Spray", hold: true },
         { id: "hop", control: "jump", label: "Hop" },
      ],
      steps: [
         { title: "Goal", text: "Put out the fires and lead every neighbour to the exit." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to move.",
            touchText: "Push the joystick to move.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Spray",
            text: "Hold E or Enter on a fire for 0.75 s. Hold it on a neighbour for 0.3 s, then walk them out. One at a time.",
            touchText: "Hold Spray on a fire for 0.75 s. Hold it on a neighbour for 0.3 s, then walk them out. One at a time.",
            keys: ["spray"],
            touch: ["spray"],
         },
         {
            title: "Hop & smoke",
            text: "Space hops over debris. Smoke slows you and spends breath. Three lives.",
            touchText: "Tap Hop to clear debris. Smoke slows you and spends breath. Three lives.",
            keys: ["hop"],
            touch: ["hop"],
         },
         {
            title: "Tips",
            text: "A doorway with a fire in it stays shut until that fire is out. Esc or P pauses.",
            touchText: "A doorway with a fire in it stays shut until that fire is out. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#f97316",
   owner: "cursor",
};
