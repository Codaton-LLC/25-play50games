"use client";

// Lava Pillar Jump (Menu 2, game 04): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the ember bonus (finalScore). A lava swallow ends "lose", unranked.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type LavaLevel } from "./levels";
import { COLORS, levelEnvironment } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Warm Cavern: feel a pillar heat under you, outclimb the first surge, ride a vent on the beat to the exit ledge. 90 seconds.",
   2: "Pillar Field: basalt bridges slide on the heartbeat, surges every 5 s, two vent climbs. 120 seconds.",
   3: "Falling Rocks: every surge shakes rocks loose, glassy and sinking shelves, a vent that fires on every third beat. 150 seconds.",
   4: "Fast Lava: magma slugs heat their tops twice as fast, surges every 4 s, narrower pillars. 180 seconds.",
   5: "Volcano Core: down to the core and Kalder the Magma Golem: ride his slams onto his shoulders, jump on his back, dive into his heart. 240 seconds.",
};

const definition: GameDefinition<LavaLevel> = {
   slug: "lava-pillar-jump",
   Scene,
   Hud,
   // the Menu 2 star screen on the result card (menu2/stars)
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "sunset" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Out-climb the lava. It surges on the volcano's heartbeat: the walls pulse red a second before.",
      "A top heats while you stand on it: orange, white, then it crumbles. Keep moving.",
      "Geyser vents fire on the beat and throw you twice as high as a jump. Stand on one and wait for it.",
      "Each ember takes 0.4 s off your time. Chain embers and new pillars for a little more. A fall sends you back to the last crystal.",
      "Power (E, Enter, or the Power button) is your hero's ability. The same timing on touch and keyboard.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1600,
   finalScore,
   // local multiplayer (menu2/multiplayer): a run with 2-4 players is never submitted to the solo board
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<LavaLevel> => {
      const night = levelEnvironment(id);
      return {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         ...(night ? { environment: night } : {}),
      };
   }),
};

export default definition;
