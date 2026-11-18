"use client";

// Gem Collector 3D (Menu 2, game 23, World 4 Frost & Sweets): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A points game: each level's round has its own clock (LevelSpec durationMs, plus a
// second the rules never reach: rules.ts ends the round on the dot and the Scene ends the run "win"
// when the level is cleared, else "timeup"); level 5 ends on the Glutton's defeat.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type ArenaSpec } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Vault Floor: roll over gems, bank the train at a beacon, and learn why a long train is worth its length squared.",
   2: "Shifting Tiles: the floor's slabs sink in turn. Keep your train's loops off the pits.",
   3: "Slime Pen: ice slimes nibble your tail. Loop round a chewing one and it freezes to gold.",
   4: "Chest Rush: at night, bump chests open for six gems each, and catch the beacon as it moves.",
   5: "Gumdrop Glutton: he eats your tail. Lasso him and bank while he is stunned, catch his minis, bank into his yawn.",
};

const definition: GameDefinition<ArenaSpec> = {
   slug: "gem-collector-3d",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 9, -18], fov: FOV, lookAt: [0, 0, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   durationMs: LEVELS[1].durationMs + 1000,
   instructions: [
      "Roll over gems: each one joins the glowing train that follows your exact path (20 links at most).",
      "Drive into a score beacon to bank the train: n links score n x n (gold counts 2), up to 400.",
      "Cross your own tail and it snaps there: the cut gems fall loose for 3 seconds.",
      "Bring your head back beside your tail without crossing it and the loop lassoes what is inside: a slime, the Glutton.",
      "Power (E, Enter, or the Power button): Riko's dash breaks the crystal wall and snaps the train straight, Nyla jumps again (the pedestal's gold), Kiro's shield guards the tail, Zuno's magnet reaches further and pulls the rim's hidden gems, Vexa's phase lets the train cross itself and opens the ghost wall.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Up on the stick rolls away from the camera.",
   ],
   resultDelayMs: 1500,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<ArenaSpec> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
      durationMs: LEVELS[id].durationMs + 1000,
   })),
};

export default definition;
