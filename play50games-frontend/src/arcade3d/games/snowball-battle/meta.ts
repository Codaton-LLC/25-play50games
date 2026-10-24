import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
export const snowballBattleMeta: ArcadeGameMeta = {
   slug: "snowball-battle",
   title: "Snowball Battle",
   tagline: "Duck, scoop, throw.",
   description: "A friendly 1-vs-3 snowball fight: duck behind snow forts, scoop snowballs and tag the rival kids before they tag you.",
   order: 17,
   status: "dev",
   collection: "adventure",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, mouse to aim; hold E or Enter to scoop, Space to throw",
      touch: "Joystick to move, hold Scoop to pack a snowball, tap a rival to throw",
   },
   scoring: {
      kind: "points",
      maxScore: 2550,
      minDurationMs: 10000,
      maxDurationMs: 92000,
      base: 600,
      maxPointsPerSec: 190,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: "/images/3d/snowball-battle.webp",
   accent: "#bae6fd",
   owner: "cursor",
};
