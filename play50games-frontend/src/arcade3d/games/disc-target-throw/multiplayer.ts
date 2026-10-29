// Disc Target Throw local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes throw in the same
// courtyard. Pure: N DiscRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step
// with the framework's stepPlayerSims, plus the mode rules:
// - The targets are shared (the card's versus target duel): whoever hits a target first takes its
//   points, so lines cross and you race for the best banks; a target stays broken for everyone.
// - Co-op (MODES.coop): powers combine through onAllyPower (Kiro's shield and Zuno's magnet cover the
//   team); the team clears the level when every target is down, whoever broke it.
// - Versus: the most points wins once the targets are all down (or the clock runs out).
// Level 5's boss runs per hero (each fights its own Mother Snapper). A solo run never comes here, and
// multiplayer runs are never ranked (index.tsx runPlayers -> core isRankedRun), so the solo proof is
// untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, step, type DiscRun, type StepEvents, type StepInput } from "./rules";

/** Heroes stand this far apart (m, along x) on the start line. */
export const START_SPACING = 1.6;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<DiscRun, StepEvents>;
   runs: DiscRun[];
   simMs: number;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a shield or a magnet covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<DiscRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<DiscRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "kiro"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.hit = first.hit;
      r.monkeyPaid = first.monkeyPaid;
      if (!r.course.raft) r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, ended: null };
}

const SPEC: PlayerSimSpec<DiscRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** How many required targets are down (shared). */
export function targetsDown(m: MultiRun): number {
   const c = m.runs[0].course;
   let n = 0;
   for (let i = 0; i < c.targets.length; i++) if (c.targets[i].required && m.runs[0].hit[i]) n++;
   return n;
}

/** One frame for every hero (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (events[i].powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(r.heroId).power, onAllyPower, active);
      }
      if (r.simMs > ms) ms = r.simMs;
   }
   m.simMs = ms;
   const c = runs[0].course;
   const cleared = c.boss ? runs.some((r) => r.ended === "win") : targetsDown(m) >= c.required;
   if (cleared) m.ended = "win";
   else if (runs.every((r) => r.ended !== null)) m.ended = runs.some((r) => r.ended === "win") ? "win" : "timeup";
   if (m.ended !== null) for (const r of runs) if (r.ended === null) r.ended = "timeup";
   return events;
}

/** The podium standings: points decide (everyone ties on time 0), progress is targets broken. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: m.ended === "win",
      timeMs: m.ended === "win" ? 0 : null,
      score: r.score,
      progress: r.required,
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
