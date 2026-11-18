// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// A win's submitted time is the finish less 0.1 s an orb and the flow bonus. The floor on a finish:
//   - the climb: no hero rises faster on average than V_CLIMB_MAX = V_BOUNCE / 2 (a bounce landing on
//     its apex: the lantern throws vy = V_BOUNCE; Nami's second jump, a stomp or a dash is slower), so
//     a level of height H takes at least H / V_CLIMB_MAX;
//   - level 5: after the arena is entered the Queen's machine must run its intro, three phases and
//     her defeat: bossMinMs() runs menu2/boss with a perfect hitter that lands a hit in the first ms
//     of every vulnerable window, the fastest the machine allows.
// The limits row is that floor less the largest bonus (orbs + the flow meter at x2 on every counted
// event), less 6 %, rounded down to 100 ms.
import type { LevelId } from "../../types";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { courseFor } from "./course";
import { LEVELS } from "./levels";
import { QUEEN } from "./progression";
import { V_CLIMB_MAX, maxBonusMs, type LevelLimits } from "./rules";

/** The Queen's least defeat time (ms) once woken: a hit in the first ms of every vulnerable window. */
export function bossMinMs(): number {
   const b = createBoss(QUEEN);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 200_000 && b.step !== "done"; guard++) {
      stepBoss(b, QUEEN, 1, ev);
      ms += 1;
      if (b.step === "vulnerable") hitBoss(b, QUEEN, 1, ev);
   }
   return ms;
}

/** The least play time (ms) any run can finish level `id` in. */
export function minFinishMs(id: LevelId): number {
   const c = courseFor(id);
   if (!LEVELS[id].boss) return (LEVELS[id].height / V_CLIMB_MAX) * 1000;
   const arenaY = c.pads[c.arena[0]].y - 1.2;
   return (arenaY / V_CLIMB_MAX) * 1000 + bossMinMs();
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
