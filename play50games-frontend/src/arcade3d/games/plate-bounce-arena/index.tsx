"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type PinLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Practice Table: the drain is gated while you flip into the bumpers; then a ramp shot through the gold ring, then light 3 lanterns to open the exit hole.",
   2: "Mushroom Garden: the mushrooms throw you onto the orbit lane. Three orbits in a row light the 2x multiplier and open the penguins; knock them down for the exit.",
   3: "Ice Table: 30 % less friction and a steeper slope. Shatter the left ice blocks, shoot the ramp, shatter the right ones.",
   4: "Multiball: light the lanterns and two marbles join you. Shoot the jackpot ramp twice (3x jackpot while all three are alive), then sink the exit.",
   5: "Rollo: hit him fast while his pockets glow, crack his armour with a golden ball from the ramp, then beat the flipper thief with the jackpot ramp.",
};

const definition: GameDefinition<PinLevel> = {
   slug: "plate-bounce-arena",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 16, 14], fov: FOV, lookAt: [0, 1, -10] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Flip", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "You are the pinball. Hold Space (Flip) to charge the plunger and let go to launch.",
      "A / Left and D / Right hold the flippers (on a phone: hold that half of the screen); Space flips both. Hold a flipper to cradle the ball and aim.",
      "Each table has sections: bumpers, ramps, lanterns, penguins. Finish them in order and the exit hole opens: sink the ball. Three balls per table.",
      "Power (E / Enter / Power): Riko dashes through the cracked block, Nami hops (double hop onto the deck), Kiro's shield saves a drain, Zuno sticks to a magnet pad and aims, Vexa phases into the attic.",
      "Turn the camera with a right-drag (two fingers on a phone), Q and C, or pinch to zoom; the stick and W / S nudge the table.",
   ],
   resultDelayMs: 1400,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<PinLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
