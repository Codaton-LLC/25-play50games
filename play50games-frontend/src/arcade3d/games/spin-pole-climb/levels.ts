// Spin Pole Climb's five levels: pure data (no React, no three.js). The design card
// (docs/menu2-super/world-3-wild-temples.md "34 Spin Pole Climb"): ancient stone poles climbed by
// running round their spiral stairs. course.ts places each level's poles, stairs and hazards.
import type { LevelId } from "../../types";

export interface SpinLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the goal cap's height (m) */
   height: number;
   /** the third star: the submitted time at or under this (the card: L1 60 s to L5 170 s) */
   targetMs: number;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** L2 on: sweeper bars on their own spin */
   sweepers: boolean;
   /** L3: poles flip direction every 6 s (a 1 s glyph flash first) */
   reversing: boolean;
   /** L4: one wide tower with four stairs at different pitches; spike collars ride up and down */
   tower: boolean;
   /** level 5: Coilstone, wound round the central pole; the win is the gong, not a cap */
   boss: boolean;
}

export const LEVELS: Record<LevelId, SpinLevel> = {
   1: { id: 1, name: "Slow Poles", height: 18, targetMs: 60_000, durationMs: 150_000, sweepers: false, reversing: false, tower: false, boss: false },
   2: { id: 2, name: "Twin Poles", height: 24, targetMs: 85_000, durationMs: 180_000, sweepers: true, reversing: false, tower: false, boss: false },
   3: { id: 3, name: "Mixed Rotation", height: 30, targetMs: 110_000, durationMs: 210_000, sweepers: true, reversing: true, tower: false, boss: false },
   4: { id: 4, name: "Fast Tower", height: 36, targetMs: 130_000, durationMs: 240_000, sweepers: false, reversing: false, tower: true, boss: false },
   5: { id: 5, name: "Spin Master", height: 18, targetMs: 170_000, durationMs: 300_000, sweepers: false, reversing: false, tower: false, boss: true },
};
