"use client";

// Wind Tunnel Escape (Menu 2, game 41): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// The shell owns the screens, Mute / Pause, the score submit and the intro (intro: true, core/intro).
// A time game: no durationMs (rules.ts ends the run at its own timer, "timeup", unranked); a win
// submits the finish ms minus the orb and flow bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type WindLevel } from "./levels";
import { COLORS, fogFor, levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Gentle Wind: ride one updraft, turn one fan across a gap, then chain a vent and a fan up and across. The storm only wakes at the end.",
   2: "Cross Wind: where two currents cross they add; switch off the crosswind, or turn it to curve round a corner.",
   3: "Vertical Lift: a tall shaft of fan lifts. Switch a vent and the platform carries you up with it.",
   4: "Moving Fans: fans that slide on rails, fans that turn themselves every 3 s, and drones in the currents.",
   5: "Storm Tunnel: the Gale Engine. Turn its blast back, jam its core with crates, then escape four rooms ahead of the storm.",
};

const definition: GameDefinition<WindLevel> = {
   slug: "wind-tunnel-escape",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 4.2, 10], fov: FOV, lookAt: [0, 1.4, 0] },
   environment: { background: COLORS.background, fog: [fogFor(1).color, fogFor(1).near, fogFor(1).far], lighting: "day" },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { action: "Fan / Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Escape the storm tunnel: turn the fans so their currents carry you across the gaps and up the shafts, then out of the exit.",
      "Next to a fan, tap E / Enter (the Fan button) to turn it 90°, hold it to switch the fan off or on. A vent switches with a tap.",
      "A current carries you on its own: steer a little inside it, you drop out at its end. Where two currents cross, they add up.",
      "The violet storm front follows you and costs a heart a second inside it. It waits while a room's fans are not set yet. Stuck for 20 s? A gold ghost shows the setup.",
      "Away from fans, E is your power: Riko dashes through cracked vent covers, Nami double-jumps (also out of a current), Kiro's shield crosses shock vents, Zuno's magnet pulls far orbs, Vexa phases into the ducts.",
      "Turn the camera: drag the view (or two fingers), mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map(
      (id): LevelSpec<WindLevel> => ({
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         environment: levelEnvironment(id),
      }),
   ),
};

export default definition;
