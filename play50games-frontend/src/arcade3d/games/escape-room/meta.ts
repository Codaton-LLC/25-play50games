import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";
import type { ArcadeGameMeta } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
export const escapeRoomMeta: ArcadeGameMeta = {
   slug: "escape-room",
   title: "Tiny Escape Room",
   tagline: "Find the items. Open the door.",
   description: "Search a small room for the key, the book and the battery, then unlock the door. Fastest escape wins.",
   order: 9,
   status: "live",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "point-and-move",
      keyboard: "WASD / arrows to move, click or E to inspect",
      touch: "Joystick to move, tap a marker to inspect"
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
         { id: "inspect", keys: ["E", "Mouse"], label: "Inspect", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
         { id: "tap", control: "tap", label: "Inspect" },
      ],
      steps: [
         { title: "Goal", text: "Find all the items and open the door. Faster escapes rank higher." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to walk.",
            touchText: "Push the joystick to walk.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Inspect",
            text: "When you are close to a yellow marker, press E or click it to inspect it.",
            touchText: "When you are close to a yellow marker, tap it to inspect it.",
            keys: ["inspect"],
            touch: ["tap"],
         },
         { title: "Escape", text: "With every item in hand, open the exit before time runs out." },
         {
            title: "Tips",
            text: "The checklist shows what is still missing: inspect every container once. Esc or P pauses.",
            touchText: "The checklist shows what is still missing: inspect every container once. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: {
      kind: "time",
      maxScore: 58634,
      minDurationMs: 13654,
      maxDurationMs: 600000,
      base: 0,
      maxPointsPerSec: 0,
      timeBaseMs: 600000,
      unitLabel: "time",
      display: "time"
   },
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id - 1], scoring: PROPOSED_LEVEL_LIMITS[id] })),
   thumbnail: "/images/3d/escape-room.webp",
   accent: "#eab308",
   owner: "codex"
};
