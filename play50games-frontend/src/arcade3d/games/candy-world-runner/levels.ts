// Candy World Runner's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One candy kingdom and five configurations of the same verb (SUGAR SIZE, the design card): an
// auto-forward runner on three lanes where you eat candy coins to grow (Small -> Normal -> Big) and
// sugar-burn roll to shrink, so you arrive at each obstacle at the size it needs. course.ts builds each
// level's lanes; these are the numbers.
import type { LevelId } from "@/arcade3d/types";

export interface CandyLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked); also the time base */
   durationMs: number;
   /** the run speed (m/s): the card's 9 m/s on level 1 up to 14 m/s on level 5 */
   speed: number;
   /** the third star: at most this many wrong-size hits (the card: 1, and 0 on level 5) */
   maxMisses: number;
   /** level 5: King Bonbon */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CandyLevel> = {
   1: { id: 1, name: "Candy Lane", durationMs: 120_000, speed: 9, maxMisses: 1, boss: false },
   2: { id: 2, name: "Cookie Road", durationMs: 130_000, speed: 10, maxMisses: 1, boss: false },
   3: { id: 3, name: "Sorbet Slopes", durationMs: 140_000, speed: 11, maxMisses: 1, boss: false },
   4: { id: 4, name: "Gummy Grove", durationMs: 150_000, speed: 12.5, maxMisses: 1, boss: false },
   5: { id: 5, name: "Bonbon Palace", durationMs: 200_000, speed: 14, maxMisses: 0, boss: true },
};
