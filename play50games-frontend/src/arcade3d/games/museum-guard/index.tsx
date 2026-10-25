"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, type MuseumLevel } from "./levels";
import { finalScore } from "./rules";
import Scene from "./Scene";

const INSTRUCTIONS = [
   "Turn with the mouse, A / D or the arrows. Drag to turn on a phone.",
   "Space or E flashes (the Flash button). Hold the beam to send a statue home.",
   "Three alarms and the night wins. Last until dawn.",
];

/** one line under the level tiles */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Eight statues and a 90 second night.",
   2: "A longer night, and more statues leave their pedestals.",
   3: "The beam narrows and the patrols leave closer together.",
   4: "Three statues sneak at once, and more of them are penguins.",
   5: "The narrowest beam and the fastest patrols, until a late dawn.",
};

/** Replaces the start-card lines only when the level adds a mechanic. Level 1 keeps INSTRUCTIONS. */
const EXTRA: Partial<Record<LevelId, string>> = {
   2: "More statues leave their pedestals, and dawn comes later.",
   3: "The beam narrows, and statues leave closer together.",
   4: "Three statues can sneak at once from the start. More of them are penguins.",
   5: "The beam is at its narrowest and the patrols are at their fastest.",
};

/**
 * L1 is today's night hall. L2–L3 stay on the night preset and only darken the room.
 * L4 is the dusk/night preset (night, darker fog). L5 is the dramatic preset (space).
 * The flashlight is the read either way; the beam width is a rules knob, not the light.
 */
const ENVIRONMENTS: Partial<Record<LevelId, LevelSpec<MuseumLevel>["environment"]>> = {
   2: { background: "#16142f", fog: ["#16142f", 16, 26], lighting: "night" },
   3: { background: "#100e24", fog: ["#100e24", 14, 24], lighting: "night" },
   4: { background: "#0b1026", fog: ["#0b1026", 12, 22], lighting: "night" },
   5: { background: "#020617", fog: ["#020617", 10, 20], lighting: "space" },
};

const definition: GameDefinition<MuseumLevel> = {
   slug: "museum-guard",
   Scene,
   Hud,
   assets: {
      knight: ASSETS.knight,
      robot: ASSETS.robot,
      penguin: ASSETS.penguin,
      dino: ASSETS.dino,
      door: ASSETS.door,
      bench: ASSETS.bench,
   },
   camera: { position: [0, 1.6, 0], lookAt: [0, 1.6, 1], fov: 70 },
   environment: { background: "#1e1b4b", fog: ["#1e1b4b", 18, 28], lighting: "night" },
   touchControls: ["action"],
   touchLabels: { action: "Flash" },
   input: { drag: true },
   hudStats: [
      { key: "alarms", label: "Alarms", max: 3 },
      { key: "flash", label: "Flash" },
      { key: "dawn", label: "Dawn" },
   ],
   instructions: INSTRUCTIONS,
   resultDelayMs: 1100,
   clockChip: false,
   finalScore,
   levels: LEVEL_IDS.map((id) => {
      const extra = EXTRA[id];
      const environment = ENVIRONMENTS[id];
      return {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         ...(extra ? { instructions: [...INSTRUCTIONS, extra] } : {}),
         ...(environment ? { environment } : {}),
      };
   }),
};

export default definition;
