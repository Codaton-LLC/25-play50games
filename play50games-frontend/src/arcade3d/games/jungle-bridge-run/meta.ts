import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 46, docs/menu1-new/specs-41-50.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const jungleBridgeRunMeta: ArcadeGameMeta = {
   slug: "jungle-bridge-run",
   title: "Jungle Bridge Run",
   tagline: "Jump the gaps. Cross the bridges.",
   description: "Race an explorer through the jungle over rope bridges, logs and gaps, collecting gems on the way to the finish.",
   order: 46,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "A / D or arrows to switch lanes, Space or W to jump, S to slide",
      touch: "Swipe to switch lanes, jump and slide",
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
   accent: "#22c55e",
   owner: "antigravity",
};
