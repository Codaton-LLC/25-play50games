import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 18700,
   minDurationMs: 9000,
   maxDurationMs: 182000,
   base: 440,
   maxPointsPerSec: 104,
   unitLabel: "pts",
   display: "int",
};

// Levels (README "Levels"): every level keeps level 1's limits (rules.ts PROPOSED_LEVEL_LIMITS; the
// proof does not depend on anything a level changes). The slide is endless, so a level clears at its
// score target (the plan's "reach the finish and collect the fish"); level 5 has nothing to unlock.
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Snow Hill", scoring: SCORING, clearScore: 3000 },
   { id: 2, title: "Ice Cave", scoring: SCORING, clearScore: 3500 },
   { id: 3, title: "Frozen Lake", scoring: SCORING, clearScore: 4000 },
   { id: 4, title: "Aurora Run", scoring: SCORING, clearScore: 4500 },
   { id: 5, title: "Glacier Sprint", scoring: SCORING },
];

export const penguinSlideMeta: ArcadeGameMeta = {
   slug: "penguin-slide",
   title: "Penguin Ice Slide",
   tagline: "Carve, jump, slurp the fish.",
   description: "Belly-slide a penguin down a twisting glacier: carve between ice blocks, launch off ramps and slurp up fish.",
   order: 25,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "A / D or left / right to steer; Space to hop; steer in the air to spin",
      touch: "Joystick left / right to steer and spin; tap Hop to hop; auto-hop assists cracks",
   },
   howTo: {
      keys: [
         { id: "steer", keys: ["A/D", "Left/Right"], label: "Steer", main: true, role: "move" },
         { id: "hop", keys: ["Space"], label: "Hop", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Steer" },
         { id: "hop", control: "jump", label: "Hop" },
      ],
      steps: [
         { title: "Goal", text: "Slide down the glacier as far as you can. Fish and gates add time." },
         {
            title: "Steer",
            text: "A / D or the arrow keys carve left and right.",
            touchText: "Push the joystick left or right to carve.",
            keys: ["steer"],
            touch: ["joystick"],
         },
         {
            title: "Hop & spin",
            text: "Space hops. Steer in the air off a ramp to spin, then land facing forward.",
            touchText: "Tap Hop to jump. Steer in the air off a ramp to spin; auto-hop helps over cracks.",
            keys: ["hop", "steer"],
            touch: ["hop", "joystick"],
         },
         { title: "Watch out", text: "Three crashes end the slide. Cross gates for +8 seconds." },
         {
            title: "Tips",
            text: "Land a spin facing forward. Esc or P pauses.",
            touchText: "Land a spin facing forward. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/penguin-slide.webp",
   accent: "#67e8f9",
   owner: "codex",
};
