// Gem Collector 3D local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes in the same vault.
// Pure: N GemRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the card's modes:
// - Versus: everyone rolls their own train; the gems on the floor are shared (a gem in one train is
//   gone for the others; a cut drops it back on the floor for anyone); the highest score when the
//   round runs out wins.
// - Co-op: the same shared floor, plus the chests, the cracked wall and the slimes; the team's banks
//   add up, and the team clears when the sum reaches the level's target. Kiro's shield, Zuno's magnet
//   and Vexa's phase cover the team (onAllyPower).
// Level 5: every player fights their own Glutton (the camera shows player 1's); README "Open issues".
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers).
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { createRun, createStepInput, levelCleared, step, type GemRun, type StepEvents, type StepInput } from "./rules";

/** Players start this far apart along the start line (m). */
export const START_SPACING = 1.4;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<GemRun, StepEvents>;
   runs: GemRun[];
   simMs: number;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a hero's shield, magnet or phase covers the ally for as long as its own lasts. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<GemRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<GemRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "riko"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const mode = MODES[modeId];
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      // one floor for everyone: the gem states and where the loose ones lie
      r.gemState = first.gemState;
      r.gx = first.gx;
      r.gz = first.gz;
      r.gy = first.gy;
      r.fadeAt = first.fadeAt;
      r.everTaken = first.everTaken;
      r.revealed = first.revealed;
      if (mode.ranking === "team") {
         r.chestOpen = first.chestOpen;
         r.wallBroken = first.wallBroken;
         r.slimeX = first.slimeX;
         r.slimeZ = first.slimeZ;
         r.slimeAlive = first.slimeAlive;
         r.slimeBite = first.slimeBite;
      }
      r.hero.x += (i - (n - 1) / 2) * START_SPACING;
   }
   return { mode, group, runs, simMs: 0, ended: null };
}

const SPEC: PlayerSimSpec<GemRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** The team's score (co-op) or the best single score. */
export function teamScore(m: MultiRun): number {
   return m.runs.reduce((s, r) => s + r.score, 0);
}

/** One frame for every player (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   let ms = 0;
   for (let i = 0; i < runs.length; i++) {
      const ev = events[i];
      if (ev.powered) {
         const active = runs.map((q) => q.ended === null);
         dispatchAllyPower(m.mode, runs, i, heroById(runs[i].heroId).power, onAllyPower, active);
      }
      if (runs[i].simMs > ms) ms = runs[i].simMs;
   }
   m.simMs = ms;
   if (runs.every((r) => r.ended !== null)) {
      const team = m.mode.ranking === "team";
      const boss = runs[0].boss !== null;
      const cleared = boss ? runs.some((r) => levelCleared(r)) : team ? teamScore(m) >= runs[0].arena.spec.targetScore : runs.some((r) => levelCleared(r));
      m.ended = cleared ? "win" : "timeup";
   }
   return events;
}

/** A player's standing: nobody "finishes" a round; the score ranks them (progress = the score). */
export function standings(m: MultiRun): Standing[] {
   return m.runs.map((r, index) => ({ index, finished: false, timeMs: null, score: r.score, progress: r.score }));
}

export function placings(m: MultiRun): Placed[] {
   return rankRace(standings(m));
}

export function team(m: MultiRun): TeamResult {
   return teamResult(standings(m));
}
