// Energy Core Hunt's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One reactor arena and five configurations of the same verb (COLLECT THE REQUESTED MIX, the card):
// cores of 2 to 5 colours drop into the arena in waves; take exactly the mix the order asks for, then
// leave through the core gate. course.ts builds each level's waves; these are the numbers.
import type { LevelId } from "@/arcade3d/types";

export interface CoreLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the card's timer (ms): the run clock's cap (reaching it ends the run "timeup", unranked); also the time base */
   durationMs: number;
   /** the arena's half size (m) */
   half: number;
   /** the card's active colours and cores to collect */
   colors: number;
   cores: number;
   /** how long a dropped core stays before it fades and drops again elsewhere in its wave (ms) */
   lifeMs: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   /** level 5: the Core Sprite */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CoreLevel> = {
   1: { id: 1, name: "Simple Hunt", durationMs: 60_000, half: 9, colors: 2, cores: 6, lifeMs: 14_000, starTargetMs: 15_000, boss: false },
   2: { id: 2, name: "Mixed Colors", durationMs: 75_000, half: 11, colors: 3, cores: 9, lifeMs: 9_000, starTargetMs: 20_000, boss: false },
   3: { id: 3, name: "Larger Arena", durationMs: 90_000, half: 13, colors: 4, cores: 12, lifeMs: 8_000, starTargetMs: 28_000, boss: false },
   4: { id: 4, name: "Moving Cores", durationMs: 105_000, half: 15, colors: 5, cores: 15, lifeMs: 6_500, starTargetMs: 35_000, boss: false },
   5: { id: 5, name: "Core Master", durationMs: 120_000, half: 16, colors: 5, cores: 20, lifeMs: 6_000, starTargetMs: 60_000, boss: true },
};
