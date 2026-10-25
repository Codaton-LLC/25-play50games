"use client";

// Sky Tower Jump (Menu 2, game 01): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro);
// the game owns Scene.tsx, rules.ts (outcome, 90 s cap, proof), Hud.tsx and the look.
// A time game: no durationMs (rules.ts ends the run at its own cap, "timeup", unranked); a win
// submits the finish ms minus the orb bonus (finalScore), never the frame's end.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type SkyLevel } from "./levels";
import { COLORS } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Training Sky: wide islands, four moving blocks, three bounce pads, three checkpoints.",
   2: "Cloud Steps (placeholder): level 1's tower with faster blocks and narrower islands.",
   3: "Moving Platforms (placeholder): level 1's tower, faster and longer moving blocks.",
   4: "Storm Heights (placeholder): level 1's tower, harder constants.",
   5: "Infinite Tower (placeholder): level 1's tower, the hardest constants.",
};

const definition: GameDefinition<SkyLevel> = {
   slug: "sky-tower-jump",
   Scene,
   Hud,
   assets: ASSETS,
   // the first frame only: the Scene's follow camera (or the intro) takes over on mount
   camera: { position: [0, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" },
   touchControls: ["joystick", "jump"],
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Jump from island to island up the sky tower and reach the gate at the top.",
      "Blue pads bounce you high. Moving blocks carry you. Beacons are checkpoints.",
      "Each orb takes 0.4 s off your time. A fall costs time and sends you back to the last beacon.",
   ],
   // the hero hops and spins at the gate before the result panel
   resultDelayMs: 1600,
   finalScore,
   levels: LEVEL_IDS.map(
      (id): LevelSpec<SkyLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
      }),
   ),
};

export default definition;
