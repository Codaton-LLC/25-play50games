// Neon Cube Jump local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes on the same field.
// Pure: N NeonRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - Co-op (the card): the flip bus is SHARED: anyone's jump flips everyone's field (NeonRun.pendingFlips),
//   so the team has to call its jumps; Kiro's shield covers the team. The team clears when everyone
//   reaches the goal (on level 5 when Flipframe falls).
// - Versus race: each player keeps their own flip state (never shared); the first to the goal wins.
// A solo run never comes here, and multiplayer runs are never ranked, so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, step, type NeonRun, type StepEvents, type StepInput } from "./rules";

/** Heroes start this far apart on the start cube (m, along x). */
export const START_SPACING = 0.45;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<NeonRun, StepEvents>;
   runs: NeonRun[];
   simMs: number;
   ended: "win" | "timeup" | null;
   /** each run's own jump flips at the last frame (co-op's shared bus) */
   lastFlips: number[];
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<NeonRun, PowerId>): void {
   if (power === "shield") ally.hero.shieldUntil = Math.max(ally.hero.shieldUntil, source.hero.shieldUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<NeonRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "vexa"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   for (let i = 0; i < n; i++) runs[i].hero.x += (i - (n - 1) / 2) * START_SPACING;
   return { mode: MODES[modeId], group, runs, simMs: 0, ended: null, lastFlips: runs.map(() => 0) };
}

const SPEC: PlayerSimSpec<NeonRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   // co-op: the jumps each run made this frame flip every other run's field too
   const coop = m.mode.id === "coop";
   if (coop) {
      const own = runs.map((r, i) => r.ownFlips - m.lastFlips[i]);
      for (let i = 0; i < runs.length; i++) {
         let add = 0;
         for (let j = 0; j < runs.length; j++) if (j !== i && runs[j].ended === null) add += own[j];
         runs[i].pendingFlips += add;
      }
   }
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (r.simMs > ms) ms = r.simMs;
      m.lastFlips[i] = r.ownFlips;
   }
   m.simMs = ms;
   if (coop ? runs.every((r) => r.ended === "win") : runs.some((r) => r.ended === "win")) m.ended = "win";
   else if (runs.every((r) => r.ended !== null)) m.ended = runs.some((r) => r.ended === "win") ? "win" : "timeup";
   if (m.ended !== null && !coop) for (const r of runs) if (r.ended === null) r.ended = "timeup";
   return events;
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? r.finishMs : null,
      score: r.orbs,
      progress: -r.hero.z,
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
