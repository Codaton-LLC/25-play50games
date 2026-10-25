// Knight Training Arena's five levels: pure data, no React (docs/arcade-levels.md §6.3).
// One octagonal arena and the same eight posts. Level 1 is today's game: rules.ts keeps the
// frozen 111-beat grid (STAGES / BEAT_TIMES_MS) and must not rebuild it from these BPMs.
// Levels 2-5 rebuild a faster grid from `bpm` (rules.ts buildVariantSchedule). What varies:
// tempo, how many shields / doubles / tomatoes, when far posts start, the on-beat window,
// the combo step, and whether far regulars slide in from the near post. The active hit
// window stays ±200 ms on every level and every device. No attempt limit: a lose-on-miss
// would end the run inside the 58-62 s window the level-1 proof is built on.
import type { LevelId } from "../../types";

export interface KnightLevel {
   id: LevelId;
   /** Stage BPMs. Level 1's times are the frozen STAGES, not a grid rebuilt from these. */
   bpm: readonly [number, number, number, number];
   /** Shield groups (two hits each) in stages 2, 3 and 4. */
   shields: readonly [number, number, number];
   /** Same-direction near+far double pairs in stages 2, 3 and 4. */
   doubles: readonly [number, number, number];
   /** Tomato decoys in stages 2, 3 and 4. */
   tomatoes: readonly [number, number, number];
   /** First beat index that may use a far post. Level 1 is 23 (stage 2). */
   farFromBeat: number;
   /** On-beat bonus window, ms. One window for touch and keyboard. */
   onBeatWindowMs: number;
   /** Consecutive real hits per combo step. Level 1 is 8. */
   comboStep: number;
   /** Far regulars slide from the near post of the same direction during the lead. */
   moving: boolean;
   durationMs: number;
}

export const LEVELS: Record<LevelId, KnightLevel> = {
   // today's game, unchanged
   1: {
      id: 1,
      bpm: [100, 110, 120, 130],
      shields: [4, 4, 4],
      doubles: [0, 13, 16],
      tomatoes: [0, 9, 9],
      farFromBeat: 23,
      onBeatWindowMs: 110,
      comboStep: 8,
      moving: false,
      durationMs: 60_000,
   },
   // far posts from the first beat, markers slide outward, a faster grid
   2: {
      id: 2,
      bpm: [104, 114, 124, 136],
      shields: [4, 4, 4],
      doubles: [0, 14, 18],
      tomatoes: [0, 9, 9],
      farFromBeat: 0,
      onBeatWindowMs: 110,
      comboStep: 8,
      moving: true,
      durationMs: 60_000,
   },
   // doubles from stage 2, tighter on-beat window
   3: {
      id: 3,
      bpm: [108, 118, 128, 142],
      shields: [4, 5, 5],
      doubles: [6, 14, 18],
      tomatoes: [3, 9, 10],
      farFromBeat: 0,
      onBeatWindowMs: 100,
      comboStep: 8,
      moving: true,
      durationMs: 60_000,
   },
   // combo climbs every 6 hits; more shields and decoys
   4: {
      id: 4,
      bpm: [112, 122, 134, 148],
      shields: [5, 5, 5],
      doubles: [8, 15, 18],
      tomatoes: [4, 10, 11],
      farFromBeat: 0,
      onBeatWindowMs: 100,
      comboStep: 6,
      moving: true,
      durationMs: 60_000,
   },
   // fastest grid, tightest on-beat window, every pattern at once
   5: {
      id: 5,
      bpm: [116, 128, 140, 156],
      shields: [5, 6, 6],
      doubles: [10, 16, 22],
      tomatoes: [5, 11, 13],
      farFromBeat: 0,
      onBeatWindowMs: 90,
      comboStep: 6,
      moving: true,
      durationMs: 60_000,
   },
};
