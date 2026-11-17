// Wizard Potion Lab level configs. One round lab shape; each level is its own room (`theme`,
// looks.ts LAB_THEMES: floor, walls, glow and the props the title promises); counts, clock, light change.
// Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export type LabTheme = "beginner" | "mushroom" | "crystal" | "forest" | "master";

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
   theme: LabTheme;
}

export const LEVELS: Record<LevelId, WizardLevel> = {
   1: { radius: 7, recipes: 2, steps: 2, dual: false, wander: false, wrongCostsLife: false, durationMs: 120_000, lighting: "indoor", background: "#1e1b4b", theme: "beginner" },
   2: { radius: 8, recipes: 3, steps: 3, dual: false, wander: false, wrongCostsLife: true, durationMs: 150_000, lives: 3, lighting: "indoor", background: "#14261c", theme: "mushroom" },
   3: { radius: 9, recipes: 4, steps: 4, dual: false, wander: true, wrongCostsLife: true, durationMs: 180_000, lives: 3, lighting: "night", background: "#172554", theme: "crystal" },
   4: { radius: 10, recipes: 5, steps: 5, dual: false, wander: true, wrongCostsLife: true, durationMs: 180_000, lives: 3, lighting: "sunset", background: "#2a1a0e", theme: "forest" },
   5: { radius: 11, recipes: 6, steps: 5, dual: true, wrongCostsLife: true, wander: true, durationMs: 210_000, lives: 3, lighting: "night", background: "#1e1b4b", theme: "master" },
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
   2: "A cellar of giant glowing mushrooms. A wrong bottle costs a life.",
   3: "An ice-crystal cave. One ingredient slides along a glowing crystal rail.",
   4: "A lab grown into the forest, leaves drifting down. Five-step recipes.",
   5: "The master's tower under the stars: two recipes at once.",
};
