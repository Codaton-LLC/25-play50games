"use client";

import type { GameDefinition, LevelSpec } from "../../core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { LEVELS, type KnightLevel } from "./levels";
import { BEAT } from "./rules";
import { CAMERA_CONFIG, KnightArenaHud, KnightArenaScene } from "./Scene";

const BASE_INSTRUCTIONS = [
   "Strike training dummies on the beat using Arrow keys, WASD, D-pad, or swipes.",
   "Watch the shrinking approach ring and overhead directional arrow (Up / Down / Left / Right).",
   "Shield dummies take 2 consecutive beat hits; ignore red tomato decoys (-50 pts).",
   "At 100% Spin meter, press Space / E / Spin to sweep all active real targets (+50 bonus).",
];

function instructionsFor(id: LevelId): string[] {
   if (id === 2) return [...BASE_INSTRUCTIONS, "Far targets slide in from the inner ring, starting in stage 1."];
   if (id === 3) return [...BASE_INSTRUCTIONS, "The on-beat window is tighter, and doubles start in stage 2."];
   if (id === 4) return [...BASE_INSTRUCTIONS, "Combo climbs faster. More shields and tomato decoys."];
   return [...BASE_INSTRUCTIONS, "The fastest tempo and the tightest on-beat window, with every target type."];
}

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Four stages in 60 seconds: shields, doubles and tomato decoys.",
   2: "Far targets slide in from the first stage, on a faster beat.",
   3: "A tighter on-beat window, and doubles from the second stage.",
   4: "Night: combo climbs faster, with more shields and decoys.",
   5: "The fastest beat and the tightest on-beat window.",
};

function environmentFor(id: LevelId): LevelSpec<KnightLevel>["environment"] {
   if (id === 2) return { background: "#d7ebf8", lighting: "day", fog: ["#c5e0f2", 18, 48] };
   if (id === 3) return { background: "#3a1424", lighting: "sunset", fog: ["#4a2030", 14, 36] };
   if (id === 4) return { background: "#0b1020", lighting: "night", fog: ["#0b1020", 12, 32] };
   if (id === 5) return { background: "#2a0a18", lighting: "sunset", fog: ["#3b1028", 12, 34] };
   return undefined;
}

const knightArena: GameDefinition<KnightLevel> = {
   slug: "knight-arena",
   Scene: KnightArenaScene,
   Hud: KnightArenaHud,
   assets: ASSETS,
   physics: false,
   durationMs: BEAT.DURATION_MS,
   camera: CAMERA_CONFIG,
   environment: {
      background: "#2a1830",
      lighting: "sunset",
      fog: ["#3b2038", 16, 42],
   },
   // strikes come from swipes (input.pressed); no joystick, which only covered the arena
   touchControls: ["action", "swipe"],
   touchLabels: {
      action: "Spin",
   },
   hudStats: [
      { key: "combo", label: "Combo" },
      { key: "spin", label: "Spin", max: 100 },
      { key: "bpm", label: "BPM" },
   ],
   instructions: BASE_INSTRUCTIONS,
   levels: LEVEL_IDS.map((id) => {
      const spec: LevelSpec<KnightLevel> = {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
      };
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.environment = environmentFor(id);
      }
      return spec;
   }),
};

export default knightArena;
