import type { GameDefinition } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import type { CorridorVariant } from "./decor";

/** Each level's corridor dressing (decor.ts CORRIDOR_DECOR, corridorArt.ts painters). */
export const LEVEL_VARIANTS: Record<LevelId, CorridorVariant> = {
   1: "openOffice",
   2: "meeting",
   3: "copyRoom",
   4: "executive",
   5: "afterHours",
};

/** The shell environment per level: background, fog range and the core lighting preset.
 *  Level 1 is the live contract and must never change; 2-5 are each department's mood
 *  (day meeting wing, pale copy room, night executive floor, sunset after-hours). */
export const LEVEL_LOOKS: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   1: { background: "#dbeafe", fog: ["#dbeafe", 40, 75], lighting: "indoor" },
   2: { background: "#cfe3f7", fog: ["#cfe3f7", 45, 80], lighting: "day" },
   3: { background: "#c9d4e4", fog: ["#c9d4e4", 40, 75], lighting: "indoor" },
   4: { background: "#131f36", fog: ["#131f36", 34, 66], lighting: "night" },
   5: { background: "#43304b", fog: ["#43304b", 34, 70], lighting: "sunset" },
};
