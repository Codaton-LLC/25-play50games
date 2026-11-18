"use client";

// Mirror Dash (Menu 2, game 33): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// A time game: rules.ts ends the run at the level's cap ("timeup", unranked); a win submits the finish
// ms minus the orb and flow bonus (finalScore). The shell owns the screens and the intro.
import type { GameDefinition, LevelSpec } from "../../core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type MirrorLevel } from "./levels";
import { LOOKS } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Mirror Lane: blocks on your side, then on the reflection's, then both: find the one move that saves both.",
   2: "Converge: the runways merge into one road. Your hero and its reflection must never meet in the middle.",
   3: "Frosted Glass: behind frosted mirror panels the reflection copies your moves instead of mirroring them.",
   4: "Echo: in echo zones the reflection repeats your input half a second later. Read the obstacles twice.",
   5: "Glass Hall: the hall's last stretch, then the Glass Sentinel: dodge its panes, jump through its knee-gems, and leap into its chest crystal together.",
};

const definition: GameDefinition<MirrorLevel> = {
   slug: "mirror-dash",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 6, 10], fov: 58, lookAt: [0, 1, -6] },
   environment: { background: LOOKS[1].background, fog: LOOKS[1].fog, lighting: LOOKS[1].lighting },
   touchControls: ["joystick", "jump", "action", "swipe"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Your hero runs the left runway, its glass reflection the right one. One input drives both.",
      "Left / Right (A / D, a swipe or a stick flick) change lane, and the reflection goes the other way. Up / Space jumps, Down slides: both copy it.",
      "Find the one move that gets both bodies past their obstacles. Three cracks shatter you back to the last gate.",
      "Merge zones join the runways: never both in the middle. Frosted glass makes the reflection copy you; echo makes it repeat you 0.5 s late.",
      "E / Enter / Power: Vexa phases both bodies, Riko dashes through cracked blocks, Kiro shields both, Zuno pulls orbs from both runways; Nami double-jumps.",
      "Turn the camera: two fingers or the right mouse button, mouse wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<MirrorLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: { background: LOOKS[id].background, fog: LOOKS[id].fog, lighting: LOOKS[id].lighting },
   })),
};

export default definition;
