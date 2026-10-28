import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";

// Plain data (server-safe). Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts), and
// arcade-games.json carries the same five (registry.sync.test.ts). A level clears only on a win
// (every toy on its shelf): there is no clearScore.
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = { ...PTS, maxScore: 990, minDurationMs: 4000, maxDurationMs: 120_000, base: 500, maxPointsPerSec: 93 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: SCORING },
   { id: 2, title: LEVEL_TITLES[2], scoring: { ...PTS, maxScore: 1405, minDurationMs: 4000, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 57 } },
   { id: 3, title: LEVEL_TITLES[3], scoring: { ...PTS, maxScore: 1715, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 48 } },
   { id: 4, title: LEVEL_TITLES[4], scoring: { ...PTS, maxScore: 2110, minDurationMs: 4000, maxDurationMs: 180_000, base: 1400, maxPointsPerSec: 36 } },
   { id: 5, title: LEVEL_TITLES[5], scoring: { ...PTS, maxScore: 2610, minDurationMs: 4000, maxDurationMs: 210_000, base: 1800, maxPointsPerSec: 28 } },
];

export const toyStoreNightShiftMeta: ArcadeGameMeta = {
   slug: "toy-store-night-shift",
   title: "Toy Store Night Shift",
   tagline: "Every toy on its shelf.",
   description: "Work the night shift in a toy store: pick up the scattered toys and put each one back on its matching shelf before the store opens.",
   order: 48,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to pick up / drop",
      touch: "Joystick to move + Use",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
         { id: "use", keys: ["E", "Enter"], label: "Pick up / drop", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
         { id: "use", control: "action", label: "Pick up / drop" },
      ],
      steps: [
         { title: "Goal", text: "Put every toy back on its shelf before the night ends." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to walk the aisles.",
            touchText: "Push the joystick to walk the aisles.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Pick up & shelve",
            text: "Press E or Enter next to a toy to pick it up, and at the matching shelf to drop it.",
            touchText: "Tap Use next to a toy to pick it up, and at the matching shelf to drop it.",
            keys: ["use"],
            touch: ["use"],
         },
         {
            title: "Read the signs",
            text: "Colour, shape and picture say which toys go where. A wrong shelf stuns you; wind-up robots knock toys out of your hands.",
         },
         {
            title: "Tips",
            text: "Check the shelf sign before you press Use. Esc or P pauses.",
            touchText: "Check the shelf sign before you press Use. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#f472b6",
   owner: "kimi",
};
