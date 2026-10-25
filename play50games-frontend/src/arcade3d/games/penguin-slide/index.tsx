"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVELS, type SlideLevel } from "./levels";

const HUD: NonNullable<GameDefinition["hudStats"]> = [{ key: "time", label: "Time" }, { key: "distance", label: "Distance" }, { key: "crashes", label: "Crashes", max: 3 }];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Gentle glacier, two obstacles a stretch to start. Score 3000 to clear.",
   2: "Three obstacles from the start and more narrow passages. Score 3500.",
   3: "Full obstacle density sooner and more bends. Score 4000.",
   4: "Four obstacles from the start, more ramps and narrows. Score 4500.",
   5: "Full density after 30 seconds and hardly a straight. Score all you can.",
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
   levels: LEVEL_IDS.map((id) => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], hudStats: HUD })),
};

export default definition;
