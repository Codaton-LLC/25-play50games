// Flooded Ruins Escape local multiplayer (menu2/multiplayer, after Sky Tower Jump's adoption): 2-4
// heroes escape the same drowned temple. Pure: N RuinRuns from the SAME seed and level (rules.ts
// unchanged), stepped in lock-step with the framework's stepPlayerSims, plus the mode rules:
// - One temple: the runs share the orbs (`collected`: whoever reaches one first), the chambers'
//   water, the levers and the broken brick. One hero pulls a lever and the water moves for everyone:
//   in co-op one hero holds a chamber high while another swims through; in versus your lever floods
//   your rival's way as much as yours.
// - One storm tide: it starts for everyone the moment any hero starts it.
// - Level 5: one Umbra Roller for the whole group (runs[0] steps it; if that hero is out, the next
//   one still in does), so any hero's hit counts.
// - Co-op (MODES.coop): checkpoints are shared, and powers combine through onAllyPower: Kiro's
//   shield covers the team from whirlpools and jets, Zuno's magnet pulls orbs for everyone, Vexa's
//   phase is shared; Riko's dash and Nami's breach stay personal. The team clears the level when
//   every hero is at the flood gate.
// - Versus race: first to the gate wins; the others get finishGraceMs to finish, then the run ends.
// A solo run never comes here: Scene.tsx keeps the solo path as it is, and multiplayer runs are
// never ranked (index.tsx runPlayers -> core isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { NONE, createRun, createStepInput, runTimeMs, step, type RuinRun, type StepEvents, type StepInput } from "./rules";

/** Heroes stand this far apart (m, along x) on the start block. */
export const START_SPACING = 1.1;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<RuinRun, StepEvents>;
   runs: RuinRun[];
   /** what Course.tsx draws: the shared temple, the furthest checkpoint anyone reached */
   view: RuinRun;
   /** each hero's furthest escape so far (m towards -z from the start): the podium's progress */
   progress: number[];
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
export function onAllyPower({ source, ally, power }: AllyPowerEvent<RuinRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<RuinRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "nami"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.collected = first.collected;
      r.water = first.water;
      r.levers = first.levers;
      r.broken = first.broken;
      r.boss = first.boss;
      r.bossOwner = i === 0;
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   const view: RuinRun = { ...first, checkpoint: 0 };
   return { mode: MODES[modeId], group, runs, view, progress: runs.map(() => 0), simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<RuinRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/**
 * One frame for every hero (inputs[i] = player i's step input). Returns each run's events (the
 * runs' own objects). After the end every later step does nothing.
 */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   const startZ = m.view.course.supports[m.view.course.checkpoints[0]].cz;
   let top = 0;
   let ms = 0;
   let tide = NONE;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.checkpoint > top) top = r.checkpoint;
      if (r.simMs > ms) ms = r.simMs;
      if (r.tideFrom !== NONE && (tide === NONE || r.tideFrom < tide)) tide = r.tideFrom;
      if (r.hero.state === "play") m.progress[i] = Math.max(m.progress[i], Math.round(startZ - r.hero.z));
   }
   // one tide for the whole temple
   if (tide !== NONE) for (const r of runs) if (r.tideFrom === NONE || r.tideFrom > tide) r.tideFrom = tide;
   // the boss keeps going while any hero is still in
   if (runs[0].boss) {
      const owner = runs.findIndex((r) => r.bossOwner);
      if (owner < 0 || runs[owner].ended !== null) {
         const next = runs.findIndex((r) => r.ended === null);
         runs.forEach((r, i) => (r.bossOwner = i === next));
      }
   }
   if (m.mode.sharedCheckpoints) for (const r of runs) if (r.ended === null && r.checkpoint < top) r.checkpoint = top;
   m.view.checkpoint = top;
   m.view.simMs = ms;
   m.view.tideFrom = tide;
   m.view.bossPose = runs[Math.max(0, runs.findIndex((r) => r.bossOwner))].bossPose;
   m.simMs = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** A hero still in the escape (the camera frames it; a finisher parks at the gate). */
export function stillEscaping(m: MultiRun, i: number): boolean {
   return m.runs[i]?.ended === null;
}

/** The podium standings: a finisher by its run time (finish ms minus the orb and flow bonus), the rest by how far they got. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) : null,
      score: r.orbs,
      progress: m.progress[index],
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

/** The furthest hero still escaping (the camera's zoom-limit anchor in a race); 0 when none is. */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || m.runs[i].hero.z < m.runs[best].hero.z) best = i;
   }
   return Math.max(0, best);
}
