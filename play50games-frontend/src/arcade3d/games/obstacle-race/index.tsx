"use client";

// Obstacle Race: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts).
// The shell owns the screens, the HUD (Score, Played, Checkpoint), pause and the score submit. The
// game owns Scene.tsx (frame loop + drawing), rules.ts (the outcome, the 300 s cap and the proof),
// camera.ts (the follow-camera fit), Primitives.tsx (the look) and assets.ts (models).
// No durationMs: the shell shows "Played" counting up, and rules.ts ends the run at 300000 ms
// ("timeup", unranked). A win submits the exact finish ms (finalScore), never the frame's end.
import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { LEVELS } from "./levels";
import { STAT, finalScore, type ObstacleLevel } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";

const LEVEL_DESCRIPTIONS: Record<LevelId, string> = {
   1: "The classic course: five platforms, five blocks, one beam.",
   2: "A container-yard build: six blocks, and beacons that telegraph every slide.",
   3: "A harbor crossing: rope bridges overhead, pilings alongside, faster hazards.",
   4: "Night arena: floodlights sweep with the bar on faster, narrower hazards.",
   5: "The sunset final: bunting, crowds and the fastest blocks on narrow pads.",
};

const definition: GameDefinition<ObstacleLevel> = {
   slug: "obstacle-race",
   Scene,
   Hud,
   assets: ASSETS,
   // README "Physics" cut line: the decorative Rapier debris made "ready" more than 0.5 s later on
   // a 4x CPU throttle, so it ships without the layer (no Rapier chunk at all). Rules never used it.
   physics: false,
   // first frame only: Scene's CameraRig (core useFittedView, camera.ts) takes over on mount
   camera: { position: [0, 6.8, 8.1], fov: 50, lookAt: [0, 0, 0] },
   environment: { background: "#bae6fd", fog: ["#bae6fd", 45, 110], lighting: "day" },
   touchControls: ["joystick", "jump"],
   hudStats: [{ key: STAT.checkpoint, label: "Checkpoint", max: 3 }],
   // three lines of two rows each on a phone (the controls box already lists the keys), so Play
   // clears the cookie banner at 375 x 812 as in the other games
   instructions: [
      "Race to the finish arch. Your finish time is your score.",
      "Jump the bar, hop the platforms, ride the blocks, cross the beam.",
      "A fall sends you back to the last checkpoint. The clock runs on.",
   ],
   // the runner cheers under the arch before the result panel
   resultDelayMs: 1200,
   finalScore,
   // five levels (docs/arcade-levels.md; README "Levels"): level 1 is today's course; the levels
   // flag off makes the core hand level 1's config, so the game is unchanged. No durationMs
   // override: rules.ts owns the 300 s cap for every level. Each level's theme (themes.ts) —
   // palette, decor set pieces and environment — matches its name; the course geometry, the
   // obstacle timeline and the scoring are level 1's shape at every level (levels.test.ts).
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: LEVEL_DESCRIPTIONS[id],
      config: LEVELS[id],
      ...(id === 2 ? { environment: { lighting: "day", background: "#a9d0ea", fog: ["#a9d0ea", 42, 106] as [string, number, number] } } : {}),
      ...(id === 3 ? { environment: { lighting: "sunset", background: "#e9a45f", fog: ["#dd8f4e", 36, 96] as [string, number, number] } } : {}),
      ...(id === 4 ? { environment: { lighting: "night", background: "#0f172a", fog: ["#0f172a", 40, 100] as [string, number, number] } } : {}),
      ...(id === 5 ? { environment: { lighting: "sunset", background: "#431f30", fog: ["#431f30", 40, 100] as [string, number, number] } } : {}),
   })),
};

export default definition;
