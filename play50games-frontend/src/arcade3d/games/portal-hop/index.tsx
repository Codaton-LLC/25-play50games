"use client";

// Rift Hop (Menu 2, game 24, World 5 Neon Cosmos): the GameDefinition GameShell runs (loaded lazily
// by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true).
// A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type PortalLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Two Rifts: walk into a frame and pop out on the next island; choose the anchor that leads to the orb; then fall off a cliff into a floor rift and fling out across a big gap. Target 45 s.",
   2: "Two Pairs: two pairs, one under the other. Fall into the first and come out high over the second: the speed stacks into one long fling. Every pair has a false lead.",
   3: "Moving Rifts: the exits ride round their tower at 20 degrees a second. Choose when you drop in as well as where: the ghost arc shows where you will land.",
   4: "Cargo: push void crystals through the frames. Land one on the pressure plate to raise the bridge, and one at the foot of the ledge to climb it.",
   5: "Rift Master: the Rift Serpent swims through your rifts. Open its exit at a beacon spike, fling yourself onto its back, then tie it in a knot with both pairs.",
};

const definition: GameDefinition<PortalLevel> = {
   slug: "portal-hop",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [4, 6, 14], fov: FOV, lookAt: [0, 1, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Move with WASD, the arrows or the joystick (camera-relative); Space jumps. Run into a purple frame, or fall into a floor rift, and you come out of its cyan exit.",
      "Each rift's exit opens at one of its anchor obelisks. Click or tap an obelisk, press 1-4, or the Exit button, to move it there (0.4 s). Near a rift a ghost arc shows where the exit flings you.",
      "Speed in = speed out: fall 10 m into a floor rift and a pitched exit flings you 20 m. Five orbs a level, each 0.1 s off your time.",
      "Power (E, Enter or the Power button): Riko dashes (+4 m/s into a rift, smashes cracked crystals), Kiro shields, Zuno's magnet pulls orbs, Vexa phases through a frame without teleporting; Nyla jumps again in the air.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Left alone, it swings back in behind you.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<PortalLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
