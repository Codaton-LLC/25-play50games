"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, type SnowLevel } from "./levels";
import Scene from "./Scene";

const HUD: NonNullable<GameDefinition["hudStats"]> = [
   { key: "time", label: "Time" },
   { key: "ammo", label: "Ammo" },
   { key: "rivals", label: "Rivals" },
];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Three rivals in the snow yard. Tag each one three times.",
   2: "Longer throws across the park, and the rivals dodge a little sooner.",
   3: "The third rival joins sooner, and two of them can attack at once.",
   4: "Shorter wind-ups, faster dodges, and forts that crumble in two hits.",
   5: "All three rivals press from the start. The 90 second clock still ends the fight.",
};

const definition: GameDefinition<SnowLevel> = {
   slug: "snowball-battle",
   Scene,
   Hud,
   assets: { kid: ASSETS.kid, pine: ASSETS.pine, snowman: ASSETS.snowman },
   camera: { position: [0, 8, 12], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#e0f2fe", fog: ["#e0f2fe", 26, 48], lighting: "snow" },
   touchControls: ["joystick", "action", "tap"],
   touchLabels: { action: "Scoop" },
   hudStats: HUD,
   instructions: [
      "Hold Scoop to pack a snowball. Space throws at the rival you are aiming at.",
      "On a phone, tap a rival or the arrow at the edge of the screen.",
      "Three tags knock a rival out. Five tags on you and the fight is over.",
   ],
   resultDelayMs: 1200,
   clockChip: false,
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      hudStats: HUD,
   })),
};

export default definition;
