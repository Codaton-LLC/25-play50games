import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const zooEscapeMeta: ArcadeGameMeta = {
   slug: "zoo-escape",
   title: "Zoo Escape",
   tagline: "Sneak past the keepers.",
   description: "Help a mischievous panda sneak out of the zoo: hide in bushes, slip past the keepers' flashlight gaze and reach the gate.",
   order: 29,
   status: "dev",
   collection: "skill",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD to move, hold Space to sneak, E to toss a snack",
      touch: "Joystick, hold Jump to sneak, Action to toss",
   },
   scoring: {
      kind: "points",
      maxScore: 4500,
      minDurationMs: 20000,
      maxDurationMs: 200000,
      base: 4500,
      maxPointsPerSec: 4500,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#34d399",
   owner: "claude",
};
