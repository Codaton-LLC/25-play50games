import type { LevelId } from "../../types";
import type { ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createRun, step, emberRadius, respawn, type StepInput } from "./rules";
import type { HeroId } from "./heroes";
export function createMulti(level: LevelId, heroes: readonly HeroId[], mode: ModeId) {
   const runs = heroes.map((h) => createRun(level, h));
   for (const r of runs) { r.lit = runs[0].lit; r.visited = runs[0].visited; }
   return { runs, mode, firstFinish: 0, chandelier: false, ended: false };
}
export type MultiRun = ReturnType<typeof createMulti>;
export function stepMulti(m: MultiRun, dt: number, inputs: StepInput[]) {
   for (let i = 0; i < m.runs.length; i++) {
      const r = m.runs[i];
      r.allies = m.runs.filter((a) => a !== r).map((a) => ({ ...a.hero, radius: emberRadius(a) }));
      step(r, dt, inputs[i]);
      if (r.ended === "win" && !m.firstFinish) m.firstFinish = r.ms;
   }
   const top = Math.max(...m.runs.map((r) => r.hero.y));
   const checkpoint = Math.max(...m.runs.map((r) => r.checkpoint));
   if (m.mode === "coop") {
      for (const r of m.runs) {
         r.checkpoint = checkpoint;
         if (m.runs.some((a) => a.heroId === "kiro" && a.powerUntil > a.ms)) r.powerUntil = Math.max(r.powerUntil, r.ms + 50);
      }
      const low = m.runs.filter((r) => r.hero.y < 3 && Math.abs(r.hero.x) > 1.2);
      if (low.some((r) => r.hero.x < 0) && low.some((r) => r.hero.x > 0)) { m.chandelier = true; m.runs[0].lit.fill(m.runs[0].ms + 20000); }
   }
   for (const r of m.runs) if (!r.ended && top - r.hero.y > 8) respawn(r);
   m.ended = m.runs.every((r) => r.ended !== null) || (m.mode === "versus" && m.firstFinish > 0 && m.runs[0].ms - m.firstFinish > 10000);
}
