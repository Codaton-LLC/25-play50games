import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const escapeRoomMeta: ArcadeGameMeta = {
   slug: "escape-room",
   title: "Tiny Escape Room",
   tagline: "Find the items. Open the door.",
   description: "Search a small room for the key, the book and the battery, then unlock the door. Fastest escape wins.",
   order: 9,
   status: "soon",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "point-and-move",
      keyboard: "WASD / arrows to move, click or E to inspect",
      touch: "Joystick to move, tap a marker to inspect"
   },
   scoring: {
      kind: "time",
      maxScore: 58370,
      minDurationMs: 16300,
      maxDurationMs: 600000,
      base: 0,
      maxPointsPerSec: 0,
      timeBaseMs: 600000,
      unitLabel: "time",
      display: "time"
   },
   thumbnail: "/images/3d/escape-room.webp",
   accent: "#eab308",
   owner: "codex"
};
