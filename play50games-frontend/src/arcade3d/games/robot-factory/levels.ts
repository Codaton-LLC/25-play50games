// Robot Factory's five levels: pure data, no React (docs/arcade-levels.md §6.3, core/README.md
// "Levels"). Level 1 is today's shift and must stay byte-for-byte with the rules.ts constants
// (levels.test.ts pins that). Levels 2-3 are the same assembly bay, harder. Levels 4-5 are the
// plan's sorter (GAME 22 "Fast Factory" / "Overdrive") played on that same bay: the cradle is the
// matching station and the scrap bin is the reject, because the built game has one belt pair and
// no second workstation. Nothing here imports rules.ts.
import type { LevelId } from "../../types";

export interface FactoryLevel {
   /** s: the shift clock (the game's own clock; the shell has no durationMs) */
   duration: number;
   /** finished robots that win the shift */
   winQuota: number;
   /** m/s of the first robot, then v1 * growth^(r - 1), capped at vMax */
   v0: number;
   v1: number;
   growth: number;
   vMax: number;
   /** s: the feeder starts carrying every other non-needed part */
   feederT: number;
   /** s: needed parts on k * period, one non-needed part on k * period + half */
   period: number;
   half: number;
   faultyChance: number;
   /** s: minimum gap between faulty spawns before STREAM.LATE_T (the late gap stays the module constant) */
   faultMinInterval: number;
   /**
    * Plan sorter (levels 4-5). The rules are still grab-the-blueprint-part / scrap-the-fault;
    * this only marks the levels whose pressure is the plan's fast sort (README "Levels").
    */
   sorter: boolean;
}

export const LEVELS: Record<LevelId, FactoryLevel> = {
   // today's game: 90 s, quota 5, belt 1.45 → 2.60, a part every 1.6 s, feeder at 60 s
   1: {
      duration: 90, winQuota: 5, v0: 1.45, v1: 1.6, growth: 1.04, vMax: 2.6,
      feederT: 60, period: 1.6, half: 0.8, faultyChance: 0.18, faultMinInterval: 3.5, sorter: false,
   },
   // Shape Sort: the belt ramps faster, the feeder joins at 45 s, 6 robots in 120 s
   2: {
      duration: 120, winQuota: 6, v0: 1.45, v1: 1.75, growth: 1.05, vMax: 2.6,
      feederT: 45, period: 1.6, half: 0.8, faultyChance: 0.18, faultMinInterval: 3.5, sorter: false,
   },
   // Color + Shape: the feeder joins at 35 s and more of the distractors are faulty; 7 robots
   3: {
      duration: 120, winQuota: 7, v0: 1.45, v1: 1.75, growth: 1.05, vMax: 2.6,
      feederT: 35, period: 1.6, half: 0.8, faultyChance: 0.22, faultMinInterval: 3.5, sorter: false,
   },
   // Fast Factory (plan sorter): top speed 3.0 m/s, faults at least 2.8 s apart, 9 robots
   4: {
      duration: 120, winQuota: 9, v0: 1.45, v1: 1.75, growth: 1.05, vMax: 3,
      feederT: 35, period: 1.6, half: 0.8, faultyChance: 0.22, faultMinInterval: 2.8, sorter: true,
   },
   // Overdrive (plan sorter): a part every 1.4 s, one in four faulty, top speed 3.0, 11 robots
   5: {
      duration: 120, winQuota: 11, v0: 1.45, v1: 1.75, growth: 1.05, vMax: 3,
      feederT: 35, period: 1.4, half: 0.7, faultyChance: 0.25, faultMinInterval: 2.8, sorter: true,
   },
};
