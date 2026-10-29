// Color Rail Grind's look per level (pure data, no three.js): World 4 Frost and Sweets, yellow. The
// Sugarfrost Workshop's toy train line: warm timber and brass under deep snow, pale-blue ice, pastel
// candy accents. Shadow Plates drained the gold: the rail lanterns start grey and relight gold behind
// the hero as it grinds (the World 4 restore). Level 1 a snowy morning, 2 the village at golden noon,
// 3 the ice bridge under a hard blue sky, 4 the night express (lanterns), 5 the runaway at a storm dusk.
import type { LevelId } from "@/arcade3d/types";

export interface RailLook {
   skyTop: string;
   skyBottom: string;
   glow: string;
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   snow: string;
   snowShade: string;
   timber: string;
   rail: string;
   ice: string;
   brass: string;
   pine: string;
   pineGrey: string;
   lampOff: string;
   lampOn: string;
   lighting: "day" | "sunset" | "night";
}

export const LOOKS: Record<LevelId, RailLook> = {
   1: { skyTop: "#9cc5e8", skyBottom: "#eef4fb", glow: "#fff6dc", background: "#dfe9f3", fog: "#e3ecf5", fogNear: 40, fogFar: 175, snow: "#f4f7fb", snowShade: "#c9d6e6", timber: "#8a5a3a", rail: "#b8c2cc", ice: "#bfe3f7", brass: "#c99a3a", pine: "#2f6f4a", pineGrey: "#7f8a86", lampOff: "#7a7a72", lampOn: "#ffd257", lighting: "day" },
   2: { skyTop: "#7fb2e0", skyBottom: "#fdf1d8", glow: "#ffe6a8", background: "#eadfca", fog: "#efe3cc", fogNear: 42, fogFar: 180, snow: "#fbf8f2", snowShade: "#d9cfc0", timber: "#94603c", rail: "#c4c8c8", ice: "#c6e6f5", brass: "#d6a542", pine: "#2c6a43", pineGrey: "#858b84", lampOff: "#7c7a70", lampOn: "#ffcf4a", lighting: "sunset" },
   3: { skyTop: "#3f86d6", skyBottom: "#d9f0ff", glow: "#ffffff", background: "#cfe7f8", fog: "#d4ebfa", fogNear: 40, fogFar: 170, snow: "#eef8ff", snowShade: "#b3d5ee", timber: "#7b5a44", rail: "#cfeefc", ice: "#9fdcff", brass: "#c79b46", pine: "#2a6a52", pineGrey: "#7c8a8a", lampOff: "#707a80", lampOn: "#ffe08a", lighting: "day" },
   4: { skyTop: "#0b1430", skyBottom: "#2a3d66", glow: "#8fa8e0", background: "#18223f", fog: "#1d2848", fogNear: 30, fogFar: 140, snow: "#c9d4e8", snowShade: "#8796b8", timber: "#6b4a34", rail: "#9aa6b8", ice: "#8fc4e8", brass: "#d7a44a", pine: "#1f4a3a", pineGrey: "#4a5258", lampOff: "#5a5c64", lampOn: "#ffc94a", lighting: "night" },
   5: { skyTop: "#4a4e66", skyBottom: "#c99a7a", glow: "#ffc9a0", background: "#8a8496", fog: "#958e9e", fogNear: 34, fogFar: 160, snow: "#e6e4ea", snowShade: "#b3aec0", timber: "#7a5236", rail: "#b0b4be", ice: "#b4d6ea", brass: "#d9a347", pine: "#2c5c46", pineGrey: "#6c7072", lampOff: "#6c6a66", lampOn: "#ffcc52", lighting: "sunset" },
};

export const COLORS = {
   background: LOOKS[1].background,
   gold: "#ffd257",
   switchLit: "#facc15",
   dead: "#ef4444",
   branch: "#4ade80",
   gate: "#c4b5fd",
   ghost: "#c4b5fd",
   shield: "#86efac",
} as const;

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
