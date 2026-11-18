// Crystal Tower local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes on the same tower.
// Pure: N TowerRuns from the SAME seed and level (rules.ts unchanged, so every player gets the same
// sequences), stepped in lock-step with the framework's stepPlayerSims, plus the card's modes:
// - Versus: each player has their own beacons and sequences (their own tier state); the gems are
//   shared (first come); first to the summit (level 5: the first to beat Prism Shade) wins.
// - Co-op: one shared tower: the tiers (shows, progress, rounds), the crystal visits, the crumbling
//   pads and the broken walls are the same arrays for everyone, so one player's show is the team's
//   and any player may touch the next crystal; the team climbs tier by tier together (the armed tier
//   is kept equal across the runs after every step). Kiro's shield, Zuno's magnet and Vexa's phase
//   cover the team (onAllyPower). The team clears together.
// Level 5: every player fights their own Prism Shade (the camera shows player 1's); README "Open issues".
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers).
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { PRISM } from "./progression";
import { createRun, createStepInput, runTimeMs, step, type TowerRun, type StepEvents, type StepInput } from "./rules";

/** Players start this far apart on the start pad (m). */
export const START_SPACING = 1.1;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<TowerRun, StepEvents>;
   runs: TowerRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a hero's shield, magnet or phase covers the ally for as long as its own lasts. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<TowerRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<TowerRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "riko"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const mode = MODES[modeId];
   const first = runs[0];
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.seat = i;
      r.collected = first.collected;
      if (mode.ranking === "team") {
         r.tiers = first.tiers;
         r.inside = first.inside;
         r.crystalSafe = first.crystalSafe;
         r.crumbleAt = first.crumbleAt;
         r.wallBroken = first.wallBroken;
      }
      // side by side across the start pad
      const off = (i - (n - 1) / 2) * START_SPACING;
      const ax = r.hero.z / (Math.hypot(r.hero.x, r.hero.z) || 1);
      const az = -r.hero.x / (Math.hypot(r.hero.x, r.hero.z) || 1);
      r.hero.x += ax * off;
      r.hero.z += az * off;
   }
   return { mode, group, runs, simMs: 0, firstFinishMs: null, ended: null };
}

const SPEC: PlayerSimSpec<TowerRun, StepInput, StepEvents> = { create: () => createRun(0), step };
const IDLE = createStepInput();

/** One frame for every player (inputs[i] = player i's step input). Returns each run's events. */
export function stepMulti(m: MultiRun, dtMs: number, inputs: readonly (StepInput | undefined)[]): StepEvents[] {
   const events = stepPlayerSims(SPEC, m.group, dtMs, inputs, IDLE);
   if (m.ended !== null) return events;
   const runs = m.runs;
   const team = m.mode.ranking === "team";
   let ms = 0;
   let top = 0;
   for (const r of runs) top = Math.max(top, r.tier);
   for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const ev = events[i];
      if (team && r.tier !== top) {
         // the team's armed tier is one and the same
         r.tier = top;
         r.ringIn = false;
      }
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

/** A player's progress: tiers done and the crystals of the current sequence (Prism Shade's hits on level 5). */
export function progressOf(r: TowerRun): number {
   if (r.boss && r.bossAwake) return r.course.tiers.length * 10 + (PRISM.maxHp - r.boss.hp) * 10;
   const ts = r.tiers[r.tier];
   return r.tier * 10 + (ts ? Math.min(9, ts.progress) : 0);
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
