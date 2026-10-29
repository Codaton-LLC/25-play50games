"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import { LEVELS, type GhostLevel } from "./levels";
import { DURATION_MS, COUNT } from "./rules";

const HUD: NonNullable<GameDefinition["hudStats"]> = [{ key: "ghosts", label: "Ghosts", max: COUNT }];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "The living rooms at night: twelve ghosts, three gold. Catch them all, or score 1500.",
   2: "The library: shelves everywhere, and ghosts that slip into them. Score 1600.",
   3: "The kitchen: tiles and counters, and ghosts that skid away when lit. Score 1700.",
   4: "The attic: beams, trunks and dust; ghosts creep back into their trunks. Score 1800.",
   5: "The whole mansion: a library, a study, a kitchen and an attic, every ghost with its room's habit.",
};

/** Each level's room habit, as a fourth instruction line (level 1 keeps its three). */
const HABITS: Partial<Record<LevelId, string>> = {
   2: "Library: a ghost now and then slips into the shelves and fades; light it when it shows again.",
   3: "Kitchen: a lit ghost skids away fast on the tiles. Keep the light on it.",
   4: "Attic: a ghost left alone creeps back into its trunk. Shaking trunk = walk up to it again.",
   5: "Whole mansion: library ghosts fade, kitchen ghosts skid, attic ghosts hide again.",
};

/** Each level's light (the room's mood; the fog and backdrop around the house). */
const ENVIRONMENT: Partial<Record<LevelId, NonNullable<GameDefinition["environment"]>>> = {
   2: { lighting: "indoor", background: "#1a120b", fog: ["#1a120b", 25, 75] },
   3: { lighting: "indoor", background: "#0f1f2a", fog: ["#0f1f2a", 25, 75] },
   4: { lighting: "night", background: "#0d0b0a", fog: ["#2a241e", 20, 60] },
   5: { lighting: "night", background: "#120f2e", fog: ["#1c1838", 25, 75] },
};

const INSTRUCTIONS = [
   "Explore the rooms: nearby desks reveal hidden ghosts.",
   "Aim the flashlight to stun; hold E, Enter or Space to vacuum.",
   "Touch: joystick moves and aims; held Vacuum assists nearby stunned targets.",
];

const definition: GameDefinition<GhostLevel> = {
   slug: "ghost-vacuum",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [0, 14, 9], fov: 45, lookAt: [0, 0, 8] },
   environment: {
      lighting: "night",
      background: COLORS.skyTop,
      fog: [COLORS.fog, 25, 75],
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Vac" },
   hudStats: HUD,
   resultDelayMs: 1600,
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      hudStats: HUD,
      ...(HABITS[id] ? { instructions: [...INSTRUCTIONS, HABITS[id]!] } : {}),
      ...(ENVIRONMENT[id] ? { environment: ENVIRONMENT[id] } : {}),
   })),
   instructions: INSTRUCTIONS,
};

export default definition;
