import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
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
      keyboard: "Click to fire, E to drop a rock, 1 / 2 to upgrade",
      touch: "Tap to fire, Action to drop a rock",
   },
   scoring: {
      kind: "points",
      maxScore: 7500,
      minDurationMs: 10000,
      maxDurationMs: 200000,
      base: 7500,
      maxPointsPerSec: 7500,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#94a3b8",
   owner: "codex",
};
