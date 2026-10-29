// Color Door Sprint local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes, each in its own
// corridor side by side (the card's "parallel corridors with the same seed"). Pure: N DoorRuns from the
// SAME seed and level (rules.ts unchanged), stepped in lock-step with the framework's stepPlayerSims.
// - Versus race: the same doors and rules for everyone (the same seed); first to the finish, then the
//   others get the grace; the podium by time, then distance.
// - Co-op is the card's party "Door Roulette": every player's true door is the door of their own hero's
//   colour (each corridor rolls its walls round its hero: RunOptions.roulette; the heroes are unique in
//   co-op). Kiro's shield, Zuno's magnet and Vexa's phase cover the whole team (onAllyPower). The team
//   clears when every hero is through.
// A solo run never comes here: Scene.tsx keeps the solo path, and multiplayer runs are never ranked
// (index.tsx runPlayers -> core isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { courseFor, createRun, createStepInput, distanceOf, runTimeMs, step, type DoorRun, type StepEvents, type StepInput } from "./rules";

/** The corridors stand this far apart along x (m): each hall's width plus a stone wall between them. */
export function corridorGap(level: LevelId): number {
   return courseFor(level).half * 2 + 3.5;
}

/** Corridor i's x offset (the corridors centred on x = 0). */
export function corridorX(level: LevelId, i: number, n: number): number {
   return (i - (n - 1) / 2) * corridorGap(level);
}

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<DoorRun, StepEvents>;
   runs: DoorRun[];
   offsets: number[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a hero's shield, magnet or phase covers every ally for as long as its own lasts. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<DoorRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const roulette = modeId === "coop";
   const spec: PlayerSimSpec<DoorRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "riko", { roulette }),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const offsets = group.sims.map((_r, i) => corridorX(level, i, n));
   return { mode: MODES[modeId], group, runs: group.sims, offsets, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<DoorRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every hero (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const ev = events[i];
      if (ev?.powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (ev?.finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   m.simMs = Math.max(m.simMs, ms);
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && m.simMs >= m.firstFinishMs + m.mode.finishGraceMs;
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
      progress: Math.round(distanceOf(r)),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
