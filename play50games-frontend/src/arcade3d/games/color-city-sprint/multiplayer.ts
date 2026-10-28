// Local multiplayer (menu2/multiplayer, phase M1). Co-op shares the red network and the hoarding.
// Versus keeps each hero's own paint, so a red lane boosts only the player who painted it.
// Gems are one pool: the first hero to reach one takes it. Multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type CityRun, type StepEvents, type StepInput } from "./rules";

export const START_SPACING = 1.1;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<CityRun, StepEvents>;
   runs: CityRun[];
   view: CityRun;
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<CityRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<CityRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "riko"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.collected = first.collected;
      if (modeId === "coop") {
         r.painted = first.painted;
         r.redUsed = first.redUsed;
         if (first.boss) r.boss = first.boss;
      }
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   return { mode: MODES[modeId], group, runs, view: runs[0], simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<CityRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   let ms = 0;
   let opened = false;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (r.cutOpen) opened = true;
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   if (m.mode.sharedCheckpoints && opened) for (const r of runs) r.cutOpen = true;
   if (m.mode.ranking === "team" && runs.some((r) => r.ended === "win" && r.course.boss)) {
      for (const r of runs) if (r.ended === null) {
         r.ended = "win";
         r.finishMs = r.simMs;
      }
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

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) : null,
      score: r.orbs,
      progress: r.beaconIndex,
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
      if (best < 0 || m.runs[i].beaconIndex > m.runs[best].beaconIndex) best = i;
   }
   return Math.max(0, best);
}
