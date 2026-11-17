import type { LevelId } from "../../types";
import type { GameDefinition } from "../../core/types";

export const LEVEL_LOOKS: Record<LevelId, NonNullable<GameDefinition["environment"]>> = {
   // Level 1 — Pocket Park: original bright sky
   1: { background: "#8ec5f0", lighting: "day" },
   // Level 2 — City Square: crisp civic morning sky + soft distant horizon haze
   2: { background: "#9cc4e4", lighting: "day", fog: ["#9cc4e4", 50, 115] },
   // Level 3 — Shopping Street: warm golden-hour sunset + warm boulevard haze
   3: { background: "#de9b79", lighting: "sunset", fog: ["#de9b79", 48, 110] },
   // Level 4 — River Walk: deep midnight riverbank sky (no fog so the night floor stays crisp on portrait)
   4: { background: "#0d1b30", lighting: "night" },
   // Level 5 — Festival Cleanup: dramatic crimson-amber dusk + warm twilight horizon fog
   5: { background: "#c77265", lighting: "sunset", fog: ["#c77265", 48, 112] },
};

