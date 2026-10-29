// Temple Lantern Jump local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes climb the same shaft.
// Pure: N TempleRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - The light is shared: every lantern lit by one hero burns for all (litUntil, litAt, visited are one
//   array), each hero's ember lights the ledges for the others (allies), a brazier floods the shaft for
//   everyone, and the orbs and sparks are taken by whoever reaches them first. Throwing an ember at a
//   lantern relights it for whoever is below.
// - Co-op (MODES.coop): Kiro's shield, Zuno's magnet and Vexa's phase cover the whole team
//   (onAllyPower); checkpoints are shared; two heroes standing on the twin plates of the start deck
//   at once light the great chandelier (the shaft is flooded for 20 s, the card's co-op-only route);
//   the team clears the level when every hero is through (level 5: when each has downed its Queen).
// - Versus race: first through the roof wins; the others get finishGraceMs, then the run ends.
// - A hero more than 8 m under the highest hero is sent back to the last lantern.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { FLOOD_MS, STEP_MS, createRun, createStepInput, emberRadius, runTimeMs, sendBack, step, type StepEvents, type StepInput, type TempleRun } from "./rules";
import { heroById, type HeroId, type PowerId } from "./heroes";

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<TempleRun, StepEvents>;
   runs: TempleRun[];
   simMs: number;
   firstFinishMs: number | null;
   /** the great chandelier is lit (co-op, level 1) */
   chandelier: boolean;
   ended: "win" | "timeup" | null;
}

/** A hero falls this far under the highest hero and is sent back (m). */
export const MP_FALL_M = 8;
/** A twin plate counts when a grounded hero is this close (m). */
export const PLATE_R = 0.95;

/** onAllyPower (co-op): a shield, magnet or phase covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<TempleRun, PowerId>): void {
   if (power === "shield") ally.shieldUntil = Math.max(ally.shieldUntil, source.shieldUntil);
   else if (power === "magnet") ally.magnetUntil = Math.max(ally.magnetUntil, source.magnetUntil);
   else if (power === "phase") ally.phaseUntil = Math.max(ally.phaseUntil, source.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<TempleRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "kiro"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (const r of runs) {
      // one shared shaft: the same arrays, so a lantern lit by one burns for all
      r.litUntil = first.litUntil;
      r.litAt = first.litAt;
      r.visited = first.visited;
      r.orbTaken = first.orbTaken;
      r.sparkTaken = first.sparkTaken;
      r.brazierLit = first.brazierLit;
      r.touched = first.touched;
      r.gone = first.gone;
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, firstFinishMs: null, chandelier: false, ended: null };
}

const SPEC: PlayerSimSpec<TempleRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** How many heroes stand on the twin plates, as a 2-bit mask (left 1, right 2). */
export function platesHeld(m: MultiRun): number {
   const plates = m.runs[0].course.plates;
   if (plates.length < 2) return 0;
   let mask = 0;
   for (const r of m.runs) {
      if (!r.hero.grounded || r.hero.y > 0.2) continue;
      for (let k = 0; k < 2; k++) if (Math.hypot(r.hero.x - plates[k].x, r.hero.z - plates[k].z) <= PLATE_R) mask |= 1 << k;
   }
   return mask;
}

/** One frame for every hero. Returns each run's events. After the end every later step does nothing. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const runs = m.runs;
   // each hero's ember lights the others' ledges
   for (const r of runs) {
      r.allies.length = 0;
      for (const q of runs) if (q !== r) r.allies.push({ x: q.hero.x, y: q.hero.y, z: q.hero.z, radius: emberRadius(q) });
   }
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   let ms = 0;
   let top = -Infinity;
   let flood = 0;
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
      if (r.floodUntil > flood) flood = r.floodUntil;
      if (r.course.pads[r.checkpoint].y > r.course.pads[best].y) best = r.checkpoint;
   }
   m.simMs = ms;
   // a brazier floods the whole shaft; the great chandelier too
   if (m.mode.id === "coop" && !m.chandelier && platesHeld(m) === 3) {
      m.chandelier = true;
      flood = Math.max(flood, ms + FLOOD_MS);
      events[0].plate = true;
   }
   for (const r of runs) {
      r.floodUntil = flood;
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

/** How far up the shaft a run is (m). */
export function progressOf(r: TempleRun): number {
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

/** The hero highest up still climbing (the camera anchor in a race, the Queen the scene draws). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.y > m.runs[best].hero.y) best = i;
   }
   return Math.max(0, best);
}

export { STEP_MS };
