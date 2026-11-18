// Ice Peak Jumper local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes on the same peak. Pure: N
// PeakRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the framework's
// stepPlayerSims. The heroes start side by side on the start patch. Shared between them: the orbs (one
// taken is gone for the rest). Each hero's own ice cracks under them alone; the Scene draws the leader's.
// - Co-op (MODES.coop): the checkpoints are shared (the leash: a fall drops you on the highest snow
//   patch any of you reached), Kiro's shield, Zuno's magnet and Vexa's phase cover the team
//   (onAllyPower), and the team clears when every hero stands on the summit.
// - Versus race: first to the summit wins; the others get finishGraceMs, then the run ends.
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers -> core
// isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type PeakRun, type StepEvents, type StepInput } from "./rules";

/** Heroes stand this far apart (m, along x) on the start patch. */
export const START_SPACING = 1.2;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<PeakRun, StepEvents>;
   runs: PeakRun[];
   ms: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): what a hero's power does for an ally, ending when the source's own does. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<PeakRun, PowerId>): void {
   if (power === "shield") {
      ally.shieldUntil = Math.max(ally.shieldUntil, source.shieldUntil);
      ally.shieldUsed = false;
   } else if (power === "magnet") ally.magnetUntil = Math.max(ally.magnetUntil, source.magnetUntil);
   else if (power === "phase") ally.phaseUntil = Math.max(ally.phaseUntil, source.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<PeakRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "zuno"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   for (let i = 0; i < n; i++) runs[i].hero.x += (i - (n - 1) / 2) * START_SPACING;
   return { mode: MODES[modeId], group, runs, ms: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<PeakRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every hero (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const ev = events[i];
      if (ev.powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      for (let k = 0; k < ev.orbCount; k++) for (const q of runs) q.collected[ev.orbList[k]] = 1;
      if (ev.finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.ms > ms) ms = r.ms;
   }
   if (m.mode.sharedCheckpoints) {
      // the leash: everyone's checkpoint is the highest snow patch any hero reached
      let top = runs[0].checkpoint;
      for (const r of runs) if (r.course.plats[r.checkpoint].y > r.course.plats[top].y) top = r.checkpoint;
      for (const r of runs) if (r.ended === null) r.checkpoint = top;
   }
   m.ms = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** The podium standings: a finisher by its run time, the rest by the height climbed. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) : null,
      score: r.orbs,
      progress: Math.round(Math.max(0, r.best - r.course.plats[r.course.start].y)),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

/** The hero highest up still climbing (the camera's anchor in a race); 0 when none is. */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.y > m.runs[best].hero.y) best = i;
   }
   return Math.max(0, best);
}
