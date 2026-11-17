// Plate Bounce Arena's five tables: pure data. One toy pinball table in the Pinball Hall and five
// configurations of it (the card's levels); table.ts places each one's pieces and objectives.
import type { LevelId } from "@/arcade3d/types";

export interface PinLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   /** level 5: Rollo; the win is his defeat */
   boss: boolean;
}

export const LEVELS: Record<LevelId, PinLevel> = {
   1: { id: 1, name: "Practice Table", durationMs: 300_000, starTargetMs: 90_000, boss: false },
   2: { id: 2, name: "Mushroom Garden", durationMs: 330_000, starTargetMs: 110_000, boss: false },
   3: { id: 3, name: "Ice Table", durationMs: 360_000, starTargetMs: 120_000, boss: false },
   4: { id: 4, name: "Multiball", durationMs: 390_000, starTargetMs: 140_000, boss: false },
   5: { id: 5, name: "Rollo's Table", durationMs: 420_000, starTargetMs: 180_000, boss: true },
};
