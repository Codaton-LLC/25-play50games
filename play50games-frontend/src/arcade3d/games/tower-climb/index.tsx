"use client";

// Tower Climb: one LevelSpec per meta.ts level, built from levels.ts (core/README.md "Levels").
// Level 1 keeps today's instructions and clock. The environment is the bright day look; later levels
// only override the sky, the fog colour and the lighting preset.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV, LOOK_AT } from "./camera";
import { LEVELS, type TowerLevel } from "./levels";
import { FOG, LEVEL_LOOKS } from "./looks";
import { DURATION_MS } from "./rules";

const BASE_INSTRUCTIONS = [
   "A/D or Left/Right to run. Space, W or Up jumps once per press.",
   "On touch: steer with the joystick, then tap Jump or swipe up.",
   "Follow the cyan and violet slabs. Orange spurs crack and fall after contact.",
   "Yellow flags mark safe checkpoint ledges. There are no respawns.",
   "+10 per new metre of height, +25 per coin. Falling ends the climb.",
];

function instructionsFor(level: TowerLevel): string[] {
   const lines = BASE_INSTRUCTIONS.slice(0, 4);
   if (level.movingTravel > 0.2) lines.push("Violet slabs slide further and faster. The arrows show which way.");
   if (level.springs > 0) lines.push("A lime pad throws you straight up. Steer to the slab above it.");
   if (level.rockets > 0) lines.push("Grab a rocket and it flies you upward. Steer onto a slab before it burns out.");
   if (level.winds > 0) lines.push("Side wind pushes you outward. Stay over the slabs.");
   lines.push("+10 per new metre of height, +25 per coin. Falling ends the climb.");
   return lines;
}

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Today's tower: moving slabs, crumbling spurs, coins and checkpoints.",
   2: "Wider, faster slabs and more crumbling spurs. Flags burst when you arrive.",
   3: "Spring pads throw you about 3 m straight up.",
   4: "A night climb. Rockets fly you upward for a short burst.",
   5: "Wind pushes you off the sides. Springs and rockets stay.",
};

function environmentFor(id: LevelId): NonNullable<GameDefinition["environment"]> {
   const look = LEVEL_LOOKS[id];
   const fog: [string, number, number] = [look.fog, FOG.near, FOG.far];
   return { background: look.background, fog, lighting: look.lighting };
}

const definition: GameDefinition<TowerLevel> = {
   slug: "tower-climb",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [3, 3, 12], fov: FOV, lookAt: LOOK_AT },
   environment: environmentFor(1),
   touchControls: ["joystick", "jump"],
   hudStats: [{ key: "height", label: "Height" }],
   instructions: BASE_INSTRUCTIONS,
   levels: LEVEL_IDS.map((id): LevelSpec<TowerLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         environment: environmentFor(id),
      };
   }),
};

export default definition;
