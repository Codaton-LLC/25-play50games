import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Stub (Menu 1 game 38, docs/menu1-new/specs-31-40.md): placeholder limits; the build replaces them
// with the proven per-level limits (PROPOSED_LEVEL_LIMITS) and adds meta.levels.
export const wizardPotionLabMeta: ArcadeGameMeta = {
   slug: "wizard-potion-lab",
   title: "Wizard Potion Lab",
   tagline: "Mix it in the right order.",
   description: "Grab ingredients off the shelves and drop them into the cauldron in recipe order to brew every potion.",
   order: 38,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to use",
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
   accent: "#c4b5fd",
   owner: "cursor",
};
