// Temple Coin Rush local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes, each in its own
// corridor side by side, the same seed and level for everyone, stepped in lock-step with the
// framework's stepPlayerSims. Pure.
// - Versus race (the card's best fit): the coins are shared: a coin one hero grabs is gone from every
//   corridor, and a toll lane one hero pays stays open for 2 s for whoever comes through it next (a
//   free pass): there is a tactical choice to make. First to the finish, then the others get the grace;
//   the podium by time, then distance.
// - Co-op: one shared coin purse that everyone pays from (RunOptions.purse); Kiro's shield, Zuno's
//   magnet and Vexa's phase cover the whole team (onAllyPower). The team clears when every hero is through.
// A solo run never comes here: Scene.tsx keeps the solo path, and multiplayer runs are never ranked
// (index.tsx runPlayers -> core isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { GATE, LANES, courseFor, createRun, createStepInput, distanceOf, scoreOf, step, type Purse, type StepEvents, type StepInput, type TempleRun } from "./rules";

/** Versus: a paid toll lane stays open this long for the heroes behind (ms). */
export const HOLD_OPEN_MS = 2000;

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
   group: PlayerSims<TempleRun, StepEvents>;
   runs: TempleRun[];
   offsets: number[];
   /** co-op's shared purse (null in versus) */
   purse: Purse | null;
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a hero's shield, magnet or phase covers every ally for as long as its own lasts. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<TempleRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const purse: Purse | null = modeId === "coop" ? { coins: 0 } : null;
   const spec: PlayerSimSpec<TempleRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "kiro", purse ? { purse } : {}),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const offsets = group.sims.map((_r, i) => corridorX(level, i, n));
   return { mode: MODES[modeId], group, runs: group.sims, offsets, purse, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<TempleRun, StepInput, StepEvents> = { create: () => createRun(0), step };
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
      if (ev && m.purse === null) {
         // versus: the coins are shared (taken here, gone everywhere) and a paid lane is held open
         for (let k = 0; k < Math.min(ev.coinCount, ev.coinList.length); k++) {
            const id = ev.coinList[k];
            if (id < 0) continue;
            for (const q of runs) q.collected[id] = 1;
         }
         if (ev.gate >= 0 && ev.gateResult === GATE.paid) {
            for (const q of runs) if (q !== r) q.openUntil[ev.gate * LANES + r.hero.lane] = r.simMs + HOLD_OPEN_MS;
         }
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

/** The podium standings: a finisher by its finish time, the rest by distance; the score is the run's score. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? r.finishMs : null,
      score: scoreOf(r),
      progress: Math.round(distanceOf(r)),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
