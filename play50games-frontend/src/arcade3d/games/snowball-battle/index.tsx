"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import Scene from "./Scene";

const definition: GameDefinition = {
   slug: "snowball-battle",
   Scene,
   Hud,
   assets: { kid: ASSETS.kid, pine: ASSETS.pine, snowman: ASSETS.snowman },
   camera: { position: [0, 8, 12], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#e0f2fe", fog: ["#e0f2fe", 26, 48], lighting: "snow" },
   touchControls: ["joystick", "action", "tap"],
   touchLabels: { action: "Scoop" },
   hudStats: [
      { key: "time", label: "Time" },
      { key: "ammo", label: "Ammo" },
      { key: "rivals", label: "Rivals" },
   ],
   instructions: [
      "Hold Scoop to pack a snowball. Space throws at the rival you are aiming at.",
      "On a phone, tap a rival or the arrow at the edge of the screen.",
      "Three tags knock a rival out. Five tags on you and the fight is over.",
   ],
   resultDelayMs: 1200,
   clockChip: false,
};

export default definition;
