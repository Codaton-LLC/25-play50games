// Color Arena Survival local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes on ONE arena.
// Pure: N ArenaRuns that share a single Arena (rules.ts unchanged): run 0 advances the floor, the
// rounds and the Keeper (even after its own hero is out), every run plays its own hero on it, stepped in
// lock-step with the framework's stepPlayerSims. The shared rules:
// - A lock-in needs EVERY hero still in to stand on the called colour (the arena's votes); the orb, the
//   gap shard and the Keeper's beacon are shared (first come).
// - Co-op (MODES.coop): Kiro's shield, Zuno's magnet and Vexa's phase cover the whole team
//   (onAllyPower); the team clears the level when every hero survives it.
// - Versus: the same floor; the last heroes standing finish together, placed by their orbs.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { STEP_MS, createArena, createRun, createStepInput, step, type Arena, type ArenaRun, type StepEvents, type StepInput } from "./rules";
import { heroById, type HeroId, type PowerId } from "./heroes";

export interface MultiRun {
   mode: ModeConfig;
   arena: Arena;
   group: PlayerSims<ArenaRun, StepEvents>;
   runs: ArenaRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a shield, magnet or phase covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<ArenaRun, PowerId>): void {
   if (power === "shield") ally.shieldUntil = Math.max(ally.shieldUntil, source.shieldUntil);
   else if (power === "magnet") ally.magnetUntil = Math.max(ally.magnetUntil, source.magnetUntil);
   else if (power === "phase") ally.phaseUntil = Math.max(ally.phaseUntil, source.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const arena = createArena(seed, level);
   const spec: PlayerSimSpec<ArenaRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "kiro", arena, i), step };
   const group = createPlayerSims(spec, seed, n);
   return { mode: MODES[modeId], arena, group, runs: group.sims, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<ArenaRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every hero. Returns each run's events. After the end every later step does nothing. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const runs = m.runs;
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   m.simMs = ms;
   if (runs.every((r) => r.ended !== null)) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** How far along a run is: the rounds it survived. */
export function progressOf(r: ArenaRun): number {
   return r.survived;
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? r.finishMs : null,
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

/** The hero still in with the most rounds survived (the camera anchor in versus). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].survived > m.runs[best].survived) best = i;
   }
   return Math.max(0, best);
}

export { STEP_MS };
