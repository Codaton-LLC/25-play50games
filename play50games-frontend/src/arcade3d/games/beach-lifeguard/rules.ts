// Beach Lifeguard rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// Sand depth 14 m (z: 0 to 14), water depth level.water (z: 0 to -water), width level.width.
// Start at the tower (0, 8). Shoreline at z = 0, safe sand at z >= 2.
import { resolveSphereAabb, type AABB } from "@/arcade3d/core/collision";
import { capScore as capToLimits, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type BeachLevel } from "./levels";

// ---------- tuning (scoring proof cites these) ----------

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

export const SHORELINE_Z = 0;
export const SAFE_SAND_Z = 2;
export const SAND_DEPTH = 14;
export const TOWER_X = 0;
export const TOWER_Z = 8;
export const JET_SKI_DOCK_X = 0;
export const JET_SKI_DOCK_Z = -2.0;

/** Score limits proven by oracle bots on all 5 levels. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 1020, minDurationMs: 4000, maxDurationMs: 120_000, base: 500, maxPointsPerSec: 21, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1360, minDurationMs: 4000, maxDurationMs: 150_000, base: 750, maxPointsPerSec: 16, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1690, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 14, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 1880, minDurationMs: 4000, maxDurationMs: 180_000, base: 1250, maxPointsPerSec: 10, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 2190, minDurationMs: 4000, maxDurationMs: 210_000, base: 1500, maxPointsPerSec: 9, unitLabel: "pts", display: "int" },
};

export function capScore(score: number, durationMs: number, limits: ScoringRules = PROPOSED_LEVEL_LIMITS[1]): number {
   return capToLimits(score, durationMs, limits);
}

// ---------- state interfaces ----------

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

export type PropKind = "chair" | "cooler" | "hut" | "sandcastle" | "surfboard" | "umbrella" | "palm";

export interface PropItem {
   kind: PropKind;
   x: number;
   z: number;
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
   jetSkiDock: { x: number; z: number };
   activeSwimmer: number;
   alertTime: number;
   swimmers: Swimmer[];
   props: PropItem[];
   over: "win" | "lose" | null;
}

export interface BeachInput {
   moveX: number;
   moveY: number;
   actionPressed: boolean;
   yaw: number;
}

export interface StepEvent {
   score?: number;
   won?: boolean;
   lost?: boolean;
   lifeLost?: boolean;
   rescued?: boolean;
   grabbed?: boolean;
   jetSkiMount?: boolean;
   jetSkiDismount?: boolean;
   alertAlarm?: boolean;
}

// ---------- physics integration across z = 0 ----------

/**
 * Computes delta z given desired velocity vz, factoring in sand vs water speed.
 * Sand (z >= 0): speed factor 1.0.
 * Water (z < 0): speed factor 0.62.
 * Integrates piecewise across z = 0 so speed in water is exactly 0.62 at every instant.
 */
export function stepZ(startZ: number, targetVZ: number, dt: number, waterFactor = WATER_FACTOR): number {
   if (dt <= 0 || targetVZ === 0) return startZ;
   // Moving from sand into water (-z)
   if (startZ >= 0 && targetVZ < 0) {
      const tSand = startZ / -targetVZ;
      if (tSand >= dt) {
         return startZ + targetVZ * dt;
      }
      const remainingDt = dt - tSand;
      const waterVZ = targetVZ * waterFactor;
      return 0 + waterVZ * remainingDt;
   }
   // Moving from water into sand (+z)
   if (startZ < 0 && targetVZ > 0) {
      const waterVZ = targetVZ * waterFactor;
      const tWater = -startZ / waterVZ;
      if (tWater >= dt) {
         return startZ + waterVZ * dt;
      }
      const remainingDt = dt - tWater;
      return 0 + targetVZ * remainingDt;
   }
   // Purely in sand
   if (startZ >= 0) {
      return startZ + targetVZ * dt;
   }
   // Purely in water
   return startZ + targetVZ * waterFactor * dt;
}

// ---------- generator ----------

export function createRun(seed: number, level: BeachLevel, levelId?: LevelId): Run {
   const rng = createRng(seed);

   // Determine levelId if not provided
   let resolvedId: LevelId = levelId ?? 1;
   if (!levelId) {
      for (const [k, v] of Object.entries(LEVELS)) {
         if (v === level || (v.width === level.width && v.water === level.water && v.rescues === level.rescues)) {
            resolvedId = Number(k) as LevelId;
            break;
         }
      }
   }

   // Spawn swimmers:
   // z in [-level.water + 2, -3]
   // x in [-level.width / 2 + 3, level.width / 2 - 3]
   // >= 6m apart in x, and never directly at x = 0 (tower corridor)
   const swimmers: Swimmer[] = [];
   const zMin = -level.water + 2;
   const zMax = -3;
   const xMin = -level.width / 2 + 3;
   const xMax = level.width / 2 - 3;

   const count = level.rescues;
   // Generate candidate slots
   for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      let valid = false;
      for (let attempt = 0; attempt < 100; attempt++) {
         const candX = xMin + rng() * (xMax - xMin);
         const candZ = zMin + rng() * (zMax - zMin);
         if (Math.abs(candX) < 1.4) continue; // Leave central tower lane clear
         let tooClose = false;
         for (const existing of swimmers) {
            if (Math.abs(existing.x - candX) < 6.0) {
               tooClose = true;
               break;
            }
         }
         if (!tooClose) {
            x = Math.round(candX * 10) / 10;
            z = Math.round(candZ * 10) / 10;
            valid = true;
            break;
         }
      }
      if (!valid) {
         // Fallback: distribute evenly
         const span = xMax - xMin;
         const step = span / (count + 1);
         let fallbackX = xMin + step * (i + 1);
         if (Math.abs(fallbackX) < 1.4) fallbackX = fallbackX < 0 ? -1.8 : 1.8;
         x = fallbackX;
         z = zMin + ((i % 3) / 2) * (zMax - zMin);
      }
      swimmers.push({ id: i, x, z, saved: false });
   }

   // Spawn props on sand (z: 3.5 to 13.5).
   // Rule: props must NOT sit on the return line: segment from every swimmer to (x, 2) is free of AABBs!
   // And spawn points leave a straight sand corridor to the tower (x = 0).
   const props: PropItem[] = [];
   const propKinds: PropKind[] = ["chair", "cooler", "hut", "sandcastle", "surfboard", "umbrella", "palm"];
   const propRadii: Record<PropKind, number> = {
      chair: 0.6,
      cooler: 0.4,
      hut: 1.1,
      sandcastle: 0.5,
      surfboard: 0.5,
      umbrella: 0.8,
      palm: 0.7,
   };

   // Prop count scales mildly with level (L3 adds chairs per spec)
   const basePropCount = 6 + level.rescues * 2;
   for (let attempt = 0; attempt < 200 && props.length < basePropCount; attempt++) {
      const kind = propKinds[Math.floor(rng() * propKinds.length)];
      const r = propRadii[kind];
      const px = -level.width / 2 + 2 + rng() * (level.width - 4);
      const pz = 3.5 + rng() * 9.5;

      // Check clearance with all swimmer return corridors (x: swimmer.x - 1.2 to swimmer.x + 1.2)
      let inCorridor = false;
      for (const swimmer of swimmers) {
         if (Math.abs(px - swimmer.x) < r + 0.9) {
            inCorridor = true;
            break;
         }
      }
      if (inCorridor) continue;

      // Check clearance with tower corridor (x: -1.6 to 1.6)
      if (Math.abs(px - TOWER_X) < r + 1.2 && pz >= 0 && pz <= 10) continue;

      // Check clearance with already placed props
      let overlaps = false;
      for (const p of props) {
         if (Math.hypot(p.x - px, p.z - pz) < r + propRadii[p.kind] + 0.5) {
            overlaps = true;
            break;
         }
      }
      if (overlaps) continue;

      const rotY = rng() * Math.PI * 2;
      const box: AABB = {
         min: { x: px - r, y: 0, z: pz - r },
         max: { x: px + r, y: 2.0, z: pz + r },
      };
      props.push({ kind, x: px, z: pz, rotY, box });
   }

   // Jet ski dock position: in water near shore
   const jetSkiDock = { x: JET_SKI_DOCK_X, z: JET_SKI_DOCK_Z };

   return {
      levelId: resolvedId,
      level,
      seed,
      time: 0,
      score: 0,
      lives: LIVES,
      saved: 0,
      expiredAlerts: 0,
      hero: { x: TOWER_X, y: 0, z: TOWER_Z, vx: 0, vz: 0, yaw: Math.PI },
      carrying: false,
      onJetSki: false,
      jetSki: { ...jetSkiDock },
      jetSkiDock,
      activeSwimmer: 0,
      alertTime: level.alertS,
      swimmers,
      props,
      over: null,
   };
}

// ---------- step ----------

export function step(run: Run, input: BeachInput, dt: number, timeLeftMs: number): StepEvent {
   const ev: StepEvent = {};
   if (run.over || dt <= 0) return ev;

   run.time += dt;

   // 1. Alert clock
   run.alertTime -= dt;
   if (run.alertTime <= 0) {
      // Alert expired!
      ev.lifeLost = true;
      run.lives--;
      run.expiredAlerts++;
      run.carrying = false; // Drop float/swimmer

      if (run.lives <= 0 || run.expiredAlerts >= 3) {
         run.over = "lose";
         ev.lost = true;
         return ev;
      }
      // Reset alert for next swimmer
      run.alertTime = run.level.alertS;
      run.activeSwimmer = (run.activeSwimmer + 1) % run.swimmers.length;
      ev.alertAlarm = true;
   }

   // 2. Jet ski mount / dismount
   if (run.level.jetSki && !run.carrying) {
      if (!run.onJetSki && input.actionPressed) {
         const distToJetSki = Math.hypot(run.hero.x - run.jetSki.x, run.hero.z - run.jetSki.z);
         if (distToJetSki <= 1.2) {
            run.onJetSki = true;
            ev.jetSkiMount = true;
         }
      }
   }

   // 3. Movement
   const world = inputToWorld(input.moveX, input.moveY, input.yaw);
   const len = Math.hypot(world.x, world.z);
   const dirX = len > 0.001 ? world.x / len : 0;
   const dirZ = len > 0.001 ? world.z / len : 0;
   const stick = Math.min(1, len);

   if (len > 0.05) {
      run.hero.yaw = turnTowards(run.hero.yaw, Math.atan2(dirX, dirZ), 14 * dt);
   }

   const maxBaseSpeed = run.onJetSki ? JET_SKI_SPEED : SPEED_SAND;
   const carryMult = run.carrying ? CARRY_FACTOR : 1.0;
   const targetSpeed = maxBaseSpeed * carryMult * stick;

   // X displacement
   const inWater = run.hero.z < 0;
   const xFactor = inWater && !run.onJetSki ? WATER_FACTOR : 1.0;
   run.hero.vx = dirX * targetSpeed * xFactor;
   run.hero.x += run.hero.vx * dt;

   // Z displacement
   run.hero.vz = dirZ * targetSpeed;
   if (run.onJetSki) {
      run.hero.z += run.hero.vz * dt;
      // Clamp jet ski to water: touching z >= 0 dismounts
      if (run.hero.z >= 0) {
         run.hero.z = 0;
         run.onJetSki = false;
         ev.jetSkiDismount = true;
         run.jetSki.x = run.jetSkiDock.x;
         run.jetSki.z = run.jetSkiDock.z;
      } else {
         run.jetSki.x = run.hero.x;
         run.jetSki.z = run.hero.z;
      }
   } else {
      run.hero.z = stepZ(run.hero.z, run.hero.vz, dt, WATER_FACTOR);
   }

   // Boundary clamp
   const halfW = run.level.width / 2;
   run.hero.x = Math.max(-halfW + RADIUS, Math.min(halfW - RADIUS, run.hero.x));
   const minZ = -run.level.water + RADIUS;
   const maxZ = SAND_DEPTH - RADIUS;
   run.hero.z = Math.max(minZ, Math.min(maxZ, run.hero.z));

   if (run.onJetSki) {
      run.hero.z = Math.min(0, run.hero.z);
   }

   // Prop collision resolution on sand
   if (!run.onJetSki && run.hero.z >= 0) {
      for (const prop of run.props) {
         resolveSphereAabb(run.hero, RADIUS, prop.box);
      }
   }

   // 4. Grab action
   if (input.actionPressed && !run.carrying) {
      const swimmer = run.swimmers[run.activeSwimmer];
      if (swimmer && !swimmer.saved) {
         const d = Math.hypot(run.hero.x - swimmer.x, run.hero.z - swimmer.z);
         if (d <= GRAB_RANGE + 0.001) {
            run.carrying = true;
            ev.grabbed = true;
         }
      }
   }

   // 5. Safe sand rescue check (z >= 2)
   if (run.carrying && run.hero.z >= SAFE_SAND_Z) {
      run.carrying = false;
      const swimmer = run.swimmers[run.activeSwimmer];
      if (swimmer) swimmer.saved = true;
      run.saved++;

      let pts = RESCUE_BASE_POINTS;
      if (run.alertTime > run.level.alertS / 2) {
         pts += RESCUE_CLOCK_BONUS;
      }
      run.score += pts;
      ev.score = pts;
      ev.rescued = true;

      // Win check
      if (run.saved >= run.level.rescues) {
         const rawBonus = Math.floor(Math.max(0, timeLeftMs) / 1000) * TIME_BONUS_PER_SECOND;
         const limits = PROPOSED_LEVEL_LIMITS[run.levelId];
         const targetScore = capScore(run.score + rawBonus, Math.round(run.time * 1000), limits);
         const bonus = targetScore - run.score;
         run.score = targetScore;
         ev.score = (ev.score ?? 0) + bonus;
         run.over = "win";
         ev.won = true;
      } else {
         // Next alert
         run.activeSwimmer = (run.activeSwimmer + 1) % run.swimmers.length;
         run.alertTime = run.level.alertS;
         ev.alertAlarm = true;
      }
   }

   return ev;
}
