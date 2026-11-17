// Snowball Battle's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One 24×18 yard, five configurations. Level 1 is today's game and must never change: the same
// rivals, the same 90 s clock, the same throw curve. Those numbers are the rules.ts constants;
// levels.test.ts pins them.
//
// The plan's stationary-target gallery, attempt limits and combo scoring were never built (targets
// are the three AI rivals, a run ends on a win, a loss or the clock, and a hit is always 100).
// Each later level turns the knobs the game already has, and keeps every harder knob from the
// level before it, so difficulty only rises.
//
// Each level is also its own arena (README "Levels"): its own seven forts (where the rivals hide),
// its own ground (ice that makes everyone slide, deep drifts that slow everyone) and, on the fort
// levels, walls that get packed back up. The yard stays 24 x 18, so the camera windows hold. None of
// that adds a score source or a faster throw, so the limit proofs are unchanged.
import type { LevelId } from "@/arcade3d/types";

/** A round patch of ground, metres. */
export interface Zone {
   x: number;
   z: number;
   r: number;
}

/** Which drawn set the Scene uses (looks.ts THEMES). Visual only. */
export type ArenaTheme = "yard" | "park" | "fort" | "village" | "arena";

export interface Arena {
   theme: ArenaTheme;
   /** the seven fort centres before the seeded jitter (rules checkYard rules apply) */
   forts: readonly (readonly [number, number])[];
   /** ice: grip drops (rules ICE), so a kid slides and turns wide */
   ice: readonly Zone[];
   /** deep snow: top speed drops (rules DRIFT) */
   drifts: readonly Zone[];
   /** a fort at 0 HP is packed back to full after this many seconds (0 = never) */
   rebuild: number;
}

export const ARENAS: Record<LevelId, Arena> = {
   // today's ring round the snowman, plain snow
   1: {
      theme: "yard",
      forts: [[0, -5.2], [6.4, -3.3], [7.5, 1.5], [3.4, 4.9], [-3.4, 4.9], [-7.5, 1.5], [-6.4, -3.3]],
      ice: [],
      drifts: [],
      rebuild: 0,
   },
   // a park: forts pushed out to the edges (longer throws) round two frozen ponds
   2: {
      theme: "park",
      forts: [[-7.6, -5], [0, -5], [7.6, -5], [-8.4, 1.2], [8.4, 1.2], [-4.6, 4.6], [4.6, 4.6]],
      ice: [{ x: -4.3, z: -1.2, r: 1.7 }, { x: 4.3, z: -1.2, r: 1.7 }],
      drifts: [],
      rebuild: 0,
   },
   // a real snow fort: the rivals' wall of five across the back, two bunkers on your side; walls get repacked
   3: {
      theme: "fort",
      forts: [[-7.4, -4.6], [-3.7, -5.3], [0, -4.6], [3.7, -5.3], [7.4, -4.6], [-4.6, 3.4], [4.6, 3.4]],
      ice: [],
      drifts: [{ x: -8.2, z: 0.6, r: 1.6 }, { x: 8.2, z: 0.6, r: 1.6 }],
      rebuild: 8,
   },
   // igloos along two lanes, a frozen square in front, drifts between the huts
   4: {
      theme: "village",
      forts: [[-7.2, -4.8], [0, -5], [7.2, -4.8], [-4.2, -0.8], [4.2, -0.8], [-7.6, 3.6], [7.6, 3.6]],
      ice: [{ x: 0, z: 3.4, r: 1.5 }],
      drifts: [{ x: -3.6, z: -4.4, r: 1.3 }, { x: 3.6, z: -4.4, r: 1.3 }, { x: -8.4, z: -0.6, r: 1.2 }, { x: 8.4, z: -0.6, r: 1.2 }],
      rebuild: 0,
   },
   // the championship ring: barriers round an ice rink, drifts in the corners, and the crew repacks walls
   5: {
      theme: "arena",
      forts: [[-6.6, -4.8], [0, -5], [6.6, -4.8], [-8.3, 0.9], [8.3, 0.9], [-4.1, 4.2], [4.1, 4.2]],
      ice: [{ x: -3.4, z: -1.9, r: 1.25 }, { x: 3.4, z: -1.9, r: 1.25 }],
      drifts: [{ x: -10.2, z: -7, r: 1.6 }, { x: 10.2, z: -7, r: 1.6 }, { x: -10.2, z: 6.8, r: 1.4 }, { x: 10.2, z: 6.8, r: 1.4 }],
      rebuild: 10,
   },
};

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
   /** the arena: forts, ice, drifts, rebuilds (ARENAS) */
   arena: Arena;
}

export const LEVELS: Record<LevelId, SnowLevel> = {
   // today's game. Snow Yard: the built 1-vs-3 fight, not a stationary gallery.
   1: {
      speed: 4.5, dodgeAt: [0.35, 0.27, 0.2], windup: 1.2, slotAt: 60, sneakerAt: 10,
      distFar: 14, flightFar: 0.85, fortHp: 3, duration: 90, arena: ARENAS[1],
   },
   // Frozen Park: slower chase, a slightly sooner dodge, and the long-throw cap moves out.
   // The lerp slope stays 0.025 s/m, so flight at 14 m and under is unchanged (README "Levels").
   2: {
      speed: 4, dodgeAt: [0.3, 0.25, 0.2], windup: 1.2, slotAt: 60, sneakerAt: 10,
      distFar: 18, flightFar: 0.95, fortHp: 3, duration: 90, arena: ARENAS[2],
   },
   // Snow Fort: the third rival joins at 8 s, and two may peek from 30 s. Rivals already move.
   3: {
      speed: 4, dodgeAt: [0.3, 0.25, 0.2], windup: 1.2, slotAt: 30, sneakerAt: 8,
      distFar: 18, flightFar: 0.95, fortHp: 3, duration: 90, arena: ARENAS[3],
   },
   // Ice Village: a 1.0 s wind-up, a quicker dodge, and forts that start on 2 HP.
   // Hit spheres stay the pose-tested sizes; "faster" is the telegraph, not a smaller body.
   4: {
      speed: 4, dodgeAt: [0.25, 0.2, 0.15], windup: 1, slotAt: 30, sneakerAt: 8,
      distFar: 18, flightFar: 0.95, fortHp: 2, duration: 90, arena: ARENAS[4],
   },
   // Championship Arena: two peek slots from the start, the third rival at 5 s, the tightest dodge.
   // No shot counter and no combo: a hit is still 100, and the 90 s clock still ends the fight.
   5: {
      speed: 4, dodgeAt: [0.2, 0.17, 0.14], windup: 1, slotAt: 0, sneakerAt: 5,
      distFar: 18, flightFar: 0.95, fortHp: 2, duration: 90, arena: ARENAS[5],
   },
};
