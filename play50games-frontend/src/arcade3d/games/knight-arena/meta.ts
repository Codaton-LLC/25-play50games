import type { ArcadeGameMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Level 1 limits are today's. Levels 2-5 equal rules.ts PROPOSED_LEVEL_LIMITS (README "Levels").
// A level clears by reaching clearScore (the run always ends on the 60 s clock). Level 5 has
// nothing to unlock, so it has no clearScore.
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 11600,
   minDurationMs: 58000,
   maxDurationMs: 62000,
   base: 0,
   maxPointsPerSec: 200,
   unitLabel: "pts",
   display: "int",
};

const levelScoring = (maxScore: number, maxPointsPerSec: number): ScoringRules => ({
   ...SCORING,
   maxScore,
   maxPointsPerSec,
});

export const knightArenaMeta: ArcadeGameMeta = {
   slug: "knight-arena",
   title: "Knight Training Arena",
   tagline: "Strike on the beat.",
   description: "A young knight trains on the castle green: strike each target in the direction it shows, on the beat, and build the biggest combo.",
   order: 28,
   status: "live",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "timing",
      keyboard: "Arrows / WASD to strike, Space to spin",
      touch: "Swipe to strike, Action to spin",
   },
   howTo: {
      keys: [
         { id: "strike", keys: ["Arrows", "WASD"], label: "Strike", main: true, role: "move" },
         { id: "spin", keys: ["Space", "E"], label: "Spin", main: true },
      ],
      touch: [
         { id: "swipe", control: "swipe", label: "Swipe to strike" },
         { id: "spin", control: "action", label: "Spin" },
      ],
      steps: [
         { title: "Goal", text: "Strike the training dummies on the beat and build your combo." },
         {
            title: "Strike",
            text: "Press the arrow (or WASD) that matches the dummy's arrow as the ring closes.",
            touchText: "Swipe in the direction of the dummy's arrow as the ring closes.",
            keys: ["strike"],
            touch: ["swipe"],
         },
         {
            title: "Spin",
            text: "At a full Spin meter, press Space or E to sweep every active target (+50).",
            touchText: "At a full Spin meter, tap Spin to sweep every active target (+50).",
            keys: ["spin"],
            touch: ["spin"],
         },
         { title: "Watch out", text: "Shield dummies take two beat hits in a row. Leave the red tomato decoys: -50." },
         {
            title: "Tips",
            text: "Hit on the beat to keep the combo climbing. Esc or P pauses.",
            touchText: "Hit on the beat to keep the combo climbing. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: [
      { id: 1, title: "Basic Training", scoring: SCORING, clearScore: 4400 },
      { id: 2, title: "Moving Targets", scoring: levelScoring(12100, 209), clearScore: 4500 },
      { id: 3, title: "Timed Course", scoring: levelScoring(13000, 225), clearScore: 5100 },
      { id: 4, title: "Combo Arena", scoring: levelScoring(13900, 240), clearScore: 6000 },
      { id: 5, title: "Royal Trial", scoring: levelScoring(15100, 261) },
   ],
   thumbnail: "/images/3d/knight-arena.webp",
   accent: "#facc15",
   owner: "antigravity",
};
