// Spin Pole Climb local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes climb the same pole field.
// Pure: N SpinRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - The field is shared: an orb taken by one hero is gone for the others (orbTaken is one array), and
//   so is Riko's cracked urn once smashed.
// - Co-op (MODES.coop): Kiro's shield, Zuno's magnet and Vexa's phase cover the whole team
//   (onAllyPower); heroes on the same stair share the flow chain (each lap one of them counts links
//   everyone's meter: the card's shared lap combo); the team clears the level when every hero is through.
// - Versus race (the card's best fit): first to the goal cap wins; the others get finishGraceMs.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { STEP_MS, createRun, createStepInput, floorY, runTimeMs, step, type SpinRun, type StepEvents, type StepInput } from "./rules";
import { heroById, type HeroId, type PowerId } from "./heroes";

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<SpinRun, StepEvents>;
   runs: SpinRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a shield, magnet or phase covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<SpinRun, PowerId>): void {
   if (power === "shield") ally.shieldUntil = Math.max(ally.shieldUntil, source.shieldUntil);
   else if (power === "magnet") ally.magnetUntil = Math.max(ally.magnetUntil, source.magnetUntil);
   else if (power === "phase") ally.phaseUntil = Math.max(ally.phaseUntil, source.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<SpinRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "kiro"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (const r of runs) {
      r.orbTaken = first.orbTaken;
      r.urnBroken = first.urnBroken;
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<SpinRun, StepInput, StepEvents> = { create: () => createRun(0), step };
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
   // co-op: a lap counted by one hero keeps every teammate on the same stair's chain alive
   if (m.mode.id === "coop") {
      for (let i = 0; i < runs.length; i++) {
         if (events[i].laps <= 0) continue;
         for (const q of runs) if (q !== runs[i] && q.hero.helix === runs[i].hero.helix && q.combo.chain > 0) q.combo.lastMs = Math.max(q.combo.lastMs, runs[i].combo.lastMs);
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

/** How high a run is (m). */
export function progressOf(r: SpinRun): number {
   return Math.max(0, Math.round(floorY(r)));
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) : null,
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

/** The hero highest up still climbing (the camera anchor in a race). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.y > m.runs[best].hero.y) best = i;
   }
   return Math.max(0, best);
}

export { STEP_MS };
