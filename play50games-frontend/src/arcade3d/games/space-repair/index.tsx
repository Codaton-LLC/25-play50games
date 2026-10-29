"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { CAMERA } from "./camera";
import { COLORS } from "./looks";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS, type SpaceRepairLevel } from "./levels";
import { CLOCK } from "./rules";

/** One line under each level tile: where this level's repairs happen. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Docking Bay: the eight pods ring the round hub between the solar wings. 30 tickets in 2 minutes.",
   2: "Power Wing: pods round a long oval on the power spine, giant solar arrays north and south.",
   3: "Comms Wing: a wide ring round the big comms dish; antenna masts crowd the outer lane where debris flies.",
   4: "External Platform: an open square deck in raw sunlight, pods on the corners, debris swinging wide.",
   5: "Station Emergency: red alert, the ring turned and sealed by bulkheads between the docks; the fastest debris.",
};
/** Each level's light: the bay's night space, the power wing in full sun, the comms wing at dusk-blue,
 *  the platform in hard daylight, the emergency in red alarm light. */
const ENVIRONMENT: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   1: { background: COLORS.space, lighting: "space", fog: [COLORS.fog, 55, 140] },
   2: { background: "#0b1a3a", lighting: "day", fog: ["#0b1a3a", 55, 140] },
   3: { background: "#0a1028", lighting: "night", fog: ["#101a3a", 50, 130] },
   4: { background: "#06142a", lighting: "sunset", fog: ["#1a2440", 55, 140] },
   5: { background: "#1a0306", lighting: "night", fog: ["#2a0508", 45, 120] },
};
const HINTS: Partial<Record<LevelId, string>> = {
   2: "Power Wing: fly round the ends of the long spine, not over it.",
   3: "Comms Wing: stay inside the antenna masts; the outer lane is debris alley.",
   4: "External Platform: open space; the corner docks sit far out, brake early.",
   5: "Emergency: bulkheads seal the outer lane between docks. Fly the inner ring.",
};
const INSTRUCTIONS = [
   "Thrust to a lit dock. Release to brake.",
   "Tap E, Enter or Space in the green repair arc.",
   "Keep station power above zero for 2 minutes.",
];

const definition: GameDefinition<SpaceRepairLevel> = {
   slug: "space-repair",
   Scene,
   Hud,
   assets: ASSETS,
   camera: CAMERA,
   environment: ENVIRONMENT[1],
   levels: LEVEL_IDS.map((id) => ({
      id,
      description: DESCRIPTIONS[id],
      config: LEVELS[id],
      hudStats: [],
      ...(id > 1 ? { environment: ENVIRONMENT[id] } : {}),
      ...(HINTS[id] ? { instructions: [...INSTRUCTIONS, HINTS[id]!] } : {}),
   })),
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Repair" },
   clockChip: false,
   hudStats: [],
   resultDelayMs: CLOCK.resultDelayMs,
   instructions: INSTRUCTIONS,
};

export default definition;
