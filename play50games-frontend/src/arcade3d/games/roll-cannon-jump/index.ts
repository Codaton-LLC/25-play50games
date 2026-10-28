// Roll Cannon Jump's GameDefinition. MILESTONE 1 (pure logic) ships only the registration shell: the
// Scene, Hud and star screen arrive in milestone 2/3 (they need three.js and React). The stub Scene
// renders nothing; the game is not playable until milestone 2 replaces it. All run logic lives in
// the pure files beside this one (rules.ts, course.ts, bot.ts) and is fully tested without this file.
import type { ComponentType } from "react";
import type { GameDefinition } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";

// The placeholder scene: milestone 2 replaces it with the three.js big top.
const SceneStub: ComponentType = () => null;

const definition: GameDefinition = {
   slug: "roll-cannon-jump",
   Scene: SceneStub,
   assets: ASSETS,
   camera: { position: [0, 10, 8], fov: 55 },
   environment: {
      background: "#1f2937",
      fog: ["#1f2937", 30, 90],
      lighting: "sunset",
   },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Fire", action: "Power" },
   instructions: [
      "In a cannon the stick aims: sideways for yaw, up and down for pitch.",
      "The power ring pulses 60-100 %. Press Jump (Fire) at the pulse you need.",
      "In flight nudge with the stick; hold down to roll-dive. Land in cannons, on platforms, trampolines and balloons.",
      "Every fall puts you back in the last cannon. Beat the show time and gather the orbs.",
   ],
   clockChip: true,
};

export default definition;
