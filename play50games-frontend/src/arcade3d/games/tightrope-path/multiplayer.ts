// Tightrope Path local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes cross the same gorge.
// Pure: N TightRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - Co-op (the card's best fit, a shared rope): each hero walking a link sways it for everyone else on
//   it (TightRun.ext), so you coordinate your steps; Kiro's shield covers the team (onAllyPower). The
//   team clears when every hero is across.
// - Versus race: the first across wins; the podium ranks by finish time, then by elements crossed.
// Level 5's joust runs per hero. A solo run never comes here, and multiplayer runs are never ranked
// (index.tsx runPlayers -> core isRankedRun), so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { V_WALK, createRun, createStepInput, step, type StepEvents, type StepInput, type TightRun } from "./rules";

/** Heroes start this far apart along the start pillar (m). */
export const START_SPACING = 0.5;
/** How hard another hero's walk on your link sways your needle (needle per s at the walk). */
export const SHARED_SWAY = 0.22;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<TightRun, StepEvents>;
   runs: TightRun[];
   simMs: number;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): Kiro's shield covers an ally until the source's own ends. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<TightRun, PowerId>): void {
   if (power === "shield") ally.hero.shieldUntil = Math.max(ally.hero.shieldUntil, source.hero.shieldUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<TightRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "kiro"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   for (let i = 0; i < n; i++) runs[i].hero.s = 0.3 + i * START_SPACING;
   return { mode: MODES[modeId], group, runs, simMs: 0, ended: null };
}

const SPEC: PlayerSimSpec<TightRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** The shared rope (co-op): each other hero walking your link pushes your needle, alternating sides. */
export function sharedSway(m: MultiRun): void {
   const coop = m.mode.id === "coop";
   for (let i = 0; i < m.runs.length; i++) {
      const r = m.runs[i];
      let f = 0;
      if (coop) {
         for (let j = 0; j < m.runs.length; j++) {
            if (j === i) continue;
            const o = m.runs[j];
            if (o.hero.link !== r.hero.link || o.hero.air || o.ended !== null) continue;
            f += (Math.abs(o.hero.v) / V_WALK) * SHARED_SWAY * Math.sin(o.simMs * 0.006 + j);
         }
      }
      r.ext = f;
   }
}

/** One frame for every hero (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   sharedSway(m);
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
   const coop = m.mode.id === "coop";
   if (coop ? runs.every((r) => r.ended === "win") : runs.some((r) => r.ended === "win")) m.ended = "win";
   else if (runs.every((r) => r.ended !== null)) m.ended = runs.some((r) => r.ended === "win") ? "win" : "timeup";
   if (m.ended !== null && !coop) for (const r of runs) if (r.ended === null) r.ended = "timeup";
   return events;
}

/** The podium standings: the finish time decides, then elements crossed. */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? r.finishMs : null,
      score: 0,
      progress: r.crossed,
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
