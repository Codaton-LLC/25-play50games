"use client";

// Color City Sprint (Menu 2, game 15, World 1). A time game: no durationMs. The rules end the run.
// finalScore submits the finish time minus the orb and flow bonus. clockChip is off (the HUD clock).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CitySpec } from "./levels";
import { COLORS, FOG, levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Red Block: one beacon at a time. The avenue is clear; the alley is shorter and full of cones. Lap 2 lights the red lanes.",
   2: "Bus Line: ramps throw you onto the bus roofs. One beacon rides the loop.",
   3: "Rush Hour: colour gates open and shut. Time the crossing.",
   4: "Night Neon: only the lamps and your red lanes show the way. Close the ring for the perfect loop.",
   5: "Greyout Avenue: the sweeper erases your red. Jump its brushes, roll its valves, slam it in a gate.",
};

const definition: GameDefinition<CitySpec> = {
   slug: "color-city-sprint",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [-8, 6, 2], fov: FOV, lookAt: [0, 1.2, 0] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "A beacon lights one at a time. Run the streets between them: they are painted red.",
      "On the next lap a red lane is 30% faster. Chain red streets to build the flow meter.",
      "Grey sludge slows you. Ramps launch you onto the bus roofs.",
      "Power (E, Enter, or the Power button): Riko dashes through a cracked hoarding, Nami jumps again, Kiro's shield ignores sludge, Zuno's magnet pulls gems from drains, Vexa phases through a ghost shop.",
      "Turn the camera: drag the view, Q / C turn, R / F tilt, V recenters. Move is camera-relative.",
   ],
   resultDelayMs: 1400,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<CitySpec> => {
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
