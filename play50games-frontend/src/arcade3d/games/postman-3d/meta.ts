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
   scoring: PROPOSED_LEVEL_LIMITS[1],
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: PROPOSED_LEVEL_LIMITS[id] })),
   thumbnail: "/images/3d/postman-3d.webp",
   accent: "#ef4444",
   owner: "claude",
};
