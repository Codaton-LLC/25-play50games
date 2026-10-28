"use client";

// Treasure Island: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The
// shell owns the screens, the HUD, the 90 s timer, pause and the score submit; the game owns
// Scene.tsx (the frame loop and what moves), rules.ts (the logic) and assets.ts (the models).
// Levels: one LevelSpec per meta.ts level, built from levels.ts (core/README.md "Levels").
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { LEVELS, type IslandLevel } from "./levels";
import { FOV } from "./looks";
import { DURATION_MS, TREASURE_COUNT } from "./rules";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Five treasures, 90 seconds. The tide turns at 70 s.",
   2: "Five treasures. The tide turns at 60 s and is in by 80 s.",
   3: "Six treasures. The tide turns at 55 s.",
   4: "Six treasures. The tide turns at 50 s.",
   5: "Six treasures on a wider island, closer together. The tide turns at 45 s.",
};

/** Start-card lines for levels 2–5. Level 1 keeps the definition's own lines. */
function instructionsFor(level: IslandLevel): string[] {
   return [
      "Walk until the detector ring turns gold and pulses fast.",
      `Hold Dig (E, Enter or Space) to dig: find all ${level.treasures} treasures before the tide.`,
      "+200 a treasure, +50 with no wrong dig before it, +10 per second left.",
   ];
}

const definition: GameDefinition<IslandLevel> = {
   slug: "treasure-island",
   Scene,
   Hud: CameraViewButton,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // only the first frame uses this: Scene's CameraRig (core useFittedView, looks.ts viewFor) fits a
   // window around the explorer clear of the HUD, the joystick and the cookie banner, and follows it
   camera: { position: [0, 14, 20], fov: FOV, lookAt: [0, 0, 9] },
   environment: { background: "#fdba74", fog: ["#fdba74", 40, 95], lighting: "sunset" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Dig" },
   hudStats: [{ key: "treasures", label: "Treasures", max: TREASURE_COUNT }],
   // the last reveal (often the chest), the confetti and the cheer are seen before the result
   resultDelayMs: 1600,
   instructions: [
      "Walk until the detector ring turns gold and pulses fast.",
      "Hold Dig (E, Enter or Space) to dig: find all 5 treasures before the tide.",
      "+200 a treasure, +50 with no wrong dig before it, +10 per second left.",
   ],
   levels: LEVEL_IDS.map((id): LevelSpec<IslandLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      const spec: LevelSpec<IslandLevel> = {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
      };
      if (level.treasures !== TREASURE_COUNT) {
         spec.hudStats = [{ key: "treasures", label: "Treasures", max: level.treasures }];
      }
      return spec;
   }),
};

export default definition;
