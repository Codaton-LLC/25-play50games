// Ring Jump Challenge's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One sea canyon and five configurations of the same verb (DIVE, the design card
// docs/menu2-super/world-2-sky-and-sea.md #27): leap off a stone column and steer a free-fall down
// the shaft, threading rings. canyon.ts builds each level's rings, orbs and hazards; these are the
// numbers every level shares.
import type { LevelId } from "@/arcade3d/types";

export interface RingLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (no clear, the points so far count) */
   durationMs: number;
   /** the drop (m): from the start column's top down to the sea */
   depth: number;
   /** the shaft's radius (m) where no section narrows it */
   radius: number;
   /**
    * The par time (ms): the third star (land at or under it) and the speed bonus (TIME_PTS per
    * second under it). From the honest bot's time (README "Stars").
    */
   parMs: number;
   /** level 5: Cyclone Ray holds the storm eye; the finish is its tail pad, not the column */
   boss: boolean;
}

export const LEVELS: Record<LevelId, RingLevel> = {
   1: { id: 1, name: "Wide Rings", durationMs: 90_000, depth: 330, radius: 20, parMs: 16_000, boss: false },
   2: { id: 2, name: "Moving Rings", durationMs: 100_000, depth: 420, radius: 20, parMs: 24_000, boss: false },
   3: { id: 3, name: "Updraft Rings", durationMs: 120_000, depth: 520, radius: 22, parMs: 46_000, boss: false },
   4: { id: 4, name: "Fast Route", durationMs: 130_000, depth: 600, radius: 18, parMs: 30_000, boss: false },
   5: { id: 5, name: "Perfect Streak", durationMs: 220_000, depth: 900, radius: 22, parMs: 85_000, boss: true },
};
