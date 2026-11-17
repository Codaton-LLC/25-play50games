// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// A win's submitted time is the finish less 0.1 s an orb and the flow bonus. The floor on a finish:
//   - the climb: the hero's height is the stair's height at his angle (plus a jump's air, which a win
//     never needs). A stair rises pitch / 2 pi metres a radian, and the angle grows at most by
//     speed / walk + spin: running (V_RUN) plus the fastest spin of any pole on the level (the
//     checkpoint disc spins every pole that fast your way). A hop lands on a turn at or under the
//     height it left from, a gap or a hit only drops you, so nothing else lifts you. Riko's dash
//     (V_DASH for 0.35 s, every 8 s from the start) adds at most DASH_EXTRA metres a dash;
//   - level 5: the win is Coilstone's defeat: bossMinMs() runs menu2/boss with a perfect hitter that
//     lands a hit in the first ms of every vulnerable window, the fastest the machine allows.
// The limits row is that floor less the largest bonus (orbs + the flow meter at x2 on every counted
// event), less 6 %, rounded down to 100 ms.
import type { LevelId } from "../../types";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { TAU, courseFor } from "./course";
import { LEVELS } from "./levels";
import { COILSTONE } from "./progression";
import { POWER_MS, V_DASH, heroById } from "./heroes";
import { V_RUN, maxBonusMs, maxSpin, type LevelLimits } from "./rules";

/** Coilstone's least defeat time (ms) from the start: a hit in the first ms of every vulnerable window. */
export function bossMinMs(): number {
   const b = createBoss(COILSTONE);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000; guard++) {
      stepBoss(b, COILSTONE, 1, ev);
      ms += 1;
      if (b.step === "vulnerable" && hitBoss(b, COILSTONE, 1, ev) === "defeated") return ms;
   }
   return ms;
}

/** The fastest climb on a level (m/s): the steepest metres-per-radian times the fastest angle rate. */
export function climbRate(level: LevelId): number {
   const c = courseFor(level);
   const spin = maxSpin(c);
   let best = 0;
   for (const h of c.helices) {
      const p = c.poles[h.pole];
      best = Math.max(best, (h.pitch / TAU) * (V_RUN / p.walk + spin));
   }
   return best;
}

/** The most one dash can add to the climb (m): the extra speed for its whole 0.35 s on the tightest, steepest stair. */
export function dashExtra(level: LevelId): number {
   const c = courseFor(level);
   let best = 0;
   for (const h of c.helices) best = Math.max(best, ((h.pitch / TAU) * (V_DASH - V_RUN) * (POWER_MS.dash / 1000)) / c.poles[h.pole].walk);
   return best;
}

/** The least play time (ms) any run can finish level `id` in. */
export function minFinishMs(id: LevelId): number {
   if (LEVELS[id].boss) return bossMinMs();
   const H = courseFor(id).top;
   const rate = climbRate(id);
   const extra = dashExtra(id);
   const every = heroById("riko").cooldownMs / 1000;
   // height(T) <= rate T + extra (1 + T / every)  =>  T >= (H - extra) / (rate + extra / every)
   return Math.max(0, ((H - extra) / (rate + extra / every)) * 1000);
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
