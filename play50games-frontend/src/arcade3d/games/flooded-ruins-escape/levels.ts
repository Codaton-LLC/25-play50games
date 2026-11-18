// Flooded Ruins Escape's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One drowned temple (ruins.ts builds each level's chambers, levers and water) and five
// configurations after the approved design card (docs/menu2-super/world-2-sky-and-sea.md, game 3):
// L1 teaches flooding up, draining down and the tide; L2 links chambers; L3 is the spiral valve
// shaft; L4 is the fast tide with the underwater shortcut; L5 is the boss, Umbra Roller.
import type { LevelId } from "@/arcade3d/types";

export interface RuinLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked). Also the level's timeBaseMs */
   durationMs: number;
   /**
    * The storm tide, the escape clock: it rises from `y0` at `rate` m/s once it starts (at the
    * checkpoint `startCheckpoint`, or `delayMs` into the run when that is -1), up to `maxY`.
    * It only ever ends a life (and the run once it covers the checkpoint), so it never makes a finish faster.
    */
   tide: { rate: number; y0: number; startCheckpoint: number; delayMs: number; maxY: number };
   /** level 5 fights Umbra Roller (progression.ts UMBRA_ROLLER) */
   boss: boolean;
}

export const LEVELS: Record<LevelId, RuinLevel> = {
   // the tide waits for beat 3 (the switchbacks), as the card's "the tide pauses while a lever puzzle is active"
   1: { id: 1, name: "Drain Entry", durationMs: 180_000, tide: { rate: 0.25, y0: -2, startCheckpoint: 2, delayMs: 0, maxY: 40 }, boss: false },
   2: { id: 2, name: "Pipe Maze", durationMs: 210_000, tide: { rate: 0.32, y0: 0, startCheckpoint: 3, delayMs: 0, maxY: 50 }, boss: false },
   3: { id: 3, name: "Valve Shaft", durationMs: 240_000, tide: { rate: 0.4, y0: -9, startCheckpoint: -1, delayMs: 20_000, maxY: 60 }, boss: false },
   4: { id: 4, name: "Flood Rise", durationMs: 270_000, tide: { rate: 0.6, y0: -10, startCheckpoint: -1, delayMs: 6_000, maxY: 60 }, boss: false },
   // the tide of phase 3 starts with the phase (rules.ts startTide on the boss's phase change)
   5: { id: 5, name: "Final Escape", durationMs: 300_000, tide: { rate: 0.8, y0: -12, startCheckpoint: -2, delayMs: 0, maxY: 60 }, boss: true },
};
