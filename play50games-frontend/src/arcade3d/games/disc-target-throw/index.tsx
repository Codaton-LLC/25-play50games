"use client";

// Disc Target Throw (Menu 2, game 40, World 3 Wild Temples): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true, core/intro). A points game: no durationMs (rules.ts ends the run at its own clock cap,
// "timeup"); the store's score is the rules' run.score and the duration the run time (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type DiscLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Static Targets: ten hay targets. Throw straight, hook one round a pillar, bank one off the wall behind the palisade. Target 60 s.",
   2: "Moving Targets: four targets slide on ruin rails at 1.5-3 m/s. Lead the throw.",
   3: "Color Targets: green, gold and jade idols pay double in order; all three in one throw is a Triple Glyph.",
   4: "Fast Combo: throw from a drifting raft and walk back onto the ring for the catch, while monkeys snatch at the returning disc.",
   5: "Accuracy Master: Mother Snapper. Throw into her open mouth, bank into her seed pods, then two banks into her plated crown.",
};

const definition: GameDefinition<DiscLevel> = {
   slug: "disc-target-throw",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 3.5, 10], fov: FOV, lookAt: [0, 2, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Throw", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Hold Throw (Space / the Throw button) to aim where the camera looks, push sideways to hook up to 35 degrees, and let go.",
      "Stone walls and columns bank the disc: one bank doubles a hit, two triple it. Wood stops it. One throw can break three targets.",
      "The disc swings back to where you threw it: stand on the gold ring for a clean catch (the combo). A miss drops it for 1.5 s.",
      "Power (E, Enter or the Power button): Riko dashes for a far catch, Nami lobs over the palisade, Kiro shields the thorn zone, Zuno's magnet pulls the disc in, Vexa's disc phases the ghost walls.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<DiscLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
         ...(id === 5 ? { resultDelayMs: 2600 } : {}),
      }),
   ),
};

export default definition;
