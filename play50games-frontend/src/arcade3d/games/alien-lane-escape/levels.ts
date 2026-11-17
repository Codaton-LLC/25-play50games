// Alien Lane Escape's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One alien valley and five configurations of the same verb (BREAK LINE OF SIGHT, the design card): a
// three-lane runner with a mothership behind you whose scan lines sweep forward over the track; be in a
// cover's shadow when a line passes. course.ts builds each level's track; these are the numbers.
import type { LevelId } from "@/arcade3d/types";

export interface AlienLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked); also the time base */
   durationMs: number;
   /** the run speed (m/s): the card's 10 m/s on level 1 up to 15 m/s on level 5 */
   speed: number;
   /** the third star: the submitted time at or under this (the card: 55 s on level 1) */
   starTargetMs: number;
   /** level 5: the Mothership */
   boss: boolean;
}

export const LEVELS: Record<LevelId, AlienLevel> = {
   1: { id: 1, name: "Alien Meadow", durationMs: 120_000, speed: 10, starTargetMs: 55_000, boss: false },
   2: { id: 2, name: "Crystal Route", durationMs: 130_000, speed: 11, starTargetMs: 58_000, boss: false },
   3: { id: 3, name: "Meteor Zone", durationMs: 140_000, speed: 12.5, starTargetMs: 58_000, boss: false },
   4: { id: 4, name: "Glow Plants", durationMs: 150_000, speed: 13.5, starTargetMs: 58_000, boss: false },
   5: { id: 5, name: "Planet Escape", durationMs: 200_000, speed: 15, starTargetMs: 80_000, boss: true },
};
