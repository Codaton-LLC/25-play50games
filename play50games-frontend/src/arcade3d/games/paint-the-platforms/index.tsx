"use client";

// Paint the Platforms (Menu 2, game 25, World 6 Prism Fortress): the GameDefinition GameShell runs
// (loaded lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the card's timer, "timeup",
// unranked); a win submits the finish ms (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type PaintLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "First Strokes: one courtyard. Run over the grey tiles to paint 30% of it in your colour within 60 s.",
   2: "Grey Blots: two courts and a bridge. Blots crawl round and wipe your paint: paint 40% in 75 s, and set rows so they stay.",
   3: "Moving Tiles: three islands joined by tile rafts that shuttle between them. Their tiles count: paint 50% in 90 s.",
   4: "Time Attack: a big court, a side court each way and the grey roller sweeping its lanes. Paint 65% in 105 s.",
   5: "80% Master: paint 80% of the Paint Blob's court in 120 s and splat the Blob while its core is open. Get out of its slam rings.",
};

const definition: GameDefinition<PaintLevel> = {
   slug: "paint-the-platforms",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 6, 9], fov: FOV, lookAt: [0, 1, -4] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Every tile you run over takes your hero's colour. Paint the share the level asks for (the bar at the bottom) before the timer runs out.",
      "Paint a whole row of a platform and it sets: it glows and nothing can wipe it again.",
      "Grey blots, the roller and the Paint Blob wipe unset paint back to grey. Paint blobs splash the tiles round them.",
      "E, Enter or the Power button fires your hero: Riko dashes, Kiro's shield freezes blots and stops the roller, Zuno's magnet pulls paint blobs, Vexa phases; Nami double jumps. On level 5 the same button splats the Blob while its core is open.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<PaintLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
         ...(id === 5 ? { resultDelayMs: 2600 } : {}),
      }),
   ),
};

export default definition;
