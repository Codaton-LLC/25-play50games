// Ring Jump Challenge local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes dive the same canyon.
// Pure: N RingRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - The canyon is shared: the rings, the orbs and the broken seals are one set. In versus (the card's
//   best mode) whoever threads a ring first takes its points, so lines cross and you jostle; the rest
//   pass through an empty ring (no miss).
// - Co-op (MODES.coop): powers combine through onAllyPower: Kiro's shield and Vexa's phase cover the
//   team, Zuno's magnet pulls orbs for everyone; the team clears the level when every hero has landed.
// - Versus race: the most points wins; once the first hero lands the others get finishGraceMs.
// Level 5's boss runs per hero (each fights its own Ray in its own eye); the camera frames them all.
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers -> core
// isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, step, type RingRun, type StepEvents, type StepInput } from "./rules";

/** Heroes stand this far apart (m, along x) on the start column's rim. */
export const START_SPACING = 1.3;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<RingRun, StepEvents>;
   runs: RingRun[];
   /** what Course.tsx draws: the shared rings, orbs and seals (player 1's run object) */
   view: RingRun;
   simMs: number;
   /** the first lander's ms (versus grace), null until someone lands */
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a shield, a magnet or a phase covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<RingRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<RingRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "nami"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.threaded = first.threaded;
      r.taken = first.taken;
      r.broken = first.broken;
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   return { mode: MODES[modeId], group, runs, view: first, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<RingRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every hero (inputs[i] = player i's step input). Returns each run's events. */
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
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
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

/** The podium standings: points decide (every lander ties on time 0), the rest by metres fallen. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? 0 : null,
      score: r.score,
      progress: Math.round(Math.max(0, r.course.top - r.hero.y)),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

/** The hero lowest in the shaft still diving (the camera's anchor in a race); 0 when none dives. */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.y < m.runs[best].hero.y) best = i;
   }
   return Math.max(0, best);
}
