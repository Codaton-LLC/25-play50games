import type { LevelId } from "../../types";
import { MODES, dispatchAllyPower, type ModeId } from "../../menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec } from "../../menu2/multiplayer/simulate";
import { createRun, step, idleInput, type SnowRun, type StepInput, type Events } from "./rules";
import type { HeroId } from "./heroes";
import { heightAt } from "./slope";

const SPEC: PlayerSimSpec<SnowRun, StepInput, Events> = { create: () => createRun(1), step };
export function createMultiRun(seed: number, level: LevelId, heroes: HeroId[], mode: ModeId) {
   const group = createPlayerSims({ ...SPEC, create: (s, i) => createRun(s, level, heroes[i]) }, seed, Math.max(1, Math.min(4, heroes.length)));
   group.sims.forEach((r, i) => { r.hero.x = (i - (group.sims.length - 1) / 2) * 1.2; });
   return { group, runs: group.sims, mode: MODES[mode], simMs: 0, firstFinishMs: null as number | null, ended: null as "win" | "timeup" | null, gatesAt: group.sims.map(() => ({ gate: -1, at: -Infinity })) };
}
export type MultiRun = ReturnType<typeof createMultiRun>;
export function leaderIndex(m: MultiRun) {
   let leader = 0;
   m.runs.forEach((r, i) => { if (r.distance > m.runs[leader].distance) leader = i; });
   return leader;
}
export function needsSplit(m: MultiRun): boolean {
   return m.runs.length === 2 && Math.abs(m.runs[0].distance - m.runs[1].distance) > 35;
}
export function sharedSimMs(runs: readonly SnowRun[]): number {
   let ms = 0;
   for (const r of runs) ms = Math.max(ms, r.simMs);
   return ms;
}
export function stepMulti(m: MultiRun, dt: number, inputs: StepInput[]): Events[] {
   if (m.ended) return m.runs.map((r) => r.events);
   for (const r of m.runs) r.draft = m.mode.id === "coop" && m.runs.some((a) => a !== r && a.distance - r.distance > 1 && a.distance - r.distance < 7 && Math.abs(a.hero.x - r.hero.x) < 2.5);
   const events = stepPlayerSims(SPEC, m.group, dt, inputs, idleInput());
   m.simMs = Math.max(...m.runs.map((r) => r.simMs));
   m.runs.forEach((r, i) => {
      if (events[i].powered) dispatchAllyPower(m.mode, m.runs, i, r.heroId, ({ source, ally, power }) => {
         if (power === "kiro") ally.immuneUntil = Math.max(ally.immuneUntil, source.powerUntil);
         if (power === "zuno" || power === "riko") ally.boost = Math.max(ally.boost, 4);
      });
      if (events[i].gate && m.mode.id === "coop") {
         const g = r.nextGate - 1;
         if (g % 6 === 0 && m.gatesAt.some((a, j) => j !== i && a.gate === g && m.simMs - a.at < 600)) {
            m.runs.forEach((a) => { a.twinUntil = m.simMs + 2000; });
         }
         m.gatesAt[i] = { gate: g, at: m.simMs };
      }
      if (r.ended === "win" && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
   });
   if (m.runs.length >= 3) {
      const leader = m.runs[leaderIndex(m)];
      for (const r of m.runs) if (!r.ended && leader.distance - r.distance > 55) {
         // A checkpoint can be almost 150 m back. Respawn into the visible leader pack instead.
         r.distance = Math.max(0, leader.distance - 20);
         r.hero.z = -r.distance;
         const gate = r.course.gates.findIndex((g) => g.d > r.distance);
         r.nextGate = gate < 0 ? r.course.gates.length : gate;
         r.hero.x = leader.hero.x;
         r.hero.y = heightAt(r.distance);
         r.hero.vx = r.hero.vy = 0;
         r.airMs = r.airTotal = 0;
         r.airRamp = -1;
         r.speed = leader.speed;
         r.checkpoint = leader.checkpoint;
         r.immuneUntil = r.simMs + 750;
      }
   }
   const all = m.runs.every((r) => r.ended !== null);
   const grace = m.mode.ranking === "race" && m.firstFinishMs !== null && m.simMs >= m.firstFinishMs + m.mode.finishGraceMs;
   // Keep advancing the race clock if all remaining players stopped (e.g. one caught by avalanche).
   if (all || grace) {
      const wins = m.runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === m.runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}
