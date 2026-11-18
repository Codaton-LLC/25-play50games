"use client";

// Toy Room Run (Menu 2, game 18, World 4 Frost & Sweets): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's timer, "timeup",
// unranked); a win submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type ToySpec } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Desk Start: push one domino and six pieces bridge a gap; follow a wave across the desk; stand on the drum as the wave hits it.",
   2: "Book Bridge: stalled chains (push the spare piece into the gap) and your first fork.",
   3: "Race Track: the wave starts toy race cars. Dodge the ones crossing, ride the one on the long track.",
   4: "Lights Out: only fallen pieces glow, spinning tops wander, and the wave outruns you. Stay right behind it.",
   5: "Toybox Finale: Jack Wobble springs out of the toyboxes. Drop books on him, push his blocks back, topple the giant line onto him.",
};

const definition: GameDefinition<ToySpec> = {
   slug: "toy-room-run",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 7, -8], fov: FOV, lookAt: [0, 1.2, 4] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Walk into the first piece of a chain: the wave runs along it and every piece falls flat.",
      "Fallen pieces over a gap are your bridge, for a moment: stay close behind the wave. Run into a standing piece and you bounce back.",
      "A chain stalls at a missing piece: push the spare lying beside it into the gap. Forks give you a choice of route.",
      "Stand on a toy drum as the wave hits it and it throws you up to the shelf. Race cars start too: dodge them or ride one.",
      "Power (E, Enter, or the Power button): Riko's dash (3 a run) breaks the cracked block wall, Nami jumps again, Kiro's shield, Zuno's magnet pulls gems and spare pieces, Vexa phases through the castle's ghost door.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. Up on the stick runs away from the camera.",
   ],
   resultDelayMs: 1500,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<ToySpec> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: levelEnvironment(id),
   })),
};

export default definition;
