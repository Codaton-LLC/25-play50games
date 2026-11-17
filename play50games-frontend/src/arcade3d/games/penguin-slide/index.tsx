"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVELS, type SlideLevel } from "./levels";
import { THEMES } from "./looks";

const HUD: NonNullable<GameDefinition["hudStats"]> = [{ key: "time", label: "Time" }, { key: "distance", label: "Distance" }, { key: "crashes", label: "Crashes", max: 3 }];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "A sunny pine slope, two obstacles a stretch to start. Score 3000 to clear.",
   2: "A dim ice cave of glowing crystals: fallen ice blocks and narrow passages. Score 3500.",
   3: "A frozen lake: thin ice cracks everywhere, more bends. Score 4000.",
   4: "Night under the northern lights: a snowman parade, more ramps and narrows. Score 4500.",
   5: "A glacier at dusk between ice cliffs, hardly a straight. Score all you can.",
};

/** The level's sky, fog and core light (looks.ts THEMES); level 1 keeps today's snow day. */
const environmentOf = (id: LevelId) => {
   const t = THEMES[LEVELS[id].site];
   return { background: t.skyBottom, fog: [t.fog, 25, 56] as [string, number, number], lighting: t.lighting };
};

const definition: GameDefinition<SlideLevel> = {
   slug: "penguin-slide",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [0, 12, 22], fov: 50, lookAt: [0, 0, -10] },
   environment: { background: "#e9fbff", fog: ["#e9fbff", 25, 56], lighting: "snow" },
   touchControls: ["joystick", "jump"],
   touchLabels: { jump: "Hop" },
   hudStats: HUD,
   resultDelayMs: 1200,
   instructions: ["A / D or arrows to carve; Space or Hop to jump.", "Follow fish and cross gates for +8 seconds. Three crashes end the slide.", "Steer off ramps to spin, then land facing forward. Touch auto-hop is always on."],
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      hudStats: HUD,
      ...(id === 1 ? {} : { environment: environmentOf(id) }),
   })),
};

export default definition;
