import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README (design approved 2026-10-09).
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 6100,
   minDurationMs: 9000,
   maxDurationMs: 242000,
   base: 0,
   maxPointsPerSec: 150,
   unitLabel: "pts",
   display: "int",
};

// Levels (README "Levels"): the same shift on every level, so the same limits (rules.ts
// PROPOSED_LEVEL_LIMITS). A level clears on a finished shift or at its score target; level 5 has
// nothing to unlock.
const CLEAR = [2500, 2600, 2700, 2800] as const;
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Garden Shed", scoring: SCORING, clearScore: CLEAR[0] },
   { id: 2, title: "Tiny House", scoring: SCORING, clearScore: CLEAR[1] },
   { id: 3, title: "Garage", scoring: SCORING, clearScore: CLEAR[2] },
   { id: 4, title: "Shop Front", scoring: SCORING, clearScore: CLEAR[3] },
   { id: 5, title: "Mini Tower", scoring: SCORING },
];

export const constructionWorkerMeta: ArcadeGameMeta = {
   slug: "construction-worker",
   title: "Construction Worker",
   tagline: "Build it floor by floor.",
   description: "Run the crane on a toy building site: pick the right material for the glowing blueprint slot and swing it into place, floor by floor.",
   order: 19,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "A / D rotate, W / S trolley, Space drop, 1-5 pick a pile",
      touch: "Joystick, Action to drop, tap a pile",
   },
   howTo: {
      keys: [
         { id: "rotate", keys: ["A/D", "Left/Right"], label: "Rotate crane", main: true, role: "move" },
         { id: "trolley", keys: ["W/S", "Up/Down"], label: "Run trolley", role: "move" },
         { id: "pick", keys: ["1-5"], label: "Pick a pile" },
         { id: "drop", keys: ["Space"], label: "Drop", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Rotate & trolley" },
         { id: "action", control: "action", label: "Pick & drop" },
         { id: "tap", control: "tap", label: "Tap a pile to pick" },
      ],
      steps: [
         { title: "Goal", text: "Pick the right material for the glowing blueprint slot and swing it into place, floor by floor." },
         {
            title: "Swing the crane",
            text: "A / D rotates the crane, W / S runs the trolley in and out. The arrow keys do the same.",
            touchText: "Push the joystick left and right to rotate the crane, up and down to run the trolley.",
            keys: ["rotate", "trolley"],
            touch: ["joystick"],
         },
         {
            title: "Pick a material",
            text: "With the hook over a pile, press its number 1-5.",
            touchText: "With the hook over a pile, tap the pile or press Action.",
            keys: ["pick"],
            touch: ["tap", "action"],
         },
         {
            title: "Drop on gold",
            text: "Press Space when the guide turns gold to drop the piece on its mark.",
            touchText: "Press Action when the guide turns gold to drop the piece on its mark.",
            keys: ["drop"],
            touch: ["action"],
         },
         {
            title: "Tips",
            text: "Wind gusts swing the load on later levels: wait for it to settle. Esc or P pauses.",
            touchText: "Wind gusts swing the load on later levels: wait for it to settle. Tap Pause to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/construction-worker.webp",
   accent: "#fbbf24",
   owner: "cursor",
};
