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
      keyboard: "WASD to move, click to inspect",
      touch: "Joystick + tap to inspect"
   },
   scoring: {
      kind: "time",
      maxScore: 60000,
      minDurationMs: 15000,
      maxDurationMs: 600000,
      base: 0,
      maxPointsPerSec: 0,
      timeBaseMs: 600000,
      unitLabel: "time",
      display: "time"
   },
   thumbnail: null,
   accent: "#eab308",
   owner: "codex"
};
