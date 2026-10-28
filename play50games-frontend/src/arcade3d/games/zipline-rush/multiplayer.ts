import type { LevelId } from "../../types";
import type { M2HeroId } from "../../menu2/heroModels";
import type { ModeId } from "../../menu2/multiplayer/modes";
import { createRun, step, type StepInput, type ZipRun } from "./rules";
export interface MultiRun { runs: ZipRun[]; mode: ModeId; ms: number; firstFinishMs: number | null; ended: "win" | "timeup" | null; bumpAt: number[] }
export function orbNeeded(runs: readonly ZipRun[], index: number) {
   return runs.some((r) => !r.ended && !r.collected[index]);
}
export function createMultiRun(level: LevelId, heroes: readonly M2HeroId[], mode: ModeId): MultiRun {
   return { runs: heroes.slice(0, 4).map((hero) => createRun(level, hero)), mode, ms: 0, firstFinishMs: null, ended: null, bumpAt: new Array(16).fill(-Infinity) };
}
export function stepMulti(g: MultiRun, dt: number, inputs: readonly StepInput[]) {
   if (g.ended || !(dt > 0)) return;
   g.ms += Math.min(250, dt);
   g.runs.forEach((r, k) => { if (inputs[k]) step(r, dt, inputs[k]); });
   for (let a = 0; a < g.runs.length; a++) for (let b = a + 1; b < g.runs.length; b++) {
      const p = g.runs[a], q = g.runs[b];
      const together = !p.ended && !q.ended && p.section === q.section && p.lane === q.lane && Math.abs(p.t - q.t) < 0.025;
      if (!together) continue;
      if (g.mode === "versus" && (p.event.hop || q.event.hop) && g.ms - g.bumpAt[a * 4 + b] > 1000) {
         p.speed *= 0.8; q.speed *= 0.8; g.bumpAt[a * 4 + b] = g.ms;
      }
      if (g.mode === "coop") {
         // Tandem tuck and relay: a partner's active power holds the ghost signal open.
         if ((inputs[a]?.throttle ?? 0) > 0.25 && (inputs[b]?.throttle ?? 0) > 0.25) { p.tandemMs = 100; q.tandemMs = 100; }
         if (p.powerMs > 0 && p.heroId === "kiro") q.hurtMs = Math.max(q.hurtMs, 100);
         if (q.powerMs > 0 && q.heroId === "kiro") p.hurtMs = Math.max(p.hurtMs, 100);
      }
   }
   if (g.mode === "coop") for (let a = 0; a < g.runs.length; a++) {
      const holder = g.runs[a];
      if (holder.mode !== "ride" || holder.section !== 1 || holder.t < 0.3 || holder.t > 0.7 || !inputs[a]?.power) continue;
      for (let b = 0; b < g.runs.length; b++) if (a !== b && g.runs[b].heroId !== holder.heroId) g.runs[b].relayOpenMs = 1000;
   }
   const won = g.runs.filter((r) => r.ended === "win").length;
   if (won && g.firstFinishMs === null) g.firstFinishMs = g.ms;
   if (g.mode === "coop" && won === g.runs.length) g.ended = "win";
   else if (g.mode === "versus" && g.firstFinishMs !== null && (won === g.runs.length || g.ms - g.firstFinishMs >= 20_000)) g.ended = "win";
   else if (g.runs.every((r) => r.ended !== null)) g.ended = won ? "win" : "timeup";
}
