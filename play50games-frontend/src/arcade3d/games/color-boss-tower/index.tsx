"use client";

// Color Boss Tower (Menu 2, game 30, World 6 Prism Spire): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's timer, "timeup",
// unranked, or "lose" when the hearts run out); a win submits the finish ms minus the orb and flow
// bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type TowerSpec } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Training Guardian: charge a red claw as Riko and the cannon fires as his plate opens; jump his slow sweep; tag Nami for the high blue claw.",
   2: "Two Colors: two claw colours, and hazard orbs roll down the spiral. Jump them or shield.",
   3: "Three Colors: the ledges crumble under you, and a yellow claw sits high on the wall for Zuno's magnet.",
   4: "Fast Switch Boss: his second phase needs a chain charge, two claws within 4 seconds. Tag fast.",
   5: "Grand Color Guardian: only the lit colour fires, then a chain before his beam drains the cores, then the tag finish: be each hero as its glyph lights.",
};

const definition: GameDefinition<TowerSpec> = {
   slug: "color-boss-tower",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 5, 2], fov: FOV, lookAt: [0, 2, 10] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Run round the tower's spiral of ledges and jump each gap. You never hit the guardian yourself: the tower is your weapon.",
      "Touch a colour claw as the hero of that colour and its prism cannon charges. When his weak plate opens, every charged cannon fires: one hit.",
      "Tag a hero in with 1-5 (T for the next) or tap their portrait. Tag inside your flow window for a Hand-off.",
      "His arm sweeps round the ring at your height: watch the glowing line, then jump as it comes round. Jump the hazard orbs too.",
      "Power (E, Enter, or the Power button): Riko dashes, Nami jumps again (up the skip ledges to a high blue claw), Kiro shields, Zuno's magnet charges a yellow claw on the wall, Vexa phases through orbs and the ghost panel.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<TowerSpec> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
