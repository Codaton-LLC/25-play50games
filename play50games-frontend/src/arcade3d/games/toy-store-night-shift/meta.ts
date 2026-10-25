import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 48, docs/menu1-new/specs-41-50.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const toyStoreNightShiftMeta: ArcadeGameMeta = {
   slug: "toy-store-night-shift",
   title: "Toy Store Night Shift",
   tagline: "Every toy on its shelf.",
   description: "Work the night shift in a toy store: pick up the scattered toys and put each one back on its matching shelf before the store opens.",
   order: 48,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to pick up / drop",
      touch: "Joystick to move + Use",
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
   accent: "#f472b6",
   owner: "kimi",
};
