"use client";

// Alien Lane Escape (Menu 2, game 17): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own timer, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type AlienLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Alien Meadow: a scan with a big crystal right in your lane (stay put), one with the cover in the next lane, then two quick scans in a row.",
   2: "Crystal Route: hovering pods drift across the lanes as a scan starts, and their shadow moves with them.",
   3: "Meteor Zone: meteors land ahead on their rings and leave craters that become new shadows. Read where cover will be.",
   4: "Glow Plants: a brushed plant lights up and washes the shadows near it out for 3 s, and a drone sweeps lateral lines across the lanes.",
   5: "Planet Escape: the Mothership. Lure its abduction beams onto the decoy pods, jump into its glowing underside, then race it to the launch pad.",
};

const definition: GameDefinition<AlienLevel> = {
   slug: "alien-lane-escape",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4, 8], fov: FOV, lookAt: [0, 1.2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action", "swipe"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "You run on your own down three alien lanes with a mothership behind you. Break its line of sight.",
      "A scan line sweeps forward over the track (the bar at the top and the violet glow warn you 1.5 s ahead). Be in a cover's dark shadow strip when it passes: UNSEEN.",
      "Crystals, rocks, drifting pods and fresh meteor craters cast shadows; under a low cover (SLIDE sign) hold Down / S (or pull the stick down) to slide into it. Caught, the tractor beam lifts you away for a moment.",
      "← / → (A / D, a swipe, or a flick of the stick) change lane; Space / Up / Jump jumps rocks; slide under the glowing energy bars. Goo slows you down; a brushed glow plant washes the shadows near it out.",
      "E / Enter is your power: Riko's dash outruns the scan (and takes the orbs in open ground), Nami's second jump reaches the high mesa, Kiro's bubble hides him (and crosses goo), Zuno's magnet pulls orbs out of the goo, Vexa phases inside any crystal and through the ghost-crystal walls.",
      "Turn the camera: right-drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<AlienLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
      }),
   ),
};

export default definition;
