"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import DinoHud from "./Hud";
import { LEVELS, type DinoLevel } from "./levels";
import { COLORS, FOG, THEME_LOOKS } from "./looks";
import { DURATION_MS, RESULT_DELAY_MS, regularSupply } from "./rules";
import Scene from "./Scene";

const BASE_INSTRUCTIONS = [
   "Gather runaway eggs and carry them back to your nest in the South-East.",
   "Each carried egg slows you down; dodge boulders and sticky mud pits!",
   "WASD / Joystick to waddle, Space / E / tap Dash to dash.",
];

/** Each level's twist, as a fourth instruction line (level 1 keeps its three). */
const TWISTS: Record<LevelId, string> = {
   1: "",
   2: "Fern Forest: fallen logs block the way. Walk round, or dash to hop over a log.",
   3: "Riverbank: wading is slow and the current drags you downstream. Cross on the log bridges.",
   4: "Volcanic Pass: lava vents glow, then erupt. Step off a glowing vent, or dash through it.",
   5: "Dino Sanctuary: the nest pen has one gate. Mind the pond, the geysers and the logs. You can carry four eggs.",
};

/** Where the nest is, per level (the first instruction line). */
const NEST_AT: Record<LevelId, string> = {
   1: "in the South-East",
   2: "in the South-West clearing",
   3: "on the South-West bank",
   4: "in the hollow on the west wall",
   5: "in the fenced pen to the south",
};

function instructionsFor(id: LevelId): string[] {
   return [...BASE_INSTRUCTIONS.map((line) => line.replace("in the South-East", NEST_AT[id])), TWISTS[id]];
}

/** one line under the level tiles */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "90 seconds in the sunset valley. Carry eggs home and dodge the boulders.",
   2: "A dense forest: trunks, ferns and fallen logs to hop. 120 seconds.",
   3: "A river splits the valley: wade against the current or use the bridges. 120 seconds.",
   4: "Night in the volcanic pass: lava boulders and erupting vents. 120 seconds.",
   5: "The sanctuary at dusk: a gated nest pen, a pond, geysers. Carry four. 120 seconds.",
};

/** each level's light, fog and backdrop colour (looks.ts THEME_LOOKS) */
const environmentFor = (level: DinoLevel): NonNullable<LevelSpec<DinoLevel>["environment"]> => {
   const look = THEME_LOOKS[level.map.theme];
   return { background: look.skyBottom, lighting: look.lighting, fog: [look.fog, look.fogNear, look.fogFar] };
};

const savedMax = (level: DinoLevel) => regularSupply(level) + level.goldenSpawnTimes.length;

const definition: GameDefinition<DinoLevel> = {
   slug: "dino-egg-rescue",
   Scene,
   Hud: DinoHud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   resultDelayMs: RESULT_DELAY_MS,
   camera: { position: [0, 16, 13.4], fov: FOV, lookAt: [0, 0, 0] },
   environment: {
      background: COLORS.skyBottom,
      lighting: "sunset",
      fog: [COLORS.fog, FOG.near, FOG.far],
   },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Dash" },
   hudStats: [{ key: "eggs", label: "Eggs Saved" }],
   instructions: BASE_INSTRUCTIONS,
   levels: LEVEL_IDS.map((id): LevelSpec<DinoLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         durationMs: level.durationMs,
         instructions: instructionsFor(id),
         environment: environmentFor(level),
         hudStats: [{ key: "eggs", label: "Eggs Saved", max: savedMax(level) }],
      };
   }),
};

export default definition;
