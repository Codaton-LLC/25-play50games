import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). The numbers equal rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and WP
// includes/arcade-games.json (registry.sync.test.ts). A level clears only on a win (every ticket served;
// on L4-L5 one expired ticket is allowed).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;
const SCORING: ScoringRules = { ...PTS, maxScore: 1130, minDurationMs: 4000, maxDurationMs: 120_000, base: 690, maxPointsPerSec: 22 };

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Cheese Pizza", scoring: SCORING },
   { id: 2, title: "Two Toppings", scoring: { ...PTS, maxScore: 1440, minDurationMs: 4000, maxDurationMs: 150_000, base: 920, maxPointsPerSec: 16 } },
   { id: 3, title: "Restaurant Rush", scoring: { ...PTS, maxScore: 2000, minDurationMs: 4000, maxDurationMs: 180_000, base: 1380, maxPointsPerSec: 15 } },
   { id: 4, title: "Multiple Orders", scoring: { ...PTS, maxScore: 2420, minDurationMs: 4000, maxDurationMs: 180_000, base: 1840, maxPointsPerSec: 10 } },
   { id: 5, title: "Master Pizza Night", scoring: { ...PTS, maxScore: 2900, minDurationMs: 4000, maxDurationMs: 210_000, base: 2300, maxPointsPerSec: 7 } },
];

export const pizzaKitchen3dMeta: ArcadeGameMeta = {
   slug: "pizza-kitchen-3d",
   title: "Pizza Kitchen 3D",
   tagline: "Sauce, cheese, oven, serve.",
   description: "Build each pizza in order, bake it just right and serve it before the next ticket comes in.",
   order: 45,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to use",
      touch: "Joystick to move + Use",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
         { id: "use", keys: ["E", "Enter"], label: "Use", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
         { id: "use", control: "action", label: "Use" },
      ],
      steps: [
         { title: "Goal", text: "Make each ticket's pizza and serve it at the hatch before the ticket expires." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to move between stations.",
            touchText: "Push the joystick to move between stations.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Use a station",
            text: "Press E or Enter at a station: dough, sauce, cheese, toppings in ticket order, then the oven.",
            touchText: "Tap Use at a station: dough, sauce, cheese, toppings in ticket order, then the oven.",
            keys: ["use"],
            touch: ["use"],
         },
         {
            title: "Bake on green",
            text: "Take it out while the ring is green, then serve. A wrong step spoils the pizza; a second expired ticket ends the run.",
         },
         {
            title: "Tips",
            text: "The first part of the green ring pays a perfect bake. Esc or P pauses.",
            touchText: "The first part of the green ring pays a perfect bake. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: null,
   accent: "#ef4444",
   owner: "claude",
};
