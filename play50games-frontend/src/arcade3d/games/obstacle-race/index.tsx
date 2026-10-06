"use client";

// Obstacle Race: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts).
// The shell owns the screens, the HUD (Score, Played, Checkpoint), pause and the score submit. The
// game owns Scene.tsx (frame loop + drawing), rules.ts (the outcome, the 300 s cap and the proof),
// camera.ts (the follow-camera fit), Primitives.tsx (the look) and assets.ts (models).
// No durationMs: the shell shows "Played" counting up, and rules.ts ends the run at 300000 ms
// ("timeup", unranked). A win submits the exact finish ms (finalScore), never the frame's end.
import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { STAT, finalScore } from "./rules";
import Scene from "./Scene";

const definition: GameDefinition = {
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
};

export default definition;
