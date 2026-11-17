// Color Boss Tower local multiplayer (menu2/multiplayer, phase M1): 2-4 climbers in the same tower.
// Pure: N CbtRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the card's modes:
// - Versus: each player climbs their own copy of the tower and fights their own guardian (the same
//   timings: same seed, lock-step); the orbs are shared (first come); first to bring theirs down wins.
// - Co-op: one guardian for the team. The claws and orbs are the team's (the runs share those
//   arrays), so any player's charge loads the cannon for everyone; player 1's guardian is the one the
//   cannons hit (lock-step: the first run stepped fires a shared charge), and every player dodges the
//   same sweeps. When he falls the team clears together. A player out of hearts is out; the team
//   goes on while anyone climbs.
// Each player keeps their own five-hero roster and tags (World 6). A solo run never comes here, and
// multiplayer runs are never ranked (index.tsx runPlayers).
import type { LevelId } from "@/arcade3d/types";
import { MODES, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import type { TagHeroId } from "@/arcade3d/menu2/heroTag/rules";
import { createRun, createStepInput, runTimeMs, step, type CbtRun, type StepEvents, type StepInput } from "./rules";

/** Players start this far apart along the ring (m of arc). */
export const START_SPACING = 0.9;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<CbtRun, StepEvents>;
   runs: CbtRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly TagHeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<CbtRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "riko"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const mode = MODES[modeId];
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.orbTaken = first.orbTaken;
      if (mode.ranking === "team") r.claws = first.claws;
      // side by side along the ring at the foot of the spiral (on ledge 0)
      r.hero.a += (i - (n - 1) / 2) * START_SPACING * -1;
   }
   return { mode, group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<CbtRun, StepInput, StepEvents> = { create: () => createRun(0), step };
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
      const won = ev.ended && r.ended === "win";
      if (team && won) {
         // the team's guardian is down: everyone still climbing clears with it
         for (const q of runs) {
            if (q.ended === null) {
               q.ended = "win";
               q.finishMs = r.finishMs;
            }
         }
      }
      if (won && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   m.simMs = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = wins > 0 ? "win" : "timeup";
   }
   return events;
}

/** A player's progress: hits on their guardian, then how high they climbed (m). */
export function progressOf(r: CbtRun): number {
   return (r.tower.bossCfg.maxHp - r.boss.hp) * 1000 + Math.round(r.hero.y);
}

/** The podium standings: a finisher by its run time, the rest by progress; the score is the orbs. */
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

/** The player furthest on still climbing (the camera's anchor). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || progressOf(m.runs[i]) > progressOf(m.runs[best])) best = i;
   }
   return Math.max(0, best);
}
