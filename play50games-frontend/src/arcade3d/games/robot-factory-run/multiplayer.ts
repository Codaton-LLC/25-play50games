import { LEVELS } from "./levels";
import type { LevelId } from "../../types";
import type { ModeId } from "../../menu2/multiplayer/modes";
import { MODES, dispatchAllyPower, type AllyPowerEvent } from "../../menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec } from "../../menu2/multiplayer/simulate";
import { createRun, step, createStepInput, type FactoryRun, type StepInput } from "./rules";
import { type HeroId } from "./heroes";
export function onAllyPower({ source, ally, power }: AllyPowerEvent<FactoryRun, string>): void {
   if (power === "kiro" || power === "vexa") {
      ally.hero.hurtUntil = Math.max(ally.hero.hurtUntil, source.hero.powerUntil);
   }
}
export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId) {
   const spec: PlayerSimSpec<FactoryRun, StepInput, FactoryRun["events"]> = { create: (s, i) => createRun(s, level, heroes[i]), step };
   const group = createPlayerSims(spec, seed, Math.max(1, Math.min(4, heroes.length)));
   const runs = group.sims;
   for (let i = 0; i < runs.length; i++) {
      runs[i].hero.x += i * 0.6;
      if (modeId === "coop") {
         runs[i].worldDriver = i === 0;
         runs[i].board = runs[0].board;
         runs[i].boss = runs[0].boss;
         runs[i].collected = runs[0].collected;
      }
   }
   return { spec, group, runs, mode: MODES[modeId], firstFinishMs: null as number | null, ended: null as "win" | "timeup" | null, simMs: 0, stealReady: heroes.map(() => 0) };
}
export type MultiRun = ReturnType<typeof createMultiRun>;
export function stepMulti(m: MultiRun, ms: number, inputs: readonly StepInput[]) {
   if (m.ended)
      return;
   // Shared boards advance only once. Every player still moves and can press switches.
   const before = m.runs[0].simMs;
   if (m.mode.ranking === "team") {
      const driver = m.runs.findIndex((r) => r.ended === null);
      m.runs.forEach((r, i) => { r.worldDriver = i === driver; });
   }
   // Every split line meets the shared orange middle belt at its top switch.
   // Roll + Power there to pull a rival cell into your dispenser. Multiplayer is unranked.
   if (m.mode.ranking === "race")
      for (let i = 0; i < m.runs.length; i++) {
         const r = m.runs[i], h = r.hero;
         if (inputs[i]?.actionPressed && inputs[i]?.roll && Math.hypot(h.x, h.z - 5) < 1 && m.simMs >= m.stealReady[i]) {
            const victim = m.runs.find((v, j) => j !== i && v.board.cells.some((c) => c.active));
            const c = victim?.board.cells.find((v) => v.active);
            if (c && r.board.charged < LEVELS[r.level].cells) {
               victim!.board.cells.splice(victim!.board.cells.indexOf(c), 1);
               c.nodeX = c.x = -6;
               c.nodeZ = c.z = 0;
               c.distance = 0;
               c.dx = 1;
               c.dz = 0;
               c.sideHop = false;
               c.armReadyAt = 0;
               const free = r.board.cells.findIndex((v) => !v.active);
               if (free >= 0)
                  r.board.cells[free] = c;
               else if (r.board.cells.length < LEVELS[r.level].cells)
                  r.board.cells.push(c);
               else
                  victim!.board.cells.push(c);
               m.stealReady[i] = m.simMs + 6000;
            }
         }
      }
   const ev = stepPlayerSims(m.spec, m.group, ms, inputs, createStepInput());
   for (let i = 0; i < ev.length; i++)
      if (ev[i].power)
         dispatchAllyPower(m.mode, m.runs, i, m.runs[i].heroId, onAllyPower);
   m.simMs = Math.max(...m.runs.map((r) => r.simMs));
   for (const r of m.runs)
      if (r.ended === "win" && m.firstFinishMs === null)
         m.firstFinishMs = r.finishMs;
   const all = m.runs.every((r) => r.ended !== null);
   const grace = m.mode.ranking === "race" && m.firstFinishMs !== null && m.simMs >= m.firstFinishMs + m.mode.finishGraceMs;
   if (all || grace)
      m.ended = (m.mode.ranking === "team" ? m.runs.every((r) => r.ended === "win") : m.runs.some((r) => r.ended === "win")) ? "win" : "timeup";
   // Co-op dual plates give a safe bypass: two heroes occupy opposite switch lanes.
   if (m.mode.ranking === "team" && m.runs.some((r) => r.hero.roll && r.hero.plate === 0) && m.runs.some((r) => r.hero.roll && r.hero.plate === m.runs[0].board.turns.length - 1) && m.simMs > before) {
      m.runs[0].board.jamUntil.fill(0);
      // Holding the two marked outer plates powers the middle routing bypass.
      for (let j = 1; j < m.runs[0].board.turns.length - 1; j++)
         m.runs[0].board.turns[j] = 0;
   }
}
