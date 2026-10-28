// Wind Tunnel Escape local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes in the same storm
// tunnel. Pure: N WindRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with
// the framework's stepPlayerSims, all sharing ONE tunnel world (rules.ts World): the fans and vents,
// the covers, the lifts, the orbs, the anemometers, the storm and the Gale Engine. That is the card's
// "best fit" co-op: one player turns the fans while another rides them, and a fan one hero sets is set
// for everyone. Run 0 owns the world (it moves the lifts, the crates, the storm and the boss); the
// others read it. The Gale Engine wakes when any hero enters its arena.
// - Co-op (MODES.coop): checkpoints are shared, Kiro's shield, Zuno's magnet and Vexa's phase cover the
//   team (onAllyPower); the team clears when every hero stands in the exit.
// - Versus race: first through the exit wins; the others get finishGraceMs, then the run ends. A rival's
//   fan setup is yours too (turn the fans into the rival's way).
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers -> core
// isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { courseFor, createRun, createStepInput, createWorld, runTimeMs, step, type StepEvents, type StepInput, type WindRun } from "./rules";

/** Heroes stand this far apart (m, along x) on the start pad. */
export const START_SPACING = 1.2;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<WindRun, StepEvents>;
   runs: WindRun[];
   /** the furthest run clock (all clocks run in lock-step until a run ends) */
   ms: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): what a hero's power does for an ally, ending when the source's own does. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<WindRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const world = createWorld(courseFor(level));
   const spec: PlayerSimSpec<WindRun, StepInput, StepEvents> = {
      create: (s, i) => {
         const r = createRun(s, level, heroes[i] ?? "nami", world);
         r.owner = i === 0;
         return r;
      },
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   for (let i = 0; i < n; i++) runs[i].hero.x += (i - (n - 1) / 2) * START_SPACING;
   return { mode: MODES[modeId], group, runs, ms: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<WindRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every hero (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   const w = runs[0].world;
   const a = runs[0].course.arena;
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
      if (r.ms > ms) ms = r.ms;
      if (a && !w.bossAwake && r.hero.state === "play" && r.hero.z < a.z0) w.bossAwake = true;
   }
   if (m.mode.sharedCheckpoints) for (const r of runs) if (r.ended === null && r.checkpoint < top) r.checkpoint = top;
   // the world keeps moving for those still in: the first unfinished run owns it
   const owner = runs.findIndex((r) => r.ended === null);
   if (owner >= 0) for (let i = 0; i < runs.length; i++) runs[i].owner = i === owner;
   m.ms = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** The podium standings: a finisher by its run time (finish minus the orb and flow bonus), the rest by distance. */
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

/** The hero furthest along the tunnel still racing (the camera's anchor in a race); 0 when none races. */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.z < m.runs[best].hero.z) best = i;
   }
   return Math.max(0, best);
}
