import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README "Scoring" (design approved 2026-10-09).

const SCORING_L1: ScoringRules = PROPOSED_LEVEL_LIMITS[1];

export const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Five Worlds", scoring: PROPOSED_LEVEL_LIMITS[1], clearScore: 2000 },
   { id: 2, title: "Breezy Approach", scoring: PROPOSED_LEVEL_LIMITS[2], clearScore: 2050 },
   { id: 3, title: "Turbulent Orbit", scoring: PROPOSED_LEVEL_LIMITS[3], clearScore: 2100 },
   { id: 4, title: "High Winds & Cavern", scoring: PROPOSED_LEVEL_LIMITS[4], clearScore: 2150 },
   { id: 5, title: "Precision Landing", scoring: PROPOSED_LEVEL_LIMITS[5], clearScore: 2200 },
];

export const rocketLandingMeta: ArcadeGameMeta = {
   slug: "rocket-landing",
   title: "Rocket Landing Challenge",
   tagline: "Touch down gently.",
   description: "Feather the thrusters of a chunky toy rocket and set it down gently on floating landing pads across five tricky planets.",
   order: 30,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "A / D or left / right to rotate; hold Space, W or up to thrust",
      touch: "Joystick left / right to rotate; hold Thrust to fire; release joystick to auto-level",
   },
   howTo: {
      keys: [
         { id: "rotate", keys: ["A/D", "Left/Right"], label: "Rotate", main: true, role: "move" },
         { id: "thrust", keys: ["Space", "W", "Up"], label: "Thrust", hold: true, main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Rotate" },
         { id: "thrust", control: "jump", label: "Thrust", hold: true },
      ],
      steps: [
         { title: "Goal", text: "Land softly on every planet's pad. Three lives." },
         {
            title: "Rotate",
            text: "A / D or the arrow keys tilt the rocket.",
            touchText: "Push the joystick left or right to tilt. Let go to auto-level.",
            keys: ["rotate"],
            touch: ["joystick"],
         },
         {
            title: "Thrust",
            text: "Hold Space, W or Up to fire the engine.",
            touchText: "Hold Thrust to fire the engine.",
            keys: ["thrust"],
            touch: ["thrust"],
         },
         {
            title: "Touch down",
            text: "Land slow, level and centred: under the pad's speed and tilt limits. Wind pushes you on later worlds.",
         },
         {
            title: "Tips",
            text: "Save fuel: the reserve pays a bonus. Esc or P pauses.",
            touchText: "Save fuel: the reserve pays a bonus. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING_L1,
   levels: LEVELS,
   thumbnail: "/images/3d/rocket-landing.webp",
   accent: "#fda4af",
   owner: "codex",
};
