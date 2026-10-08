import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR
// (proposed in README.md "Server limits and why they hold": 10500, 19000-92000 ms, 1500 + 110/s).
export const pirateCannonsMeta: ArcadeGameMeta = {
   slug: "pirate-cannons",
   title: "Pirate Cannon Battle",
   tagline: "Read the wind, sink the ships.",
   description: "Man a seaside fort's cartoon cannon: drag to aim, read the wind, and sink pirate ships before they reach the harbour.",
   order: 23,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "aim-drag",
      keyboard: "Drag to aim, release to fire, click to fire again; or arrows + Space",
      touch: "Drag to aim, release to fire, tap to fire again",
   },
   scoring: {
      kind: "points",
      maxScore: 9000,
      minDurationMs: 10000,
      maxDurationMs: 92000,
      base: 9000,
      maxPointsPerSec: 9000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#f87171",
   owner: "claude",
};
