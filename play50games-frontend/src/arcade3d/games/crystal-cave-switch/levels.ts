// Crystal Cave Switch's five levels: pure data (no React, no three.js). The design card
// (docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md "GAME 44 — Crystal Cave Switch"): a
// crystal cave of linked rooms; each room's gate opens when its crystals are struck in the colour order
// its beacon shows. course.ts lays each level's rooms; these are the numbers every level shares.
import type { LevelId } from "../../types";

export interface CaveLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this (the card: 75 s up to 150 s) */
   targetMs: number;
   /** L2 on: a moving slab carries you to a crystal island */
   moving: boolean;
   /** L3 on: hidden crystals glow only when you are near */
   hidden: boolean;
   /** L4 on: a started sequence must finish in time; decoy crystals reset it */
   timed: boolean;
   /** L5: the Hollow Prism; the win is its defeat */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CaveLevel> = {
   1: { id: 1, name: "Two Crystals", durationMs: 180_000, targetMs: 75_000, moving: false, hidden: false, timed: false, boss: false },
   2: { id: 2, name: "Three Sequence", durationMs: 210_000, targetMs: 90_000, moving: true, hidden: false, timed: false, boss: false },
   3: { id: 3, name: "Hidden Crystal", durationMs: 240_000, targetMs: 105_000, moving: false, hidden: true, timed: false, boss: false },
   4: { id: 4, name: "Timed Sequence", durationMs: 270_000, targetMs: 120_000, moving: false, hidden: true, timed: true, boss: false },
   5: { id: 5, name: "Crystal Master", durationMs: 360_000, targetMs: 150_000, moving: true, hidden: true, timed: true, boss: true },
};
