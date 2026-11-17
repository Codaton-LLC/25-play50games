"use client";

// Temple Gong Timing (Menu 2, game 36, World 3 Wild Temples, the world's finale): the GameDefinition
// GameShell runs (loaded lazily by loaders.ts). The shell owns the screens, Mute / Pause, the score submit
// and the intro (intro: true). A points game that ends with its song (levels 1-4) or with Coilstone's
// defeat / the cap (level 5): no durationMs, its own clock (the song), so clockChip is off.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "@/arcade3d/menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type GongLevel } from "./levels";
import { levelEnvironment } from "./look";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Slow Beat (96 BPM, 4 gongs): strike one gong on the shrinking ring, then two in turn, then hold the ceremony drum. Clear at 70 % accuracy.",
   2: "Alternating Gongs (104 BPM, 6 gongs): the lanterns call a 4-note pattern on the gongs; answer it with no rings. 75 %.",
   3: "Moving Targets (112 BPM): the gongs ride round the stage; your roll has to lead them. 80 %.",
   4: "Fast Rhythm (124 BPM, 8 gongs): eighth notes on one gong and shockwaves on the off-beats: jump them. 85 %.",
   5: "Perfect Timing: free Coilstone. Echo its calls, win the drum duel through its shockwaves, then strike the Great Gong on the last beat.",
};

const definition: GameDefinition<GongLevel> = {
   slug: "temple-gong-timing",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 11, 14], fov: FOV, lookAt: [0, 1, -1] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Jump", action: "Strike" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "A ring shrinks onto a gong: when it closes (it turns gold), press Strike (E, Enter or the Strike button). Within 45 ms is a Perfect, within 90 ms a Good: the same on every device.",
      "Leave the stick at rest and your hero rolls to the next gong by itself; the stick takes over to chase echo orbs and bonus notes. Hold Strike on a ceremony drum until its ring empties.",
      "Jump (Space) the violet shockwaves. Every struck note links the combo (x2 at most); a miss or a shockwave breaks it. Every Perfect throws out an echo orb (+20) and grows a flower round the stage.",
      "Heroes: Riko's dash roll makes the cross-stage notes (double points), Nami double-jumps to the pillar gongs, Kiro's shield saves one miss or shockwave, Zuno's magnet pulls echo orbs, Vexa strikes the ghost gong.",
      "Turn the camera: drag (or two fingers), wheel / pinch zooms, Q / C turn, R / F tilt, V recenters.",
   ],
   resultDelayMs: 1800,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<GongLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id) })),
};

export default definition;
