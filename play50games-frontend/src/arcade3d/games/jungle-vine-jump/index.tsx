"use client";

// Jungle Vine Jump (Menu 2, game 8, World 3 Wild Temples): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit and the intro
// (intro: true). A time game: no durationMs (rules.ts ends the run at the level's time cap, "timeup",
// unranked); a win submits the finish ms minus the orb and combo bonus (finalScore).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type VineLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Green Start: one vine over a safe leaf, two vines far apart (slide down to reach), then a vine-to-vine catch over a net leaf. About 35 m up the tree. Target 75 s.",
   2: "Branch Climb: the branches bob and the vines rooted on them move with them, so the anchors ride up and down as you swing. About 43 m.",
   3: "Swinging Vines: brown dry vines snap 2.5 s after you grab them, so commit fast; snapper plants bite beside the landing branches. About 60 m.",
   4: "Ruins: vines hang from mossy stone arches that lean with your weight, and monkeys throw fruit pods that knock you off. A 70 m climb.",
   5: "Canopy Peak: climb to the crown and duel the Howler King: swing into his perch, release into him after his roar, then meet him at the bottom faster.",
};

/** Each level's own twist, as a fifth start-card line (level 1 keeps its four). */
const TWISTS: Record<Exclude<LevelId, 1>, string> = {
   2: "The branches bob 0.6 m: time your release for where the landing branch will be.",
   3: "Dry brown vines snap 2.5 s after the grab, and snappers bite on a 2 s beat beside the branches.",
   4: "Arch vines lean with your swing; monkeys wind up (a hop) before each throw: Kiro's shield blocks the pods.",
   5: "The Howler King: 6 hits in 3 phases. Only a fast hit counts (7 m/s), so swing big.",
};

const INSTRUCTIONS = [
   "Climb the giant tree. Jump into a vine to grab it; Space (or Jump) lets go along the swing.",
   "On a vine, Up / Down slides your grip: short swings fast, long swings slow but reaches far. Left / Right in time with the swing pumps it higher (up to 75 degrees).",
   "Catch vine to vine within 1.2 s for a combo. Five green orbs a level hang on the swings, each 0.1 s off your time.",
   "Action (E, Enter or the Power button) fires your hero power: Riko dashes after a release, Kiro shields, Zuno's magnet pulls emeralds, Vexa phases into the trunk hollow; Nami double jumps on Jump. Turn the camera by dragging (or two fingers); wheel / pinch zooms.",
];

const definition: GameDefinition<VineLevel> = {
   slug: "jungle-vine-jump",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 8, 30], fov: FOV, lookAt: [0, 2, 16] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: INSTRUCTIONS,
   resultDelayMs: 1700,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<VineLevel> =>
      id === 1
         ? { id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) }
         : { id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id), instructions: [...INSTRUCTIONS, TWISTS[id]] },
   ),
};

export default definition;
