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
   hiveRadius: 1.6,
   flowerReach: 0.55,
   branchRadius: 0.5,
   webRadius: 0.65,
   carryCap: 3,
   pointsPerUnit: 20,
   bonusFullLoad: 15,
   winBonusPerSecond: 4,
   breezeAccelX: 0.8,
   resultDelayMs: 900,
} as const;

export interface Flower {
   id: number;
   type: "A" | "B" | "C";
   x: number;
   z: number;
   hasNectar: boolean;
}

export interface Branch {
   id: number;
   x: number;
   z: number;
   radius: number;
}

export interface Web {
   id: number;
   x: number;
   z: number;
   radius: number;
}

export interface BeeState {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
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
   time: number;
   timeLeft: number;
   over: boolean;
   endReason: "win" | "lose" | "timeup" | null;
   bounds: { halfX: number; halfZ: number };
   events: RunEvent[];
}

export interface StepInput {
   moveX?: number;
   moveY?: number;
   dirX?: number;
   dirZ?: number;
   jump?: boolean;
}

/**
 * Server limits for points games (README "Server limits and why they hold", arcade-score-limits skill).
 * Copied into meta.levels and arcade-games.json. Level 1 equals meta.scoring byte-for-byte.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: {
      kind: "points",
      maxScore: 680,
      minDurationMs: 4000,
      maxDurationMs: 120_000,
      base: 245,
      maxPointsPerSec: 31,
      unitLabel: "pts",
      display: "int",
   },
   2: {
      kind: "points",
      maxScore: 890,
      minDurationMs: 4000,
      maxDurationMs: 150_000,
      base: 375,
      maxPointsPerSec: 22,
      unitLabel: "pts",
      display: "int",
   },
   3: {
      kind: "points",
      maxScore: 1100,
      minDurationMs: 4000,
      maxDurationMs: 180_000,
      base: 490,
      maxPointsPerSec: 19,
      unitLabel: "pts",
      display: "int",
   },
   4: {
      kind: "points",
      maxScore: 1180,
      minDurationMs: 4000,
      maxDurationMs: 180_000,
      base: 620,
      maxPointsPerSec: 13,
      unitLabel: "pts",
      display: "int",
   },
   5: {
      kind: "points",
      maxScore: 1380,
      minDurationMs: 4000,
      maxDurationMs: 210_000,
      base: 750,
      maxPointsPerSec: 11,
      unitLabel: "pts",
      display: "int",
   },
};

export const PROPOSED_LIMITS = PROPOSED_LEVEL_LIMITS[1];

export function withinServerLimits(score: number, durationMs: number, rules: ScoringRules = PROPOSED_LIMITS): boolean {
   return fitsLimits(score, durationMs, rules);
}

export function capScore(score: number, durationMs: number, rules: ScoringRules = PROPOSED_LIMITS): number {
   return capToLimits(score, durationMs, rules);
}

/** Pure, seeded layout generator for Bee Garden. */
export function createRun(seed: number, level: BeeLevel = LEVELS[1], levelId: LevelId = 1): RunState {
   const rng = createRng(seed);
   const halfX = level.width / 2;
   const halfZ = level.depth / 2;

   // Hive positioned at south edge
   const hive = {
      x: 0,
      z: halfZ - 2.5,
      radius: TUNING.hiveRadius,
   };

   // Player bee starts at hive facing forward (+z = south, heading = -PI/2 faces north)
   const bee: BeeState = {
      x: 0,
      y: TUNING.altitude,
      z: halfZ - 2.5,
      vx: 0,
      vz: 0,
      heading: -Math.PI / 2,
      lateralAccel: 0,
   };

   const branches: Branch[] = [];
   const webs: Web[] = [];
   const flowers: Flower[] = [];

   // South safety corridor: z >= halfZ - 4.5 is strictly hazard-free
   const hazardMaxZ = halfZ - 4.5;

   // Place branches
   let branchAttempts = 0;
   while (branches.length < level.branches && branchAttempts < 500) {
      branchAttempts++;
      const bx = (rng() * 2 - 1) * (halfX - 2.0);
      const bz = -halfZ + 2.0 + rng() * (hazardMaxZ - (-halfZ + 2.0));
      // Distance from other branches
      const tooClose = branches.some((b) => Math.hypot(b.x - bx, b.z - bz) < 3.2);
      // Distance from hive
      const hiveDist = Math.hypot(hive.x - bx, hive.z - bz);
      if (!tooClose && hiveDist > hive.radius + 2.0) {
         branches.push({ id: branches.length, x: bx, z: bz, radius: TUNING.branchRadius });
      }
   }

   // Place webs
   let webAttempts = 0;
   while (webs.length < level.webs && webAttempts < 500) {
      webAttempts++;
      const wx = (rng() * 2 - 1) * (halfX - 2.0);
      const wz = -halfZ + 2.0 + rng() * (hazardMaxZ - (-halfZ + 2.0));
      const tooCloseWeb = webs.some((w) => Math.hypot(w.x - wx, w.z - wz) < 3.0);
      const tooCloseBranch = branches.some((b) => Math.hypot(b.x - wx, b.z - wz) < 2.0);
      const hiveDist = Math.hypot(hive.x - wx, hive.z - wz);
      if (!tooCloseWeb && !tooCloseBranch && hiveDist > hive.radius + 2.0) {
         webs.push({ id: webs.length, x: wx, z: wz, radius: TUNING.webRadius });
      }
   }

   // Place flowers (types A, B, C in rotation)
   const flowerTypes: Array<"A" | "B" | "C"> = ["A", "B", "C"];
   let flowerAttempts = 0;
   while (flowers.length < level.units && flowerAttempts < 2000) {
      flowerAttempts++;
      const fx = (rng() * 2 - 1) * (halfX - 1.8);
      const fz = (rng() * 2 - 1) * (halfZ - 1.8);
      const hiveDist = Math.hypot(hive.x - fx, hive.z - fz);
      if (hiveDist < hive.radius + 1.8) continue;

      const nearBranch = branches.some((b) => Math.hypot(b.x - fx, b.z - fz) < b.radius + 1.2);
      if (nearBranch) continue;

      const nearWeb = webs.some((w) => Math.hypot(w.x - fx, w.z - fz) < w.radius + 1.2);
      if (nearWeb) continue;

      const nearFlower = flowers.some((f) => Math.hypot(f.x - fx, f.z - fz) < 1.6);
      if (nearFlower) continue;

      const type = flowerTypes[flowers.length % 3];
      flowers.push({ id: flowers.length, type, x: fx, z: fz, hasNectar: true });
   }

   // If tight seeds miss candidate spots, fill with deterministic grid spots
   if (flowers.length < level.units) {
      const stepX = (halfX * 1.6) / Math.ceil(Math.sqrt(level.units));
      const stepZ = (halfZ * 1.5) / Math.ceil(Math.sqrt(level.units));
      for (let gx = -halfX + 2.0; gx <= halfX - 2.0 && flowers.length < level.units; gx += stepX) {
         for (let gz = -halfZ + 2.0; gz <= halfZ - 4.5 && flowers.length < level.units; gz += stepZ) {
            const nearFlower = flowers.some((f) => Math.hypot(f.x - gx, f.z - gz) < 1.0);
            if (!nearFlower) {
               const type = flowerTypes[flowers.length % 3];
               flowers.push({ id: flowers.length, type, x: gx, z: gz, hasNectar: true });
            }
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
      time: 0,
      timeLeft: level.durationMs / 1000,
      over: false,
      endReason: null,
      bounds: { halfX, halfZ },
      events: [],
   };
}

/** Pure frame step for Bee Garden. Mutates `run` in place without allocating. */
export function stepRun(
   run: RunState,
   input: StepInput,
   dt: number,
   store?: StoreApi<ArcadeStore>
): void {
   if (run.over || !(dt > 0)) return;

   run.events = [];
   run.time += dt;
   run.timeLeft = Math.max(0, run.level.durationMs / 1000 - run.time);

   // Stun timer takes priority
   if (run.stunTimer > 0) {
      run.stunTimer = Math.max(0, run.stunTimer - dt);
      run.bee.vx = 0;
      run.bee.vz = 0;
      if (run.stunTimer <= 0) {
         run.webImmunityTimer = 0.4;
      }
   } else {
      // Boost and stamina update
      if (run.boostLock > 0) {
         run.boostLock = Math.max(0, run.boostLock - dt);
      }

      const wantsBoost = Boolean(input.jump);
      const canBoost = wantsBoost && run.stamina > 0 && run.boostLock <= 0;

      if (canBoost) {
         run.boosting = true;
         run.stamina = Math.max(0, run.stamina - TUNING.boostDrain * dt);
         if (run.stamina <= 0) {
            run.stamina = 0;
            run.boosting = false;
            run.boostLock = TUNING.boostLockDuration;
         }
      } else {
         if (run.boosting && !wantsBoost) {
            run.boosting = false;
            run.boostLock = TUNING.boostLockDuration;
         } else {
            run.boosting = false;
         }
         run.stamina = Math.min(100, run.stamina + TUNING.boostRefill * dt);
      }

      const topSpeed = run.boosting ? TUNING.boostSpeed : TUNING.normalSpeed;

      // Steering
      let dx = input.dirX ?? input.moveX ?? 0;
      let dz = input.dirZ ?? input.moveY ?? 0;
      const len = Math.hypot(dx, dz);
      if (len > 1) {
         dx /= len;
         dz /= len;
      }

      const targetVx = dx * topSpeed;
      const targetVz = dz * topSpeed;

      let dvx = targetVx - run.bee.vx;
      let dvz = targetVz - run.bee.vz;
      const dv = Math.hypot(dvx, dvz);
      const maxDv = TUNING.accel * dt;
      if (dv > maxDv) {
         dvx = (dvx / dv) * maxDv;
         dvz = (dvz / dv) * maxDv;
      }
      run.bee.vx += dvx;
      run.bee.vz += dvz;

      // Drag when input is near zero
      if (len < 0.05) {
         const dragFactor = Math.max(0, 1 - TUNING.drag * dt);
         run.bee.vx *= dragFactor;
         run.bee.vz *= dragFactor;
      }

      // Breeze acceleration (L5)
      if (run.level.breeze) {
         run.bee.vx += TUNING.breezeAccelX * dt;
      }

      // Speed cap
      const spd = Math.hypot(run.bee.vx, run.bee.vz);
      if (spd > topSpeed) {
         run.bee.vx = (run.bee.vx / spd) * topSpeed;
         run.bee.vz = (run.bee.vz / spd) * topSpeed;
      }

      // Position update
      run.bee.x += run.bee.vx * dt;
      run.bee.z += run.bee.vz * dt;
      run.bee.y = TUNING.altitude;

      // Obstacle collision (branches)
      for (const branch of run.branches) {
         const dist = Math.hypot(run.bee.x - branch.x, run.bee.z - branch.z);
         const minDist = TUNING.beeRadius + branch.radius;
         if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = (run.bee.x - branch.x) / (dist || 1);
            const nz = (run.bee.z - branch.z) / (dist || 1);
            run.bee.x += nx * overlap;
            run.bee.z += nz * overlap;
            const vn = run.bee.vx * nx + run.bee.vz * nz;
            if (vn < 0) {
               run.bee.vx -= vn * nx;
               run.bee.vz -= vn * nz;
            }
         }
      }

      // Garden bounds clamp
      const hx = run.bounds.halfX - TUNING.beeRadius;
      const hz = run.bounds.halfZ - TUNING.beeRadius;
      run.bee.x = Math.max(-hx, Math.min(hx, run.bee.x));
      run.bee.z = Math.max(-hz, Math.min(hz, run.bee.z));

      // Heading and banking
      const speed = Math.hypot(run.bee.vx, run.bee.vz);
      if (speed > 0.2) {
         const targetHeading = Math.atan2(run.bee.vx, run.bee.vz);
         run.bee.heading = turnTowards(run.bee.heading, targetHeading, 1 - Math.exp(-12 * dt));
      }
      run.bee.lateralAccel = run.bee.vx * Math.cos(run.bee.heading) - run.bee.vz * Math.sin(run.bee.heading);
   }

   // Web overlap check
   if (run.webImmunityTimer > 0) {
      run.webImmunityTimer = Math.max(0, run.webImmunityTimer - dt);
   } else if (run.stunTimer <= 0) {
      for (const web of run.webs) {
         const dist = Math.hypot(run.bee.x - web.x, run.bee.z - web.z);
         if (dist < TUNING.beeRadius + web.radius) {
            run.stunTimer = TUNING.stunDuration;
            run.bee.vx = 0;
            run.bee.vz = 0;
            run.boosting = false;
            // Drop carried nectar back to exact flowers
            for (const fid of run.carried) {
               const flower = run.flowers.find((f) => f.id === fid);
               if (flower) flower.hasNectar = true;
            }
            run.carried = [];
            run.events.push("web_hit");
            break;
         }
      }
   }

   // Nectar collection
   if (run.carried.length < TUNING.carryCap && run.stunTimer <= 0) {
      for (const flower of run.flowers) {
         if (flower.hasNectar) {
            const dist = Math.hypot(run.bee.x - flower.x, run.bee.z - flower.z);
            if (dist < TUNING.flowerReach) {
               flower.hasNectar = false;
               run.carried.push(flower.id);
               run.events.push("pickup");
               if (run.carried.length >= TUNING.carryCap) break;
            }
         }
      }
   }

   // Hive deposit
   const distHive = Math.hypot(run.bee.x - run.hive.x, run.bee.z - run.hive.z);
   if (distHive < run.hive.radius + TUNING.beeRadius && run.carried.length > 0) {
      const count = run.carried.length;
      const pts = TUNING.pointsPerUnit * count + (count === TUNING.carryCap ? TUNING.bonusFullLoad : 0);
      run.score += pts;
      run.totalDeposited += count;
      run.carried = [];
      run.events.push("deposit");

      // Check win condition
      if (run.totalDeposited >= run.level.units) {
         run.over = true;
         run.endReason = "win";
         const secsLeft = Math.floor(run.timeLeft);
         const timeBonus = Math.max(0, secsLeft * TUNING.winBonusPerSecond);
         run.score += timeBonus;
         run.score = capScore(run.score, run.time * 1000, PROPOSED_LEVEL_LIMITS[run.levelId]);
         run.events.push("win");
         if (store) {
            store.getState().setScore(run.score);
            store.getState().end("win");
         }
         return;
      }
   }

   // Check timeup
   if (run.timeLeft <= 0 && !run.over) {
      run.over = true;
      run.endReason = "timeup";
      run.events.push("timeup");
      if (store) {
         store.getState().setScore(run.score);
         store.getState().end("timeup");
      }
      return;
   }

   // Sync to store
   if (store) {
      store.getState().setScore(run.score);
      store.getState().setStat("nectar", run.carried.length);
      store.getState().setStat("stamina", Math.round(run.stamina));
   }
}
