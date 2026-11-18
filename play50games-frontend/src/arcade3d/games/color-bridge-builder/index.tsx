"use client";

// Color Bridge Builder (Menu 2, game 39): the GameDefinition GameShell runs (loaded lazily by loaders.ts).
// A time game: rules.ts ends the run at the level's cap ("timeup", unranked); a win submits the finish
// ms minus the orb and flow bonus (finalScore). The shell owns the screens and the intro.
import type { GameDefinition, LevelSpec } from "../../core/types";
import { LEVEL_IDS, type LevelId } from "../../types";
import { sessionRunPlayers } from "../../menu2/multiplayer/leaderboard";
import { ASSETS } from "./assets";
import { LEVELS, type BridgeLevel } from "./levels";
import { LOOKS } from "./look";
import { finalScore } from "./rules";
import Scene from "./Scene";
import Hud from "./Hud";
import StarResult from "./StarResult";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Two Switches: walk a red bridge as Riko, switch a dark node to blue for Nyla, and tag Vexa where red crosses blue into purple.",
   2: "Prisms: bump a prism to aim the yellow beam for Zuno; blue crossing yellow makes green for Kiro, and a green ledge holds a sticker.",
   3: "Split Bridge: red crossing yellow flickers orange; two half-bridges side by side; yellow or blue at the top: orange to time, or purple for Vexa.",
   4: "Timed Bridge: drones swallow the beams they fly through, a node shines only 10 s after its far switch, and a cracked rock hides a shard.",
   5: "Canyon Gate: the Bridge Keeper's plate wants a colour each window: red, blue, yellow, then purple and green, then white. Dodge its stomps.",
};

const definition: GameDefinition<BridgeLevel> = {
   slug: "color-bridge-builder",
   Scene,
   Hud,
   ResultExtra: StarResult,
   assets: ASSETS,
   camera: { position: [10, 16, 40], fov: 50, lookAt: [10, 0, 26] },
   environment: { background: LOOKS[1].background, fog: LOOKS[1].fog, lighting: LOOKS[1].lighting },
   touchControls: ["joystick", "jump", "action"],
   touchLabels: { jump: "Tag", action: "Power" },
   hudStats: [],
   clockChip: false,
   intro: true,
   instructions: [
      "Cross the canyon to the gate. Energy nodes shoot beams; a beam that reaches an anchor becomes a bridge of light.",
      "Step on a switch to change its node's colour. Walk into a prism to turn it.",
      "Crossing beams mix: red + blue = purple, blue + yellow = green, red + yellow = orange (it flickers), all three = white.",
      "Only the hero of a bridge's colour walks it: Riko red, Nyla blue, Zuno yellow, Vexa purple, Kiro green. Orange and white: anyone.",
      "Tag (Space / Tag) swaps to the hero the bridge ahead needs. Mid-bridge, tag as you step onto the new colour.",
      "Power (E / Enter): Riko dashes 3 cells, Nyla leaps 2, Zuno pulls a prism, Vexa walks any light 1.5 s, Kiro's shield blocks a beam.",
   ],
   resultDelayMs: 1800,
   finalScore,
   runPlayers: () => sessionRunPlayers(),
   levels: LEVEL_IDS.map((id): LevelSpec<BridgeLevel> => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      environment: { background: LOOKS[id].background, fog: LOOKS[id].fog, lighting: LOOKS[id].lighting },
   })),
};

export default definition;
