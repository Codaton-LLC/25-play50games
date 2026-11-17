// Space Pod Jump local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes in the same system, side by
// side in parallel copies of it (stacked along y), the same seed and level for everyone, stepped in
// lock-step with the framework's stepPlayerSims. Pure.
// - Versus race to the dock: slingshotting past a rival steals 1 m/s from them (the card): a hero passing
//   within 2 m of a rival's place (in the copies' shared coordinates) while faster takes 1 m/s off it.
// - Co-op: two heroes charging pods on the same body at once launch together for a double-strength
//   escape (+2 m/s each, the card's co-op route); Kiro's shield, Zuno's magnet and Vexa's phase cover the
//   team (onAllyPower). The team clears when every hero is docked.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { NONE, createRun, createStepInput, distanceOf, runTimeMs, step, type PodRun, type StepEvents, type StepInput } from "./rules";

/** The copies stand this far apart along y (m). */
export const COPY_GAP = 70;
/** Versus: the slingshot steal (m/s) within this reach (m), once per pair every STEAL_MS. */
export const STEAL = { dv: 1, reach: 2, cooldownMs: 1500 } as const;
/** Co-op: a double launch adds this to each launch (m/s). */
export const DOUBLE_LAUNCH = 2;

export function copyY(i: number, n: number): number {
   return (i - (n - 1) / 2) * COPY_GAP;
}

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<PodRun, StepEvents>;
   runs: PodRun[];
   offsets: number[];
   /** versus: the last steal (pair i * 4 + j) */
   stealAt: Float64Array;
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<PodRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<PodRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "vexa"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const offsets = group.sims.map((_r, i) => copyY(i, n));
   return { mode: MODES[modeId], group, runs: group.sims, offsets, stealAt: new Float64Array(16).fill(-1e9), simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<PodRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const runs = m.runs;
   // co-op: two heroes charging pods on the same body at once launch together
   if (m.mode.ranking === "team") {
      for (let i = 0; i < runs.length; i++) {
         for (let j = i + 1; j < runs.length; j++) {
            const a = runs[i].hero;
            const b = runs[j].hero;
            if (a.pod !== NONE && b.pod !== NONE && a.body === b.body) {
               runs[i].launchBonus = DOUBLE_LAUNCH;
               runs[j].launchBonus = DOUBLE_LAUNCH;
            }
         }
      }
   }
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const ev = events[i];
      if (ev?.powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (ev?.finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   // versus: a faster hero passing close to a rival's place steals 1 m/s from them
   if (m.mode.ranking === "race") {
      for (let i = 0; i < runs.length; i++) {
         for (let j = 0; j < runs.length; j++) {
            if (i === j) continue;
            const a = runs[i].hero;
            const b = runs[j].hero;
            if (a.grounded || b.grounded) continue;
            if (Math.hypot(a.x - b.x, a.y - b.y) > STEAL.reach) continue;
            const va = Math.hypot(a.vx, a.vy);
            const vb = Math.hypot(b.vx, b.vy);
            if (va <= vb || vb < 0.5) continue;
            if (ms - m.stealAt[i * 4 + j] < STEAL.cooldownMs) continue;
            m.stealAt[i * 4 + j] = ms;
            const k = Math.max(0, vb - STEAL.dv) / vb;
            b.vx *= k;
            b.vy *= k;
         }
      }
   }
   m.simMs = Math.max(m.simMs, ms);
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && m.simMs >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r) : null,
      score: r.orbs,
      progress: Math.round(distanceOf(r)),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
