import type { LevelId } from "../../types";

export interface SnowLevel {
   id: LevelId;
   name: string;
   length: number;
   baseSpeed: number;
   orbs: number;
   starTargetMs: number;
   durationMs: number;
   night: boolean;
}
export const LEVELS: Record<LevelId, SnowLevel> = {
   1: { id: 1, name: "Bunny Hill", length: 650, baseSpeed: 12, orbs: 20, starTargetMs: 45_000, durationMs: 100_000, night: false },
   2: { id: 2, name: "Pine Run", length: 920, baseSpeed: 16, orbs: 25, starTargetMs: 60_000, durationMs: 125_000, night: false },
   3: { id: 3, name: "Frozen Lake", length: 1100, baseSpeed: 20, orbs: 30, starTargetMs: 70_000, durationMs: 145_000, night: false },
   4: { id: 4, name: "Lantern Slope", length: 1300, baseSpeed: 24, orbs: 35, starTargetMs: 80_000, durationMs: 165_000, night: true },
   5: { id: 5, name: "Avalanche Run", length: 1800, baseSpeed: 28, orbs: 40, starTargetMs: 100_000, durationMs: 210_000, night: false },
};
