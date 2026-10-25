"use client";

// Office Escape: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts).
// The shell owns the screens, the HUD (Score, Played, Coins), pause and the score submit. The game
// owns Scene.tsx (frame loop + drawing), rules.ts (the outcome), camera.ts (the chase camera fit),
// Hud.tsx (the speed-up notice) and assets.ts (models). Untimed: no durationMs, no lives. A run ends
// by the rules: a hit ("lose") or the 29:55 run limit ("win").
import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS, type OfficeLevel } from "./levels";
import { LEVEL_LOOKS } from "./looks";
import { ASSETS } from "./assets";
import OfficeHud from "./Hud";
import Scene from "./Scene";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "The original office run. Reach 760 points (about 60-75 seconds) to clear.",
   2: "Paired static obstacles, faster pace and 55-point coin lines. Target 1,000.",
   3: "Moving chairs and carts plus full-width printer lines. Target 1,330.",
   4: "Night shift: three obstacles per row, faster carts and shorter recovery. Target 1,575.",
   5: "After-hours high-score run: all patterns, rapid carts and 70-point coins. Target 1,870.",
};

const definition: GameDefinition<OfficeLevel> = {
   slug: "office-escape",
   Scene,
   Hud: OfficeHud,
   assets: ASSETS,
   // first frame only: Scene's CameraRig refits on mount (camera.ts fitChase)
   camera: { position: [0, 4.3, 7], fov: 50, lookAt: [0, 0, -8] },
   environment: { background: "#dbeafe", fog: ["#dbeafe", 40, 75], lighting: "indoor" },
   levels: LEVEL_IDS.map((id) => ({
      id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: LEVEL_LOOKS[id],
      hudStats: [{ key: "coins", label: "Coins" }],
      ...(id > 1 ? { instructions: [
         DESCRIPTIONS[id],
         "Left / Right or swipe to dodge. Space / swipe up jumps desks, printers and boxes.",
         "Chairs and carts move within their lane. One hit ends the run.",
         `1 point per metre, +${LEVELS[id].coinPoints} per coin. Keep running after the target for a higher score.`,
      ] } : {}),
   })),
   touchControls: ["swipe"],
   hudStats: [{ key: "coins", label: "Coins" }],
   // the scene stays up this long after a hit before the result panel: the runner's fall onto its
   // back (crash.ts CRASH.fallS, 0.45 s) and one bounce (another ~0.45 s) play out in full
   resultDelayMs: 900,
   instructions: [
      "Run as far as you can. Swipe or press Left / Right to change lanes.",
      "Swipe up or press Space to jump desks, printers and boxes.",
      "Dodge chairs, coffee carts and water coolers. One hit ends the run.",
      "1 point per metre, +50 per coin. It gets faster every 20 s.",
   ],
};

export default definition;
