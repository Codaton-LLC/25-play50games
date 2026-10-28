import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README "Server limits and why they hold" and "Levels" (level 1 user-approved
// 2026-10-08). rules.test.ts pins level 1 to PROPOSED_LIMITS; levels.test.ts pins every level to
// PROPOSED_LEVEL_LIMITS. The run never calls end("win"), so a level clears by reaching
// clearScore. Level 5's target unlocks nothing; it still marks the shift cleared.

/** Level 1 = today's game. Do not change these numbers. */
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 7620,
   minDurationMs: 10000,
   maxDurationMs: 122000,
   base: 0,
   maxPointsPerSec: 64,
   unitLabel: "pts",
   display: "int",
};

const levelScoring = (maxScore: number, minDurationMs: number, maxDurationMs: number, maxPointsPerSec: number): ScoringRules => ({
   ...SCORING,
   maxScore,
   minDurationMs,
   maxDurationMs,
   maxPointsPerSec,
});

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Training Belt", scoring: SCORING, clearScore: 3600 },
   { id: 2, title: "Two Destinations", scoring: levelScoring(12050, 9500, 152000, 81), clearScore: 5400 },
   { id: 3, title: "Four Destinations", scoring: levelScoring(17730, 9500, 182000, 99), clearScore: 7800 },
   { id: 4, title: "Rush Hour", scoring: levelScoring(18480, 9400, 182000, 103), clearScore: 8200 },
   { id: 5, title: "International Hub", scoring: levelScoring(22090, 9400, 202000, 111), clearScore: 9800 },
];

export const luggageRushMeta: ArcadeGameMeta = {
   slug: "luggage-rush",
   title: "Airport Luggage Rush",
   tagline: "Every bag to the right flight.",
   description: "Flip conveyor switches so every suitcase rides to the flight with its colour and symbol before the baggage hall overflows.",
   order: 13,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "A / left, S / down and D / right flip diverters 1–3; W / up flips diverter 4 after 70 s; or click a diverter",
      touch: "Tap a diverter to flip it",
   },
   howTo: {
      keys: [
         { id: "d13", keys: ["A/S/D", "Left/Down/Right"], label: "Flip diverters 1-3", main: true },
         { id: "d4", keys: ["W", "Up"], label: "Flip diverter 4" },
         { id: "click", keys: ["Mouse"], label: "Click a diverter", role: "pointer" },
      ],
      touch: [
         { id: "tap", control: "tap", label: "Tap a diverter to flip it" },
      ],
      steps: [
         { title: "Goal", text: "Send every bag down the chute that matches its colour and symbol." },
         {
            title: "Flip",
            text: "A or Left, S or Down, D or Right flip diverters 1-3. Or click a diverter.",
            touchText: "Tap a diverter to flip it.",
            keys: ["d13", "click"],
            touch: ["tap"],
         },
         {
            title: "Diverter 4",
            text: "After 70 seconds a fourth diverter opens: W or Up flips it.",
            touchText: "After 70 seconds a fourth diverter opens: tap it to flip.",
            keys: ["d4"],
            touch: ["tap"],
         },
         { title: "Watch out", text: "Three missed bags end the run. A gold rim is a VIP: it scores double." },
         {
            title: "Tips",
            text: "+20 a bag, up to x3 in a row: keep the streak. Esc or P pauses.",
            touchText: "+20 a bag, up to x3 in a row: keep the streak. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/luggage-rush.webp",
   accent: "#60a5fa",
   owner: "cursor",
};
