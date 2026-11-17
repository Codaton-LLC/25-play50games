// Bee Garden rules (docs/menu1-new/specs-31-40.md §40). Pure and deterministic with a seed: no three.js,
// no React. The Scene calls createRun once per run and stepRun from one useRunFrame.
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng, turnTowards } from "@/arcade3d/core/math";
import type { ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import type { StoreApi } from "zustand/vanilla";
import { LEVELS, type BeeLevel } from "./levels";

// ---------- tuning ----------

export const TUNING = {
   altitude: 1.15,
   beeRadius: 0.3,
   accel: 16,
   normalSpeed: 6.5,
   boostSpeed: 9.5,
   drag: 0.6,
   boostDrain: 22,
   boostRefill: 10,
   boostLockDuration: 1.0,
   stunDuration: 0.5,
   /** after a stun the bee may fly out of the web it sits in */
   webImmunity: 0.4,
   hiveRadius: 1.6,
   /** the hive box itself is solid (the bee deposits at hiveRadius + beeRadius, long before it touches) */
   hiveSolid: 0.7,
   flowerReach: 0.55,
   branchRadius: 0.5,
   webRadius: 0.65,
   carryCap: 3,
   pointsPerUnit: 20,
   bonusFullLoad: 15,
   winBonusPerSecond: 4,
   breezeAccelX: 0.8,
   resultDelayMs: 900,
   /** generator: hazards stay north of this line (z <= halfZ - corridor), so the south band is clear */
   corridor: 4.5,
   /** hive centre from the south edge */
   hiveInset: 2.5,
} as const;

export type FlowerType = "A" | "B" | "C";
export const FLOWER_TYPES: readonly FlowerType[] = ["A", "B", "C"];

export interface Flower {
   id: number;
   type: FlowerType;
   x: number;
   z: number;
   hasNectar: boolean;
}

export interface Circle {
   id: number;
   x: number;
   z: number;
   radius: number;
   /** visual turn only (rad) */
   rotY: number;
}

export type Branch = Circle;
export type Web = Circle;

export interface BeeState {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   /** facing: 0 = +z, positive towards +x (atan2(vx, vz)) */
   heading: number;
   lateralAccel: number;
}

export type RunEvent = "pickup" | "deposit" | "web_hit" | "win" | "timeup";

export interface RunState {
   seed: number;
   levelId: LevelId;
   level: BeeLevel;
   bee: BeeState;
   flowers: Flower[];
   branches: Branch[];
   webs: Web[];
   hive: { x: number; z: number; radius: number };
   carried: number[];
   totalDeposited: number;
   stamina: number;
   boosting: boolean;
   boostLock: number;
   stunTimer: number;
   webImmunityTimer: number;
   score: number;
   /** points of the last deposit (for the floating score) */
   lastDeposit: number;
   time: number;
   timeLeft: number;
   over: boolean;
   endReason: "win" | "timeup" | null;
   bounds: { halfX: number; halfZ: number };
   /** this frame's events (cleared in place every step) */
   events: RunEvent[];
   /** what the store last got (-1 = never), so the HUD updates only on a change */
   synced: { score: number; nectar: number; stamina: number };
}

export interface StepInput {
   /** world direction (inputToWorld output); falls back to the raw stick (moveX, moveY) at yaw 0 */
   dirX?: number;
   dirZ?: number;
   moveX?: number;
   moveY?: number;
   /** held boost (Space / touch Boost) */
   jump?: boolean;
}

// ---------- server limits (README "Server limits and why they hold") ----------

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/** Bobj = 20 * units + 15 * floor(units / 3): every unit deposits once, every full load pays its bonus once. */
export function objectiveCeiling(units: number): number {
   return TUNING.pointsPerUnit * units + TUNING.bonusFullLoad * Math.floor(units / TUNING.carryCap);
}

/**
 * Per level: base = Bobj, the time bonus 4 * floor(D - t) is largest at the earliest win M, so
 * maxScore >= Bobj + 4 * (D - M) and pps >= 4 * (D - M) / M (B(t) <= base + pps * t for t >= M; before
 * M the score is a part of Bobj <= base). M is the lower bound in the README (0.8 x the oracle bot's
 * fastest win over 200 seeds at 30 / 60 / 144 Hz), so a better route than the bot's still fits.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 245, D 120 s, oracle 13.67 s → M 10.9 s, peak 681; pps 4 * (120 / 10.9 - 1) = 40.0 */
   1: { ...PTS, maxScore: 705, minDurationMs: 4000, maxDurationMs: 120_000, base: 245, maxPointsPerSec: 42 },
   /** L2: Bobj 375, D 150 s, oracle 22.30 s → M 17.84 s, peak 903; pps 29.6 */
   2: { ...PTS, maxScore: 930, minDurationMs: 4000, maxDurationMs: 150_000, base: 375, maxPointsPerSec: 31 },
   /** L3: Bobj 490, D 180 s, oracle 32.49 s → M 26.0 s, peak 1106; pps 23.7 */
   3: { ...PTS, maxScore: 1140, minDurationMs: 4000, maxDurationMs: 180_000, base: 490, maxPointsPerSec: 25 },
   /** L4: Bobj 620, D 180 s, oracle 47.49 s → M 38.0 s, peak 1188; pps 14.9 */
   4: { ...PTS, maxScore: 1225, minDurationMs: 4000, maxDurationMs: 180_000, base: 620, maxPointsPerSec: 16 },
   /** L5: Bobj 750, D 210 s, oracle 59.19 s → M 47.36 s, peak 1398; pps 13.7 */
   5: { ...PTS, maxScore: 1440, minDurationMs: 4000, maxDurationMs: 210_000, base: 750, maxPointsPerSec: 15 },
};

export const PROPOSED_LIMITS = PROPOSED_LEVEL_LIMITS[1];

/** The earliest win each proof assumes (s): 0.8 x the fastest oracle / greedy win over 200 seeds (tests pin it). */
export const PROOF_EARLIEST_WIN_S: Record<LevelId, number> = { 1: 10.9, 2: 17.84, 3: 26.0, 4: 38.0, 5: 47.36 };

export function withinServerLimits(score: number, durationMs: number, rules: ScoringRules = PROPOSED_LIMITS): boolean {
   return fitsLimits(score, durationMs, rules);
}

export function capScore(score: number, durationMs: number, rules: ScoringRules = PROPOSED_LIMITS): number {
   return capToLimits(score, durationMs, rules);
}

// ---------- generator ----------

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/** The rules every flower obeys (also checked by the tests on many seeds). */
export function flowerSpotOk(
   x: number,
   z: number,
   halfX: number,
   halfZ: number,
   hive: { x: number; z: number; radius: number },
   branches: readonly Circle[],
   webs: readonly Circle[],
   flowers: readonly Flower[],
   spacing: number
): boolean {
   if (Math.abs(x) > halfX - 1.8 || Math.abs(z) > halfZ - 1.8) return false;
   if (dist(x, z, hive.x, hive.z) < hive.radius + 1.8) return false;
   for (const b of branches) if (dist(x, z, b.x, b.z) < b.radius + 1.2) return false;
   for (const w of webs) if (dist(x, z, w.x, w.z) < w.radius + 1.2) return false;
   for (const f of flowers) if (dist(x, z, f.x, f.z) < spacing) return false;
   return true;
}

/** Pure, seeded layout. `levelId` picks the limits the win bonus is capped to. */
export function createRun(seed: number, level: BeeLevel = LEVELS[1], levelId: LevelId = 1): RunState {
   const rng = createRng(seed);
   const halfX = level.width / 2;
   const halfZ = level.depth / 2;
   const hive = { x: 0, z: halfZ - TUNING.hiveInset, radius: TUNING.hiveRadius };

   // The bee hovers just north of the hive box, facing north (-z).
   const bee: BeeState = {
      x: hive.x,
      y: TUNING.altitude,
      z: hive.z - (TUNING.hiveSolid + TUNING.beeRadius + 0.3),
      vx: 0,
      vz: 0,
      heading: Math.PI,
      lateralAccel: 0,
   };

   const branches: Branch[] = [];
   const webs: Web[] = [];
   const flowers: Flower[] = [];
   const hazardMinZ = -halfZ + 2.0;
   const hazardMaxZ = halfZ - TUNING.corridor;

   for (let tries = 0; branches.length < level.branches && tries < 2000; tries++) {
      const x = (rng() * 2 - 1) * (halfX - 2.0);
      const z = hazardMinZ + rng() * (hazardMaxZ - hazardMinZ);
      const rotY = rng() * Math.PI;
      if (branches.some((b) => dist(b.x, b.z, x, z) < 3.2)) continue;
      if (dist(hive.x, hive.z, x, z) < hive.radius + 2.0) continue;
      branches.push({ id: branches.length, x, z, radius: TUNING.branchRadius, rotY });
   }

   for (let tries = 0; webs.length < level.webs && tries < 2000; tries++) {
      const x = (rng() * 2 - 1) * (halfX - 2.0);
      const z = hazardMinZ + rng() * (hazardMaxZ - hazardMinZ);
      const rotY = rng() * Math.PI;
      if (webs.some((w) => dist(w.x, w.z, x, z) < 3.0)) continue;
      if (branches.some((b) => dist(b.x, b.z, x, z) < 2.0)) continue;
      if (dist(hive.x, hive.z, x, z) < hive.radius + 2.0) continue;
      webs.push({ id: webs.length, x, z, radius: TUNING.webRadius, rotY });
   }

   for (let tries = 0; flowers.length < level.units && tries < 4000; tries++) {
      const x = (rng() * 2 - 1) * (halfX - 1.8);
      const z = (rng() * 2 - 1) * (halfZ - 1.8);
      if (!flowerSpotOk(x, z, halfX, halfZ, hive, branches, webs, flowers, 1.6)) continue;
      flowers.push({ id: flowers.length, type: FLOWER_TYPES[flowers.length % 3], x, z, hasNectar: true });
   }
   // A crowded seed: a fine scan that keeps every rule but a closer spacing (tests: never short).
   for (let spacing = 1.2; flowers.length < level.units && spacing >= 0.8; spacing -= 0.2) {
      for (let x = -(halfX - 1.8); x <= halfX - 1.8 && flowers.length < level.units; x += 0.4) {
         for (let z = -(halfZ - 1.8); z <= halfZ - 1.8 && flowers.length < level.units; z += 0.4) {
            if (!flowerSpotOk(x, z, halfX, halfZ, hive, branches, webs, flowers, spacing)) continue;
            flowers.push({ id: flowers.length, type: FLOWER_TYPES[flowers.length % 3], x, z, hasNectar: true });
         }
      }
   }

   return {
      seed,
      levelId,
      level,
      bee,
      flowers,
      branches,
      webs,
      hive,
      carried: [],
      totalDeposited: 0,
      stamina: 100,
      boosting: false,
      boostLock: 0,
      stunTimer: 0,
      webImmunityTimer: 0,
      score: 0,
      lastDeposit: 0,
      time: 0,
      timeLeft: level.durationMs / 1000,
      over: false,
      endReason: null,
      bounds: { halfX, halfZ },
      events: [],
      synced: { score: -1, nectar: -1, stamina: -1 },
   };
}

// ---------- step ----------

function pushOut(bee: BeeState, cx: number, cz: number, radius: number): void {
   const d = dist(bee.x, bee.z, cx, cz);
   const min = TUNING.beeRadius + radius;
   if (d >= min) return;
   const nx = d > 1e-9 ? (bee.x - cx) / d : 0;
   const nz = d > 1e-9 ? (bee.z - cz) / d : -1;
   bee.x = cx + nx * min;
   bee.z = cz + nz * min;
   const vn = bee.vx * nx + bee.vz * nz;
   if (vn < 0) {
      bee.vx -= vn * nx;
      bee.vz -= vn * nz;
   }
}

/** One frame of play (dt = the run clock's play time). Mutates `run`; no allocation. */
export function stepRun(run: RunState, input: StepInput, dt: number, store?: StoreApi<ArcadeStore>): void {
   if (run.over || !(dt > 0)) return;
   const bee = run.bee;
   run.events.length = 0;
   run.time += dt;
   run.timeLeft = Math.max(0, run.level.durationMs / 1000 - run.time);

   if (run.stunTimer > 0) {
      run.stunTimer = Math.max(0, run.stunTimer - dt);
      bee.vx = 0;
      bee.vz = 0;
      if (run.stunTimer <= 0) run.webImmunityTimer = TUNING.webImmunity;
   } else {
      // Boost: held jump while stamina > 0 and no lock. Releasing it, or reaching 0, locks it for 1.00 s.
      if (run.boostLock > 0) run.boostLock = Math.max(0, run.boostLock - dt);
      const wantsBoost = !!input.jump;
      if (wantsBoost && run.stamina > 0 && run.boostLock <= 0) {
         run.boosting = true;
         run.stamina = Math.max(0, run.stamina - TUNING.boostDrain * dt);
         if (run.stamina <= 0) {
            run.boosting = false;
            run.boostLock = TUNING.boostLockDuration;
         }
      } else {
         if (run.boosting && !wantsBoost) run.boostLock = TUNING.boostLockDuration;
         run.boosting = false;
         run.stamina = Math.min(100, run.stamina + TUNING.boostRefill * dt);
      }
      const topSpeed = run.boosting ? TUNING.boostSpeed : TUNING.normalSpeed;

      let dx = input.dirX ?? input.moveX ?? 0;
      let dz = input.dirZ ?? input.moveY ?? 0;
      const len = Math.hypot(dx, dz);
      if (len > 1) {
         dx /= len;
         dz /= len;
      }
      let dvx = dx * topSpeed - bee.vx;
      let dvz = dz * topSpeed - bee.vz;
      const dv = Math.hypot(dvx, dvz);
      const maxDv = TUNING.accel * dt;
      if (dv > maxDv) {
         dvx = (dvx / dv) * maxDv;
         dvz = (dvz / dv) * maxDv;
      }
      bee.vx += dvx;
      bee.vz += dvz;
      if (len < 0.05) {
         const k = Math.max(0, 1 - TUNING.drag * dt);
         bee.vx *= k;
         bee.vz *= k;
      }
      if (run.level.breeze) bee.vx += TUNING.breezeAccelX * dt;
      const speed = Math.hypot(bee.vx, bee.vz);
      if (speed > topSpeed) {
         bee.vx = (bee.vx / speed) * topSpeed;
         bee.vz = (bee.vz / speed) * topSpeed;
      }

      bee.x += bee.vx * dt;
      bee.z += bee.vz * dt;
      bee.y = TUNING.altitude;
      for (const b of run.branches) pushOut(bee, b.x, b.z, b.radius);
      pushOut(bee, run.hive.x, run.hive.z, TUNING.hiveSolid);
      const hx = run.bounds.halfX - TUNING.beeRadius;
      const hz = run.bounds.halfZ - TUNING.beeRadius;
      if (bee.x < -hx || bee.x > hx) {
         bee.x = Math.max(-hx, Math.min(hx, bee.x));
         bee.vx = 0;
      }
      if (bee.z < -hz || bee.z > hz) {
         bee.z = Math.max(-hz, Math.min(hz, bee.z));
         bee.vz = 0;
      }

      const moving = Math.hypot(bee.vx, bee.vz);
      if (moving > 0.2) bee.heading = turnTowards(bee.heading, Math.atan2(bee.vx, bee.vz), 1 - Math.exp(-12 * dt));
      // sideways velocity (right of the heading positive) drives the bank
      bee.lateralAccel = bee.vx * Math.cos(bee.heading) - bee.vz * Math.sin(bee.heading);
   }

   // Webs: a stun, the carry goes back onto the very flowers it came from, no points.
   if (run.webImmunityTimer > 0) {
      run.webImmunityTimer = Math.max(0, run.webImmunityTimer - dt);
   } else if (run.stunTimer <= 0) {
      for (const w of run.webs) {
         if (dist(bee.x, bee.z, w.x, w.z) >= TUNING.beeRadius + w.radius) continue;
         run.stunTimer = TUNING.stunDuration;
         bee.vx = 0;
         bee.vz = 0;
         if (run.boosting) run.boostLock = TUNING.boostLockDuration;
         run.boosting = false;
         for (const id of run.carried) run.flowers[id].hasNectar = true;
         run.carried.length = 0;
         run.events.push("web_hit");
         break;
      }
   }

   if (run.stunTimer <= 0) {
      for (const f of run.flowers) {
         if (run.carried.length >= TUNING.carryCap) break;
         if (!f.hasNectar || dist(bee.x, bee.z, f.x, f.z) >= TUNING.flowerReach) continue;
         f.hasNectar = false;
         run.carried.push(f.id);
         run.events.push("pickup");
      }
   }

   if (run.carried.length > 0 && dist(bee.x, bee.z, run.hive.x, run.hive.z) < run.hive.radius + TUNING.beeRadius) {
      const count = run.carried.length;
      const pts = TUNING.pointsPerUnit * count + (count === TUNING.carryCap ? TUNING.bonusFullLoad : 0);
      run.score += pts;
      run.lastDeposit = pts;
      run.totalDeposited += count;
      run.carried.length = 0;
      run.events.push("deposit");
      if (run.totalDeposited >= run.level.units) {
         run.over = true;
         run.endReason = "win";
         run.score += Math.floor(run.timeLeft) * TUNING.winBonusPerSecond;
         // a no-op for every honest run (tests); only a forged clock could reach it
         run.score = capScore(run.score, run.time * 1000, PROPOSED_LEVEL_LIMITS[run.levelId]);
         run.events.push("win");
         if (store) {
            store.getState().setScore(run.score);
            store.getState().end("win");
         }
         return;
      }
   }

   if (run.timeLeft <= 0) {
      run.over = true;
      run.endReason = "timeup";
      run.events.push("timeup");
      if (store) {
         store.getState().setScore(run.score);
         store.getState().end("timeup");
      }
      return;
   }

   if (store) {
      const synced = run.synced;
      const stamina = Math.round(run.stamina);
      if (synced.score !== run.score) store.getState().setScore((synced.score = run.score));
      if (synced.nectar !== run.carried.length) store.getState().setStat("nectar", (synced.nectar = run.carried.length));
      if (synced.stamina !== stamina) store.getState().setStat("stamina", (synced.stamina = stamina));
   }
}
