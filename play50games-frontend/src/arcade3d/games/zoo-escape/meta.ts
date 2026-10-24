import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): the proven ones are PROPOSED_LIMITS in
// rules.ts (README "Server limits and why they hold"); Claude copies them here and into
// arcade-games.json in the go-live PR.
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
      keyboard: "WASD / arrows to move, hold Space to sneak, E or Enter to toss bamboo",
      touch: "Joystick to move, hold Sneak to sneak, Toss to throw bamboo",
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
   thumbnail: "/images/3d/zoo-escape.webp",
   accent: "#34d399",
   owner: "claude",
};
