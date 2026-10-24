import type { LevelId } from "../../types";
import type { GameDefinition } from "../../core/types";
export const LEVEL_LOOKS: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   1: { background: "#8ec5f0", lighting: "day" },
   2: { background: "#a7c8df", lighting: "day" },
   3: { background: "#d49d83", lighting: "sunset" },
   4: { background: "#101c32", lighting: "night", fog: ["#101c32", 35, 90] },
   5: { background: "#c77869", lighting: "sunset", fog: ["#c77869", 40, 100] },
};
