// Jungle Bridge Run level configs (Menu 1 game 46).
// Track sections, speed, duration and lighting per level. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export type PatternKind = "gap" | "vine" | "log" | "bridge" | "pillar" | "lava";

export interface JungleLevel {
   sections: number;
   speed: number;
   gemsPerSection: number;
   patterns: ReadonlyArray<PatternKind>;
   logSpeed: number;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, JungleLevel> = {
   1: { sections: 3, speed: 6.0, gemsPerSection: 3, patterns: ["gap", "pillar"], logSpeed: 0, durationMs: 75_000, lighting: "day", background: "#86efac", fogFar: 70 },
   2: { sections: 5, speed: 6.5, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine"], logSpeed: 0, durationMs: 90_000, lighting: "day", background: "#4ade80", fogFar: 60 },
   3: { sections: 7, speed: 7.0, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine", "log"], logSpeed: 2.5, durationMs: 110_000, lighting: "day", background: "#22c55e", fogFar: 55 },
   4: { sections: 9, speed: 7.8, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine", "log"], logSpeed: 3.2, durationMs: 120_000, lighting: "sunset", background: "#a16207", fogFar: 45 },
   5: { sections: 12, speed: 8.4, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine", "log", "lava"], logSpeed: 3.6, durationMs: 120_000, lighting: "sunset", background: "#7f1d1d", fogFar: 40 },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Jungle Path",
   2: "Rope Bridges",
   3: "Waterfall",
   4: "Ancient Temple",
   5: "Volcano Jungle",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Three sections, wide gaps.",
   2: "Only one lane has planks.",
   3: "Logs roll across the path.",
   4: "Faster, closer.",
   5: "Twelve sections and lava vents.",
};
