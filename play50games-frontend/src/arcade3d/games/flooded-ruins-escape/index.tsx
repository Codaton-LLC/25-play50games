"use client";

// Flooded Ruins Escape (Menu 2, game 03): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type RuinLevel } from "./levels";
import { COLORS, levelEnvironment } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Drain Entry: flood a trench to float up, drain the next to walk under its door, then race the storm tide up three switchbacks.",
   2: "Pipe Maze: linked chambers. Lowering one channel raises the next, so pick your order. Every lever pulls back.",
   3: "Valve Shaft: the spiral round the flooded shaft. The water decides which ledges are dry, and bats swoop when it is low.",
   4: "Flood Rise: a fast tide. Swim the long underwater shortcut between air bubbles, or take the safe dry climb.",
   5: "Final Escape: beat Umbra Roller in three phases, then ring the Tide Bell at the top.",
};

const definition: GameDefinition<RuinLevel> = {
   slug: "flooded-ruins-escape",
   Scene,
   Hud,
   // the Menu 2 star screen on the result card (menu2/stars)
   ResultExtra: StarResult,
   assets: ASSETS,
   // the first frame only: the orbit camera (or the intro) takes over on mount
   camera: { position: [0, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Escape the drowned temple: decide where the water goes. Stone levers raise or lower each chamber's water.",
      "Flood a room to float up to high ledges; drain it to walk through low doors. Floating crates rise with the water.",
      "In the water you swim: hold Jump to swim up, let go to sink, press Jump at the surface to leap out. Bubble spouts refill your air.",
      "The storm tide rises from below and cannot be stopped. Each orb takes 0.3 s off your time; chain orbs, ledges and levers for the flow bonus.",
      "Power (E, Enter, or the Power button): Riko dashes through cracked brick, Nami breaches 4 m out of the water, Kiro's shield blocks steam and whirlpools, Zuno's magnet pulls buried orbs, Vexa phases through ghost doors.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   // the hero hops and spins at the gate before the result panel
   resultDelayMs: 1600,
   finalScore,
   // local multiplayer (menu2/multiplayer): a run with 2-4 players is never submitted to the solo board
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<RuinLevel> => {
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
