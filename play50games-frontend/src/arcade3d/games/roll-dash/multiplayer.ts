// Roll Dash local multiplayer (menu2/multiplayer, phase M1): 2-4 rollers on the same street.
// Pure: N DashRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - Versus race (the card's best fit): the same street and locks, each player with a private five-hero
//   roster (two may both be Riko), each player told apart by a ring in the player's slot colour; first to
//   the gate wins (level 5: first to beat the Hawk), the others get finishGraceMs.
// - Co-op relay: the same street; Kiro's shield and Zuno's magnet cover the whole team (onAllyPower), and
//   an unlock by one keeps every teammate's flow chain alive. The team clears when everyone is through.
//   Not built from the card: the 6-lane street, the hero bench pool and the high-five swap.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { STEP_MS, createRun, createStepInput, runTimeMs, step, type DashRun, type StepEvents, type StepInput } from "./rules";
import { heroById, type HeroId, type PowerId } from "./heroes";

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<DashRun, StepEvents>;
   runs: DashRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "lose" | "timeup" | null;
}

/** onAllyPower (co-op): a shield or a magnet covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<DashRun, PowerId>): void {
   if (power === "shield") ally.shieldUntil = Math.max(ally.shieldUntil, source.shieldUntil);
   else if (power === "magnet") ally.magnetUntil = Math.max(ally.magnetUntil, source.magnetUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<DashRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "riko"), step };
   const group = createPlayerSims(spec, seed, n);
   return { mode: MODES[modeId], group, runs: group.sims, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<DashRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every roller. Returns each run's events. After the end every later step does nothing. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const runs = m.runs;
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.active).power, onAllyPower, active);
      }
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   if (m.mode.id === "coop") {
      for (let i = 0; i < runs.length; i++) {
         if (events[i].openCount <= 0) continue;
         for (const q of runs) if (q !== runs[i] && q.combo.chain > 0) q.combo.lastMs = Math.max(q.combo.lastMs, runs[i].combo.lastMs);
      }
   }
   m.simMs = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** How far a run is (m). */
export function progressOf(r: DashRun): number {
   return Math.max(0, Math.round(r.hero.d));
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r.finishMs, r.combo.bonusTotal) : null,
      score: r.orbs,
      progress: progressOf(r),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

/** The roller furthest down the street still rolling (the camera anchor in a race). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.d > m.runs[best].hero.d) best = i;
   }
   return Math.max(0, best);
}

export { STEP_MS };
