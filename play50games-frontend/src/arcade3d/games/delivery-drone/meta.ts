import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Approved P-15 provisional limits; Claude pairs the server catalog update at merge.
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
   scoring: {
      kind: "points",
      maxScore: 3600,
      minDurationMs: 20000,
      maxDurationMs: 182000,
      base: 300,
      maxPointsPerSec: 75,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#38bdf8",
   owner: "codex",
};
