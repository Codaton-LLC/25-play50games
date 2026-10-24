import type { LevelId } from "../../types";
import type { GameDefinition } from "../../core/types";
export const LEVEL_LOOKS: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   1: { background: "#8ec5f0", lighting: "day" },
   2: { background: "#a7c8df", lighting: "day" },
   3: { background: "#d49d83", lighting: "sunset" },
   // no fog: the portrait phone camera stands far enough back that fog covered the whole map
   4: { background: "#101c32", lighting: "night" },
   5: { background: "#c77869", lighting: "sunset" },
};
