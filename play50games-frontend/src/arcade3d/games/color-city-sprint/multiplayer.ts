// Color City Sprint local multiplayer (menu2/multiplayer, phase M1): 2-4 heroes in the same city.
// Pure: N CityRuns from the SAME seed and level (rules.ts unchanged), stepped in lock-step with the
// framework's stepPlayerSims, plus the card's modes:
// - Versus race (the best fit): each player paints their own lanes, in their own colour, and only
//   their own red boosts them (another player's lane is neutral: each run keeps its own `painted`).
//   The gems are shared (first come). First to finish wins; the others get finishGraceMs.
// - Co-op relay: one shared red network (the runs share `painted`), and the beacons alternate: beacon
//   k is player (k mod n)'s to take (the others' runs are `beaconLocked`), and a beacon taken moves
//   everyone on. Riko's smashed hoarding opens for all; Kiro's shield, Zuno's magnet and Vexa's phase
//   cover the team (onAllyPower). The team clears together.
// Level 5: every player fights their own Greyout (the camera shows player 1's); README "Open issues".
// A solo run never comes here, and multiplayer runs are never ranked (index.tsx runPlayers).
import type { LevelId } from "@/arcade3d/types";
import { MODES, dispatchAllyPower, type AllyPowerEvent, type ModeConfig, type ModeId } from "@/arcade3d/menu2/multiplayer/modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec, type PlayerSims } from "@/arcade3d/menu2/multiplayer/simulate";
import { rankRace, teamResult, type Placed, type Standing, type TeamResult } from "@/arcade3d/menu2/multiplayer/results";
import { heroById, type HeroId, type PowerId } from "./heroes";
import { GREYOUT } from "./progression";
import { beaconQuota, createRun, createStepInput, runTimeMs, step, type CityRun, type StepEvents, type StepInput } from "./rules";

/** Players start this far apart across the street (m). */
export const START_SPACING = 1.2;

export interface MultiRun {
   mode: ModeConfig;
   group: PlayerSims<CityRun, StepEvents>;
   runs: CityRun[];
   simMs: number;
   firstFinishMs: number | null;
   ended: "win" | "timeup" | null;
}

/** onAllyPower (co-op): a hero's shield, magnet or phase covers the ally for as long as its own lasts. */
export function onAllyPower({ source, ally, power }: AllyPowerEvent<CityRun, PowerId>): void {
   const s = source.hero;
   const a = ally.hero;
   if (power === "shield") a.shieldUntil = Math.max(a.shieldUntil, s.shieldUntil);
   else if (power === "magnet") a.magnetUntil = Math.max(a.magnetUntil, s.magnetUntil);
   else if (power === "phase") a.phaseUntil = Math.max(a.phaseUntil, s.phaseUntil);
}

export function createMultiRun(seed: number, level: LevelId, heroes: readonly HeroId[], modeId: ModeId): MultiRun {
   const n = Math.max(1, Math.min(4, heroes.length));
   const spec: PlayerSimSpec<CityRun, StepInput, StepEvents> = { create: (s, i) => createRun(s, level, heroes[i] ?? "riko"), step };
   const group = createPlayerSims(spec, seed, n);
   const runs = group.sims;
   const mode = MODES[modeId];
   const first = runs[0];
   const yaw = first.course.startYaw;
   for (let i = 0; i < n; i++) {
      const r = runs[i];
      r.collected = first.collected;
      if (mode.ranking === "team") r.painted = first.painted;
      // side by side across the line to the first beacon
      const off = (i - (n - 1) / 2) * START_SPACING;
      r.hero.x += Math.cos(yaw) * off;
      r.hero.z -= Math.sin(yaw) * off;
   }
   const m: MultiRun = { mode, group, runs, simMs: 0, firstFinishMs: null, ended: null };
   relayLocks(m);
   return m;
}

/** Co-op relay: only beacon k's owner (player k mod n) may take it. */
function relayLocks(m: MultiRun): void {
   if (m.mode.ranking !== "team") return;
   const n = m.runs.length;
   const k = m.runs[0].beaconIndex;
   for (let i = 0; i < n; i++) m.runs[i].beaconLocked = n > 1 && k % n !== i;
}

/** Whose turn the lit beacon is (co-op relay), or -1 in versus. */
export function relayOwner(m: MultiRun): number {
   return m.mode.ranking === "team" ? m.runs[0].beaconIndex % m.runs.length : -1;
}

const SPEC: PlayerSimSpec<CityRun, StepInput, StepEvents> = { create: () => createRun(0), step };
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
      if (team && ev.siteOpened) for (const q of runs) q.siteOpen = true;
      if (team && ev.beacon) {
         // the relay moves everyone on (and a finish clears the whole team)
         for (const q of runs) {
            if (q === r) continue;
            q.beaconIndex = r.beaconIndex;
            q.lap = r.lap;
            if (r.ended === "win" && q.ended === null) {
               q.ended = "win";
               q.finishMs = r.finishMs;
            }
         }
      }
      if (ev.finished && m.firstFinishMs === null) m.firstFinishMs = r.finishMs;
      if (r.simMs > ms) ms = r.simMs;
   }
   relayLocks(m);
   m.simMs = ms;
   const allDone = runs.every((r) => r.ended !== null);
   const graceOver = m.mode.ranking === "race" && m.firstFinishMs !== null && ms >= m.firstFinishMs + m.mode.finishGraceMs;
   if (allDone || graceOver) {
      const wins = runs.filter((r) => r.ended === "win").length;
      m.ended = (team ? wins === runs.length : wins > 0) ? "win" : "timeup";
   }
   return events;
}

/** A player's progress (beacons taken, Greyout's hits on level 5). */
export function progressOf(r: CityRun): number {
   if (r.boss) return GREYOUT.maxHp - r.boss.hp;
   return Math.min(r.beaconIndex, beaconQuota(r.course));
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

/** The player furthest on still running (the camera's zoom-limit anchor in a race). */
export function leaderIndex(m: MultiRun): number {
   let best = -1;
   for (let i = 0; i < m.runs.length; i++) {
      if (m.runs[i].ended !== null) continue;
      if (best < 0 || progressOf(m.runs[i]) > progressOf(m.runs[best])) best = i;
   }
   return Math.max(0, best);
}
