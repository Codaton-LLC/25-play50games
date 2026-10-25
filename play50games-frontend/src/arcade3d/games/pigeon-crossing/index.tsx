"use client";

import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, type PigeonLevel } from "./levels";
import { LEVEL_LOOKS } from "./looks";
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV, LOOK_AT } from "./camera";
import { COLORS } from "./Primitives";
import { DURATION_MS } from "./rules";

const definition: GameDefinition<PigeonLevel> = {
   slug: "pigeon-crossing",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   camera: { position: [0, 29.711, 17.204], fov: FOV, lookAt: LOOK_AT },
   environment: { background: COLORS.background, lighting: "day" },
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: ["Cross three sections. The live street, unchanged.", "Four sections: parked vans and denser traffic. Centre grass stays safe.", "Five sections: paired convoys and parked vans on both sides.", "Six sections: longer crossings through faster night traffic.", "Eight sections: five-row crossings and mixed rush-hour convoys."][id - 1],
      config: LEVELS[id],
      environment: LEVEL_LOOKS[id],
      durationMs: LEVELS[id].durationMs,
      hudStats: [{ key: "level", label: id === 1 ? "Level" : "Street" }],
      ...(id === 1 ? {} : { instructions: [
         "Arrows / WASD or swipes: one hop per press. Tap hops forward; queue one hop in the air.",
         "Parked vans block the edge columns on grass. Wait in the centre for a clear crossing.",
         `New rows earn ${10 * LEVELS[id].pointsFactor} points; each street adds ${100 * LEVELS[id].pointsFactor}. Clear the target, then keep scoring.`,
      ] }),
   })),
   touchControls: ["swipe", "tap"],
   hudStats: [{ key: "level", label: "Level" }],
   instructions: [
      "Arrows or WASD: one hop per press. Swipe to hop in any direction.",
      "Tap or click to hop forward. You can queue one hop while in the air.",
      "Watch the gaps, wait on grass and cross twenty rows to the next level.",
      "+10 for each new furthest row, +100 for a level. One hit ends the run.",
   ],
};

export default definition;
