import type { LevelId } from "../../types";

export interface WindLevel {
   id: LevelId;
   name: string;
   rooms: number;
   durationMs: number;
   starTargetMs: number;
   crosswinds: boolean;
   lifts: boolean;
   rails: boolean;
   boss: boolean;
}

export const LEVELS: Record<LevelId, WindLevel> = {
   1: { id: 1, name: "Gentle Wind", rooms: 3, durationMs: 150000, starTargetMs: 60000, crosswinds: false, lifts: false, rails: false, boss: false },
   2: { id: 2, name: "Cross Wind", rooms: 4, durationMs: 180000, starTargetMs: 90000, crosswinds: true, lifts: false, rails: false, boss: false },
   3: { id: 3, name: "Vertical Lift", rooms: 4, durationMs: 210000, starTargetMs: 110000, crosswinds: false, lifts: true, rails: false, boss: false },
   4: { id: 4, name: "Moving Fans", rooms: 5, durationMs: 240000, starTargetMs: 130000, crosswinds: true, lifts: false, rails: true, boss: false },
   5: { id: 5, name: "Storm Tunnel", rooms: 4, durationMs: 300000, starTargetMs: 180000, crosswinds: true, lifts: true, rails: false, boss: true },
};
