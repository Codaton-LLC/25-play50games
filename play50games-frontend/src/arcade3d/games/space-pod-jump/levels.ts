// Space Pod Jump's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One little star system, five configurations of the same verb (ORBIT, the design card): planetoids,
// moons and station pods in a plane, patched-conic gravity (only the nearest body pulls), and a dock to
// reach. system.ts builds each level's bodies and props.
import type { LevelId } from "@/arcade3d/types";

export interface PodLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this (ms; the card's L1 50 s) */
   starTargetMs: number;
   /** level 5: the Orbit Warden */
   boss: boolean;
}

export const LEVELS: Record<LevelId, PodLevel> = {
   1: { id: 1, name: "Dock", durationMs: 120_000, starTargetMs: 50_000, boss: false },
   2: { id: 2, name: "Pod Line", durationMs: 150_000, starTargetMs: 70_000, boss: false },
   3: { id: 3, name: "Satellite Field", durationMs: 160_000, starTargetMs: 75_000, boss: false },
   4: { id: 4, name: "Zero-G Gap", durationMs: 170_000, starTargetMs: 80_000, boss: false },
   5: { id: 5, name: "Orbital Peak", durationMs: 260_000, starTargetMs: 130_000, boss: true },
};
