import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Proven limits (README "Server limits and why they hold"; rules.ts PROPOSED_LIMITS).
export const spaceRepairMeta: ArcadeGameMeta = {
   slug: "space-repair",
   title: "Space Repair Mission",
   tagline: "Fix the station before the power runs out.",
   description: "Jetpack around a tiny space station in zero gravity and fix sparking modules before the station's power runs out.",
   order: 26,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to thrust; release to brake; tap E, Enter or Space in the repair arc",
      touch: "Joystick to thrust; release to brake; tap Repair in the repair arc",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Thrust", main: true, role: "move" },
         { id: "repair", keys: ["E", "Enter", "Space"], label: "Repair", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Thrust" },
         { id: "repair", control: "action", label: "Repair" },
      ],
      steps: [
         { title: "Goal", text: "Fix the station's broken docks and keep its power above zero." },
         {
            title: "Thrust",
            text: "WASD or the arrow keys thrust. Let go to brake.",
            touchText: "Push the joystick to thrust. Let go to brake.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Repair on time",
            text: "At a lit dock, tap E, Enter or Space while the marker is in the green arc.",
            touchText: "At a lit dock, tap Repair while the marker is in the green arc.",
            keys: ["repair"],
            touch: ["repair"],
         },
         { title: "Keep the power up", text: "Keep station power above zero for 2 minutes." },
         {
            title: "Tips",
            text: "Brake early: drifting past the dock wastes time. Esc or P pauses.",
            touchText: "Brake early: drifting past the dock wastes time. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: {
      kind: "points",
      maxScore: 4700,
      minDurationMs: 37000,
      maxDurationMs: 122000,
      base: 400,
      maxPointsPerSec: 40,
      unitLabel: "pts",
      display: "int",
   },
   levels: [
      { id: 1, title: "Docking Bay", scoring: { kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" }, clearScore: 2400 },
      { id: 2, title: "Power Wing", scoring: { kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" }, clearScore: 2400 },
      { id: 3, title: "Comms Wing", scoring: { kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" }, clearScore: 2400 },
      { id: 4, title: "External Platform", scoring: { kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" }, clearScore: 2400 },
      { id: 5, title: "Station Emergency", scoring: { kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" }, clearScore: 2400 },
   ],
   thumbnail: "/images/3d/space-repair.webp",
   accent: "#818cf8",
   owner: "codex",
};
