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
   2: "Sandstone tomb hall with obelisks, sarcophagi and a cordoned north path.",
   3: "Crimson art salon where catching a statue triggers its paired counterpart.",
   4: "Planetarium wing with rockets, specimen pods and randomized turntables.",
   5: "Midnight treasury vault with cross-gallery alternating exits.",
};

/** Replaces the start-card lines only when the level adds a mechanic. Level 1 keeps INSTRUCTIONS. */
const EXTRA: Partial<Record<LevelId, string>> = {
   2: "Ancient Wing: the north passage is cordoned off, and dawn comes later.",
   3: "Art Wing: sending a statue home wakes its paired counterpart next.",
   4: "Science Wing: three statues sneak at once on randomized turntable pedestals.",
   5: "Full Museum Night: departures alternate across the vault with the narrowest beam.",
};

/**
 * L1 is today's night hall. L2–L4 use distinct wing fog/background palettes on the night preset
 * (amber sandstone, crimson salon, cyber-cobalt planetarium). L5 uses the dramatic space preset.
 */
const ENVIRONMENTS: Partial<Record<LevelId, LevelSpec<MuseumLevel>["environment"]>> = {
   2: { background: "#1c140d", fog: ["#1c140d", 15, 25], lighting: "night" },
   3: { background: "#230d16", fog: ["#230d16", 14, 24], lighting: "night" },
   4: { background: "#061527", fog: ["#061527", 12, 22], lighting: "night" },
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
      sarcophagus: ASSETS.sarcophagus,
      bust: ASSETS.bust,
      chest: ASSETS.chest,
      rocket: ASSETS.rocket,
      glowPod: ASSETS.glowPod,
      cannon: ASSETS.cannon,
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
