"use client";
import type { GameDefinition } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type TempleLevel } from "./levels";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud, { StarResult } from "./Hud";
const definition: GameDefinition<TempleLevel> = {
   slug: "temple-lantern-jump", Scene, Hud, ResultExtra: StarResult, assets: ASSETS,
   camera: { position: [0, 6, 12], lookAt: [0, 3, 0], fov: 55 },
   environment: { background: "#142822", fog: ["#142822", 20, 70], lighting: "day" },
   touchControls: ["joystick", "jump", "action"], touchLabels: { jump: "Jump", action: "Ember" },
   hudStats: [], clockChip: false, intro: true, resultDelayMs: 1700, finalScore,
   runPlayers: () => sessionRunPlayers(),
   instructions: [
      "Land on a cage lantern to bounce, refill your 8-second ember and ignite 12 seconds of light.",
      "Gold glyph ledges hold you only inside a light pool. Faint stone rims and the next ember guide the climb.",
      "Jump from ledges. While airborne, Ember throws light downwards and costs 3 seconds. The same button activates your hero power when ready.",
      "Riko opens brazier galleries, Nami jumps twice, Kiro shields fire jets, Zuno draws sparks, Vexa enters the hidden lantern room.",
      "Collect five green orbs, beat the target time, and explore the side galleries. Drag / two fingers to orbit, wheel / pinch to zoom.",
   ],
   levels: LEVEL_IDS.map((id) => ({ id, config: LEVELS[id], description: LEVELS[id].name,
      environment: { background: id === 4 ? "#0b1628" : "#142822", fog: [id === 4 ? "#0b1628" : "#142822", 18, 65], lighting: "day" } })),
};
export default definition;
