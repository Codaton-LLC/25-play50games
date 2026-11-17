// Paint the Platforms' five levels: pure data (no React, no three.js). The design card
// (docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md "GAME 25 — Paint the Platforms"): an
// area-painting challenge; every tile the hero runs over takes the hero's colour, and the level is won
// when the target share of the arena is painted (30 % up to 80 %) before the card's timer (60 s up to
// 120 s) runs out. course.ts lays each level's platforms; these are the numbers every level shares.
import type { LevelId } from "../../types";

export interface PaintLevel {
   id: LevelId;
   /** the level's name (meta.ts titles) */
   name: string;
   /** the share of the arena's tiles to paint (the card: 30 %, 40 %, 50 %, 65 %, 80 %) */
   goal: number;
   /** the card's timer (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this */
   targetMs: number;
   /** L2 on: grey blots crawl their loops and wipe the paint they cross */
   blots: boolean;
   /** L3 on: moving tile rafts shuttle between the islands (their tiles count) */
   moving: boolean;
   /** L4 on: the grey roller sweeps a lane of the main arena after a 1.5 s glow */
   roller: boolean;
   /** L5: the Paint Blob; the win is the target share painted AND the Blob popped */
   boss: boolean;
}

export const LEVELS: Record<LevelId, PaintLevel> = {
   1: { id: 1, name: "First Strokes", goal: 0.3, durationMs: 60_000, targetMs: 15_000, blots: false, moving: false, roller: false, boss: false },
   2: { id: 2, name: "Grey Blots", goal: 0.4, durationMs: 75_000, targetMs: 25_000, blots: true, moving: false, roller: false, boss: false },
   3: { id: 3, name: "Moving Tiles", goal: 0.5, durationMs: 90_000, targetMs: 40_000, blots: true, moving: true, roller: false, boss: false },
   4: { id: 4, name: "Time Attack", goal: 0.65, durationMs: 105_000, targetMs: 65_000, blots: true, moving: false, roller: true, boss: false },
   5: { id: 5, name: "80% Master", goal: 0.8, durationMs: 120_000, targetMs: 75_000, blots: true, moving: false, roller: false, boss: true },
};
