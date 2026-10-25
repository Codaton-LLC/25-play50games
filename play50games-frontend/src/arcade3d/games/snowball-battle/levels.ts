// Snowball Battle's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One 24×18 yard, five configurations. Level 1 is today's game and must never change: the same
// rivals, the same 90 s clock, the same throw curve. Those numbers are the rules.ts constants;
// levels.test.ts pins them.
//
// The plan's stationary-target gallery, attempt limits and combo scoring were never built (targets
// are the three AI rivals, a run ends on a win, a loss or the clock, and a hit is always 100).
// Each later level turns the knobs the game already has, and keeps every harder knob from the
// level before it, so difficulty only rises. No new models, and the snow lighting stays.
import type { LevelId } from "@/arcade3d/types";

export interface SnowLevel {
   /** player and rival top speed (KID.speed). Lower is a longer chase. */
   speed: number;
   /** dodge delay at t = 0 / 30 / 60 s (AI.dodgeAt). Lower dodges sooner. */
   dodgeAt: readonly [number, number, number];
   /** rooted wind-up, seconds (AI.windup). */
   windup: number;
   /** from this second, two rivals may peek at once (AI.slotAt). 0 = from the start. */
   slotAt: number;
   /** the third rival joins, seconds (AI.sneakerAt). */
   sneakerAt: number;
   /** distance where flight time reaches flightFar (THROW.distFar). */
   distFar: number;
   /** flight time at distFar and beyond (THROW.flightFar). */
   flightFar: number;
   /** fort HP when the fight starts (FORT.hp). */
   fortHp: number;
   /** rules clock, seconds (SCORE.duration). Every level is 90. */
   duration: number;
}

export const LEVELS: Record<LevelId, SnowLevel> = {
   // today's game. Snow Yard: the built 1-vs-3 fight, not a stationary gallery.
   1: {
      speed: 4.5, dodgeAt: [0.35, 0.27, 0.2], windup: 1.2, slotAt: 60, sneakerAt: 10,
      distFar: 14, flightFar: 0.85, fortHp: 3, duration: 90,
   },
   // Frozen Park: slower chase, a slightly sooner dodge, and the long-throw cap moves out.
   // The lerp slope stays 0.025 s/m, so flight at 14 m and under is unchanged (README "Levels").
   2: {
      speed: 4, dodgeAt: [0.3, 0.25, 0.2], windup: 1.2, slotAt: 60, sneakerAt: 10,
      distFar: 18, flightFar: 0.95, fortHp: 3, duration: 90,
   },
   // Snow Fort: the third rival joins at 8 s, and two may peek from 30 s. Rivals already move.
   3: {
      speed: 4, dodgeAt: [0.3, 0.25, 0.2], windup: 1.2, slotAt: 30, sneakerAt: 8,
      distFar: 18, flightFar: 0.95, fortHp: 3, duration: 90,
   },
   // Ice Village: a 1.0 s wind-up, a quicker dodge, and forts that start on 2 HP.
   // Hit spheres stay the pose-tested sizes; "faster" is the telegraph, not a smaller body.
   4: {
      speed: 4, dodgeAt: [0.25, 0.2, 0.15], windup: 1, slotAt: 30, sneakerAt: 8,
      distFar: 18, flightFar: 0.95, fortHp: 2, duration: 90,
   },
   // Championship Arena: two peek slots from the start, the third rival at 5 s, the tightest dodge.
   // No shot counter and no combo: a hit is still 100, and the 90 s clock still ends the fight.
   5: {
      speed: 4, dodgeAt: [0.2, 0.17, 0.14], windup: 1, slotAt: 0, sneakerAt: 5,
      distFar: 18, flightFar: 0.95, fortHp: 2, duration: 90,
   },
};
