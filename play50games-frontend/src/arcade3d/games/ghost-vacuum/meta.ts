import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README "Scoring" (design approved 2026-10-09).
const CLEAR = [1500, 1600, 1700, 1800] as const;

const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 2630,
   minDurationMs: 91000,
   maxDurationMs: 122000,
   base: 1720,
   maxPointsPerSec: 10,
   unitLabel: "pts",
   display: "int",
};

/** Levels 2-5 add gold ghosts: maxScore 2030 + 200 x gold, base maxScore - 910 (rules.ts PROPOSED_LEVEL_LIMITS, README "Levels"). */
const withGold = (gold: number): ScoringRules => ({ ...SCORING, maxScore: 2030 + 200 * gold, base: 2030 + 200 * gold - 910 });

// A level clears on a win (all twelve ghosts) or at its score target; level 5 has nothing to unlock.
const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Living Room", scoring: SCORING, clearScore: CLEAR[0] },
   { id: 2, title: "Library", scoring: withGold(4), clearScore: CLEAR[1] },
   { id: 3, title: "Kitchen", scoring: withGold(5), clearScore: CLEAR[2] },
   { id: 4, title: "Attic", scoring: withGold(6), clearScore: CLEAR[3] },
   { id: 5, title: "Whole Mansion", scoring: withGold(7) },
];

export const ghostVacuumMeta: ArcadeGameMeta = {
   slug: "ghost-vacuum",
   title: "Ghost Vacuum",
   tagline: "Light them up, suck them in.",
   description: "Bust giggling ghosts out of a toy haunted mansion with a backpack vacuum: light them up to stun them, then suck them in.",
   order: 18,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, mouse to aim; hold E, Enter or Space to vacuum",
      touch: "Joystick to move and aim, hold Vacuum to catch stunned ghosts",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
         { id: "aim", keys: ["Mouse"], label: "Aim", role: "pointer" },
         { id: "vac", keys: ["E", "Enter", "Space"], label: "Vacuum", hold: true, main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move & aim" },
         { id: "vac", control: "action", label: "Vacuum", hold: true },
      ],
      steps: [
         { title: "Goal", text: "Hunt the ghosts in the mansion: stun them with your flashlight, then vacuum them up." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to explore. Nearby desks reveal hidden ghosts.",
            touchText: "Push the joystick to explore. Nearby desks reveal hidden ghosts.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Stun",
            text: "Aim the flashlight with the mouse to stun a ghost.",
            touchText: "The joystick moves and aims the flashlight: point it at a ghost to stun it.",
            keys: ["aim"],
            touch: ["joystick"],
         },
         {
            title: "Vacuum",
            text: "Hold E, Enter or Space to vacuum a stunned ghost. Gold ghosts score extra.",
            touchText: "Hold Vac to vacuum a stunned ghost nearby. Gold ghosts score extra.",
            keys: ["vac"],
            touch: ["vac"],
         },
         {
            title: "Tips",
            text: "Catch them all, or reach the level's score. Esc or P pauses.",
            touchText: "Catch them all, or reach the level's score. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/ghost-vacuum.webp",
   accent: "#a78bfa",
   owner: "codex",
};
