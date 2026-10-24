"use client";

import type { GameDefinition } from "../../core/types";
import { ASSETS } from "./assets";
import { BEAT } from "./rules";
import { CAMERA_CONFIG, KnightArenaHud, KnightArenaScene } from "./Scene";

const knightArena: GameDefinition = {
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
   instructions: [
      "Strike training dummies on the beat using Arrow keys, WASD, D-pad, or swipes.",
      "Watch the shrinking approach ring and overhead directional arrow (Up / Down / Left / Right).",
      "Shield dummies take 2 consecutive beat hits; ignore red tomato decoys (-50 pts).",
      "At 100% Spin meter, press Space / E / Spin to sweep all active real targets (+50 bonus).",
   ],
};

export default knightArena;
