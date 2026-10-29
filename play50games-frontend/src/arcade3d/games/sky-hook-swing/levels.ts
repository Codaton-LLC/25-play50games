// Sky Hook Swing's five levels: pure data (no React, no three.js). One airship-dock course and five
// configurations of the same verb (aim, reel, release). course.ts places each level's rings.
import type { LevelId } from "@/arcade3d/types";

export interface SwingLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms). Reaching it ends the run "timeup" (unranked). */
   durationMs: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   /** level 5: the Gust Galleon. The bell rings only once it is down. */
   boss: boolean;
}

export const LEVELS: Record<LevelId, SwingLevel> = {
   1: { id: 1, name: "Single Swing", durationMs: 100_000, starTargetMs: 45_000, boss: false },
   2: { id: 2, name: "Double Swing", durationMs: 140_000, starTargetMs: 70_000, boss: false },
   3: { id: 3, name: "Moving Anchors", durationMs: 180_000, starTargetMs: 90_000, boss: false },
   4: { id: 4, name: "Long Gaps", durationMs: 200_000, starTargetMs: 100_000, boss: false },
   5: { id: 5, name: "Sky Swing Master", durationMs: 240_000, starTargetMs: 150_000, boss: true },
};
