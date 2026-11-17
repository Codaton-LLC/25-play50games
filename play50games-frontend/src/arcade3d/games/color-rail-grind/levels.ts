// Color Rail Grind's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One toy train line through the Sugarfrost Workshop, five configurations of the same verb (SWITCH-
// ROUTING, the design card): the hero grinds the rails automatically, hops between parallel rails and
// throws the track switches ahead to build its own route. network.ts builds each level's rails.
import type { LevelId } from "@/arcade3d/types";

export interface RailLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** the grind speed (m/s): the card's 10-20 m/s */
   speed: number;
   /** the third star: the submitted time at or under this (ms; the card's 60 / 80 / 95 / 105 / 150 s) */
   starTargetMs: number;
   /** the main orbs ("all orbs": the card's 25 / 30 / 35 / 40 / 35) */
   orbs: number;
   /** level 5: the Clockwork Express */
   boss: boolean;
}

export const LEVELS: Record<LevelId, RailLevel> = {
   1: { id: 1, name: "Station Yard", durationMs: 120_000, speed: 12, starTargetMs: 60_000, orbs: 25, boss: false },
   2: { id: 2, name: "Village Loop", durationMs: 150_000, speed: 13, starTargetMs: 80_000, orbs: 30, boss: false },
   3: { id: 3, name: "Ice Bridge", durationMs: 170_000, speed: 13, starTargetMs: 95_000, orbs: 35, boss: false },
   4: { id: 4, name: "Night Express", durationMs: 180_000, speed: 15, starTargetMs: 105_000, orbs: 40, boss: false },
   5: { id: 5, name: "Runaway Express", durationMs: 260_000, speed: 16, starTargetMs: 150_000, orbs: 35, boss: true },
};
