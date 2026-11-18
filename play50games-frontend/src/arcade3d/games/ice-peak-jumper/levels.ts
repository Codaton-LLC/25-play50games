// Ice Peak Jumper's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One frozen peak and five configurations of the same verb (SLIDE-LAUNCH, the design card): build your
// slide on gripless ice, launch off the edge, and the run-up is your aim. course.ts builds each level's
// platforms and hazards; these are the numbers.
import type { LevelId } from "@/arcade3d/types";

export interface PeakLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked); also the time base */
   durationMs: number;
   /** the third star: the submitted time at or under this (the card's 70 / 95 / 110 / 125 / 160 s) */
   starTargetMs: number;
   /** the dotted landing arc shows above 4 m/s (the card: levels 1-2 only) */
   arc: boolean;
   /** level 4: night; snow grips only while its lantern is lit */
   night: boolean;
   /** level 5: the Frost Golem */
   boss: boolean;
}

export const LEVELS: Record<LevelId, PeakLevel> = {
   1: { id: 1, name: "Base Camp", durationMs: 180_000, starTargetMs: 70_000, arc: true, night: false, boss: false },
   2: { id: 2, name: "Icicle Steps", durationMs: 210_000, starTargetMs: 95_000, arc: true, night: false, boss: false },
   3: { id: 3, name: "Yeti Ridge", durationMs: 240_000, starTargetMs: 110_000, arc: false, night: false, boss: false },
   4: { id: 4, name: "Lantern Night", durationMs: 270_000, starTargetMs: 125_000, arc: false, night: true, boss: false },
   5: { id: 5, name: "Summit Cairn", durationMs: 360_000, starTargetMs: 160_000, arc: false, night: false, boss: true },
};
