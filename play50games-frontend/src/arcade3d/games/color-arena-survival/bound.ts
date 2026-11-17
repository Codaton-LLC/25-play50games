// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// A win's submitted time is the finish time (no bonus comes off it). The floor:
//   Levels 1-4: the win comes at the end of a drop, once the hero has survived `rounds` of them. A round
//   cannot be hurried past its clock: the first call starts START_MS in; a call lasts at least
//   MIN_CALL_MS (a lock-in only ends it once it is that old); a drop lasts DROP_MS; a rise RISE_MS. A
//   fall survives nothing, so the k-th survived drop ends no sooner than the k-th drop at all:
//      floor = START_MS + rounds x (MIN_CALL_MS + DROP_MS) + (rounds - 1) x RISE_MS.
//   No hero power changes the arena's clock (rules.ts stepArena reads no hero).
//   Level 5: the win is the Prism Keeper's defeat: bossMinMs() runs menu2/boss with a perfect hitter
//   that lands a hit in the first ms of every vulnerable window, the fastest the machine allows (the
//   game only arms a hit on a beacon round, every third round, so real runs are far slower).
// The limits row is that floor less 6 %, rounded down to 100 ms.
import type { LevelId } from "../../types";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { LEVELS } from "./levels";
import { KEEPER } from "./progression";
import { DROP_MS, MIN_CALL_MS, RISE_MS, START_MS, type LevelLimits } from "./rules";

/** The Keeper's least defeat time (ms) from the start: a hit in the first ms of every vulnerable window. */
export function bossMinMs(): number {
   const b = createBoss(KEEPER);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 600_000; guard++) {
      stepBoss(b, KEEPER, 1, ev);
      ms += 1;
      if (b.step === "vulnerable" && b.stepMs <= 1 && hitBoss(b, KEEPER, 1, ev) === "defeated") return ms;
   }
   return ms;
}

/** The least play time (ms) any run can finish level `id` in. */
export function minFinishMs(id: LevelId): number {
   const cfg = LEVELS[id];
   if (cfg.boss) return bossMinMs();
   return START_MS + cfg.rounds * (MIN_CALL_MS + DROP_MS) + (cfg.rounds - 1) * RISE_MS;
}

/** The level's limits row: the floor less 6 %, to the 100 ms below; maxScore the best possible time score. */
export function proposeLimits(id: LevelId): LevelLimits {
   const minDurationMs = Math.floor((minFinishMs(id) * 0.94) / 100) * 100;
   const timeBaseMs = LEVELS[id].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}
