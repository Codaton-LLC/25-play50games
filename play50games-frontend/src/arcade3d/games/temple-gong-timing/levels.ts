// Temple Gong Timing's five levels: pure data (no React, no three.js). The design card
// (docs/menu2-super/world-3-wild-temples.md "36 Temple Gong Timing"): a rhythm game in a ruined temple
// arena, the World 3 motif as the playable song. chart.ts builds each level's stage and chart.
import type { LevelId } from "../../types";

export interface GongLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   bpm: number;
   /** gongs round the stage */
   gongs: number;
   /** the clear star: accuracy at or over this (0..1); level 5 clears on Coilstone's defeat */
   accuracy: number;
   /** the third star: a score at or over this */
   scoreTarget: number;
   /** the second star: catch this many echo orbs */
   echoTarget: number;
   /** rings appear this many beats before their note (L1: 4, the card) */
   leadBeats: number;
   /** L2: lantern pillars call a 4-note pattern, you answer it with no rings */
   callResponse: boolean;
   /** L3: the gongs orbit the stage (rad/s) */
   orbit: number;
   /** L4 on: off-beat shockwaves to jump */
   shockwaves: boolean;
   /** level 5: Coilstone; the run ends on its defeat or at the cap */
   boss: boolean;
   /** level 5's cap (ms); levels 1-4 end with their song */
   capMs: number;
}

export const LEVELS: Record<LevelId, GongLevel> = {
   1: { id: 1, name: "Slow Beat", bpm: 96, gongs: 4, accuracy: 0.7, scoreTarget: 9_300, echoTarget: 44, leadBeats: 4, callResponse: false, orbit: 0, shockwaves: false, boss: false, capMs: 0 },
   2: { id: 2, name: "Alternating Gongs", bpm: 104, gongs: 6, accuracy: 0.75, scoreTarget: 8_700, echoTarget: 43, leadBeats: 3, callResponse: true, orbit: 0, shockwaves: false, boss: false, capMs: 0 },
   3: { id: 3, name: "Moving Targets", bpm: 112, gongs: 6, accuracy: 0.8, scoreTarget: 8_100, echoTarget: 40, leadBeats: 3, callResponse: false, orbit: (2 * Math.PI) / 28, shockwaves: false, boss: false, capMs: 0 },
   4: { id: 4, name: "Fast Rhythm", bpm: 124, gongs: 8, accuracy: 0.85, scoreTarget: 11_500, echoTarget: 52, leadBeats: 2, callResponse: false, orbit: 0, shockwaves: true, boss: false, capMs: 0 },
   5: { id: 5, name: "Perfect Timing", bpm: 120, gongs: 6, accuracy: 0.9, scoreTarget: 17_500, echoTarget: 70, leadBeats: 2, callResponse: true, orbit: 0, shockwaves: true, boss: true, capMs: 240_000 },
};
