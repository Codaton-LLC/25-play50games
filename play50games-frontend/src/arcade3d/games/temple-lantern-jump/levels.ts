// Temple Lantern Jump's five levels: pure data (no React, no three.js). The design card
// (docs/menu2-super/world-3-wild-temples.md "6 Temple Lantern Jump"): a dark temple shaft climbed by
// bouncing on lanterns. The climb's layouts are course.ts.
import type { LevelId } from "../../types";

export interface TempleLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the goal roof's top (m), the card's shaft height */
   height: number;
   /** lanterns on the climb (the card: L1 9) */
   lanterns: number;
   /** the third star: the submitted time at or under this (the card's target times) */
   targetMs: number;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the ember meter (ms of light): 8 s, 6 s on level 4 */
   emberMs: number;
   /** ledges between one lantern and the next, in climb order, then the stretch to the roof (course.ts) */
   gaps: readonly number[];
   /** how many lanterns from the first stand on plain stone only (the lesson: bounce first) */
   plainLanterns: number;
   /** L2: lanterns swing 2 m on chains, period 3 s */
   swing: boolean;
   /** L3: gusts blow lit lanterns out early; wooden balconies crumble 1.2 s after a touch */
   gusts: boolean;
   /** L4: soot bats snuff lit lanterns; bounce one to stun it 4 s */
   bats: number;
   /** fire jets block the express column (L2 on) and pulse in the boss's second phase */
   jets: boolean;
   /** level 5: the Soot Bat Queen; the win is her defeat, not the roof */
   boss: boolean;
}

export const LEVELS: Record<LevelId, TempleLevel> = {
   1: { id: 1, name: "Temple Gate", height: 12, lanterns: 9, targetMs: 70_000, durationMs: 180_000, emberMs: 8_000, gaps: [1, 2, 2, 2, 1, 6, 2, 1, 1], plainLanterns: 2, swing: false, gusts: false, bats: 0, jets: false, boss: false },
   2: { id: 2, name: "Lantern Hall", height: 20, lanterns: 12, targetMs: 95_000, durationMs: 210_000, emberMs: 8_000, gaps: [1, 1, 2, 2, 2, 3, 2, 2, 3, 4, 2, 2], plainLanterns: 1, swing: true, gusts: false, bats: 0, jets: true, boss: false },
   3: { id: 3, name: "Balcony Climb", height: 28, lanterns: 15, targetMs: 120_000, durationMs: 240_000, emberMs: 8_000, gaps: [1, 2, 2, 3, 2, 2, 3, 2, 4, 2, 3, 2, 3, 2, 2], plainLanterns: 1, swing: false, gusts: true, bats: 0, jets: true, boss: false },
   4: { id: 4, name: "Night Temple", height: 36, lanterns: 18, targetMs: 145_000, durationMs: 270_000, emberMs: 6_000, gaps: [1, 2, 3, 2, 3, 4, 2, 3, 3, 2, 4, 3, 2, 3, 4, 2, 3, 2], plainLanterns: 1, swing: false, gusts: false, bats: 3, jets: true, boss: false },
   5: { id: 5, name: "Golden Roof", height: 40, lanterns: 21, targetMs: 180_000, durationMs: 360_000, emberMs: 8_000, gaps: [1, 2, 2, 3, 2, 3, 2, 3, 3, 2, 3, 4, 2, 3, 3, 2, 3, 0, 0, 0, 0], plainLanterns: 1, swing: false, gusts: false, bats: 0, jets: true, boss: true },
};

/** The game's level config type (the shell's useLevel<TempleLevel>). */
export type TempleConfig = TempleLevel;
