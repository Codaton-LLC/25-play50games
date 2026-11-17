// Local multiplayer (menu2/multiplayer): 2-4 heroes in the same arena against the same orbs. Seat 0's run
// owns the orbs, the beacon and the boss; it checks every hero's zone, and a block scores for the hero who
// made it. Co-op: the team holds the beacon together. Versus: the same, ranked by score.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, step, type DefenseRun, type StepEvents, type StepInput } from "./rules";

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<DefenseRun, StepEvents>;
   runs: DefenseRun[];
   simMs: number;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<DefenseRun, PowerId>): void {
   if (power === "phase") ally.phaseUntil = Math.max(ally.phaseUntil, source.phaseUntil);
   else if (power === "magnet") ally.magnetUntil = Math.max(ally.magnetUntil, source.magnetUntil);
}

const SEATS = [
   [0, 5.2],
   [-3, 4.4],
   [3, 4.4],
   [0, 3.4],
] as const;

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<DefenseRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "riko"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const owner = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.hero.x = SEATS[i][0];
      r.hero.z = SEATS[i][1];
      r.multi = true;
      r.versus = MODES[modeId].ranking === "race";
      r.seat = i;
      if (i > 0) {
         r.owner = false;
         r.orbs = owner.orbs;
         r.shared = owner.shared;
         r.boss = owner.boss;
      }
   }
   owner.partners = runs.slice(1);
   return { mode: MODES[modeId], group, runs, simMs: 0, ended: null };
}

const SPEC: PlayerSimSpec<DefenseRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   const owner = runs[0];
   for (let i = 0; i < runs.length; i++) {
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(runs[i].heroId).power, onAllyPower, active);
      }
   }
   // the owner decides how the arena ends; the partners follow
   if (owner.ended !== null) {
      for (const r of runs) {
         if (r === owner || r.ended !== null) continue;
         r.ended = owner.ended;
         r.finishMs = owner.finishMs;
      }
   }
   m.simMs = owner.simMs;
   if (runs.every((r) => r.ended !== null)) m.ended = owner.ended === "win" ? "win" : "timeup";
   return events;
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({ index, finished: r.ended === "win", timeMs: null, score: r.score, progress: r.score }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
