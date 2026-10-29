// Local multiplayer (menu2/multiplayer): each hero has their own run; orbs and smashed panels are
// shared. Co-op shares the furthest checkpoint. Versus is the card's race: a crumbling wall a rival
// is running cracks twice as fast for you.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type StepEvents, type StepInput, type WallRun } from "./rules";

export const START_SPACING = 1.1;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<WallRun, StepEvents>;
   runs: WallRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<WallRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<WallRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "kiro"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   const versus = MODES[modeId].ranking === "race";
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.collected = first.collected;
      r.broken = first.broken;
      r.hero.z += (i - (n - 1) / 2) * START_SPACING;
      r.startZ = r.hero.z;
      r.multi = true;
      r.versus = versus;
      r.seat = i;
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<WallRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** Versus: a crumbling wall a rival is on cracks for you as if you had been on it 0.4 s longer. */
function rivalCracks(runs: WallRun[]): void {
   for (const r of runs) {
      if (!r.versus) continue;
      for (const o of runs) {
         if (o === r || o.hero.mode !== "wall") continue;
         const w = o.hero.wall;
         if (r.course.walls[w]?.kind !== "crumble") continue;
         if (r.crumbleAt[w] < 0) r.crumbleAt[w] = r.simMs - 400;
      }
   }
}

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   rivalCracks(m.runs);
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   let best = runs[0].checkpoint;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.checkpoint > best) best = r.checkpoint;
      if (r.simMs > ms) ms = r.simMs;
   }
   if (m.mode.sharedCheckpoints) {
      for (const r of runs) if (r.ended === null && r.checkpoint < best) r.checkpoint = best;
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

/** progress along the route: the checkpoint pad's index, then the distance from the start */
export function progressOf(r: WallRun): number {
   return Math.round(Math.abs(r.hero.x - r.startX) + Math.abs(r.hero.z - r.startZ));
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

export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || progressOf(m.runs[i]) > progressOf(m.runs[best])) best = i;
   }
   return Math.max(0, best);
}
