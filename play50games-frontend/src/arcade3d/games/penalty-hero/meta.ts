import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const penaltyHeroMeta: ArcadeGameMeta = {
   slug: "penalty-hero",
   title: "Penalty Hero",
   tagline: "10 shots. Beat the keeper.",
   description: "Pick a corner and shoot. The keeper guesses a side. Score streaks for bonus points.",
   order: 5,
   status: "live",
   difficulty: 2,
   orientation: "portrait",
   controls: {
      scheme: "tap-target",
      keyboard: "Arrow keys to aim, Space to shoot",
      touch: "Tap a target zone"
   },
   scoring: {
      kind: "points",
      maxScore: 1450,
      minDurationMs: 15500,
      maxDurationMs: 225000,
      base: 0,
      maxPointsPerSec: 95,
      unitLabel: "pts",
      display: "int"
   },
   thumbnail: "/images/3d/penalty-hero.webp",
   accent: "#f472b6",
   owner: "cursor"
};
