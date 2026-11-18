// Cloud Hopper local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes cross the same cloud sea.
// Pure: N CloudRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - The sky is shared: the runs share the orbs (`collected`, first to reach one gets it), the clouds'
//   sink clocks (`landAt`: a cloud one hero landed on is already sinking for the next, the card's
//   versus mind game), the feathers (`featherAt`) and the broken storm walls (`broken`).
// - Co-op (MODES.coop): checkpoints are shared (one hero's beacon is everyone's respawn), and powers
//   combine through onAllyPower: Kiro's shield and Vexa's phase cover the team, Zuno's magnet
//   pulls orbs and feathers for everyone. Riko's dash and Nami's double jump stay personal here. The
//   team clears the level when every hero stands on the rainbow bridge.
// - Versus race: first to the bridge wins; the others get finishGraceMs to finish, then the run ends.
// A solo run never comes here: Scene.tsx keeps the solo path exactly as before, and multiplayer runs
// are never ranked (index.tsx runPlayers -> core isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type CloudRun, type StepEvents, type StepInput } from "./rules";

/** Heroes stand this far apart (m, along x) on the start platform. */
export const START_SPACING = 1.1;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<CloudRun, StepEvents>;
   runs: CloudRun[];
   /** what Course.tsx draws: the shared orbs and clouds, the furthest checkpoint anyone reached */
   view: CloudRun;
   /** the furthest run clock (all clocks run in lock-step until a run ends) */
   simMs: number;
   /** the first finisher's finish ms (versus grace), null until someone finishes */
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/**
 * onAllyPower (co-op): what a hero's power does for an ally. Effects end at the same rules ms as
 * the source's own, so a shared shield never lasts longer than the one that fired.
 */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<CloudRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<CloudRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "riko"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.collected = first.collected;
      r.landAt = first.landAt;
      r.featherAt = first.featherAt;
      r.broken = first.broken;
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   const view: CloudRun = { ...runs[0], checkpoint: 0 };
   return { mode: MODES[modeId], group, runs, view, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<CloudRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/**
 * One frame for every hero (inputs[i] = player i's step input). Returns each run's events (the
 * runs' own objects). After the end every later step does nothing.
 */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
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
   m.simMs = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** A hero still in the race (the camera frames it; a finisher parks on the bridge). */
export function stillClimbing(m: MultiRun, i: number): boolean {
   return m.runs[i]?.ended === null;
}

/** The podium standings: a finisher by its run time (finish ms minus the orb and flow bonus), the rest by distance. */
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

/** The hero furthest along the run still racing (the camera's zoom-limit anchor in a race); 0 when none races. */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.z < m.runs[best].hero.z) best = i;
   }
   return Math.max(0, best);
}
