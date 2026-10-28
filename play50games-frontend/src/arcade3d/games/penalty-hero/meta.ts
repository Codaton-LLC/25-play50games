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
   howTo: {
      keys: [
         { id: "aim", keys: ["Arrows"], label: "Pick a zone", main: true, role: "move" },
         { id: "shoot", keys: ["Space"], label: "Shoot", main: true },
      ],
      touch: [
         { id: "tap", control: "tap", label: "Tap a zone to shoot" },
      ],
      steps: [
         { title: "Goal", text: "Ten penalties. Beat the keeper as often as you can." },
         {
            title: "Aim",
            text: "The arrow keys pick a target zone.",
            touchText: "Tap the zone you want: the shot goes as your finger lands.",
            keys: ["aim"],
            touch: ["tap"],
         },
         {
            title: "Shoot on time",
            text: "Press Space when the ring is inside the white band, or the ball goes wide.",
            touchText: "Tap when the ring is inside the white band, or the ball goes wide.",
            keys: ["shoot"],
            touch: ["tap"],
         },
         { title: "Streak", text: "Goals in a row score 150 instead of 100." },
         {
            title: "Tips",
            text: "Wait for the ring: a shot outside the white band goes wide. Esc or P pauses.",
            touchText: "Wait for the ring: a shot outside the white band goes wide. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
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
