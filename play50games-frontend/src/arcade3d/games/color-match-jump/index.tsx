"use client";

// Color Match Jump (Menu 2, game 21, World 6 Prism Fortress): the GameDefinition GameShell runs (loaded
// lazily by loaders.ts). A time game: rules.ts ends the run at the level's cap ("timeup", unranked);
// a win submits the finish time (finalScore).
import type { GameDefinition, LevelSpec } from "../../core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { LEVELS, type CmjLevel } from "./levels";
import { levelEnvironment } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Two-Tone Steps: red and blue only, no sinking. Hop the red hexes as Riko, tag Nami for the blue one, then tag on every jump across the stepping stones. 5 codes.",
   2: "Three Calls: yellow joins, codes of three, and the rear rows start to sink. 8 codes.",
   3: "Shifting Hues: every hex changes colour every 4 s (it fades first) and the pillars bob. 12 codes.",
   4: "Fast Countdown: all five colours, codes of four, fast sinking and glassy hexes that skid. 16 codes.",
   5: "Frozen Crown: the Echo Frost Golem. Crack codes onto its cores, stomp its plate in the right colour, then survive its prism storm.",
};

const definition: GameDefinition<CmjLevel> = {
   slug: "color-match-jump",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [0, 8, 10], fov: FOV, lookAt: [0, 0.5, -3] },
   environment: levelEnvironment(1),
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Hop", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   resultDelayMs: 1600,
   instructions: [
      "Aim with the stick and hop hex to hex (Space / Hop; hold it for a two-hex long jump).",
      "A hex holds only if your hero's colour matches it: the wrong colour cracks and drops it 0.6 s later. Grey hexes are always safe.",
      "Tag a hero any time, even in mid-air: keys 1-5 (T cycles) or tap a portrait. Riko red, Nami blue, Kiro green, Zuno yellow, Vexa purple.",
      "Land the beacon's colours in order to crack its codes; enough codes open the crown at the far end. The rear rows sink behind you.",
      "Powers (E / Enter / Power): Riko dashes two hexes further, Nami double-jumps the tall pillars, Kiro shields through lightning, Zuno pulls orb trails, Vexa phases through ghost pillars.",
      "Camera: drag (or two fingers) to turn, wheel / pinch to zoom, Q / C turn, R / F tilt, V recenters.",
   ],
   finalScore,
   levels: LEVEL_IDS.map((id): LevelSpec<CmjLevel> => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id], environment: levelEnvironment(id), ...(id === 5 ? { resultDelayMs: 2600 } : {}) })),
};

export default definition;
