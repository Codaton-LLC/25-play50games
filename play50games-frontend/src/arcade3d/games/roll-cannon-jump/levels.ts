// Roll Cannon Jump's five levels: pure data (no React, no three.js). The design card
// (docs/menu2-super/world-1-ember-heights.md "43 Roll Cannon Jump"): a colour-drained big top crossed
// by firing yourself cannon to cannon; level 5 is the Ashbag boss fight. The layouts are show.ts.
import type { LevelId } from "@/arcade3d/types";

export interface CannonLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the show time: the run clock's cap (ms). Reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   /** the golf badge on the star screen: finish in at most this many shots (L1 par 6) */
   parShots: number;
   /** how much of the arc the aim preview draws: all of it on L1, half on L2-L3, 30 % on L4-L5 */
   preview: number;
   /** level 5: Ashbag, the Smoke Blimp (menu2/boss); the win is its defeat, not the finish ring */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CannonLevel> = {
   1: { id: 1, name: "Short Launch", durationMs: 75_000, starTargetMs: 20_000, parShots: 6, preview: 1, boss: false },
   2: { id: 2, name: "Angle Practice", durationMs: 90_000, starTargetMs: 26_000, parShots: 8, preview: 0.5, boss: false },
   3: { id: 3, name: "Moving Pads", durationMs: 110_000, starTargetMs: 34_000, parShots: 11, preview: 0.5, boss: false },
   4: { id: 4, name: "Long Distance", durationMs: 125_000, starTargetMs: 34_000, parShots: 8, preview: 0.3, boss: false },
   5: { id: 5, name: "Big Top Finale", durationMs: 200_000, starTargetMs: 60_000, parShots: 16, preview: 0.3, boss: true },
};

/** The game's level config type (the shell's useLevel<CannonLevel>). */
export type RollLevel = CannonLevel;
