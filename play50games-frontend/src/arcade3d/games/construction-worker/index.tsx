"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import { Hud } from "./Hud";
import { ASSETS } from "./assets";
import { COLORS, THEMES } from "./looks";
import { LEVELS, type CraneLevel } from "./levels";
import { CLOCK_S } from "./rules";

const HUD: NonNullable<GameDefinition["hudStats"]> = [
   { key: "stability", label: "Stability", max: 100 },
   { key: "building", label: "Building", max: 3 },
   { key: "swing", label: "Swing" },
];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "A back garden at midday; the wind gusts at the tower. Score 2500 or finish.",
   2: "A street of tiny houses: piles spread wide, a tight little house, wind from the east from the shop on. Score 2600.",
   3: "A garage yard at sunset: two workstations, a wide garage, gusts across the yard. Score 2700.",
   4: "A shop street at dusk: the piles alternate sides and the crosswind flips with every gust. Score 2800.",
   5: "Downtown at night: a slim tower and diagonal gusts that come round from every side. Build all you can.",
};

/** The level's sky, fog and core light (looks.ts THEMES); level 1 keeps today's. */
const environmentOf = (id: LevelId) => {
   const t = THEMES[LEVELS[id].site];
   return { background: t.skyBottom, fog: [t.fog, t.fogNear, t.fogFar] as [string, number, number], lighting: t.lighting };
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
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      hudStats: HUD,
      ...(id === 1 ? {} : { environment: environmentOf(id) }),
   })),
   instructions: [
      "A / D rotates the crane, W / S runs the trolley. Arrows do the same.",
      "Swing the hook over the glowing pile (arrow + number), then press its key, tap it or Action, and hold still.",
      "Run the trolley out into the green band over the glowing slot; Space or Action drops when the ring under the hook is green.",
      "C or 📷 changes the view.",
   ],
};

export default definition;
