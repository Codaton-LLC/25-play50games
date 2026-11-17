import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README "Scoring" (level 1) and "Levels" (one proof per level).
// They equal rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and arcade-games.json levels.

/** Level 1 = today's game. These duration bounds are pinned to the 90 s clock. */
const SCORING_L1: ScoringRules = {
   kind: "points",
   maxScore: 6000,
   minDurationMs: 88000,
   maxDurationMs: 92000,
   base: 0,
   maxPointsPerSec: 70,
   unitLabel: "pts",
   display: "int",
};

// Levels 2-5 run 120 s. Clear by score: the run never wins, it ends on timeup.
// clearScore is what an honest run reaches; level 5 included so the tile can show cleared.
const levelScoring = (maxScore: number, maxPointsPerSec: number): ScoringRules => ({
   ...SCORING_L1,
   maxScore,
   minDurationMs: 118000,
   maxDurationMs: 122000,
   maxPointsPerSec,
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Green Valley", scoring: SCORING_L1, clearScore: 1500 },
   { id: 2, title: "Fern Forest", scoring: levelScoring(6100, 52), clearScore: 2000 },
   { id: 3, title: "Riverbank", scoring: levelScoring(6100, 52), clearScore: 2000 },
   { id: 4, title: "Volcanic Pass", scoring: levelScoring(6100, 52), clearScore: 2000 },
   { id: 5, title: "Dino Sanctuary", scoring: levelScoring(7300, 62), clearScore: 2500 },
];

export const dinoEggRescueMeta: ArcadeGameMeta = {
   slug: "dino-egg-rescue",
   title: "Dino Egg Rescue",
   tagline: "Bring the runaway eggs home.",
   description: "A clumsy baby dino carries runaway eggs home to its nest while dodging rolling boulders and sticky mud.",
   order: 14,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, Space or E to dash",
      touch: "Joystick to move, tap Dash to dash",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Waddle", main: true, role: "move" },
         { id: "dash", keys: ["Space", "E"], label: "Dash", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Waddle" },
         { id: "dash", control: "action", label: "Dash" },
      ],
      steps: [
         { title: "Goal", text: "Gather the runaway eggs and carry them back to your nest in the south-east." },
         {
            title: "Waddle",
            text: "Use WASD or the arrow keys to waddle.",
            touchText: "Push the joystick to waddle.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Dash",
            text: "Press Space or E for a burst of speed.",
            touchText: "Tap Dash for a burst of speed.",
            keys: ["dash"],
            touch: ["dash"],
         },
         { title: "Watch out", text: "Each carried egg slows you down. Dodge rolling boulders and sticky mud pits." },
         {
            title: "Tips",
            text: "Golden eggs score extra: grab them on the way home. Esc or P pauses.",
            touchText: "Golden eggs score extra: grab them on the way home. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/dino-egg-rescue.webp",
   accent: "#a3e635",
   owner: "antigravity",
};

export default dinoEggRescueMeta;
