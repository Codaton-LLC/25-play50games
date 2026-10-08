import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Provisional limits (docs/arcade-expansion/02 §C.4): set for real in the game's "assets + limits" PR.
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
      keyboard: "WASD / arrows to fly, Space or E to drop",
      touch: "Joystick + Action to drop",
   },
   scoring: {
      kind: "points",
      maxScore: 6000,
      minDurationMs: 10000,
      maxDurationMs: 200000,
      base: 6000,
      maxPointsPerSec: 6000,
      unitLabel: "pts",
      display: "int",
   },
   thumbnail: null,
   accent: "#38bdf8",
   owner: "codex",
};
