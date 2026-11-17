// Beach Lifeguard rules (docs/menu1-new/specs-31-40.md §34). Pure and deterministic with a seed: no
// three.js, React, DOM, Math.random or Date. The Scene calls step() + syncStore() from one useRunFrame.
//
// Sand z 0..14, water z 0..-level.water, width level.width. Start in front of the tower at (0, 8).
// The shoreline is z = 0; a rescue counts once the lifeguard carries the swimmer to z >= 2.
import { resolveSphereAabb, type AABB } from "@/arcade3d/core/collision";
import { capScore as capToLimits } from "@/arcade3d/core/limits";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import type { ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import type { StoreApi } from "zustand/vanilla";
import type { BeachLevel } from "./levels";

// ---------- tuning (the limit proof cites these) ----------

export const LIVES = 3;
export const RESCUE_BASE_POINTS = 180;
export const RESCUE_CLOCK_BONUS = 70;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 5;

export const RADIUS = 0.38;
export const SPEED_SAND = 5.0;
export const WATER_FACTOR = 0.62;
export const SPEED_WATER = SPEED_SAND * WATER_FACTOR; // 3.10
export const CARRY_FACTOR = 0.85;
export const JET_SKI_SPEED = 8.5;
export const GRAB_RANGE = 1.2;
export const MOUNT_RANGE = 1.2;
export const TURN_RATE = 14;

export const SHORELINE_Z = 0;
export const SAFE_SAND_Z = 2;
export const SAND_DEPTH = 14;
export const START_X = 0;
export const START_Z = 8;
/** The tower stands behind the start (towards the camera), solid. */
/** footprint of the 3.0 m tower GLB (1.63 x 1.90 m, assets.ts FIT) */
export const TOWER = { x: 0, z: 11.6, halfX: 0.82, halfZ: 0.95 } as const;
export const JET_SKI_DOCK = { x: 0, z: -2.0 } as const;

/** Swimmer spawn band and spacing. */
export const SWIM_Z_MAX = -3;
export const SWIMMER_SPACING_X = 6;
/** No swimmer straight in front of the tower: the start lane stays free. */
export const TOWER_LANE = 1.4;

/** Points-game ceiling of the objective: every rescue pays its base and its clock bonus once. */
export function objectiveCeiling(level: BeachLevel): number {
   return (RESCUE_BASE_POINTS + RESCUE_CLOCK_BONUS) * level.rescues;
}

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/**
 * README "Server limits and why they hold": base = Bobj = 250 x rescues; the win bonus 5 x floor(D - t)
 * is largest at the earliest win M, so maxScore >= Bobj + 5 (D - M) and pps >= 5 (D - M) / M. M is
 * 0.8 x the oracle bot's fastest win over 200 seeds at 30 / 60 / 144 Hz (the jet-ski oracle on L4-L5).
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 500, D 120 s, fastest bot win 6.96 s, M 5.56 s: peak 1070 */
   1: { ...PTS, maxScore: 1110, minDurationMs: 4000, maxDurationMs: 120_000, base: 500, maxPointsPerSec: 107 },
   /** L2: Bobj 750, D 150 s, fastest bot win 14.10 s, M 11.28 s: peak 1440 */
   2: { ...PTS, maxScore: 1490, minDurationMs: 4000, maxDurationMs: 150_000, base: 750, maxPointsPerSec: 64 },
   /** L3: Bobj 1000, D 180 s, fastest bot win 22.97 s, M 18.37 s: peak 1805 */
   3: { ...PTS, maxScore: 1860, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 46 },
   /** L4: Bobj 1250, D 180 s, jet-ski oracle 23.13 s (21.35 s on an earlier layout), M 17.08 s: peak 2060 */
   4: { ...PTS, maxScore: 2130, minDurationMs: 4000, maxDurationMs: 180_000, base: 1250, maxPointsPerSec: 50 },
   /** L5: Bobj 1500, D 210 s, jet-ski oracle 28.94 s (28.14 s on an earlier layout), M 22.51 s: peak 2435 */
   5: { ...PTS, maxScore: 2510, minDurationMs: 4000, maxDurationMs: 210_000, base: 1500, maxPointsPerSec: 44 },
};
/** The proof's earliest win per level (s): 0.8 x the fastest bot win over 200 seeds (README). */
export const PROOF_MIN_WIN_S: Record<LevelId, number> = { 1: 5.56, 2: 11.28, 3: 18.37, 4: 17.08, 5: 22.51 };

export function capScore(score: number, durationMs: number, limits: ScoringRules = PROPOSED_LEVEL_LIMITS[1]): number {
   return capToLimits(score, durationMs, limits);
}

// ---------- state ----------

export interface HeroState {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   yaw: number;
}

export interface Swimmer {
   id: number;
   x: number;
   z: number;
   saved: boolean;
}

export type PropKind = "chair" | "cooler" | "sandcastle" | "umbrella";
export const PROP_KINDS: readonly PropKind[] = ["chair", "cooler", "sandcastle", "umbrella"];
/** Footprint half sizes (m) of each prop, before its quarter turn. */
export const PROP_HALF: Record<PropKind, { x: number; z: number }> = {
   chair: { x: 0.45, z: 0.65 },
   cooler: { x: 0.26, z: 0.2 },
   sandcastle: { x: 0.5, z: 0.5 },
   // a stand round the pole, so the 1.9 m canopy (from 1.23 m up) never cuts the lifeguard's head
   umbrella: { x: 0.55, z: 0.55 },
};

export interface PropItem {
   kind: PropKind;
   x: number;
   z: number;
   /** quarter turns only, so the box stays the footprint */
   rotY: number;
   box: AABB;
}

export interface Run {
   levelId: LevelId;
   level: BeachLevel;
   seed: number;
   time: number;
   score: number;
   lives: number;
   saved: number;
   expiredAlerts: number;
   hero: HeroState;
   carrying: boolean;
   onJetSki: boolean;
   jetSki: { x: number; z: number };
   activeSwimmer: number;
   alertTime: number;
   swimmers: Swimmer[];
   props: PropItem[];
   /** the tower and every prop (solid on the sand) */
   solids: AABB[];
   over: "win" | "lose" | null;
   /** the win score before the safety cap (tests: the cap is a no-op) */
   uncapped: number;
   /** what the store last got (-1 = never), so the HUD updates only on a change */
   synced: { saved: number; alert: number };
}

export interface BeachInput {
   moveX: number;
   moveY: number;
   /** one-frame Grab / mount press (E, Enter, the touch Grab) */
   actionPressed: boolean;
   /** camera yaw for inputToWorld */
   yaw: number;
}

export interface StepEvent {
   score: number;
   won: boolean;
   lost: boolean;
   lifeLost: boolean;
   rescued: boolean;
   grabbed: boolean;
   jetSkiMount: boolean;
   jetSkiDismount: boolean;
   alertAlarm: boolean;
}

export const createEvent = (): StepEvent => ({
   score: 0,
   won: false,
   lost: false,
   lifeLost: false,
   rescued: false,
   grabbed: false,
   jetSkiMount: false,
   jetSkiDismount: false,
   alertAlarm: false,
});

function clearEvent(ev: StepEvent): StepEvent {
   ev.score = 0;
   ev.won = ev.lost = ev.lifeLost = ev.rescued = ev.grabbed = ev.jetSkiMount = ev.jetSkiDismount = ev.alertAlarm = false;
   return ev;
}

// ---------- water ----------

/**
 * z after `dt` at the wanted z velocity `targetVZ` (sand speed): in the water (z < 0) the speed is
 * x 0.62, split exactly at z = 0 inside the frame that crosses it.
 */
export function stepZ(startZ: number, targetVZ: number, dt: number, waterFactor = WATER_FACTOR): number {
   if (dt <= 0 || targetVZ === 0) return startZ;
   if (startZ >= 0 && targetVZ < 0) {
      const tSand = startZ / -targetVZ;
      if (tSand >= dt) return startZ + targetVZ * dt;
      return targetVZ * waterFactor * (dt - tSand);
   }
   if (startZ < 0 && targetVZ > 0) {
      const waterVZ = targetVZ * waterFactor;
      const tWater = -startZ / waterVZ;
      if (tWater >= dt) return startZ + waterVZ * dt;
      return targetVZ * (dt - tWater);
   }
   return startZ >= 0 ? startZ + targetVZ * dt : startZ + targetVZ * waterFactor * dt;
}

// ---------- generator ----------

/** How many props a level asks for: two per rescue, and from L3 (the resort) four more chairs and coolers. */
export function propTarget(level: BeachLevel, levelId: LevelId): number {
   return 4 + level.rescues * 2 + (levelId >= 3 ? 4 : 0);
}

const boxOf = (x: number, z: number, hx: number, hz: number, h = 2): AABB => ({ min: { x: x - hx, y: 0, z: z - hz }, max: { x: x + hx, y: h, z: z + hz } });

export function createRun(seed: number, level: BeachLevel, levelId: LevelId): Run {
   const rng = createRng(seed);
   const halfW = level.width / 2;
   const zMin = -level.water + 2;
   const xMin = -halfW + 3;
   const xMax = halfW - 3;

   // Swimmers: z in [-water + 2, -3], >= 6 m apart in x, never in the tower lane. The x's are n sorted
   // uniform draws in the slack left after the spacing (so every draw fits), redrawn if one lands in the
   // tower lane; the alert order is then shuffled.
   const swimmers: Swimmer[] = [];
   const n = level.rescues;
   const slack = xMax - xMin - SWIMMER_SPACING_X * (n - 1);
   const xs: number[] = [];
   for (let tries = 0; tries < 200; tries++) {
      xs.length = 0;
      for (let i = 0; i < n; i++) xs.push(rng() * slack);
      xs.sort((p, q) => p - q);
      for (let i = 0; i < n; i++) xs[i] = Math.round((xMin + xs[i] + SWIMMER_SPACING_X * i) * 10) / 10;
      let ok = true;
      for (let i = 0; i < n; i++) if (Math.abs(xs[i]) < TOWER_LANE || (i > 0 && xs[i] - xs[i - 1] < SWIMMER_SPACING_X - 1e-9)) ok = false;
      if (ok) break;
      // a deterministic last resort (never needed on the five levels: tests)
      if (tries === 199) for (let i = 0; i < n; i++) xs[i] = xMin + ((xMax - xMin) * (i + 0.5)) / n;
   }
   for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = xs[i];
      xs[i] = xs[j];
      xs[j] = t;
   }
   for (let i = 0; i < n; i++) swimmers.push({ id: i, x: xs[i], z: Math.round((zMin + rng() * (SWIM_Z_MAX - zMin)) * 10) / 10, saved: false });

   // Props on the sand, z 3.5..10.5: never in a swimmer's straight return lane, never in the tower lane
   // (the start and the tower), never on each other.
   const props: PropItem[] = [];
   const want = propTarget(level, levelId);
   for (let tries = 0; props.length < want && tries < 600; tries++) {
      const kind = PROP_KINDS[Math.floor(rng() * PROP_KINDS.length)];
      const turn = Math.floor(rng() * 4);
      const half = PROP_HALF[kind];
      const hx = turn % 2 ? half.z : half.x;
      const hz = turn % 2 ? half.x : half.z;
      const x = -halfW + 1.5 + rng() * (level.width - 3);
      const z = 3.5 + rng() * 7;
      if (swimmers.some((s) => Math.abs(x - s.x) < hx + RADIUS + 0.9)) continue;
      if (Math.abs(x - START_X) < hx + RADIUS + 1.4) continue;
      if (props.some((p) => Math.abs(p.x - x) < hx + (p.box.max.x - p.box.min.x) / 2 + 0.6 && Math.abs(p.z - z) < hz + (p.box.max.z - p.box.min.z) / 2 + 0.6)) continue;
      props.push({ kind, x, z, rotY: (turn * Math.PI) / 2, box: boxOf(x, z, hx, hz) });
   }

   return {
      levelId,
      level,
      seed,
      time: 0,
      score: 0,
      lives: LIVES,
      saved: 0,
      expiredAlerts: 0,
      hero: { x: START_X, y: 0, z: START_Z, vx: 0, vz: 0, yaw: Math.PI },
      carrying: false,
      onJetSki: false,
      jetSki: { x: JET_SKI_DOCK.x, z: JET_SKI_DOCK.z },
      activeSwimmer: 0,
      alertTime: level.alertS,
      swimmers,
      props,
      solids: [boxOf(TOWER.x, TOWER.z, TOWER.halfX, TOWER.halfZ, 3), ...props.map((p) => p.box)],
      over: null,
      uncapped: 0,
      synced: { saved: -1, alert: -1 },
   };
}

/** The next swimmer still in the water after `from` (wrapping), or -1. */
export function nextSwimmer(run: Run, from: number): number {
   const n = run.swimmers.length;
   for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (!run.swimmers[i].saved) return i;
   }
   return -1;
}

// ---------- step ----------

const WORLD = { x: 0, z: 0 };
const EVENT = createEvent();

/**
 * One frame of play (dt = the run clock's play time). `timeLeftMs` is the shell clock (the win bonus).
 * Mutates `run`; returns a shared event object (valid until the next call).
 */
export function step(run: Run, input: BeachInput, dt: number, timeLeftMs: number): StepEvent {
   const ev = clearEvent(EVENT);
   if (run.over || !(dt > 0)) return ev;
   const hero = run.hero;
   run.time += dt;

   // 1. The alert clock. An expired alert costs a life and drops the carry; the next swimmer alerts.
   run.alertTime -= dt;
   if (run.alertTime <= 0) {
      ev.lifeLost = true;
      run.lives--;
      run.expiredAlerts++;
      run.carrying = false;
      if (run.lives <= 0) {
         run.over = "lose";
         ev.lost = true;
         return ev;
      }
      const next = nextSwimmer(run, run.activeSwimmer);
      run.activeSwimmer = next < 0 ? run.activeSwimmer : next;
      run.alertTime = run.level.alertS;
      ev.alertAlarm = true;
   }

   // 2. The jet ski (levels with jetSki): Grab next to it while not carrying mounts it.
   if (run.level.jetSki && !run.onJetSki && !run.carrying && input.actionPressed) {
      if (Math.hypot(hero.x - run.jetSki.x, hero.z - run.jetSki.z) <= MOUNT_RANGE) {
         run.onJetSki = true;
         ev.jetSkiMount = true;
      }
   }

   // 3. Movement: sand speed, x 0.62 in the water, x 0.85 carrying; the jet ski is 8.5 on the water only.
   inputToWorld(input.moveX, input.moveY, input.yaw, WORLD);
   const len = Math.hypot(WORLD.x, WORLD.z);
   const dirX = len > 0.001 ? WORLD.x / len : 0;
   const dirZ = len > 0.001 ? WORLD.z / len : 0;
   const stick = Math.min(1, len);
   if (len > 0.05) hero.yaw = turnTowards(hero.yaw, Math.atan2(dirX, dirZ), Math.min(1, TURN_RATE * dt));
   const speed = (run.onJetSki ? JET_SKI_SPEED : SPEED_SAND) * (run.carrying ? CARRY_FACTOR : 1) * stick;
   const xFactor = hero.z < 0 && !run.onJetSki ? WATER_FACTOR : 1;
   hero.vx = dirX * speed * xFactor;
   hero.vz = dirZ * speed;
   hero.x += hero.vx * dt;
   if (run.onJetSki) {
      hero.z += hero.vz * dt;
      if (hero.z >= SHORELINE_Z) {
         hero.z = SHORELINE_Z;
         run.onJetSki = false;
         ev.jetSkiDismount = true;
         run.jetSki.x = JET_SKI_DOCK.x;
         run.jetSki.z = JET_SKI_DOCK.z;
      }
   } else {
      hero.z = stepZ(hero.z, hero.vz, dt, WATER_FACTOR);
   }
   const halfW = run.level.width / 2;
   hero.x = Math.max(-halfW + RADIUS, Math.min(halfW - RADIUS, hero.x));
   hero.z = Math.max(-run.level.water + RADIUS, Math.min(SAND_DEPTH - RADIUS, hero.z));
   if (run.onJetSki) {
      run.jetSki.x = hero.x;
      run.jetSki.z = hero.z;
   } else if (hero.z > 0) {
      // out = hero: pushed in place (the helper's call returned a copy and dropped it: props were walk-through)
      for (const box of run.solids) resolveSphereAabb(hero, RADIUS, box, hero);
   }

   // 4. Grab the active swimmer within 1.20 m.
   if (input.actionPressed && !run.carrying && !ev.jetSkiMount) {
      const s = run.swimmers[run.activeSwimmer];
      if (s && !s.saved && Math.hypot(hero.x - s.x, hero.z - s.z) <= GRAB_RANGE + 1e-9) {
         run.carrying = true;
         ev.grabbed = true;
      }
   }

   // 5. Safe sand: the rescue counts.
   if (run.carrying && hero.z >= SAFE_SAND_Z) {
      run.carrying = false;
      run.swimmers[run.activeSwimmer].saved = true;
      run.saved++;
      const pts = RESCUE_BASE_POINTS + (run.alertTime > run.level.alertS / 2 ? RESCUE_CLOCK_BONUS : 0);
      run.score += pts;
      ev.score = pts;
      ev.rescued = true;
      if (run.saved >= run.level.rescues) {
         const raw = run.score + Math.floor(Math.max(0, timeLeftMs) / 1000) * TIME_BONUS_PER_SECOND;
         // a no-op for every honest run (tests); only a forged clock could reach the cap
         run.uncapped = raw;
         const total = capScore(raw, Math.round(run.time * 1000), PROPOSED_LEVEL_LIMITS[run.levelId]);
         ev.score += total - run.score;
         run.score = total;
         run.over = "win";
         ev.won = true;
      } else {
         run.activeSwimmer = nextSwimmer(run, run.activeSwimmer);
         run.alertTime = run.level.alertS;
         ev.alertAlarm = true;
      }
   }
   return ev;
}

/** The store side of one frame, exactly as the Scene does it (and the bots in the tests). */
export function syncStore(run: Run, ev: StepEvent, store: StoreApi<ArcadeStore>): void {
   const s = store.getState();
   if (ev.score) s.addScore(ev.score);
   const alert = Math.round(Math.max(0, run.alertTime / run.level.alertS) * 100);
   if (run.synced.saved !== run.saved) s.setStat("saved", (run.synced.saved = run.saved));
   if (run.synced.alert !== alert) s.setStat("alert", (run.synced.alert = alert));
   if (ev.lifeLost) s.loseLife();
   if (ev.won) s.end("win");
   else if (ev.lost) s.end("lose");
}
