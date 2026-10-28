// Wind Tunnel Escape's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One storm tunnel and five configurations of the same verb (REDIRECT, the design card): rooms of
// fans you turn and vents you switch, so the currents chain across gaps, up shafts and out of the
// exit before the violet storm front catches you. tunnel.ts builds each level's rooms; these are the
// numbers (timer, star target, storm, twist flags).
import type { LevelId } from "@/arcade3d/types";

export interface WindLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked); also the time base */
   durationMs: number;
   /** the third star: the submitted time at or under this (the card's targets) */
   starTargetMs: number;
   /** the storm front: the room it wakes in, how far behind that room's entry it starts (m), its speed (m/s) */
   storm: { fromRoom: number; behind: number; speed: number };
   /** level 5: the Gale Engine (the arena's gate opens only once it is down) */
   boss: boolean;
}

export const LEVELS: Record<LevelId, WindLevel> = {
   // L1: the card's "the storm front appears only at the end, as a slow chase"
   1: { id: 1, name: "Gentle Wind", durationMs: 120_000, starTargetMs: 60_000, storm: { fromRoom: 2, behind: 26, speed: 1.6 }, boss: false },
   2: { id: 2, name: "Cross Wind", durationMs: 150_000, starTargetMs: 90_000, storm: { fromRoom: 0, behind: 34, speed: 1.4 }, boss: false },
   3: { id: 3, name: "Vertical Lift", durationMs: 180_000, starTargetMs: 110_000, storm: { fromRoom: 0, behind: 34, speed: 1.2 }, boss: false },
   4: { id: 4, name: "Moving Fans", durationMs: 210_000, starTargetMs: 130_000, storm: { fromRoom: 0, behind: 34, speed: 1.5 }, boss: false },
   5: { id: 5, name: "Storm Tunnel", durationMs: 300_000, starTargetMs: 180_000, storm: { fromRoom: 0, behind: 34, speed: 1.4 }, boss: true },
};
