// Pure level data. Level 1 is the original six-hole course, including all timing.
import type { LevelId } from "../../types";

export interface MiniGolfLevel {
   holes: number;
   /** Harder courses require every cup for a win; L1 preserves legacy pick-up wins. */
   requireAllCups?: boolean;
   vMax: number;
   pickUpOver: number;
   capS: number;
   turntableOmega: number;
   windmillPeriod: number;
   cupRadius: number;
   captureSpeed: number;
   /**
    * The course's layouts in order (course.ts SPECS indices); omitted = the first `holes` (levels 1
    * and 5). Levels 2-4 play their own six: ramp holes, windmill holes, neon bank holes.
    */
   course?: readonly number[];
}

export const LEVELS: Record<LevelId, MiniGolfLevel> = {
   1: { holes: 6, vMax: 4.5, pickUpOver: 4, capS: 600, turntableOmega: 1.2, windmillPeriod: 6, cupRadius: 0.1, captureSpeed: 1.2 },
   // Ramp Course: Ramp Jump, Ramp Dogleg, Dogleg, Ramp Island, Turntable Hill, First Putt (par 17)
   2: { holes: 6, requireAllCups: true, vMax: 5, pickUpOver: 3, capS: 480, turntableOmega: 1.2, windmillPeriod: 6, cupRadius: 0.1, captureSpeed: 1.2, course: [2, 9, 1, 10, 5, 0] },
   // Windmill Course: Windmill, First Putt, Windmill Gate, Dogleg, Windmill Pond, Turntable Hill (par 17)
   3: { holes: 6, requireAllCups: true, vMax: 5, pickUpOver: 3, capS: 480, turntableOmega: 1.6, windmillPeriod: 5, cupRadius: 0.1, captureSpeed: 1.2, course: [3, 0, 11, 1, 12, 5] },
   // Neon Course: First Putt, Neon Zigzag, Split Fairway, Neon Diamond, Twin Banks, Final Needle (par 17)
   4: { holes: 6, requireAllCups: true, vMax: 5, pickUpOver: 3, capS: 480, turntableOmega: 1.6, windmillPeriod: 5, cupRadius: 0.08, captureSpeed: 1, course: [0, 13, 6, 14, 7, 8] },
   5: { holes: 9, requireAllCups: true, vMax: 5, pickUpOver: 2, capS: 600, turntableOmega: 1.6, windmillPeriod: 5, cupRadius: 0.08, captureSpeed: 1 },
};

export const TITLES = ["Garden Course", "Ramp Course", "Windmill Course", "Neon Course", "Master Course"] as const;
export const DESCRIPTIONS: Record<LevelId, string> = {
   1: "The original six holes, par 17. Read the slopes, ramps and tunnels.",
   2: "Six holes with stronger putts, fewer attempts and eight minutes.",
   3: "Faster windmill blades and turntable: choose your timing.",
   4: "Smaller cups demand a slower, more accurate finish.",
   5: "Nine holes, three new layouts and a strict par + 2 stroke limit.",
};

export const LEVEL_LIMITS: Record<LevelId, import("../../types").ScoringRules> = Object.fromEntries(
   ([1, 2, 3, 4, 5] as const).map(id => [id, {
      kind: "points", unitLabel: "pts", display: "int",
      maxScore: id === 5 ? 6200 : 4100,
      minDurationMs: id === 5 ? 24000 : 15000,
      maxDurationMs: LEVELS[id].capS * 1000 + 2000,
      base: 1200, maxPointsPerSec: id === 5 ? 210 : 200,
   }])
) as Record<LevelId, import("../../types").ScoringRules>;
