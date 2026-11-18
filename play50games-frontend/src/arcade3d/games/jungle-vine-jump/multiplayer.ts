// Jungle Vine Jump local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes climb the same tree.
// Pure: N VineRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules (the card):
// - The tree is shared: a dry vine one hero snaps is down for all (downUntil is one array), the orbs
//   and emeralds go to whoever reaches them first.
// - Co-op (MODES.coop): two heroes on one vine add their pumps (each pumps x1.5 per extra rider), so
//   they swing higher together; Kiro's shield, Zuno's magnet and Vexa's phase cover the whole team
//   (onAllyPower); checkpoints are shared; the team clears the level when every hero is through
//   (level 5: when each has downed its King).
// - Versus race: grabbing a vine a rival is on makes it heavier, so it swings slower (each pumps x0.75);
//   first to the top wins, the others get finishGraceMs, then the run ends.
// - A hero more than 10 m under the highest hero is sent back to its last platform.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { STEP_MS, createRun, createStepInput, runTimeMs, sendBack, step, type StepEvents, type StepInput, type VineRun } from "./rules";
import { heroById, type HeroId, type PowerId } from "./heroes";

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<VineRun, StepEvents>;
   runs: VineRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** A hero falls this far under the highest hero and is sent back (m). */
export const MP_FALL_M = 10;
/** Co-op: each extra rider on the vine adds this much to the pump; versus: a rival on it scales it by RIVAL_PUMP. */
export const TANDEM_PUMP = 0.5;
export const RIVAL_PUMP = 0.75;

/** onAllyPower (co-op): a shield, magnet or phase covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<VineRun, PowerId>): void {
   if (power === "shield") ally.shieldUntil = Math.max(ally.shieldUntil, source.shieldUntil);
   else if (power === "magnet") ally.magnetUntil = Math.max(ally.magnetUntil, source.magnetUntil);
   else if (power === "phase") ally.phaseUntil = Math.max(ally.phaseUntil, source.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<VineRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "kiro"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (const r of runs) {
      // one shared tree: the same arrays, so a vine snapped by one is down for all
      r.downUntil = first.downUntil;
      r.orbTaken = first.orbTaken;
      r.emeraldTaken = first.emeraldTaken;
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<VineRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** The pump scale of each run from who else hangs on its vine (co-op: tandem; versus: heavy). */
export function pumpScales(m: MultiRun): void {
   for (const r of m.runs) {
      if (r.hero.vine < 0) {
         r.pumpScale = 1;
         continue;
      }
      let others = 0;
      for (const q of m.runs) if (q !== r && q.ended === null && q.hero.vine === r.hero.vine) others += 1;
      r.pumpScale = others === 0 ? 1 : m.mode.id === "coop" ? 1 + TANDEM_PUMP * others : Math.pow(RIVAL_PUMP, others);
   }
}

/** One frame for every hero. Returns each run's events. After the end every later step does nothing. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const runs = m.runs;
   pumpScales(m);
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   let ms = 0;
   let top = -Infinity;
   let best = runs[0].checkpoint;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
      if (r.ended === null && r.hero.y > top) top = r.hero.y;
      if (r.course.pads[r.checkpoint].y > r.course.pads[best].y) best = r.checkpoint;
   }
   m.simMs = ms;
   for (const r of runs) {
      if (m.mode.sharedCheckpoints) r.checkpoint = best;
      if (r.ended === null && top - r.hero.y > MP_FALL_M) sendBack(r);
   }
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** How far up the tree a run is (m). */
export function progressOf(r: VineRun): number {
   return Math.max(0, Math.round(r.hero.y));
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

/** The hero highest up still climbing (the camera anchor in a race, the King the scene draws). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.y > m.runs[best].hero.y) best = i;
   }
   return Math.max(0, best);
}

export { STEP_MS };
