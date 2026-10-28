import type { LevelId } from "../../types";
export interface FactoryLevel {
   id: LevelId;
   name: string;
   durationMs: number;
   targetMs: number;
   cells: number;
   junctions: number;
   reverse: boolean;
   arms: boolean;
   lasers: boolean;
   boss: boolean;
}
export const LEVELS: Record<LevelId, FactoryLevel> = {
   1: { id: 1, name: "Assembly Start", durationMs: 90000, targetMs: 45000, cells: 2, junctions: 2, reverse: false, arms: false, lasers: false, boss: false },
   2: { id: 2, name: "Conveyor Hall", durationMs: 110000, targetMs: 60000, cells: 3, junctions: 3, reverse: true, arms: false, lasers: false, boss: false },
   3: { id: 3, name: "Robot Arms", durationMs: 120000, targetMs: 65000, cells: 3, junctions: 3, reverse: false, arms: true, lasers: false, boss: false },
   4: { id: 4, name: "Laser Line", durationMs: 140000, targetMs: 80000, cells: 3, junctions: 4, reverse: true, arms: true, lasers: true, boss: false },
   5: { id: 5, name: "Factory Overdrive", durationMs: 240000, targetMs: 170000, cells: 3, junctions: 4, reverse: true, arms: true, lasers: true, boss: true },
};
