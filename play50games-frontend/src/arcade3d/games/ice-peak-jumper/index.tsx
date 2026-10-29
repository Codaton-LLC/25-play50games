"use client";

// Ice Peak Jumper (Menu 2, game 9): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own timer, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type PeakLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Base Camp: slide across a flat ice sheet and stop on snow, launch over a 3 m gap (the run-up is the aim), then leave a cracked platform before it shatters.",
   2: "Icicle Steps: tiered ledges zig-zag up the face, so plan your slide; icicles shake for 0.8 s, then drop.",
   3: "Yeti Ridge: a yeti on the high ledge throws a snowball every 3 s where you stand; ride a rolling snowball to its ledge.",
   4: "Lantern Night: snow grips only while its lantern is lit (4 s of every 6 s), so time your arrivals; ice slimes patrol the patches.",
   5: "Summit Cairn: the Frost Golem. Slide up his slam slopes onto his back, climb the boulders he throws to his shoulder, then out-climb him up the crumbling cairn to his head crystal.",
};

const definition: GameDefinition<PeakLevel> = {
   slug: "ice-peak-jumper",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4.5, 9], fov: FOV, lookAt: [0, 1.4, 0] },
   environment: levelEnvironment(1, false),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Climb the frozen peak to the summit cairn. Ice has no grip: you slide, and the slide's speed sets how far a jump carries you (2.5 m standing, 7 m at full speed).",
      "On ice the stick (WASD / arrows) builds your slide up to 9 m/s and nothing slows you; pull back (S / Down, or the stick down) to brake.",
      "Snow patches grip: walk, stop, turn and re-aim there. Each one is a checkpoint: a fall drops you back on the last one. Cracked ice shatters 1.2 s after you touch it.",
      "Levels 1-2 show a dotted arc where a jump would land. A landing on a platform's centre is perfect: it feeds the flow meter.",
      "E / Enter is your power: Riko dashes (+4 m/s on ice: the far ledges, and it smashes ice cubes), Nami jumps again in the air and re-aims, Kiro's shield crosses the icicle chute, Zuno's magnet pulls the coins frozen in the ice walls, Vexa phases through ghost ice.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<PeakLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id, LEVELS[id].night),
      }),
   ),
};

export default definition;
