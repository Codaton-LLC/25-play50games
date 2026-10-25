// Tower Climb's five levels: pure data (no React, no three.js). Level 1 is today's game.
// docs/arcade-levels.md §6.3, core/README.md "Levels". The plan's height targets are the clear
// scores in meta.ts; the 30-minute cap stays, because the built tower is an endless climb.
import type { LevelId } from "@/arcade3d/types";

export interface TowerLevel {
   id: LevelId;
   /** Half-amplitude of a moving slab (m). Level 1 is 0.20; the slab after each checkpoint stays at 0.20. */
   movingTravel: number;
   /** Triangle period (ms). Shorter is faster. Level 1 is 2000. */
   periodMs: number;
   /** Spur presence weight: a pair is tried when the roll is below spurPresent / spurTotal. Level 1 is 1/2. */
   spurPresent: number;
   spurTotal: number;
   /** Ms from the first contact until a spur stops colliding. Never below the 665 ms flight. */
   warningMs: number;
   /** Spring pads placed (0 on levels 1 and 2). */
   springs: number;
   /** Rocket pickups placed (0 before level 4). */
   rockets: number;
   /** Side wind bands (level 5 only). */
   winds: number;
   /** Checkpoint fireworks (level 2's new element; looks only). */
   fireworks: boolean;
}

/** Triangle-wave speed (m/s): the slab covers 2 × travel in each half period. */
export function slabSpeed(travel: number, periodMs: number): number {
   return (4 * travel * 1000) / periodMs;
}

export const LEVELS: Record<LevelId, TowerLevel> = {
   // today's game, unchanged
   1: { id: 1, movingTravel: 0.2, periodMs: 2000, spurPresent: 1, spurTotal: 2, warningMs: 800, springs: 0, rockets: 0, winds: 0, fireworks: false },
   // wider, faster slabs, more spurs, a shorter warning still above the walk-back, fireworks on a checkpoint
   2: { id: 2, movingTravel: 0.4, periodMs: 1800, spurPresent: 2, spurTotal: 3, warningMs: 760, springs: 0, rockets: 0, winds: 0, fireworks: true },
   // spring pads (the new mechanic)
   3: { id: 3, movingTravel: 0.4, periodMs: 1600, spurPresent: 3, spurTotal: 4, warningMs: 740, springs: 8, rockets: 0, winds: 0, fireworks: false },
   // rockets, night
   4: { id: 4, movingTravel: 0.4, periodMs: 1400, spurPresent: 4, spurTotal: 5, warningMs: 730, springs: 12, rockets: 5, winds: 0, fireworks: false },
   // wind, every hazard at its hardest, dramatic light
   5: { id: 5, movingTravel: 0.4, periodMs: 1200, spurPresent: 5, spurTotal: 6, warningMs: 720, springs: 16, rockets: 8, winds: 6, fireworks: false },
};
