import type { ArcadeGameMeta, LevelId, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Proven limits (README "Server limits and why they hold", one proof per level);
// arcade-games.json carries the same values.
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: {
      kind: "points",
      maxScore: 2030,
      minDurationMs: 3500,
      maxDurationMs: 77000,
      base: 1700,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int",
   },
   2: {
      kind: "points",
      maxScore: 2520,
      minDurationMs: 3500,
      maxDurationMs: 102000,
      base: 2200,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int",
   },
   3: {
      kind: "points",
      maxScore: 3560,
      minDurationMs: 3500,
      maxDurationMs: 152000,
      base: 3250,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int",
   },
   4: {
      kind: "points",
      maxScore: 4520,
      minDurationMs: 3500,
      maxDurationMs: 152000,
      base: 4200,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int",
   },
   5: {
      kind: "points",
      maxScore: 5960,
      minDurationMs: 3500,
      maxDurationMs: 182000,
      base: 5650,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int",
   },
};

/** Level 1 limits (backward compatibility with today's game and registry checks). */
export const PROPOSED_LIMITS: ScoringRules = PROPOSED_LEVEL_LIMITS[1];

export const shoppingCartMeta: ArcadeGameMeta = {
   slug: "shopping-cart",
   title: "Crazy Shopping Cart",
   tagline: "Grab the list, dodge the spills.",
   description: "Drift a runaway shopping cart through the aisles, grab everything on your list and dodge shoppers, spills and can pyramids.",
   order: 16,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to steer, hold Space to ride",
      touch: "Joystick to steer, hold Ride to ride",
   },
   howTo: {
      keys: [
         { id: "steer", keys: ["WASD", "Arrows"], label: "Steer", main: true, role: "move" },
         { id: "ride", keys: ["Space"], label: "Ride", hold: true, main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Steer" },
         { id: "ride", control: "jump", label: "Ride", hold: true },
      ],
      steps: [
         { title: "Goal", text: "Grab everything on your shopping list, then dash to the checkout before the clock runs out." },
         {
            title: "Steer",
            text: "Use WASD or the arrow keys to steer the runaway cart through the aisles.",
            touchText: "Push the joystick to steer the runaway cart through the aisles.",
            keys: ["steer"],
            touch: ["joystick"],
         },
         {
            title: "Ride",
            text: "Hold Space to ride the cart and drift faster.",
            touchText: "Hold Ride to ride the cart and drift faster.",
            keys: ["ride"],
            touch: ["ride"],
         },
         {
            title: "Watch out",
            text: "Dodge shoppers, spills and can pyramids. Steer round them, not through them.",
            keys: ["steer"],
            touch: ["joystick"],
         },
         {
            title: "Tips",
            text: "Esc or P pauses the run. Clear a level to unlock the next store.",
            touchText: "Tap Pause, top right, any time. Clear a level to unlock the next store.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: { ...PROPOSED_LEVEL_LIMITS[1] },
   levels: [
      { id: 1, title: "Mini Market", scoring: PROPOSED_LEVEL_LIMITS[1], clearScore: 1200 },
      { id: 2, title: "Fresh Food", scoring: PROPOSED_LEVEL_LIMITS[2], clearScore: 1400 },
      { id: 3, title: "Household Aisles", scoring: PROPOSED_LEVEL_LIMITS[3], clearScore: 1600 },
      { id: 4, title: "Superstore", scoring: PROPOSED_LEVEL_LIMITS[4], clearScore: 1800 },
      { id: 5, title: "Closing-Time Rush", scoring: PROPOSED_LEVEL_LIMITS[5] },
   ],
   thumbnail: "/images/3d/shopping-cart.webp",
   accent: "#fb923c",
   owner: "antigravity",
};
