// Plate Surf's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One bay and one rolling wave, five configurations of the same verb (CARVE, the design card): ride
// the face along -z, pump up and down it for speed, air off the lip, and stay ahead of the curl.
// waves.ts builds each level's props from these numbers.
import type { LevelId } from "@/arcade3d/types";

export interface SurfLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the ride's length along -z (m), start to the lagoon / beach */
   length: number;
   /** the wave face's height (m): the lip stands this high over the trough */
   waveH: number;
   /** the curl's speed along -z (m/s): it chases you; slower than your top speed */
   curlMps: number;
   /** the third star: the submitted time at or under this (the card's 50 / 65 / 75 / 85 / 120 s) */
   starTargetMs: number;
   /** King Breaker (level 5): the beach's Tide Bell rings only once the boss is down */
   boss: boolean;
}

export const LEVELS: Record<LevelId, SurfLevel> = {
   // the card: a small wave and a slow curl (11 m/s), slower than your top speed
   1: { id: 1, name: "Training Swell", durationMs: 120_000, length: 600, waveH: 6.5, curlMps: 11, starTargetMs: 50_000, boss: false },
   2: { id: 2, name: "Rocky Path", durationMs: 140_000, length: 800, waveH: 8, curlMps: 12, starTargetMs: 65_000, boss: false },
   3: { id: 3, name: "Jump Gates", durationMs: 160_000, length: 900, waveH: 8, curlMps: 12.5, starTargetMs: 75_000, boss: false },
   // the card: the curl speeds up to 15 m/s in the canyon
   4: { id: 4, name: "Speed Canyon", durationMs: 180_000, length: 1050, waveH: 8, curlMps: 15, starTargetMs: 85_000, boss: false },
   5: { id: 5, name: "Plate Surf Master", durationMs: 240_000, length: 1400, waveH: 8, curlMps: 13, starTargetMs: 120_000, boss: true },
};
