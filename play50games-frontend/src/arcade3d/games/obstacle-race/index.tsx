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

const LEVEL_DESCRIPTIONS: Record<LevelId, string> = {
   1: "The classic course: five platforms, five blocks, one beam.",
   2: "A longer course: six platforms and six blocks.",
   3: "Seven blocks and a faster bar, blocks and beam.",
   4: "Night run: seven platforms, faster hazards, narrower pads.",
   5: "Championship: eight blocks at full speed on narrow pads.",
};

const definition: GameDefinition<ObstacleLevel> = {
   slug: "obstacle-race",
   Scene,
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
   // override: rules.ts owns the 300 s cap for every level.
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: LEVEL_DESCRIPTIONS[id],
      config: LEVELS[id],
      ...(id === 4 ? { environment: { lighting: "night", background: "#0f172a", fog: ["#0f172a", 40, 100] as [string, number, number] } } : {}),
      ...(id === 5 ? { environment: { lighting: "sunset", background: "#431f30", fog: ["#431f30", 40, 100] as [string, number, number] } } : {}),
   })),
};

export default definition;
