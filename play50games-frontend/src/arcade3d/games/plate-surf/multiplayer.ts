// Plate Surf local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes ride the same wave.
// Pure: N SurfRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules (the card's "Multiplayer"):
// - The wave is shared: the runs share the orbs (`collected`, first to reach one gets it) and the
//   broken reef walls (`laneOpen`). Each rider has its own curl: a straggler is pulled in by it.
// - Co-op (MODES.coop): checkpoints are shared, Kiro's shield, Zuno's magnet and Vexa's phase cover the
//   team (onAllyPower), and "tandem pump": riding side by side (within TANDEM.dz along the wave)
//   speeds both up by TANDEM.accel (m/s², capped at V_MAX, so at most the card's +10 % at top speed
//   over a few seconds). The team clears when every rider is in the lagoon.
// - Versus race: riding in front gets no draft; the riders behind the leader (within DRAFT) pick up
//   DRAFT.accel. Most orbs plus the finish decide the podium; the others get finishGraceMs.
// A solo run never comes here: Scene.tsx keeps the solo path, and multiplayer runs are never ranked
// (index.tsx runPlayers -> core isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { V_MAX, createRun, createStepInput, runTimeMs, step, type StepEvents, type StepInput, type SurfRun } from "./rules";

/** Riders start this far apart across the face (m). */
export const START_SPACING = 1.4;
/** Co-op tandem pump: side by side within dz (m) along the wave, both pick up accel (m/s²). */
export const TANDEM = { dz: 5, accel: 0.8 } as const;
/** Versus draft: a rider 2-14 m behind the leader picks up accel (m/s²); the leader never does. */
export const DRAFT = { near: 2, far: 14, accel: 0.6 } as const;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<SurfRun, StepEvents>;
   runs: SurfRun[];
   /** what Course.tsx draws: the shared orbs and walls, the furthest checkpoint anyone reached */
   view: SurfRun;
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a hero's shield, magnet or phase covers the ally for as long as its own lasts. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<SurfRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<SurfRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "nami"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.collected = first.collected;
      r.laneOpen = first.laneOpen;
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   const view: SurfRun = { ...runs[0], checkpoint: 0 };
   return { mode: MODES[modeId], group, runs, view, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<SurfRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** The tandem / draft speed-up for every rider this frame (pure; dtMs = the frame). */
export function applyPackSpeed(m: MultiRun, dtMs: number): void {
   const runs = m.runs;
   const dt = dtMs / 1000;
   if (m.mode.ranking === "team") {
      for (let i = 0; i < runs.length; i++) {
         const a = runs[i].hero;
         if (runs[i].ended !== null || a.state !== "play" || !a.grounded) continue;
         let side = false;
         for (let j = 0; j < runs.length && !side; j++) {
            if (j === i || runs[j].ended !== null || runs[j].hero.state !== "play") continue;
            if (Math.abs(runs[j].hero.z - a.z) <= TANDEM.dz) side = true;
         }
         if (side) a.v = Math.min(V_MAX, a.v + TANDEM.accel * dt);
      }
      return;
   }
   let lead = Infinity;
   for (const r of runs) if (r.ended === null && r.hero.state === "play") lead = Math.min(lead, r.hero.z);
   for (const r of runs) {
      const a = r.hero;
      if (r.ended !== null || a.state !== "play" || !a.grounded) continue;
      const behind = a.z - lead;
      if (behind >= DRAFT.near && behind <= DRAFT.far) a.v = Math.min(V_MAX, a.v + DRAFT.accel * dt);
   }
}

/** One frame for every rider (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   applyPackSpeed(m, dtMs);
   let top = 0;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.checkpoint > top) top = r.checkpoint;
      if (r.simMs > ms) ms = r.simMs;
   }
   if (m.mode.sharedCheckpoints) for (const r of runs) if (r.ended === null && r.checkpoint < top) r.checkpoint = top;
   m.view.checkpoint = top;
   m.view.simMs = ms;
   m.view.mainOrbs = runs.reduce((n, r) => n + r.mainOrbs, 0);
   m.simMs = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** The podium standings: a finisher by its run time, the rest by distance; the score is the orbs. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) : null,
      score: r.orbs,
      progress: Math.round(Math.max(0, r.bestDist)),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

/** The rider furthest along still riding (the camera's zoom-limit anchor in a race). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.z < m.runs[best].hero.z) best = i;
   }
   return Math.max(0, best);
}
