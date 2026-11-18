// Cloud Hopper's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One drifting cloud sea and five configurations of the same verb (GLIDE, the design card): a
// horizontal run along -z over clouds that sink under you, crossed by hopping and by gliding on
// feathers. sea.ts builds each level's clouds from its script; these are the numbers.
import type { LevelId } from "@/arcade3d/types";

export interface CloudLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the sunset: the run clock's cap (ms). Reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the run's length along -z (m), start to the rainbow bridge */
   length: number;
   /** a landed cloud sinks this fast (m/s) and bursts this long after the first landing; it re-forms later */
   sinkMps: number;
   burstMs: number;
   reformMs: number;
   /** the third star: the submitted time at or under this (the card's "beat the sunset") */
   starTargetMs: number;
   /** Gloom Nimbus (level 5): the bridge's bell rings only once the boss is down */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CloudLevel> = {
   // the card's risk fix: L1 clouds sink at 0.3 m/s and hold 5 s before they burst
   1: { id: 1, name: "Soft Clouds", durationMs: 130_000, length: 250, sinkMps: 0.3, burstMs: 5000, reformMs: 3500, starTargetMs: 60_000, boss: false },
   2: { id: 2, name: "Moving Clouds", durationMs: 150_000, length: 300, sinkMps: 0.6, burstMs: 3000, reformMs: 3500, starTargetMs: 80_000, boss: false },
   3: { id: 3, name: "Wind Zone", durationMs: 180_000, length: 360, sinkMps: 0.6, burstMs: 3000, reformMs: 3500, starTargetMs: 95_000, boss: false },
   4: { id: 4, name: "Fading Clouds", durationMs: 210_000, length: 420, sinkMps: 0.6, burstMs: 3000, reformMs: 3500, starTargetMs: 110_000, boss: false },
   5: { id: 5, name: "Sky Sprint", durationMs: 240_000, length: 480, sinkMps: 0.6, burstMs: 3000, reformMs: 3500, starTargetMs: 150_000, boss: true },
};

/** The game's level config type (the shell's useLevel<CloudLevel>). */
export type RoofLevel = CloudLevel;
