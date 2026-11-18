// Dragon Cave Rush local multiplayer (menu2/multiplayer, phase M1): 2-4 carts on the same rails. Pure: N
// CaveRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the framework's
// stepPlayerSims. The carts start in a short column (P1 in front, START_GAP m apart; a cart's head start
// is added back to its time, so the order on the rails is no advantage). What the carts share:
// - the orbs (an orb one cart takes is gone for the rest: a race for them),
// - Riko's broken barricades (a shortcut one Riko opens is open for everyone),
// - Cindermaw: the Scene draws one dragon, on the leader's tail (the card: she targets the leader).
// - Co-op (MODES.coop): Kiro's shield, Zuno's magnet and Vexa's phase cover the team (onAllyPower);
//   the team clears when every cart is through the skull gate.
// - Versus race: first through the gate wins; the others get finishGraceMs, then the run ends.
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers -> core
// isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type CaveRun, type StepEvents, type StepInput } from "./rules";

/** The carts' spacing in the start column (m along the rails). */
export const START_GAP = 3.5;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<CaveRun, StepEvents>;
   runs: CaveRun[];
   /** each cart's head start (m) and its time (ms at the track speed), added back to its finish */
   startS: number[];
   startMs: number[];
   ms: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): what a hero's power does for an ally, ending when the source's own does. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<CaveRun, PowerId>): void {
   const s = source.cart;
   const a = ally.cart;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<CaveRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "riko"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const startS: number[] = [];
   const startMs: number[] = [];
   for (let i = 0; i < n; i++) {
      const s0 = (n - 1 - i) * START_GAP;
      runs[i].cart.s = s0;
      startS.push(s0);
      startMs.push(Math.round((s0 / runs[i].course.config.speed) * 1000));
   }
   return { mode: MODES[modeId], group, runs, startS, startMs, ms: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<CaveRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every cart (inputs[i] = player i's step input). Returns each run's events. */
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
      // a taken orb and a broken barricade are gone / open for every cart
      for (let k = 0; k < ev.orbCount; k++) for (const q of runs) q.collected[ev.orbList[k]] = 1;
      if (ev.barricade >= 0) for (const q of runs) q.broken[ev.barricade] = 1;
      if (ev.finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.ms > ms) ms = r.ms;
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

/** A cart's time on the podium: its run time plus its head start in the column. */
export function cartTimeMs(m: MultiRun, i: number): number | null {
   const r = m.runs[i];
   return r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) + m.startMs[i] : null;
}

/** How far a cart got (m from the start column's back, the head start taken off). */
export function cartProgress(m: MultiRun, i: number): number {
   return Math.round(Math.max(0, m.runs[i].cart.s - m.startS[i]));
}

/** The podium standings: a finisher by its time, the rest by distance. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: cartTimeMs(m, index),
      score: r.orbs,
      progress: cartProgress(m, index),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

/** The cart furthest along the rails still racing (the dragon's target and the camera's anchor in a race). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].cart.s > m.runs[best].cart.s) best = i;
   }
   return Math.max(0, best);
}
