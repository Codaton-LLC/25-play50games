"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import { Hud } from "./Hud";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import { LEVELS, type CraneLevel } from "./levels";
import { CLOCK_S } from "./rules";

const HUD: NonNullable<GameDefinition["hudStats"]> = [
   { key: "stability", label: "Stability", max: 100 },
   { key: "building", label: "Building", max: 3 },
   { key: "swing", label: "Swing" },
];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "House, shop and tower; the wind gusts at the tower. Score 2500 or finish.",
   2: "The wind starts at the shop, and the landing marks are smaller. Score 2600.",
   3: "Gusts from the very first piece, a little stronger. Score 2700.",
   4: "Stronger, more frequent gusts and tighter marks. Score 2800.",
   5: "The strongest wind and the smallest marks. Build all you can.",
};

const definition: GameDefinition<CraneLevel> = {
   slug: "construction-worker",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [8, 12, 18], fov: 42, lookAt: [0, 0.5, 5] },
   environment: { background: COLORS.skyBottom, fog: [COLORS.fog, 65, 140], lighting: "day" },
   touchControls: ["joystick", "action", "tap"],
   hudStats: HUD,
   durationMs: CLOCK_S * 1000,
   resultDelayMs: 1100,
   levels: LEVEL_IDS.map((id) => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], hudStats: HUD })),
   instructions: [
      "A / D rotates the crane, W / S runs the trolley. Arrows do the same.",
      "Swing the hook over the glowing pile (arrow + number), then press its key, tap it or Action, and hold still.",
      "Run the trolley out into the green band over the glowing slot; Space or Action drops when the ring under the hook is green.",
      "C or 📷 changes the view.",
   ],
};

export default definition;
