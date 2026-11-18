"use client";

// Robot Factory Run (Menu 2, game 13, World 1 Ember Heights): the GameDefinition GameShell runs
// (loaded lazily by loaders.ts). A time game: no durationMs (rules.ts ends the shift at its cap,
// "timeup", unranked); a win submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type FactoryLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Assembly Start: ride a belt, step on a red plate to turn a junction, send 2 cells past the press into the charger, then out.",
   2: "Conveyor Hall: the amber klaxon belts run backwards every 6 s. Time the short way, or wire the long way round. 3 cells.",
   3: "Robot Arms: arms lift what waits on their pad two belts over: cells, or you onto the catwalk. 3 cells.",
   4: "Laser Line: every plate also swaps the laser gates on the exit. Plan the order. 3 cells.",
   5: "Factory Overdrive: Overseer M-8. Route cells into its chest, drag it into the press, roll-drop into its vents.",
};

const definition: GameDefinition<FactoryLevel> = {
   slug: "robot-factory-run",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 12, 16], fov: FOV, lookAt: [0, 0, 2] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Power cells ride the conveyor belts. Route them into the orange charger, then reach the exit.",
      "Step on a red switch plate: the junction wired to it turns a quarter turn (its arrow shows where it sends cells). Step off and on again for another turn.",
      "Belts carry you too. Space jumps; Space again in the air roll-drops. Presses, tread bots and M-8 knock you back.",
      "A cell that runs off a belt end or under a press is scrap: the dispenser lets out another on its beat.",
      "Power (E, Enter, or the Power button): Riko dashes (flicks a cell one belt over, smashes cracked crates), Nami jumps again, Kiro shields through lasers, Zuno's magnet pulls cells and orbs, Vexa phases through ghost crates.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<FactoryLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
