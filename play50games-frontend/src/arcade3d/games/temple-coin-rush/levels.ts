// Temple Coin Rush's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One collapsing temple, five configurations of the same verb (PAY, the design card): a three-lane
// auto-run along -z with a boulder at your heels, coins to grab, and a toll gate every 12-18 s that
// splits the path into a paid fast lane and a free slow lane. temples.ts builds each level's course.
import type { LevelId } from "@/arcade3d/types";

export interface TempleLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run ("timeup", scored like a lost run) */
   durationMs: number;
   /** the auto-run speed (m/s): the card's 8 m/s on level 1 rising to 11 m/s on level 5 */
   speed: number;
   /** the par time (ms): the time bonus is one point per 0.1 s under it */
   parMs: number;
   /** the finish bonus (points) */
   finishBonus: number;
   /** the third star: finish with at least this many banked coins */
   bankTarget: number;
   /** level 5: Coilstone, the Temple Serpent, replaces the boulder */
   boss: boolean;
}

export const LEVELS: Record<LevelId, TempleLevel> = {
   1: { id: 1, name: "Temple Entry", durationMs: 120_000, speed: 8, parMs: 58_000, finishBonus: 150, bankTarget: 20, boss: false },
   2: { id: 2, name: "Coin Hall", durationMs: 130_000, speed: 9, parMs: 64_000, finishBonus: 200, bankTarget: 30, boss: false },
   3: { id: 3, name: "Broken Floors", durationMs: 140_000, speed: 9.5, parMs: 66_000, finishBonus: 250, bankTarget: 35, boss: false },
   4: { id: 4, name: "Rolling Hazards", durationMs: 150_000, speed: 10.5, parMs: 66_000, finishBonus: 300, bankTarget: 40, boss: false },
   5: { id: 5, name: "Temple Sprint", durationMs: 240_000, speed: 11, parMs: 95_000, finishBonus: 400, bankTarget: 30, boss: true },
};
