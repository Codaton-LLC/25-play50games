// Robot Factory Run local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes on ONE factory line
// (the card: the best co-op game in W1: one rides, the others hold switches). Pure: N FactoryRuns from
// the same seed share one Board (rules.ts createRun's `board`): the turntables, the plates, the
// cells, the lasers, the crates and M-8's lane are the same for everyone, and only the first run
// (the driver) moves the line, once per ms. Each hero has its own body, orbs and power.
// - Co-op (MODES.coop): shield, magnet and phase cover the team; the team clears when every hero is
//   in the exit (level 5: when M-8 is down).
// - Versus: the same line, first into the exit after the charge wins, then the grace.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, runTimeMs, step, type FactoryRun, type StepEvents, type StepInput } from "./rules";
import { tileX } from "./factory";

export interface MultiRun {
   mode: ModeConfig;
   runs: FactoryRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<FactoryRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const first = createRun(seed, level, heroes[0] ?? "riko");
   const runs = [first];
   for (let i = 1; i < n; i++) {
      const r = createRun(seed, level, heroes[i] ?? "riko", first.board);
      // the boss machine is the driver's too (one M-8)
      r.boss = first.boss;
      runs.push(r);
   }
   runs.forEach((r, i) => (r.hero.x += (i - (n - 1) / 2) * 0.9));
   return { mode: MODES[modeId], runs, simMs: 0, firstFinishMs: null, ended: null };
}

const IDLE = createStepInput();

/** One frame for every hero (the driver first, so the line moves once). */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events: StepEvents[] = [];
   for (let i = 0; i < m.runs.length; i++) {
      const r = m.runs[i];
      const ev = step(r, dtMs, inputs[i] ?? IDLE);
      events.push(ev);
   }
   if (m.ended !== null) return events;
   let ms = 0;
   for (let i = 0; i < m.runs.length; i++) {
      const r = m.runs[i];
      if (events[i].powered) {
         const active = m.runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, m.runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (events[i].finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   // M-8 down ends it for everyone
   if (m.runs[0].boss && events.some((e) => e.bossDefeated)) for (const r of m.runs) if (r.ended === null) {
      r.ended = "win";
      r.finishMs = r.simMs;
   }
   m.simMs = ms;
   const allDone = m.runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = m.runs.filter((r) => r.ended === "win").length;
      m.ended = (m.mode.ranking === "team" ? wins === m.runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) : null,
      score: r.orbs,
      progress: r.board.charged,
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

/** The hero nearest the exit still playing (the camera's anchor in a race). */
export function leaderIndex(m: MultiRun): number {
   const [ec] = m.runs[0].floor.exit;
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || Math.abs(m.runs[i].hero.x - tileX(ec)) < Math.abs(m.runs[best].hero.x - tileX(ec))) best = i;
   }
   return Math.max(0, best);
}
