import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). Scoring must match WP includes/arcade-games.json.
const SCORING: ScoringRules = PROPOSED_LEVEL_LIMITS[1];

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: PROPOSED_LEVEL_LIMITS[1] },
   { id: 2, title: LEVEL_TITLES[2], scoring: PROPOSED_LEVEL_LIMITS[2] },
   { id: 3, title: LEVEL_TITLES[3], scoring: PROPOSED_LEVEL_LIMITS[3] },
   { id: 4, title: LEVEL_TITLES[4], scoring: PROPOSED_LEVEL_LIMITS[4] },
   { id: 5, title: LEVEL_TITLES[5], scoring: PROPOSED_LEVEL_LIMITS[5] },
];

export const marsRoverMissionMeta: ArcadeGameMeta = {
   slug: "mars-rover-mission",
   title: "Mars Rover Mission",
   tagline: "Drill. Scan. Bring it home.",
   description: "One mission per level on the red planet: drill crystals, scan beacons, repair solar panels, then drive back to the lander before the battery or the clock runs out.",
   order: 43,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "W / up drives, S / down brakes and reverses, A D / arrows steer (the camera follows behind). 📷 or C changes the view",
      touch: "Joystick: push up to drive, left or right to turn",
   },
   howTo: {
      keys: [
         { id: "drive", keys: ["W", "Up"], label: "Drive", main: true, role: "move" },
         { id: "brake", keys: ["S", "Down"], label: "Brake / reverse", role: "move" },
         { id: "steer", keys: ["A/D", "Left/Right"], label: "Steer", role: "move" },
         { id: "view", keys: ["C"], label: "Change view" },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Drive & turn" },
      ],
      steps: [
         { title: "Goal", text: "Follow the light to each target ring, do the job, then park on the blue pad by the lander." },
         {
            title: "Drive",
            text: "W or Up drives, S or Down brakes and reverses, A / D steer. The camera follows behind.",
            touchText: "Push the joystick up to drive, left or right to turn.",
            keys: ["drive", "brake", "steer"],
            touch: ["joystick"],
         },
         {
            title: "Stop in the ring",
            text: "Stop inside the ring: the rover drills, repairs or scans by itself in 1 s. Dead centre = +60.",
            keys: ["brake"],
            touch: ["joystick"],
         },
         { title: "Watch out", text: "Hitting a rock faster than 3 m/s costs a life. Watch the battery: green pads recharge it." },
         {
            title: "Tips",
            text: "C changes the view. Esc or P pauses.",
            touchText: "The camera button changes the view. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/mars-rover-mission.webp",
   accent: "#f97316",
   owner: "antigravity",
};
