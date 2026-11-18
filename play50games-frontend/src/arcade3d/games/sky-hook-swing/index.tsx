"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type SwingLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Single Swing: one ring over a net, reel in to clear the wall, then three rings to the landing pad.",
   2: "Double Swing: chain peak releases from rest island to rest island. Only a green-flash release connects.",
   3: "Moving Anchors: a swaying airship, then a windmill blade, then the pad.",
   4: "Long Gaps: a crosswind, and cracked rings that snap the rope after three seconds.",
   5: "Sky Swing Master: knock the Gust Galleon's turrets off, swing a drone into the mast, then climb the falling rings and ring the Tide Bell.",
};

const definition: GameDefinition<SwingLevel> = {
   slug: "sky-hook-swing",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [-12, 6, 8], fov: FOV, lookAt: [0, 3, 0] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Hook" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Aim the stick at a grapple ring (the glowing one is the one Hook takes) and press Hook. Up on the stick reels in, down reels out. Hook again to release.",
      "Release while the ring flashes green for a faster fling. Chain four releases without touching down to fill the flow meter.",
      "A safety net catches the first gap. Landing off a checkpoint breaks the sky chain.",
      "Power: Riko dashes and smashes crates, Nami jumps again after a release, Kiro shields sparks and smoke, Zuno pulls orbs from under the arc, Vexa phases through ghost panels.",
      "Turn the camera with a drag (two fingers on a phone), Q and C, or the on-screen control. Screen-up walks along the docks.",
   ],
   resultDelayMs: 1100,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<SwingLevel> => {
      return {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
      };
   }),
};

export default definition;
