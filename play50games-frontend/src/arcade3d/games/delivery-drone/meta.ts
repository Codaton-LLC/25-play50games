import type { ArcadeGameMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Level 1 keeps the approved P-15 limits. Levels 2-5 equal rules.ts PROPOSED_LEVEL_LIMITS
// (proof: README.md "Levels"); levels.test.ts and arcade-games.json levels (registry.sync.test.ts).
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 3600,
   minDurationMs: 20000,
   maxDurationMs: 182000,
   base: 300,
   maxPointsPerSec: 75,
   unitLabel: "pts",
   display: "int",
};

export const deliveryDroneMeta: ArcadeGameMeta = {
   slug: "delivery-drone",
   title: "Delivery Drone",
   tagline: "Drop every parcel on its rooftop pad.",
   description: "Fly a zippy delivery drone over a toy city, swing parcels on a winch and drop them onto glowing rooftop pads before the battery runs flat.",
   order: 15,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "flight",
      keyboard: "WASD / arrows to fly, Space, E or Enter to drop",
      touch: "Joystick to fly, tap Drop to release; hover at the depot to reload",
   },
   scoring: SCORING,
   // a win clears the level; clearScore also clears a route that was almost finished
   levels: [
      { id: 1, title: "Training Rooftop", scoring: SCORING, clearScore: 1200 },
      { id: 2, title: "Residential Blocks", scoring: { ...SCORING, maxScore: 3900, maxDurationMs: 202000 }, clearScore: 2000 },
      { id: 3, title: "Downtown", scoring: { ...SCORING, maxScore: 4200, maxDurationMs: 222000 }, clearScore: 2000 },
      { id: 4, title: "Windy Towers", scoring: { ...SCORING, maxScore: 4500, maxDurationMs: 242000 }, clearScore: 1200 },
      { id: 5, title: "Night Delivery", scoring: { ...SCORING, maxScore: 4800, maxDurationMs: 272000 }, clearScore: 1400 },
   ],
   thumbnail: "/images/3d/delivery-drone.webp",
   accent: "#38bdf8",
   owner: "codex",
};
