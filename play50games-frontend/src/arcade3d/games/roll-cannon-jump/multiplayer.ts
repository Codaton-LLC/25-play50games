// Roll Cannon Jump local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes fire through the
// same big top. Pure: N CannonRuns from the SAME seed and level (rules.ts unchanged), stepped in
// lock-step with the framework's stepPlayerSims, plus the mode rules:
// - The show is shared: the orbs (`collected`: first to reach one gets it), the smashed target
//   boards (`broken`: Riko opens the hidden cannon for everyone) and the paint jams.
// - Co-op (MODES.coop): Kiro's shield, Zuno's magnet and Vexa's phase cover the whole team
//   (onAllyPower); the team clears the level when every hero is through (level 5: when each has
//   downed its Ashbag).
// - Versus race (the card's "mirrored cannon lanes", here the same lane): first through the
//   finish ring wins; the others get finishGraceMs, then the run ends.
// Level 5: each hero fights its own Ashbag (the boss machine is per run); the scene draws the
// leader's. A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type CannonRun, type StepEvents, type StepInput } from "./rules";

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<CannonRun, StepEvents>;
   runs: CannonRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a shield, magnet or phase covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<CannonRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<CannonRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "riko"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (const r of runs) {
      r.collected = first.collected;
      r.broken = first.broken;
      r.jamUntil = first.jamUntil;
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<CannonRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every hero. Returns each run's events. After the end every later step does nothing. */
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

/** How far into the show a run is (m along -z from the start cannon). */
export function progressOf(r: CannonRun): number {
   return Math.max(0, Math.round(r.course.cannons[0].z - r.hero.z));
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

/** The hero furthest along still racing (the camera anchor in a race, the boss the scene draws). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.z < m.runs[best].hero.z) best = i;
   }
   return Math.max(0, best);
}
