"use client";

// Crystal Cave Switch (Menu 2, game 44, World 5 Neon Cosmos): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup",
// unranked); a win submits the finish ms less the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CaveLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Two Crystals: two rooms. Read the beacon by each gate and strike its crystals in that order. Target 75 s.",
   2: "Three Sequence: three rooms of three crystals; ride the moving slab out to the crystal island.",
   3: "Hidden Crystal: four rooms; some crystals hide on ledges and only glow when you come near.",
   4: "Timed Sequence: five rooms; once you strike the first crystal the lights fade on a timer, and decoys reset the room.",
   5: "Crystal Master: everything at once, then the Hollow Prism. Step out of its beam's lane and strike the colour codes it flashes.",
};

const definition: GameDefinition<CaveLevel> = {
   slug: "crystal-cave-switch",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 6, 9], fov: FOV, lookAt: [0, 1, -4] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Strike" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Each room's gate opens when you strike its crystals in the order its beacon shows. The order is also at the bottom of the screen.",
      "Strike a crystal by standing at it and pressing E, Enter or the Strike button. Colours have shapes: ruby triangle, sapphire square, emerald diamond, topaz circle.",
      "A wrong crystal or a decoy resets the room. In timed rooms, finish the sequence before the lights fade.",
      "Away from a crystal, the same button fires your hero: Riko dashes, Kiro shields the Prism's beam, Zuno's magnet strikes from 4 m, Vexa phases through ghost walls; Nyla double jumps.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<CaveLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
         ...(id === 5 ? { resultDelayMs: 2600 } : {}),
      }),
   ),
};

export default definition;
