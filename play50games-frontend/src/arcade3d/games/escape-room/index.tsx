"use client";

// Tiny Escape Room: the GameDefinition GameShell runs. Time game. The shell owns the clock,
// the result and the submit. Found is the only shell stat. Status stays "soon".
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, type EscapeLevel } from "./levels";
import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Checklist from "./Hud";
import { ASSETS } from "./assets";
import { DURATION_MS } from "./rules";
import { COLORS, FOG } from "./looks";

const definition: GameDefinition<EscapeLevel> = {
   slug: "escape-room",
   levels: LEVEL_IDS.map((id) => ({
      id, config: LEVELS[id], durationMs: LEVELS[id].durationMs,
      description: id === 1 ? "Find three items and escape the original office." : `${LEVELS[id].containers} containers, ${LEVELS[id].items} items. Inspect every container.${id >= 3 ? " Collect in the displayed clue order." : ""}${id === 5 ? " Return to the first drawer to restore exit power." : ""}`,
      hudStats: [{ key: "found", label: "Found", max: LEVELS[id].items }],
      ...(id === 1 ? {} : {
         instructions: ["Inspect every container, collect the items, then open the exit.", "Use WASD/arrows or the joystick; E or tap the nearby marker to inspect.", id >= 3 ? "Follow the clue order in the checklist." : "The chairs block the centre: walk around them.", ...(id === 5 ? ["After collecting everything, inspect the first drawer again to restore exit power."] : [])],
      }),
      ...(id === 4 ? { environment: { lighting: "night" as const, background: "#172033" } } : {}),
      ...(id === 5 ? { environment: { lighting: "space" as const, background: "#101827" } } : {}),
      ...(id === 3 ? { environment: { lighting: "sunset" as const } } : {}),
   })),
   Scene,
   Hud: Checklist,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // Preserve the live L1 frame-end duration. New levels submit the exact action finish ms.
   finalScore: (state) => ({
      score: state.score,
      durationMs: state.endReason === "win" && (state.stats.finishMs ?? 0) > 0
         ? state.stats.finishMs : state.elapsedMs,
   }),
   // first frame only: Scene's CameraRig fits the room at yaw 30°, clear of the HUD,
   // the checklist, the joystick and the cookie banner
   camera: { position: [4, 14, 12], fov: 45, lookAt: [0, 0.5, 0] },
   environment: { background: COLORS.bg, fog: [COLORS.fog, FOG.near, FOG.far], lighting: "indoor" },
   touchControls: ["joystick", "tap"],
   hudStats: [{ key: "found", label: "Found", max: 3 }],
   instructions: [
      "Open containers, take all three items, then open the door.",
      "Walk with WASD or arrows. Click a yellow marker, or press E, when you are close.",
      "Faster escapes rank higher. You have 10 minutes.",
   ],
};

export default definition;
