// Ghost Vacuum's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One mansion, five configurations. Level 1 is today's game and must never change: gold ghosts
// 5, 8, 11, big ghosts 9 and 10, speed x1, exposure 0.4 s (big 0.8 s), stun 2 s, active cap 3
// before 40 s then 6, ordinary ghosts speed up at 60 s. levels.test.ts pins it to rules.ts.
//
// Every level keeps the twelve ghosts, the release schedule (last ghost at 90 s), the 120 s clock and
// the night look. A harder level makes more ghosts gold (faster, +200 each, so a harder level offers
// more points) and more of them big (slower to stun), and the ghosts faster, the stun shorter, the
// light slower, the early cap higher and the late speed-up sooner. Ghost 11 stays gold on every
// level, so the earliest win stays 90 s + exposure + 1 s pull (README "Levels").
import type { LevelId } from "@/arcade3d/types";

export interface GhostLevel {
   /** ids of the gold ghosts (always includes 11) */
   gold: readonly number[];
   /** ids of the big ghosts (disjoint from gold) */
   big: readonly number[];
   /** factor on every ghost speed */
   speed: number;
   /** continuous light needed to stun an ordinary or gold ghost, seconds */
   exposure: number;
   /** the same for a big ghost */
   bigExposure: number;
   /** how long a stun lasts before a pull must start, seconds */
   stun: number;
   /** active ghosts allowed before `capAt` seconds (6 afterwards) */
   earlyCap: number;
   capAt: number;
   /** from this second ordinary ghosts use their late (faster) speeds */
   lateAt: number;
}

export const LEVELS: Record<LevelId, GhostLevel> = {
   // Living Room: today's game.
   1: { gold: [5, 8, 11], big: [9, 10], speed: 1, exposure: 0.4, bigExposure: 0.8, stun: 2, earlyCap: 3, capAt: 40, lateAt: 60 },
   // Library: one more gold ghost, a little faster, a shorter stun.
   2: { gold: [2, 5, 8, 11], big: [9, 10], speed: 1.1, exposure: 0.45, bigExposure: 0.9, stun: 1.8, earlyCap: 3, capAt: 35, lateAt: 50 },
   // Kitchen: five gold, four ghosts at once early.
   3: { gold: [2, 5, 7, 8, 11], big: [9, 10], speed: 1.2, exposure: 0.5, bigExposure: 1, stun: 1.7, earlyCap: 4, capAt: 30, lateAt: 45 },
   // Attic: six gold, a third big ghost.
   4: { gold: [2, 4, 5, 7, 8, 11], big: [6, 9, 10], speed: 1.3, exposure: 0.5, bigExposure: 1, stun: 1.6, earlyCap: 4, capAt: 25, lateAt: 40 },
   // Whole Mansion: seven gold, four big, the fastest ghosts.
   5: { gold: [1, 2, 4, 5, 7, 8, 11], big: [3, 6, 9, 10], speed: 1.4, exposure: 0.55, bigExposure: 1.1, stun: 1.5, earlyCap: 4, capAt: 20, lateAt: 30 },
};
