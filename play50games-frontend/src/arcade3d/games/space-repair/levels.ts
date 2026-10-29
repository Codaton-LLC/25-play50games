// Pure level data. Its own station layout per level; the same 30 tickets and scoring opportunity on every level.
import type { LevelId } from "@/arcade3d/types";

/**
 * Where a level's repairs happen (rules.ts STATIONS): "bay" today's docking ring, "power" an oval round
 * a power spine with solar arrays north and south, "comms" a wide ring round the big dish with antenna
 * masts outside, "platform" a square open deck, "emergency" the ring turned half a pod with sealed
 * bulkheads between the docks. Level 1 has no `station` (today's bay).
 */
export type StationKind = "bay" | "power" | "comms" | "platform" | "emergency";

export interface SpaceRepairLevel {
   times: readonly number[];
   duration: number;
   speeds: readonly number[];
   periods: readonly number[];
   arcs: readonly number[];
   lock: number;
   station?: StationKind;
}

const TIMES = [6, 12, 18, 24, 30, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 83, 86, 89, 92, 95, 98, 101, 104, 107, 110, 113, 116, 119];
export const LEVELS: Record<LevelId, SpaceRepairLevel> = {
   1: { times: TIMES, duration: 120, speeds: [1, 1.2, 1.4], periods: [1.2, 1, 0.8], arcs: [60, 45, 35], lock: 0.5 },
   2: { times: TIMES, duration: 120, speeds: [1.2, 1.4, 1.6], periods: [1.2, 1, 0.8], arcs: [59, 44, 34], lock: 0.52, station: "power" },
   3: { times: TIMES, duration: 120, speeds: [1.4, 1.7, 2], periods: [1.2, 1, 0.8], arcs: [58, 43, 33], lock: 0.54, station: "comms" },
   4: { times: TIMES, duration: 120, speeds: [1.6, 1.9, 2.3], periods: [1.2, 1, 0.8], arcs: [57, 42, 32], lock: 0.56, station: "platform" },
   5: { times: TIMES, duration: 120, speeds: [1.8, 2.2, 2.6], periods: [1.2, 1, 0.8], arcs: [56, 41, 31], lock: 0.6, station: "emergency" },
};
