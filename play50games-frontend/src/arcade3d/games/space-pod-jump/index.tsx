"use client";

// Space Pod Jump (Menu 2, game 10): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win submits
// the finish ms (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type PodLevel } from "./levels";
import { COLORS, LOOKS, levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Dock: walk round a planetoid, hop into the next one's pull, then launch your first pod for the dock.",
   2: "Pod Line: a chain of six cradles. Aim the launch, brake with the jets, settle in.",
   3: "Satellite Field: moving moons to slingshot off, gates that open at 8 m/s, debris in orbit.",
   4: "Zero-G Gap: no body at all, only drift. Push off the floating crates; fuel is precious.",
   5: "Orbital Peak: the Orbit Warden rewrites your orbits. Hit its vents, its thruster, then hit it fast.",
};

const definition: GameDefinition<PodLevel> = {
   slug: "space-pod-jump",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 17], fov: FOV, lookAt: [0, 4, 0] },
   environment: { background: COLORS.background, fog: [LOOKS[1].fog, LOOKS[1].fogNear, LOOKS[1].fogFar], lighting: LOOKS[1].lighting },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Down is wherever the nearest body is: walk round a planetoid with A / D or the arrows (the joystick on touch).",
      "Space jumps (it always comes back down). On a pod cradle hold Space to charge (5 to 9 m/s), aim with A / D, let go to launch.",
      "In flight only the nearest body pulls: watch the dots, they turn green when you will land. Hold Space for the retro jets (1.2 s of fuel, refilled on landing).",
      "Reach the dock's capture ring to finish: your time is the score. Grab every orb for the second star; slingshot gates open at 8 m/s.",
      "Power (E, Enter or the Power button): Riko burns prograde, Nami gives a second impulse, Kiro's shield crosses flares and debris, Zuno's magnet pulls orbs, Vexa phases through a planetoid to its far side.",
      "Turn the camera: drag the view (two fingers on touch), wheel / pinch zooms. The view rolls with the local down; 'Up: fixed' stops it.",
   ],
   resultDelayMs: 1600,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<PodLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
