// Disc Target Throw's five levels: pure data (no React, no three.js). The design card
// (docs/menu2-super/world-3-wild-temples.md "40 Disc Target Throw"): one ruin courtyard, a returning
// training disc that banks off stone and comes back to be caught. course.ts places each level's
// targets, columns, walls and hazards; these are the numbers every level shares.
import type { LevelId } from "../../types";

export interface DiscLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (the points so far count) */
   durationMs: number;
   /**
    * The par time (ms): the third star (clear at or under it) and the speed bonus (TIME_PTS per second
    * under it). The card's target times (L1 60 s), a little over the honest bot's clear.
    */
   parMs: number;
   /** L2: targets slide along ruin rails */
   rails: boolean;
   /** L3: jade, gold and green idols that pay double in colour order */
   colours: boolean;
   /** L4: the hero throws from a drifting raft; monkeys snatch a returning disc */
   raft: boolean;
   /** L5: Mother Snapper rooted in the courtyard centre; the win is her defeat */
   boss: boolean;
}

export const LEVELS: Record<LevelId, DiscLevel> = {
   1: { id: 1, name: "Static Targets", durationMs: 150_000, parMs: 60_000, rails: false, colours: false, raft: false, boss: false },
   2: { id: 2, name: "Moving Targets", durationMs: 160_000, parMs: 70_000, rails: true, colours: false, raft: false, boss: false },
   3: { id: 3, name: "Color Targets", durationMs: 170_000, parMs: 80_000, rails: false, colours: true, raft: false, boss: false },
   4: { id: 4, name: "Fast Combo", durationMs: 180_000, parMs: 90_000, rails: true, colours: false, raft: true, boss: false },
   5: { id: 5, name: "Accuracy Master", durationMs: 240_000, parMs: 120_000, rails: false, colours: false, raft: false, boss: true },
};

/** The game's level config type (the shell's useLevel<DiscLevel>). */
export type DiscConfig = DiscLevel;
