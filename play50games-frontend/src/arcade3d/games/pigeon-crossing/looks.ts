import type { LevelId } from "@/arcade3d/types";
import type { GameDefinition } from "@/arcade3d/core/types";
import { COLORS } from "./Primitives";

export const LEVEL_LOOKS: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   1: { background: COLORS.background, lighting: "day" },
   2: { background: COLORS.background, lighting: "day" },
   3: { background: "#e9bd99", lighting: "sunset" },
   4: { background: "#17243b", lighting: "night" },
   5: { background: "#c18070", lighting: "sunset" },
};
