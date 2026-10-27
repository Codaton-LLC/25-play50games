"use client";

// Cloud Hopper (Menu 2, game 05): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own sunset, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CloudLevel } from "./levels";
import { COLORS, levelEnvironment } from "./look";
import { FOG } from "./World";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Soft Clouds: big clouds, a feather and a gap to glide, a wind ring only a glide reaches. 250 m before sunset.",
   2: "Moving Clouds: clouds drift on lanes, so plan each landing. 300 m.",
   3: "Wind Zone: crosswinds push you, a head wind halves a glide, a tail wind doubles it. 360 m.",
   4: "Fading Clouds: pulse clouds are solid on the beat, thunderheads zap the clouds beside them. 420 m.",
   5: "Sky Sprint: Gloom Nimbus chases you across 480 m. Charge its rods, glide through its eyes, ring the bell.",
};

const definition: GameDefinition<CloudLevel> = {
   slug: "cloud-hopper",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [2.4, 4.4, 10.6], fov: FOV, lookAt: [0, 1.8, -1] },
   environment: { background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Cross the cloud sea to the rainbow bridge before the sun sets. Every cloud sinks once you land, then bursts.",
      "Feathers fill your glide meter. Hold Jump in the air to glide; wind rings add glide.",
      "Land on a cloud's bright centre to build a streak. Each orb takes 0.4 s off your time.",
      "Wind bands push gliders. Solid anchor clouds are checkpoints. A fall costs time.",
      "Power (E, Enter, or the Power button): Riko air-dashes through storm walls, Nami jumps again after a glide, Kiro shields through thunder, Zuno's magnet pulls feathers and hidden orbs, Vexa phases through ghost veils.",
   ],
   resultDelayMs: 1600,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<CloudLevel> => {
      const dusk = levelEnvironment(id);
      return {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         ...(dusk ? { environment: dusk } : {}),
      };
   }),
};

export default definition;
