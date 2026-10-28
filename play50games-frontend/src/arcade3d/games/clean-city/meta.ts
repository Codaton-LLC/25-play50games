import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";

// Plain data: mirrors rules.ts PROPOSED_LEVEL_LIMITS, checked in levels.test.ts.
const scoring = (maxScore: number, minDurationMs: number, maxDurationMs: number, pps = 180): ScoringRules => ({
   kind: "points", maxScore, minDurationMs, maxDurationMs, base: 1000,
   maxPointsPerSec: pps, unitLabel: "pts", display: "int",
});
const LEVEL_META: readonly LevelMeta[] = [
   { id: 1, title: "Pocket Park", scoring: scoring(4940, 43000, 250000, 100), clearScore: 3000 },
   { id: 2, title: "City Square", scoring: scoring(6365, 40200, 245000, 135), clearScore: 5400 },
   { id: 3, title: "Shopping Street", scoring: scoring(7230, 42200, 240000, 150), clearScore: 6300 },
   { id: 4, title: "River Walk", scoring: scoring(8100, 42800, 235000, 170), clearScore: 7200 },
   { id: 5, title: "Festival Cleanup", scoring: scoring(10060, 42100, 230000, 215), clearScore: 8100 },
];

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const cleanCityMeta: ArcadeGameMeta = {
   slug: "clean-city",
   title: "Clean the City",
   tagline: "Tidy up the park, the city and the beach.",
   description: "Collect every piece of litter across a park, a city street and a beach as a tidy-up runner. Faster clean-ups earn a time bonus.",
   order: 8,
   status: "live",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move",
      touch: "Joystick to move"
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
      ],
      steps: [
         { title: "Goal", text: "Clean the park, the city and the beach: pick up every piece of litter." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to walk.",
            touchText: "Push the joystick to walk.",
            keys: ["move"],
            touch: ["joystick"],
         },
         { title: "Pick up", text: "Walk into litter to pick it up: +50 a piece.", keys: ["move"], touch: ["joystick"] },
         { title: "Beat the clock", text: "Clear all three maps before time runs out; every second left pays extra." },
         {
            title: "Tips",
            text: "Plan a loop: later levels add moving bins that slow you. Esc or P pauses.",
            touchText: "Plan a loop: later levels add moving bins that slow you. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: {
      kind: "points",
      maxScore: 4940,
      minDurationMs: 43000,
      maxDurationMs: 250000,
      base: 1000,
      maxPointsPerSec: 100,
      unitLabel: "pts",
      display: "int"
   },
   levels: LEVEL_META,
   thumbnail: "/images/3d/clean-city.webp",
   accent: "#4ade80",
   owner: "cursor"
};
