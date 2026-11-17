// Ultimate Color Trial local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes in the same corridor.
// Pure: N TrialRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the card's modes:
// - Versus: each player has their own sections (rings, doors, rounds, cores: their own exits); the
//   gems are shared (first come); first to the finish (level 5: the first to beat the Sentinel) wins.
// - Co-op: one shared corridor: the sections' progress (rings passed, rows passed, rounds begun, the
//   cores), the exits and the broken walls are the same arrays for everyone, so one player's ring or
//   door is the team's; each hero keeps its own colour charge. Kiro's shield, Zuno's magnet and
//   Vexa's phase cover the team (onAllyPower). The team clears together.
// Level 5: every player fights their own Sentinel (the camera shows player 1's); README "Open issues".
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers).
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { SENTINEL } from "./progression";
import { createRun, createStepInput, currentSection, runTimeMs, step, type TrialRun, type StepEvents, type StepInput } from "./rules";

/** Players start this far apart across the start strip (m). */
export const START_SPACING = 1.2;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<TrialRun, StepEvents>;
   runs: TrialRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a hero's shield, magnet or phase covers the ally for as long as its own lasts. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<TrialRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<TrialRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "riko"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const mode = MODES[modeId];
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.seat = i;
      r.collected = first.collected;
      if (mode.ranking === "team") {
         r.secDone = first.secDone;
         r.secEntered = first.secEntered;
         r.ringNext = first.ringNext;
         r.rowNext = first.rowNext;
         r.surviveStart = first.surviveStart;
         r.coreState = first.coreState;
         r.coreX = first.coreX;
         r.coreZ = first.coreZ;
         r.wallBroken = first.wallBroken;
      }
      // side by side across the start strip
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   return { mode, group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<TrialRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every player (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   const team = m.mode.ranking === "team";
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const ev = events[i];
      if (ev.powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (team && ev.finished) {
         // the first one home clears the team
         for (const q of runs) {
            if (q.ended === null) {
               q.ended = "win";
               q.finishMs = r.finishMs;
            }
         }
      }
      if (ev.finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   m.simMs = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (team ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** A player's progress: sections done, and the metres into the current one (the Sentinel's hits on level 5). */
export function progressOf(r: TrialRun): number {
   const c = r.course;
   if (r.boss && r.bossAwake) return c.sections.length * 100 + (SENTINEL.maxHp - r.boss.hp) * 10;
   const cur = currentSection(r);
   if (cur >= c.sections.length) return c.sections.length * 100;
   const s = c.sections[cur];
   return cur * 100 + Math.max(0, Math.min(99, Math.round(((r.hero.z - s.z0) / Math.max(1, s.z1 - s.z0)) * 99)));
}

/** The podium standings: a finisher by its run time, the rest by progress; the score is the gems. */
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

/** The player furthest on still running (the camera's zoom-limit anchor in a race). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || progressOf(m.runs[i]) > progressOf(m.runs[best])) best = i;
   }
   return Math.max(0, best);
}
