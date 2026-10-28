// Roll Cannon Jump's five levels: pure data (no React, no three.js). The design card
// (.handoff/K-m2-cannon/world-1-cards.md "43 Roll Cannon Jump"): a colour-drained circus where the
// hero fires itself cannon-to-cannon toward a finish ring; level 5 is the Ashbag boss fight.
import type { LevelId } from "@/arcade3d/types";

export interface CannonLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the show time: the run clock's cap (ms). Reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this (the card's target time) */
   starTargetMs: number;
   /** the bonus badge, shown like golf: finish at or under this many shots (L1 par is 6) */
   parShots: number;
   /** how much of the fired arc the preview shows: 1 on L1, 0.5 on L2-L3, 0.3 on L4-L5 */
   preview: number;
   /** level 5: Ashbag, the Smoke Blimp (menu2/boss); the win is its defeat, not a ring */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CannonLevel> = {
   // the card: L1 "Short Launch", 75 s cap, 6 cannons, par 6
   1: { id: 1, name: "Short Launch", durationMs: 75_000, starTargetMs: 30_000, parShots: 6, preview: 1, boss: false },
   2: { id: 2, name: "Angle Practice", durationMs: 95_000, starTargetMs: 42_000, parShots: 9, preview: 0.5, boss: false },
   3: { id: 3, name: "Moving Pads", durationMs: 115_000, starTargetMs: 55_000, parShots: 11, preview: 0.5, boss: false },
   4: { id: 4, name: "Long Distance", durationMs: 135_000, starTargetMs: 68_000, parShots: 8, preview: 0.3, boss: false },
   5: { id: 5, name: "Big Top Finale", durationMs: 180_000, starTargetMs: 100_000, parShots: 14, preview: 0.3, boss: true },
};

/** The game's level config type (the shell's useLevel<CannonLevel>). */
export type RollLevel = CannonLevel;
