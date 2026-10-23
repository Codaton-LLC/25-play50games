import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Score, limits and end" (design merge 2026-10-09).
export const castleDefenderMeta: ArcadeGameMeta = {
   slug: "castle-defender",
   title: "Castle Defender",
   tagline: "Hold the wall.",
   description: "Hold the castle wall against waves of bumbling cartoon goblins: tap to fire the wall cannon, drop rocks on ladders and keep the gate standing.",
   order: 24,
   status: "dev",
   collection: "skill",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "Click the field to fire; arrows / WASD aim, Space fires; E / Enter drops a rock; 1 / 2 chooses an upgrade",
      touch: "Tap the field to fire, tap Rock to clear a ladder, tap an upgrade card to choose",
   },
   scoring: {
      kind: "points",
      maxScore: 3210,
      minDurationMs: 39000,
      maxDurationMs: 140000,
      base: 160,
      maxPointsPerSec: 25,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#94a3b8",
   owner: "codex",
};
