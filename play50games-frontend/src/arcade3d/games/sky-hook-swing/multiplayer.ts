// Local multiplayer. Each hero has their own run. Orbs and broken crates are shared. Co-op shares
// the furthest checkpoint, lets a hero hook their partner (the tether), and a heavy ring only
// swings once two ropes are on it. Versus locks a ring for a second after someone takes it.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type StepEvents, type StepInput, type SwingRun } from "./rules";

export const START_SPACING = 1.2;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<SwingRun, StepEvents>;
   runs: SwingRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<SwingRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

function linkPartners(runs: SwingRun[], versus: boolean): void {
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      r.multi = true;
      r.versus = versus;
      r.seat = i;
      const p = runs[(i + 1) % runs.length];
      const t = r.tether;
      t.x = p.hero.x;
      t.y = p.hero.y + 1.15;
      t.z = p.hero.z;
      t.vx = p.hero.vx;
      t.vy = p.hero.vy;
      t.vz = p.hero.vz;
      t.live = !versus && runs.length > 1 && p.hero.mode !== "lost" && p.hero.mode !== "spawn";
      let heavy = false;
      const a = r.hero.anchor;
      if (r.hero.mode === "swing" && a >= 0 && r.course.anchors[a]?.kind === "heavy") {
         for (let j = 0; j < runs.length; j++) {
            if (j !== i && runs[j].hero.mode === "swing" && runs[j].hero.anchor === a) heavy = true;
         }
      }
      r.heavyLive = heavy;
   }
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<SwingRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "nami"),
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
      r.lockUntil = first.lockUntil;
      r.lockOwner = first.lockOwner;
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
      r.hero.z += i === 0 ? 0 : 0.4;
      r.startX = r.hero.x;
      r.multi = true;
      r.versus = versus;
      r.seat = i;
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<SwingRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   linkPartners(m.runs, m.mode.ranking === "race");
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
      if (r.course.islands[r.checkpoint].x > r.course.islands[best].x) best = r.checkpoint;
      if (r.simMs > ms) ms = r.simMs;
   }
   if (m.mode.sharedCheckpoints) {
      for (const r of runs) if (r.ended === null && r.course.islands[r.checkpoint].x < r.course.islands[best].x) r.checkpoint = best;
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
      progress: Math.round(r.hero.x),
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
      if (best < 0 || m.runs[i].hero.x > m.runs[best].hero.x) best = i;
   }
   return Math.max(0, best);
}
