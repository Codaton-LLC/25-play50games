import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 41, docs/menu1-new/specs-41-50.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const dogParkFetchMeta: ArcadeGameMeta = {
   slug: "dog-park-fetch",
   title: "Dog Park Fetch",
   tagline: "Fetch it. Bring it back.",
   description: "Chase balls, sticks and frisbees around the park as a happy dog and bring each one back to your owner.",
   order: 41,
   status: "dev",
   collection: "adventure",
   difficulty: 1,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to run, Space to jump",
      touch: "Joystick to run + Jump",
   },
   scoring: {
      kind: "points",
      maxScore: 3000,
      minDurationMs: 10_000,
      maxDurationMs: 300_000,
      base: 3000,
      maxPointsPerSec: 3000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#f59e0b",
   owner: "kimi",
};
