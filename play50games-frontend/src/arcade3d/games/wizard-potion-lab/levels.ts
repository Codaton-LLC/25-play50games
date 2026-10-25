// Wizard Potion Lab level configs. One round lab; counts, the clock and lighting change.
// Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface WizardLevel {
   radius: number;
   recipes: number;
   steps: number;
   dual: boolean;
   wander: boolean;
   wrongCostsLife: boolean;
   durationMs: number;
   lives?: number;
   lighting: "indoor" | "night" | "sunset";
   background: string;
}

export const LEVELS: Record<LevelId, WizardLevel> = {
   1: { radius: 7, recipes: 2, steps: 2, dual: false, wander: false, wrongCostsLife: false, durationMs: 120_000, lighting: "indoor", background: "#1e1b4b" },
   2: { radius: 8, recipes: 3, steps: 3, dual: false, wander: false, wrongCostsLife: true, durationMs: 150_000, lives: 3, lighting: "indoor", background: "#1e1b4b" },
   3: { radius: 9, recipes: 4, steps: 4, dual: false, wander: true, wrongCostsLife: true, durationMs: 180_000, lives: 3, lighting: "night", background: "#172554" },
   4: { radius: 10, recipes: 5, steps: 5, dual: false, wander: true, wrongCostsLife: true, durationMs: 180_000, lives: 3, lighting: "sunset", background: "#3b0764" },
   5: { radius: 11, recipes: 6, steps: 5, dual: true, wrongCostsLife: true, wander: true, durationMs: 210_000, lives: 3, lighting: "night", background: "#1e1b4b" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Beginner Lab",
   2: "Mushroom Lab",
   3: "Crystal Lab",
   4: "Forest Lab",
   5: "Master Wizard Lab",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Two short recipes.",
   2: "A wrong bottle costs a life.",
   3: "One ingredient slides along the shelf.",
   4: "Longer recipes, same room.",
   5: "Two recipes at once.",
};
