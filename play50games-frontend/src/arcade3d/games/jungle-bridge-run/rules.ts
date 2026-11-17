// Jungle Bridge Run rules (docs/menu1-new/specs-41-50.md §46). Pure and deterministic: no three.js,
// React, DOM, Math.random or Date. Scene.tsx calls step() from one useRunFrame; the bots call the same.
import { createRng } from "@/arcade3d/core/math";
import type { ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import type { StoreApi } from "zustand/vanilla";
import { LEVELS, type JungleLevel, type PatternKind } from "./levels";

// ---------- tuning (the limit proof cites these) ----------

export const INITIAL_LIVES = 3;
export const SECTION_LEN = 24;
/** The first section starts here; the runner starts at z = 0. */
export const RUN_IN_Z = 6;
/**
 * Lane centres in screen order: the camera looks along +z from behind, so screen-left is world +x.
 * Lane 0 is the left lane, `pressed.right` moves to a higher lane index.
 */
export const LANE_X = [2, 0, -2] as const;
export const LANE_CHANGE_S = 0.18;
export const JUMP_S = 0.55;
export const JUMP_ARC = 1.3;
export const SLIDE_S = 0.6;
export const RESPAWN_S = 0.8;
/** A respawn puts the runner this far before its section's start, on the section's clear lane. */
export const RESPAWN_BACK = 4;
export const PLAYER_RADIUS = 0.38;
export const SLIDE_HEIGHT = 0.6;
export const STAND_HEIGHT = 1.76;

/** Obstacle geometry (m) */
export const GAP_LEN = 2.5;
/** The gap's edges hold a landing foot: the runner falls only on the ground inside the inner hole. */
export const GAP_EDGE = 0.4;
/** Feet clear the ground above this height. */
export const AIRBORNE_Y = 0.15;
export const BRIDGE_LEN = 8;
export const VINE_HALF_Z = 0.35;
export const PILLAR_HALF = 0.55;
export const PILLAR_HALF_Z = 0.6;
export const LOG_HALF_X = 0.3;
export const LOG_HALF_Z = 0.6;
export const LOG_CLEAR_Y = 0.4;
export const LOG_MIN_X = -2.4;
export const LOG_MAX_X = 2.4;
export const LAVA_HALF = 0.6;
export const LAVA_PERIOD = 3;
export const LAVA_ON = 1.2;
/** Where patterns start inside a section (m from its start): one pattern, or two spaced 12 m. */
export const SINGLE_AT = 5;
export const PAIR_AT = [1.5, 13.5] as const;
/** A single log's section adds a pillar on the arrival lane this far after the log. */
export const LOG_PILLAR_AFTER = 10.2;
export const GEM_OFFSETS = [4, 11, 18] as const;
export const GEM_Y = 0.5;

export const SECTION_POINTS = 100;
export const GEM_POINTS = 20;
/** Win only: +6 per full second left on the shell clock (spec). */
export const TIME_BONUS_PER_SECOND = 6;

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/** The finish line: the last section's gate. */
export const finishZ = (level: JungleLevel): number => RUN_IN_Z + level.sections * SECTION_LEN;
/** Every section and every gem, once each. */
export const objectiveCeiling = (level: JungleLevel): number => SECTION_POINTS * level.sections + GEM_POINTS * level.sections * level.gemsPerSection;
/**
 * The earliest win (s): the run moves forward at exactly `speed` from z = 0 (no boost, a fall only
 * sets it back), so it cannot reach the finish before finishZ / speed.
 */
export const earliestWinS = (level: JungleLevel): number => finishZ(level) / level.speed;

/** The nearest a pattern starts to its section's start (m). */
export const firstPatternAt = (level: JungleLevel): number => (level.patterns.length > 4 && level.speed >= 7.8 ? PAIR_AT[0] : SINGLE_AT);
/**
 * The earliest end of any run (s): a lose after three hits, each at the earliest point a pattern can
 * touch the runner (its start minus the deepest half-depth, 0.6 m), the first from z = 0, the next two
 * after a 0.8 s respawn RESPAWN_BACK before the section start.
 */
export function earliestEndS(level: JungleLevel): number {
   const reach = firstPatternAt(level) - Math.max(PILLAR_HALF_Z, LOG_HALF_Z, LAVA_HALF, VINE_HALF_Z);
   return (RUN_IN_Z + reach) / level.speed + (INITIAL_LIVES - 1) * (RESPAWN_S + (RESPAWN_BACK + reach) / level.speed);
}

/**
 * Per level (README "Server limits"): base = Bobj; a win at t >= M pays Bobj + 6 floor(D - t), largest
 * at M; pps >= 6 (D / M - 1) keeps every win under base + pps t; before M the score is part of Bobj.
 * maxScore = peak + ~3 %, rounded up to 5. minDurationMs = 0.9 x the earliest possible end, three hits
 * as early as the layout allows (earliestEndS); a win is always later.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 480, D 75 s, M 78 / 6 = 13.0 s → peak 480 + 6 * 62 = 852; pps 28.6 */
   1: { ...PTS, maxScore: 880, minDurationMs: 5500, maxDurationMs: 75_000, base: 480, maxPointsPerSec: 30 },
   /** L2: Bobj 800, D 90 s, M 126 / 6.5 = 19.38 s → peak 800 + 6 * 70 = 1220; pps 21.9 */
   2: { ...PTS, maxScore: 1260, minDurationMs: 5200, maxDurationMs: 90_000, base: 800, maxPointsPerSec: 23 },
   /** L3: Bobj 1120, D 110 s, M 174 / 7 = 24.86 s → peak 1120 + 6 * 85 = 1630; pps 20.6 */
   3: { ...PTS, maxScore: 1680, minDurationMs: 4900, maxDurationMs: 110_000, base: 1120, maxPointsPerSec: 22 },
   /** L4: Bobj 1440, D 120 s, M 222 / 7.8 = 28.46 s → peak 1440 + 6 * 91 = 1986; pps 19.3 */
   4: { ...PTS, maxScore: 2050, minDurationMs: 3300, maxDurationMs: 120_000, base: 1440, maxPointsPerSec: 20 },
   /** L5: Bobj 1920, D 120 s, M 294 / 8.4 = 35.0 s → peak 1920 + 6 * 85 = 2430; pps 14.6 */
   5: { ...PTS, maxScore: 2505, minDurationMs: 3200, maxDurationMs: 120_000, base: 1920, maxPointsPerSec: 15 },
};

// ---------- obstacles & layout ----------

export interface GapObstacle {
   kind: "gap";
   z: number;
   length: number;
   lanes: number[];
}

export interface VineObstacle {
   kind: "vine";
   z: number;
   lanes: number[];
}

export interface LogObstacle {
   kind: "log";
   z: number;
   speed: number;
   minX: number;
   maxX: number;
   /** phase offset (s) so logs in a run do not move in step */
   phase: number;
}

export interface BridgeObstacle {
   kind: "bridge";
   z: number;
   length: number;
   plankLane: number;
}

export interface PillarObstacle {
   kind: "pillar";
   z: number;
   lane: number;
}

export interface LavaObstacle {
   kind: "lava";
   z: number;
   lane: number;
}

export type Obstacle = GapObstacle | VineObstacle | LogObstacle | BridgeObstacle | PillarObstacle | LavaObstacle;

export interface GemData {
   id: number;
   section: number;
   lane: number;
   x: number;
   y: number;
   z: number;
   collected: boolean;
}

export interface SectionData {
   index: number;
   startZ: number;
   gateZ: number;
   obstacles: Obstacle[];
   clearLane: number;
}

export interface RunnerInput {
   left?: boolean;
   right?: boolean;
   jump?: boolean;
   slide?: boolean;
}

export const idleInput = (): RunnerInput => ({ left: false, right: false, jump: false, slide: false });

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   gemCollected: boolean;
   sectionCleared: boolean;
   jump: boolean;
   slide: boolean;
}

export interface Run {
   seed: number;
   level: JungleLevel;
   levelId: LevelId;
   time: number;
   score: number;
   lives: number;
   over: false | "win" | "lose";
   speed: number;
   x: number;
   y: number;
   z: number;
   lane: number;
   laneFromX: number;
   laneToX: number;
   laneTimer: number;
   jumpTimer: number;
   slideTimer: number;
   respawning: boolean;
   respawnTimer: number;
   /** what hit the runner last (for the fall / flail visuals) */
   lastHit: Obstacle["kind"] | null;
   currentSection: number;
   gemsTaken: number;
   sections: SectionData[];
   gems: GemData[];
   ev: StepEvents;
   /** what the store last got (-1 = never) */
   synced: { section: number; gems: number };
}

// ---------- generation ----------

function blocksLane(o: Obstacle, lane: number, z: number, pad: number): boolean {
   if (o.kind === "pillar" || o.kind === "lava") return o.lane === lane && Math.abs(z - o.z) <= pad;
   if (o.kind === "bridge") return o.plankLane !== lane && z >= o.z - pad && z <= o.z + o.length + pad;
   return false;
}

/** Where a pattern ends (m along z), for the spacing rule. */
export function obstacleEnd(o: Obstacle): number {
   if (o.kind === "gap" || o.kind === "bridge") return o.z + o.length;
   if (o.kind === "vine") return o.z + VINE_HALF_Z;
   return o.z + 0.6;
}

export function createRun(seed: number, level: JungleLevel = LEVELS[1], levelId: LevelId = 1): Run {
   const rng = createRng(seed);
   const sections: SectionData[] = [];
   const gems: GemData[] = [];
   // the runner starts on lane 1; every section's clear lane differs from the lane it arrives on (the
   // last clear lane), and its pillar or lava blocks that arrival lane, so standing still never passes
   let prevClear = 1;

   for (let s = 0; s < level.sections; s++) {
      const startZ = RUN_IN_Z + s * SECTION_LEN;
      const arrival = prevClear;
      const lanes = [0, 1, 2].filter((l) => l !== arrival);
      const clearLane = lanes[Math.floor(rng() * lanes.length)];
      prevClear = clearLane;
      const pick = () => level.patterns[Math.floor(rng() * level.patterns.length)];
      const obstacles: Obstacle[] = [];
      // L4+ (fast levels with 5+ patterns): half the sections carry two patterns 12 m apart, never a
      // bridge (8 m) in a pair, so every pattern is ~10 m from the next one (spec risk note)
      const pair = level.patterns.length > 4 && level.speed >= 7.8 && rng() < 0.5;
      if (pair) {
         for (const at of PAIR_AT) {
            let kind = pick();
            for (let k = 0; kind === "bridge" && k < 8; k++) kind = pick();
            if (kind === "bridge") kind = "pillar";
            // a rolling log can miss a runner who stands still: two logs become a log and a pillar
            if (at === PAIR_AT[1] && kind === "log" && obstacles[0].kind === "log") kind = "pillar";
            obstacles.push(buildObstacle(kind, startZ + at, clearLane, arrival, level, rng));
         }
      } else {
         const kind = pick();
         obstacles.push(buildObstacle(kind, startZ + SINGLE_AT, clearLane, arrival, level, rng));
         // ... so a log section also has a pillar on the arrival lane 10 m on
         if (kind === "log") obstacles.push(buildObstacle("pillar", startZ + SINGLE_AT + LOG_PILLAR_AFTER, clearLane, arrival, level, rng));
      }
      sections.push({ index: s, startZ, gateZ: startZ + SECTION_LEN, obstacles, clearLane });

      for (let g = 0; g < level.gemsPerSection; g++) {
         const z = startZ + GEM_OFFSETS[g % GEM_OFFSETS.length] + Math.floor(g / GEM_OFFSETS.length) * 2;
         let lane = rng() < 0.65 ? clearLane : Math.floor(rng() * 3);
         // a gem never sits where a lane is blocked (pillar, lava, off the bridge): it moves to the clear lane
         if (obstacles.some((o) => blocksLane(o, lane, z, 1.5))) lane = clearLane;
         gems.push({ id: gems.length, section: s, lane, x: LANE_X[lane], y: GEM_Y, z, collected: false });
      }
   }

   return {
      seed,
      level,
      levelId,
      time: 0,
      score: 0,
      lives: INITIAL_LIVES,
      over: false,
      speed: level.speed,
      x: LANE_X[1],
      y: 0,
      z: 0,
      lane: 1,
      laneFromX: LANE_X[1],
      laneToX: LANE_X[1],
      laneTimer: 0,
      jumpTimer: 0,
      slideTimer: 0,
      respawning: false,
      respawnTimer: 0,
      lastHit: null,
      currentSection: 0,
      gemsTaken: 0,
      sections,
      gems,
      ev: { score: 0, lifeLost: false, won: false, lost: false, gemCollected: false, sectionCleared: false, jump: false, slide: false },
      synced: { section: -1, gems: -1 },
   };
}

function buildObstacle(kind: PatternKind, z: number, clearLane: number, arrival: number, level: JungleLevel, rng: () => number): Obstacle {
   switch (kind) {
      case "gap":
         return { kind: "gap", z, length: GAP_LEN, lanes: [0, 1, 2] };
      case "vine":
         // a low bar over the clear lane and the arrival lane (all three half the time): slide under it
         return { kind: "vine", z, lanes: rng() < 0.5 ? [0, 1, 2] : [clearLane, arrival].sort((p, q) => p - q) };
      case "bridge":
         return { kind: "bridge", z, length: BRIDGE_LEN, plankLane: clearLane };
      case "pillar":
         return { kind: "pillar", z, lane: arrival };
      case "log":
         return { kind: "log", z, speed: level.logSpeed > 0 ? level.logSpeed : 2.5, minX: LOG_MIN_X, maxX: LOG_MAX_X, phase: rng() * 4 };
      case "lava":
         return { kind: "lava", z, lane: arrival };
   }
}

// ---------- queries ----------

/** Every section has a lane free of pillars, lava and missing planks (the clear line). */
export function hasClearLine(run: Run): boolean {
   for (const sec of run.sections) {
      for (const o of sec.obstacles) {
         if ((o.kind === "pillar" || o.kind === "lava") && o.lane === sec.clearLane) return false;
         if (o.kind === "bridge" && o.plankLane !== sec.clearLane) return false;
      }
   }
   return true;
}

/** The log's centre x at run time t: back and forth between minX and maxX at its speed. */
export function logXAt(log: LogObstacle, time: number): number {
   const range = log.maxX - log.minX;
   if (range <= 0 || log.speed <= 0) return 0;
   const mod = (((time + log.phase) * log.speed) % (2 * range) + 2 * range) % (2 * range);
   return mod < range ? log.minX + mod : log.maxX - (mod - range);
}

export const isLavaActive = (time: number): boolean => time % LAVA_PERIOD < LAVA_ON;

export const timeBonus = (timeLeftMs: number): number => Math.max(0, Math.floor(timeLeftMs / 1000)) * TIME_BONUS_PER_SECOND;

// ---------- step ----------

/** One frame (dt = the run clock's play time). `timeLeftMs` = the shell clock (the win bonus). */
export function step(run: Run, input: RunnerInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.gemCollected = false;
   ev.sectionCleared = false;
   ev.jump = false;
   ev.slide = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;

   if (run.respawning) {
      run.respawnTimer = Math.max(0, run.respawnTimer - dt);
      if (run.respawnTimer <= 0) {
         const sec = run.sections[run.currentSection];
         run.respawning = false;
         run.z = (sec ? sec.startZ : RUN_IN_Z) - RESPAWN_BACK;
         run.lane = sec ? sec.clearLane : 1;
         run.x = LANE_X[run.lane];
         run.laneFromX = run.x;
         run.laneToX = run.x;
         run.laneTimer = 0;
         run.y = 0;
         run.jumpTimer = 0;
         run.slideTimer = 0;
      }
      return ev;
   }

   // lanes: one press = one lane, 0.18 s, also mid-jump
   if (input.left && run.lane > 0) {
      run.lane -= 1;
      run.laneFromX = run.x;
      run.laneToX = LANE_X[run.lane];
      run.laneTimer = LANE_CHANGE_S;
   } else if (input.right && run.lane < 2) {
      run.lane += 1;
      run.laneFromX = run.x;
      run.laneToX = LANE_X[run.lane];
      run.laneTimer = LANE_CHANGE_S;
   }
   if (run.laneTimer > 0) {
      run.laneTimer = Math.max(0, run.laneTimer - dt);
      const t = 1 - run.laneTimer / LANE_CHANGE_S;
      run.x = run.laneFromX + (run.laneToX - run.laneFromX) * t;
   } else {
      run.x = LANE_X[run.lane];
   }

   // a jump from the ground (not again mid-air), a slide from the ground; a slide in the air drops the runner
   if (input.jump && run.jumpTimer <= 0) {
      run.jumpTimer = JUMP_S;
      run.slideTimer = 0;
      ev.jump = true;
   } else if (input.slide && run.slideTimer <= 0) {
      run.slideTimer = SLIDE_S;
      run.jumpTimer = 0;
      ev.slide = true;
   }
   if (run.jumpTimer > 0) {
      run.jumpTimer = Math.max(0, run.jumpTimer - dt);
      run.y = run.jumpTimer > 0 ? Math.sin((1 - run.jumpTimer / JUMP_S) * Math.PI) * JUMP_ARC : 0;
   } else {
      run.y = 0;
   }
   if (run.slideTimer > 0) run.slideTimer = Math.max(0, run.slideTimer - dt);

   run.z += run.speed * dt;

   const sec = run.sections[run.currentSection];
   if (sec) {
      for (const o of sec.obstacles) {
         if (hits(run, o)) {
            run.lastHit = o.kind;
            run.lives -= 1;
            ev.lifeLost = true;
            run.jumpTimer = 0;
            run.slideTimer = 0;
            if (run.lives <= 0) {
               run.over = "lose";
               ev.lost = true;
            } else {
               run.respawning = true;
               run.respawnTimer = RESPAWN_S;
            }
            return ev;
         }
      }
   }

   for (const gem of run.gems) {
      if (gem.collected) continue;
      if (Math.abs(run.z - gem.z) <= 0.9 && Math.abs(run.x - gem.x) <= 0.8 && Math.abs(run.y - gem.y) <= 1.1) {
         gem.collected = true;
         run.score += GEM_POINTS;
         ev.score += GEM_POINTS;
         run.gemsTaken += 1;
         ev.gemCollected = true;
      }
   }

   if (sec && run.z >= sec.gateZ) {
      run.score += SECTION_POINTS;
      ev.score += SECTION_POINTS;
      if (run.currentSection + 1 < run.level.sections) {
         run.currentSection += 1;
         ev.sectionCleared = true;
      } else {
         const bonus = timeBonus(timeLeftMs);
         run.score += bonus;
         ev.score += bonus;
         run.over = "win";
         ev.won = true;
      }
   }
   return ev;
}

/** Does the runner, as it stands now, hit this obstacle? (the rule each obstacle's test pins) */
export function hits(run: Run, o: Obstacle): boolean {
   const grounded = run.y < AIRBORNE_Y;
   switch (o.kind) {
      case "gap":
         return grounded && run.z >= o.z + GAP_EDGE && run.z <= o.z + o.length - GAP_EDGE && o.lanes.includes(run.lane);
      case "vine":
         // a slide on the ground passes under the bar; standing or jumping hits it
         return Math.abs(run.z - o.z) <= VINE_HALF_Z && o.lanes.some((l) => Math.abs(run.x - LANE_X[l]) <= 0.9) && !(run.slideTimer > 0 && grounded);
      case "log":
         return Math.abs(run.z - o.z) <= LOG_HALF_Z && Math.abs(run.x - logXAt(o, run.time)) <= LOG_HALF_X + PLAYER_RADIUS && run.y < LOG_CLEAR_Y;
      case "pillar":
         return Math.abs(run.z - o.z) <= PILLAR_HALF_Z && Math.abs(run.x - LANE_X[o.lane]) <= PILLAR_HALF + PLAYER_RADIUS;
      case "bridge":
         return grounded && run.z >= o.z && run.z <= o.z + o.length && Math.abs(run.x - LANE_X[o.plankLane]) > 0.7;
      case "lava":
         return Math.abs(run.z - o.z) <= LAVA_HALF && Math.abs(run.x - LANE_X[o.lane]) <= LAVA_HALF && isLavaActive(run.time) && run.y < 0.3;
   }
}

/** The frame's store calls, shared by the Scene and the bots: score, lives, stats (on change only), the end. */
export function syncStore(run: Run, ev: StepEvents, store: StoreApi<ArcadeStore>): void {
   const s = store.getState();
   if (ev.score) s.addScore(ev.score);
   // the store's lives run with the rules' (3): the last loseLife ends the run with "lose"
   if (ev.lifeLost) s.loseLife();
   const section = Math.min(run.level.sections, run.currentSection + 1);
   if (run.synced.section !== section) s.setStat("section", (run.synced.section = section));
   if (run.synced.gems !== run.gemsTaken) s.setStat("gems", (run.synced.gems = run.gemsTaken));
   if (ev.won) s.end("win");
   else if (ev.lost) store.getState().end("lose");
}
