// Museum Guard's five levels: pure data, no React (docs/arcade-levels.md §6.3, core/README.md "Levels").
// One gallery, five configurations. Level 1 is today's game and must never change: 8 pedestals,
// the same phases, the same 16/14/12° beam, dawn at 90 s.
//
// The plan's wings are rooms the build never had (fixed eye, turn + flash only). They map to the
// knobs below, not to a new ring: a pedestal count other than 8 would move the 2.842 / 6.926 m
// paths and the both-exits cone, and a 6-pedestal ring sits a statue on a door. Blocked paths,
// locked paths, free-position randomization and a walking patrol are not built.
// What does vary, and only by getting harder: how long the night is, how fast statues walk,
// how many may sneak at once, how many leave, the gap between departures, how narrow the beam
// is, and (from level 4) a faster roster. The ring, the doors, the flash timing and the turn
// cap stay put, and touch and keys share those timings.
import type { LevelId } from "@/arcade3d/types";

export interface MuseumLevel {
   /** phase i is active until this many seconds; the last equals dawn */
   ends: readonly [number, number, number];
   /** the run is won at this second if an alarm remains */
   dawn: number;
   /** multiplier on every statue's speed, per phase */
   speed: readonly [number, number, number];
   /** sneaking at once, per phase (frozen and returning do not count) */
   cap: readonly [number, number, number];
   /** departures, per phase */
   starts: readonly [number, number, number];
   /** seconds between departures, per phase */
   gap: readonly [number, number, number];
   /** no departure before this second */
   first: number;
   /** beam half-angle in degrees, per phase (coarse still ×1.2, clamped at 17) */
   beam: readonly [number, number, number];
   /** knight, robot, penguin, dino. Always eight, so the ring and the radar stay put. */
   roster: readonly [number, number, number, number];
}

export const LEVELS: Record<LevelId, MuseumLevel> = {
   // today's game
   1: {
      ends: [30, 60, 90], dawn: 90,
      speed: [1, 1.15, 1.25], cap: [2, 3, 3], starts: [6, 7, 8], gap: [4.2, 3.6, 3.2],
      first: 3, beam: [16, 14, 12], roster: [2, 2, 2, 2],
   },
   // Ancient Wing: the night runs longer and one more statue leaves in each phase
   2: {
      ends: [35, 70, 105], dawn: 105,
      speed: [1, 1.18, 1.3], cap: [2, 3, 3], starts: [7, 8, 9], gap: [4.2, 3.4, 3],
      first: 3, beam: [16, 14, 12], roster: [2, 2, 2, 2],
   },
   // Art Wing: the beam narrows and the later patrols leave closer together
   3: {
      ends: [40, 80, 120], dawn: 120,
      speed: [1, 1.22, 1.35], cap: [2, 3, 3], starts: [8, 9, 10], gap: [4.2, 3.2, 2.8],
      first: 3, beam: [16, 13, 11], roster: [2, 2, 2, 2],
   },
   // Science Wing: three sneaks from the opening, and a penguin-heavy roster
   4: {
      ends: [40, 80, 120], dawn: 120,
      speed: [1, 1.28, 1.4], cap: [3, 3, 3], starts: [8, 10, 11], gap: [4, 3, 2.6],
      first: 3, beam: [15, 13, 11], roster: [1, 2, 3, 2],
   },
   // Full Museum Night: the narrowest beam, the fastest patrols, the most departures
   5: {
      ends: [45, 90, 135], dawn: 135,
      speed: [1, 1.32, 1.45], cap: [3, 3, 3], starts: [9, 11, 12], gap: [3.8, 2.8, 2.5],
      first: 3, beam: [14, 12, 10], roster: [1, 1, 3, 3],
   },
};
