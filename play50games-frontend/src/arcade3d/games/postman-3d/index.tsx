"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type PostLevel } from "./levels";
import { CAMERA, environmentFor } from "./looks";
import Scene from "./Scene";

const instructions = [
   "WASD / arrows or the stick moves. E / Enter or the Post button delivers within 1.2 m.",
   "Match the number and colour. Letters go in mailboxes; parcels go to the front door.",
   "Follow the list for +40. Return to POST for more mail and one parcel at a time.",
];
const stats = (c: PostLevel) => [{ key: "delivered", label: "Delivered", max: c.letters + c.parcels }, { key: "bag", label: "Bag", max: c.bagCap }];
const definition: GameDefinition<PostLevel> = {
   slug: "postman-3d", Scene, Hud, assets: ASSETS,
   camera: CAMERA, environment: environmentFor(LEVELS[1]), durationMs: LEVELS[1].durationMs,
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Post" }, instructions, hudStats: stats(LEVELS[1]), resultDelayMs: 900,
   levels: LEVEL_IDS.map((id) => ({
      id, config: LEVELS[id], description: LEVEL_LINES[id], durationMs: LEVELS[id].durationMs,
      lives: LEVELS[id].lives, environment: environmentFor(LEVELS[id]), hudStats: stats(LEVELS[id]),
      instructions: [...instructions, ...(id >= 3 ? ["Dogs stun you. Read the street plates; address markers are off."] : []), ...(id >= 4 ? ["Three lives. Cross on the zebra: approaching cars yield there."] : [])],
   })),
};

export default definition;
