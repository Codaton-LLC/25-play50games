// Paint the Platforms local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes on the same arena.
// Pure: N PaintRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the mode rules:
// - Co-op "Mural Crew": one shared board (every hero paints it in their own colour) and one set of
//   hazards (blots, roller, Blob), stepped by player 1's run; Kiro's shield covers the team. The team
//   clears together when the shared target is painted (level 5: and the Blob popped).
// - Versus race: each player paints their own board; the first to their target wins.
// A solo run never comes here, and multiplayer runs are never ranked, so the solo proof is untouched.
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, step, type PaintRun, type StepEvents, type StepInput } from "./rules";

export const START_SPACING = 0.8;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<PaintRun, StepEvents>;
   runs: PaintRun[];
   simMs: number;
   ended: "win" | "timeup" | null;
}

export function onAllyPower({ source, ally, power }: AllyPowerEvent<PaintRun, PowerId>): void {
   if (power === "shield") ally.hero.shieldUntil = Math.max(ally.hero.shieldUntil, source.hero.shieldUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<PaintRun, StepInput, StepEvents> = {
      create: (s, i) => createRun(s, level, heroes[i] ?? "riko"),
      step,
   };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
      if (modeId === "coop" && i > 0) {
         r.board = first.board;
         r.owner = false;
         r.hz = first.hz;
         r.blotAt = first.blotAt;
         r.blotFrozen = first.blotFrozen;
         r.blotTile = first.blotTile;
         r.boss = first.boss;
         r.bossEv = first.bossEv;
         r.ring = first.ring;
      }
   }
   return { mode: MODES[modeId], group, runs, simMs: 0, ended: null };
}

const SPEC: PlayerSimSpec<PaintRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

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
   const coop = m.mode.id === "coop";
   if (coop ? runs.every((r) => r.ended === "win") : runs.some((r) => r.ended === "win")) m.ended = "win";
   else if (runs.every((r) => r.ended !== null)) m.ended = runs.some((r) => r.ended === "win") ? "win" : "timeup";
   if (m.ended !== null && !coop) for (const r of runs) if (r.ended === null) r.ended = "timeup";
   return events;
}

/** Tiles painted on run r's board. */
export const tilesPainted = (r: PaintRun): number => r.board.painted;

export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({
      index,
      finished: r.ended === "win",
      timeMs: r.ended === "win" ? r.finishMs : null,
      score: r.board.taken.reduce((n, t) => n + t, 0),
      progress: tilesPainted(r),
   }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
