"use client";

// Temple Lantern Jump (Menu 2, game 6, World 3 Wild Temples): the GameDefinition GameShell runs
// (loaded lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the
// intro (intro: true). A time game: no durationMs (rules.ts ends the run at the level's time cap,
// "timeup", unranked); a win submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type TempleLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Temple Gate: a 12 m shaft, nine lanterns. Bounce the first one, watch the gold ledges appear in its light, then cross the long dark stretch while the ember dims. Target 70 s.",
   2: "Lantern Hall: the lanterns hang on chains and swing 2 m, so the light pool and the solid ledges sweep. A fire jet blocks the fast centre column. 20 m.",
   3: "Balcony Climb: gusts of wind blow lanterns out early (the leaves warn you a second ahead) and the wooden balconies crumble under your feet. 28 m.",
   4: "Night Temple: soot bats snuff the lit lanterns they touch; bounce one to stun it. The ember lasts only 6 s. 36 m.",
   5: "Golden Roof: the Soot Bat Queen fans darkness down the shaft. Relight three lanterns to scorch her wings, bounce into her dive, then throw the ember into the roof brazier.",
};

const definition: GameDefinition<TempleLevel> = {
   slug: "temple-lantern-jump",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [7, 6, 8], fov: FOV, lookAt: [0, 2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Ember" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Climb the dark shaft. Land on a stone cage lantern to bounce 1.4x as high, refill your 8-second ember and light it for 12 seconds.",
      "Gold glyph ledges hold you only in light: your ember (6 m wide, shrinking as it burns), a lit lantern or a flare. In the dark they fade and drop you. Plain stone is always solid.",
      "Ember (E, Enter or the Ember button) in the air throws light down at a lantern for 3 seconds of ember; on the ground it fires your hero power: Riko dashes, Kiro shields the fire jets, Zuno's magnet pulls sparks and orbs, Vexa phases through the ghost wall; Nami double jumps on Jump.",
      "Five green orbs a level (two in the dark side galleries), each 0.1 s off your time. A brazier in a gallery lights the whole shaft for 20 s.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<TempleLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
