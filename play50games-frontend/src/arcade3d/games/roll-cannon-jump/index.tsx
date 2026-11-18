"use client";

// Roll Cannon Jump (Menu 2, game 43, World 1 Ember Heights): the GameDefinition GameShell runs
// (loaded lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the
// intro (intro: true). A time game: no durationMs (rules.ts ends the run at the show's time cap,
// "timeup", unranked); a win submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CannonLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Short Launch: press fire, aim at a cannon 8 m away, then a short shot, a long shot, a trampoline catch and the finish ring. Par 6 shots.",
   2: "Angle Practice: lob over the tent walls, fire flat under the trapeze banners. The aim preview shows half the arc.",
   3: "Moving Pads: cannons on rails, a wheel cannon that sweeps on its own, an auto-cannon chain and the first smoke jets.",
   4: "Long Distance: 25 m shots across the big top, a balloon re-aim over the widest gap, smoke jets, 30 % preview. A 100 % shot finds the one-shot line.",
   5: "Big Top Finale: everything, then Ashbag the Smoke Blimp. Pop its smoke pods, bounce into its gondola, ride the auto-cannons up and dive into its valve.",
};

const definition: GameDefinition<CannonLevel> = {
   slug: "roll-cannon-jump",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [4, 9, 9], fov: FOV, lookAt: [0, 6, -4] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Fire", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Fire yourself cannon to cannon through the drained circus to the gold finish ring.",
      "In a cannon the stick turns the barrel: left / right to aim, up / down to lob or fire flat. The power ring pulses 60-100 %: press Fire (Space) at the power you need.",
      "In flight the stick nudges a little; press Fire again and hold it to roll-dive steeper. Cannons catch you when you pass close; trampolines bounce you up; balloons give a free re-aim.",
      "A fall into the net or a bonk puts you back in the last cannon. Each orb takes 0.1 s off your time.",
      "Power (E, Enter, or the Power button): Riko air-dashes and smashes target boards, Nami jumps again in flight, Kiro shields through smoke, Zuno's magnet pulls hidden orbs, Vexa phases through ghost poles.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1600,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<CannonLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
