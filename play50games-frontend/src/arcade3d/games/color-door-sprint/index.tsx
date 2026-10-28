"use client";

// Color Door Sprint (Menu 2, game 46): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win submits
// the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type DoorLevel } from "./levels";
import { COLORS, LOOKS, levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Two Doors: steer through the open door, match the lamp's colour, then read the lamp alone. 8 walls.",
   2: "Three Doors: three lanes and a chime per colour. Halfway the lamp dims: listen. 10 walls.",
   3: "Fake Door: sliding doors, cracked fake doors and the NOT rule. 12 walls.",
   4: "Fast Gates: the echo lamp shows the wall after next. Up to five lanes at 16 m/s. 14 walls.",
   5: "Door Sprint Master: Flicker, the Fire Spirit, slams the doors. Charge the red rush and ram him.",
};

const definition: GameDefinition<DoorLevel> = {
   slug: "color-door-sprint",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.5, -6] },
   environment: { background: COLORS.background, fog: [LOOKS[1].fog, LOOKS[1].fogNear, LOOKS[1].fogFar], lighting: "sunset" },
   touchControls: ["swipe", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Run the Hall of Doors. A rule lamp hangs before every wall: take the one true door.",
      "Change lanes with A / D or the arrows (swipe on touch). Doors lock 0.6 s before you reach them.",
      "Match the lamp's colour (each colour has its own shape and chime). A crossed-out lamp means NOT that colour; a dim lamp: listen to the chime; a ringed lamp shows the wall after next.",
      "The true door surges you on. A wrong door bounces you back 1.5 s. Jump (Space / up) the floor bars, roll (S / down) under the low beams. Each orb takes 0.15 s off your time.",
      "Power (E, Enter, or the Power button): Riko's dash smashes cracked fake doors, Nami double jumps to the upper doors, Kiro's shield absorbs a wrong door, Zuno's magnet pulls hidden orbs, Vexa phases through ghost doors.",
      "Turn the camera: drag the view (two fingers on touch), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1600,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<DoorLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
