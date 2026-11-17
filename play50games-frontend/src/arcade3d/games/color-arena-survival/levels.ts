// Color Arena Survival's five levels: pure data (no React, no three.js). The card
// (docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md, "GAME 26"): a round-based survival on a
// floor of colour tiles. Each round a colour is called; when the call runs out every tile of another
// colour drops. Stand on the called colour and hold still on it to LOCK IN: the floor drops at once.
// rules.ts runs the rounds; the levels only set the arena, the pace and the one new rule each adds.
import type { LevelId } from "../../types";

export interface ArenaLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** tiles along each side (the arena is size x size) */
   size: number;
   /** how many of the five colours the floor uses */
   colours: number;
   /** rounds to survive (the card's main objective); level 5's win is the boss's defeat */
   rounds: number;
   /** how long a call lasts without a lock-in (ms) */
   callMs: number;
   /** the third star: the finish at or under this (the card's "Timer / target") */
   targetMs: number;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** L2+: after each drop this many of the dropped tiles crack and stay down (holes) */
   holesPerRound: number;
   /** holes never take the floor under this share of its tiles */
   minFloorShare: number;
   /** L3: tiles that blink and swap colour halfway through a call */
   swaps: number;
   /** L4: a padded sweeper bar turns over the floor (rad/s, 0 = none) */
   sweeper: number;
   /** level 5: the Prism Keeper; the win is its defeat */
   boss: boolean;
}

const DEG = Math.PI / 180;

export const LEVELS: Record<LevelId, ArenaLevel> = {
   1: { id: 1, name: "Slow Rounds", size: 5, colours: 2, rounds: 5, callMs: 6000, targetMs: 60_000, durationMs: 150_000, holesPerRound: 0, minFloorShare: 1, swaps: 0, sweeper: 0, boss: false },
   2: { id: 2, name: "Three Colors", size: 6, colours: 3, rounds: 8, callMs: 5000, targetMs: 75_000, durationMs: 180_000, holesPerRound: 1, minFloorShare: 0.75, swaps: 0, sweeper: 0, boss: false },
   3: { id: 3, name: "Five Colors", size: 7, colours: 5, rounds: 12, callMs: 4200, targetMs: 90_000, durationMs: 220_000, holesPerRound: 1, minFloorShare: 0.72, swaps: 4, sweeper: 0, boss: false },
   4: { id: 4, name: "Fast Rounds", size: 8, colours: 5, rounds: 16, callMs: 3000, targetMs: 105_000, durationMs: 250_000, holesPerRound: 2, minFloorShare: 0.7, swaps: 0, sweeper: 55 * DEG, boss: false },
   5: { id: 5, name: "Survival Master", size: 7, colours: 5, rounds: 18, callMs: 3400, targetMs: 120_000, durationMs: 300_000, holesPerRound: 0, minFloorShare: 1, swaps: 0, sweeper: 0, boss: true },
};
