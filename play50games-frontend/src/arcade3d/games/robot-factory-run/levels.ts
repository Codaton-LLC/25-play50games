// Robot Factory Run's five levels (the card): caps, cells to charge, star targets, the twist flags.
// The floors themselves are factory.ts.
import type { LevelId } from "@/arcade3d/types";

export interface FactoryLevel {
   id: LevelId;
   name: string;
   /** the shift's length: the run clock's cap (ms); reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the third star: the submitted time at or under this */
   targetMs: number;
   boss: boolean;
}

export const LEVELS: Record<LevelId, FactoryLevel> = {
   1: { id: 1, name: "Assembly Start", durationMs: 90_000, targetMs: 30_000, boss: false },
   2: { id: 2, name: "Conveyor Hall", durationMs: 110_000, targetMs: 40_000, boss: false },
   3: { id: 3, name: "Robot Arms", durationMs: 120_000, targetMs: 40_000, boss: false },
   4: { id: 4, name: "Laser Line", durationMs: 140_000, targetMs: 45_000, boss: false },
   5: { id: 5, name: "Factory Overdrive", durationMs: 240_000, targetMs: 90_000, boss: true },
};
