import type { LevelId } from "@/arcade3d/types";
import type { GameDefinition } from "@/arcade3d/core/types";
import { MAP_2, MAP_3, MAP_4, MAP_5 } from "./maps";
import { COLORS } from "./Primitives";

export const LEVEL_LOOKS: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   1: { background: COLORS.background, lighting: "day" },
   2: { background: MAP_2.palette.background, fog: [MAP_2.palette.background, 26, 78], lighting: "day" },
   3: { background: MAP_3.palette.background, fog: [MAP_3.palette.background, 24, 72], lighting: "sunset" },
   4: { background: MAP_4.palette.background, fog: [MAP_4.palette.background, 20, 62], lighting: "night" },
   5: { background: MAP_5.palette.background, fog: [MAP_5.palette.background, 22, 66], lighting: "sunset" },
};
