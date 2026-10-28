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
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Fly", main: true, role: "move" },
         { id: "drop", keys: ["Space", "E", "Enter"], label: "Drop", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Fly" },
         { id: "drop", control: "action", label: "Drop" },
      ],
      steps: [
         { title: "Goal", text: "Deliver every parcel to its rooftop before the battery runs flat." },
         {
            title: "Load",
            text: "Fly with WASD or the arrow keys and hover at the depot for 4 seconds to load a parcel.",
            touchText: "Push the joystick to fly and hover at the depot for 4 seconds to load a parcel.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Drop",
            text: "Over the blue rooftop, press Space, E or Enter to release.",
            touchText: "Over the blue rooftop, tap Drop to release.",
            keys: ["drop"],
            touch: ["drop"],
         },
         { title: "Land it clean", text: "Brake early and line up the landing cross. Wind and fragile parcels come later." },
         {
            title: "Tips",
            text: "Hover at the depot again to reload. Esc or P pauses.",
            touchText: "Hover at the depot again to reload. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
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
