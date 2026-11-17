import { LEVEL_IDS, type ArcadeGameMeta } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./scoring";

// Plain server-safe metadata. Claude aligns backend limits at the integration gate.
export const postman3dMeta: ArcadeGameMeta = {
   slug: "postman-3d",
   title: "Postman 3D",
   tagline: "Right letter, right door.",
   description: "Walk the neighbourhood with a full mailbag and deliver every letter and parcel to the right address.",
   order: 50,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD / arrows to move, E or Enter to deliver",
      touch: "Joystick to move + Post",
   },
   howTo: {
      keys: [
         { id: "move", keys: ["WASD", "Arrows"], label: "Move", main: true, role: "move" },
         { id: "post", keys: ["E", "Enter"], label: "Deliver", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Move" },
         { id: "post", control: "action", label: "Deliver" },
      ],
      steps: [
         { title: "Goal", text: "Deliver the mail on your list: letters to mailboxes, parcels to front doors." },
         {
            title: "Move",
            text: "Use WASD or the arrow keys to walk the street.",
            touchText: "Push the joystick to walk the street.",
            keys: ["move"],
            touch: ["joystick"],
         },
         {
            title: "Deliver",
            text: "Within 1.2 m of the right house, press E or Enter. Match the number and colour.",
            touchText: "Within 1.2 m of the right house, tap Post. Match the number and colour.",
            keys: ["post"],
            touch: ["post"],
         },
         { title: "Watch out", text: "Dogs stun you. Cross on the zebra: cars yield there. Three lives." },
         {
            title: "Tips",
            text: "Follow the list order for +40. Return to POST for more mail. Esc or P pauses.",
            touchText: "Follow the list order for +40. Return to POST for more mail. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: PROPOSED_LEVEL_LIMITS[1],
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: PROPOSED_LEVEL_LIMITS[id] })),
   thumbnail: "/images/3d/postman-3d.webp",
   accent: "#ef4444",
   owner: "claude",
};
