// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// A win's submitted time is the finish less 0.1 s an orb and the combo bonus. The floor on a finish:
//   - the climb: no hero ever rises faster than V_RISE_MAX (rules.ts: the full 75 degree swing at the
//     6 m grip at its fastest, plus the grip pulled in at 3 m/s, plus a bobbing anchor; a jump, Nami's
//     second jump, a dash or a knock is slower), so a climb to the goal's top H takes at least
//     H / V_RISE_MAX;
//   - level 5: after the arena is reached the King's machine must run its intro, three phases and his
//     defeat: bossMinMs() runs menu2/boss with a perfect hitter that lands a hit in the first ms of
//     every vulnerable window, the fastest the machine allows.
// The limits row is that floor less the largest bonus (orbs + the combo meter at x2 on every counted
// event), less 6 %, rounded down to 100 ms.
import type { LevelId } from "../../types";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { courseFor } from "./course";
import { LEVELS } from "./levels";
import { HOWLER } from "./progression";
import { V_RISE_MAX, maxBonusMs, type LevelLimits } from "./rules";

/** The King's least defeat time (ms) once woken: a hit in the first ms of every vulnerable window. */
export function bossMinMs(): number {
   const b = createBoss(HOWLER);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 200_000 && b.step !== "done"; guard++) {
      stepBoss(b, HOWLER, 1, ev);
      ms += 1;
      if (b.step === "vulnerable") hitBoss(b, HOWLER, 1, ev);
   }
   return ms;
}

/** The least play time (ms) any run can finish level `id` in. */
export function minFinishMs(id: LevelId): number {
   const c = courseFor(id);
   const climb = (c.top / V_RISE_MAX) * 1000;
   return LEVELS[id].boss ? climb + bossMinMs() : climb;
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
