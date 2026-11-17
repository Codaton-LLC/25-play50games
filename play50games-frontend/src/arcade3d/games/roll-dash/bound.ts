// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// A win's submitted time is the finish less the flow bonus. The floor on a finish:
//   - levels 1-4: the street is `length` metres and the forward speed is never more than the level's
//     base + BOOST (a correct unlock's 1.5 s boost, assumed always on) + Riko's dash (DASH_BOOST while
//     it lasts: 0.3 s). Her dash recharges 3 s while she is active and twice as fast on the bench, so
//     a dash needs at least COOLDOWN / BENCH_RECHARGE between two of them: distance <= (base + BOOST) T +
//     DASH_BOOST 0.3 (1 + T / 1.5) (the first dash at t = 0). A bounce or a stumble only slows you.
//   - level 5: the win is the Hawk's defeat: bossMinMs() runs menu2/boss with a perfect hitter that
//     lands a hit in the first ms of every vulnerable window, the fastest the machine allows.
// The limits row is that floor less the largest flow bonus, less 6 %, rounded down to 100 ms.
import type { LevelId } from "../../types";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { LEVELS } from "./levels";
import { HAWK } from "./progression";
import { DASH_BOOST, heroById } from "./heroes";
import { BENCH_RECHARGE, BOOST, maxBonusMs, type LevelLimits } from "./rules";

/** The Hawk's least defeat time (ms) from the start: a hit in the first ms of every vulnerable window. */
export function bossMinMs(): number {
   const b = createBoss(HAWK);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000; guard++) {
      stepBoss(b, HAWK, 1, ev);
      ms += 1;
      if (b.step === "vulnerable" && hitBoss(b, HAWK, 1, ev) === "defeated") return ms;
   }
   return ms;
}

/** The most extra metres one dash adds, and the least time between two dashes (s). */
export function dashExtra(): { metres: number; every: number } {
   const riko = heroById("riko");
   return { metres: DASH_BOOST * (riko.durationMs / 1000), every: riko.cooldownMs / 1000 / BENCH_RECHARGE };
}

/** The least play time (ms) any run can finish level `id` in. */
export function minFinishMs(id: LevelId): number {
   const cfg = LEVELS[id];
   if (cfg.boss) return bossMinMs();
   const { metres, every } = dashExtra();
   // L <= (base + BOOST) T + metres (1 + T / every)  =>  T >= (L - metres) / (base + BOOST + metres / every)
   return (Math.max(0, cfg.length - metres) / (cfg.speed + BOOST + metres / every)) * 1000;
}

export function minDurationMsOf(id: LevelId): number {
   return Math.max(0, minFinishMs(id) - maxBonusMs(id));
}

/** The level's limits row: the bound less 6 %, to the 100 ms below; maxScore the best possible time score. */
export function proposeLimits(id: LevelId): LevelLimits {
   const minDurationMs = Math.floor((minDurationMsOf(id) * 0.94) / 100) * 100;
   const timeBaseMs = LEVELS[id].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}
