import type { LevelId } from "../../types";
export interface TempleLevel { id: LevelId; name: string; height: number; lanterns: number; targetMs: number; durationMs: number; emberMs: number; }
export const LEVELS: Record<LevelId, TempleLevel> = {
   1: { id: 1, name: "Temple Gate", height: 12, lanterns: 9, targetMs: 70000, durationMs: 180000, emberMs: 8000 },
   2: { id: 2, name: "Lantern Hall", height: 20, lanterns: 12, targetMs: 95000, durationMs: 210000, emberMs: 8000 },
   3: { id: 3, name: "Balcony Climb", height: 28, lanterns: 15, targetMs: 120000, durationMs: 240000, emberMs: 8000 },
   4: { id: 4, name: "Night Temple", height: 36, lanterns: 18, targetMs: 145000, durationMs: 270000, emberMs: 6000 },
   5: { id: 5, name: "Golden Roof", height: 40, lanterns: 21, targetMs: 180000, durationMs: 360000, emberMs: 8000 },
};
