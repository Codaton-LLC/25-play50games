// Temple Gong Timing local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes on the same stage, the
// same song. Pure: N GongRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with
// the framework's stepPlayerSims, plus the mode rules:
// - Co-op, "band mode" (the card's best fit): everyone plays the chart together; the band clears the song
//   when its average accuracy reaches the level's target (level 5: when every hero's Coilstone is free).
//   A Perfect by one hero keeps everyone's combo window open (the band plays as one).
// - Versus: the same chart, the highest score wins.
// A solo run never comes here, and multiplayer runs are never ranked.
import type { LevelId } from "@/arcade3d/types";
import { MODES, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { PERFECT, STEP_MS, createRun, createStepInput, finalAccuracy, step, type GongRun, type StepEvents, type StepInput } from "./rules";
import type { HeroId } from "./heroes";
import { LEVELS } from "./levels";

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<GongRun, StepEvents>;
   runs: GongRun[];
   simMs: number;
   ended: "win" | "lose" | null;
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<GongRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "kiro"), step };
   const group = createPlayerSims(spec, seed, n);
   return { mode: MODES[modeId], group, runs: group.sims, simMs: 0, ended: null };
}

const SPEC: PlayerSimSpec<GongRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const runs = m.runs;
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   let ms = 0;
   for (const r of runs) if (r.simMs > ms) ms = r.simMs;
   m.simMs = ms;
   // the band plays as one: a Perfect keeps every bandmate's combo window open
   if (m.mode.id === "coop") {
      for (let i = 0; i < runs.length; i++) {
         if (events[i].strike !== PERFECT) continue;
         for (const q of runs) if (q !== runs[i] && q.combo.chain > 0) q.combo.lastMs = Math.max(q.combo.lastMs, runs[i].combo.lastMs);
      }
   }
   if (runs.every((r) => r.ended !== null)) {
      if (m.mode.id === "coop") {
         const level = runs[0].level;
         const avg = runs.reduce((sum, r) => sum + finalAccuracy(r), 0) / runs.length;
         m.ended = LEVELS[level].boss ? (runs.every((r) => r.ended === "win") ? "win" : "lose") : avg >= LEVELS[level].accuracy ? "win" : "lose";
      } else m.ended = runs.some((r) => r.ended === "win") ? "win" : "lose";
   }
   return events;
}

/** A run's accuracy as a whole percent (the per-player chip). */
export function progressOf(r: GongRun): number {
   return Math.round(finalAccuracy(r) * 100);
}

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({ index, finished: r.ended === "win", timeMs: null, score: r.score, progress: progressOf(r) }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}

export { STEP_MS };
