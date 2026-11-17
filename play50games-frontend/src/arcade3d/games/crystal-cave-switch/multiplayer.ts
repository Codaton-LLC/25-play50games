// Crystal Cave Switch local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes in the same cave.
// Pure: N CaveRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - Co-op: the rooms are shared (their sequences, lit crystals, timers and gates): split up and strike
//   the crystals together; Kiro's shield covers the team. The team clears when everyone reaches the goal
//   (level 5: when the Prism falls).
// - Versus race: each player solves their own rooms; the first to the goal wins.
// A solo run never comes here, and multiplayer runs are never ranked, so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, step, type CaveRun, type StepEvents, type StepInput } from "./rules";

export const START_SPACING = 0.8;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<CaveRun, StepEvents>;
   runs: CaveRun[];
   simMs: number;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<CaveRun, PowerId>): void {
   if (power === "shield") ally.hero.shieldUntil = Math.max(ally.hero.shieldUntil, source.hero.shieldUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<CaveRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "vexa"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
      if (modeId === "coop") {
         r.progress = first.progress;
         r.solved = first.solved;
         r.deadline = first.deadline;
         r.lit = first.lit;
      }
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, ended: null };
}

const SPEC: PlayerSimSpec<CaveRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (r.simMs > ms) ms = r.simMs;
   }
   m.simMs = ms;
   const coop = m.mode.id === "coop";
   if (coop ? runs.every((r) => r.ended === "win") : runs.some((r) => r.ended === "win")) m.ended = "win";
   else if (runs.every((r) => r.ended !== null)) m.ended = runs.some((r) => r.ended === "win") ? "win" : "timeup";
   if (m.ended !== null && !coop) for (const r of runs) if (r.ended === null) r.ended = "timeup";
   return events;
}

/** Rooms solved by run r. */
export const roomsSolved = (r: CaveRun): number => r.solved.reduce((n, v) => n + v, 0);

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? r.finishMs : null,
      score: r.orbs,
      progress: roomsSolved(r),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
