import type { GameDefinition } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";

export const LEVEL_LOOKS: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   1: { background: "#dbeafe", fog: ["#dbeafe", 40, 75], lighting: "indoor" },
   2: { background: "#dbeafe", fog: ["#dbeafe", 40, 75], lighting: "day" },
   3: { background: "#c9d4e4", fog: ["#c9d4e4", 40, 75], lighting: "indoor" },
   4: { background: "#17243b", fog: ["#17243b", 40, 75], lighting: "night" },
   5: { background: "#43304b", fog: ["#43304b", 40, 75], lighting: "sunset" },
};
