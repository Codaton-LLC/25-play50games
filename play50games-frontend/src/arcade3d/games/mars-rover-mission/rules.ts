// Mars Rover Mission pure rules and simulation. Owned by antigravity.
// No three.js, React or DOM imports.
import {
   aabbFromCenter,
   circlesOverlapXZ,
   distanceSq,
   resolveSphereAabb,
   sweptAabbXZ,
   type AABB,
   type Vec3Like,
} from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type MarsLevel } from "./levels";

export const ROVER = {
   topSpeed: 7,
   accel: 7,
   brake: 12,
   reverse: 2.5,
   steer: 1.8, // rad/s
   radius: 1.1,
   drag: 0.6,
} as const;

export const LIVES = 3;
export const SITE_RING_RADIUS = 1.8;
export const SCAN_SPEED_MAX = 0.5;
export const SCAN_HOLD_S = 1.0;
export const CHARGER_PAD_RADIUS = 2.2;
export const CHARGE_RATE = 12; // battery per second
export const BASE_PAD_RADIUS = 2.4;
export const WIN_HOLD_S = 0.6;
export const ROCK_RADIUS = 0.95;
export const ROCK_HIT_SPEED = 3.0;
export const BOULDER_RADIUS = 0.85;

export const BASE_SCAN_SCORE = 120;
export const CENTER_BONUS_SCORE = 60;
export const CENTER_BONUS_RADIUS = 1.0;
export const TIME_BONUS_PER_SEC = 5;

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 1020, minDurationMs: 4000, maxDurationMs: 120_000, base: 540, maxPointsPerSec: 36, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1300, minDurationMs: 4000, maxDurationMs: 150_000, base: 720, maxPointsPerSec: 28, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1580, minDurationMs: 4000, maxDurationMs: 180_000, base: 900, maxPointsPerSec: 24, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 1690, minDurationMs: 4000, maxDurationMs: 180_000, base: 1080, maxPointsPerSec: 20, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 2100, minDurationMs: 4000, maxDurationMs: 240_000, base: 1260, maxPointsPerSec: 20, unitLabel: "pts", display: "int" },
};

export interface MarsInput {
   moveX: number;
   moveY: number;
}

export interface Site {
   index: number;
   x: number;
   z: number;
   scanned: boolean;
   holdTime: number;
}

export interface Charger {
   index: number;
   x: number;
   z: number;
}

export interface Rock {
   index: number;
   x: number;
   z: number;
   radius: number;
}

export interface Boulder {
   index: number;
   x: number;
   z: number;
   speed: number;
   minZ: number;
   maxZ: number;
}

export interface BasePad {
   x: number;
   z: number;
   radius: number;
}

export interface RoverState {
   x: number;
   z: number;
   yaw: number;
   speed: number;
   vx: number;
   vz: number;
   battery: number;
   invulnerable: number;
}

export interface StepEvents {
   score: number;
   siteScanned: number;
   centerBonus: boolean;
   charging: boolean;
   rockHit: boolean;
   boulderHit: boolean;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   timeBonus: number;
}

export interface Run {
   seed: number;
   level: MarsLevel;
   rover: RoverState;
   sites: Site[];
   chargers: Charger[];
   rocks: Rock[];
   boulders: Boulder[];
   basePad: BasePad;
   score: number;
   lives: number;
   samplesScanned: number;
   baseHoldTime: number;
   over: "win" | "lose" | null;
   charging: boolean;
   ev: StepEvents;
   time: number;
}

export function idleInput(): MarsInput {
   return { moveX: 0, moveY: 0 };
}

export function timeBonus(timeLeftMs: number): number {
   return Math.floor(Math.max(0, timeLeftMs) / 1000) * TIME_BONUS_PER_SEC;
}

export function createRun(seed: number, level: MarsLevel): Run {
   const rng = createRng(seed);

   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   const baseZ = halfD - 3.5;
   const basePad: BasePad = { x: 0, z: baseZ, radius: BASE_PAD_RADIUS };

   // 1. Generate scan sites: >= 10 m apart, >= 3 m from solids and base
   const sites: Site[] = [];
   const siteMarginX = halfW - 3.8;
   const siteMinZ = -halfD + 3.8;
   const siteMaxZ = halfD - 6.5;

   for (let i = 0; i < level.sites; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 200; attempt++) {
         const x = (rng() * 2 - 1) * siteMarginX;
         const z = siteMinZ + rng() * (siteMaxZ - siteMinZ);

         // Distance to base
         if (Math.hypot(x - basePad.x, z - basePad.z) < 6.5) continue;

         // Distance to other sites (>= 10 m apart)
         let tooClose = false;
         for (const existing of sites) {
            if (Math.hypot(x - existing.x, z - existing.z) < 10.0) {
               tooClose = true;
               break;
            }
         }
         if (tooClose) continue;

         sites.push({
            index: i,
            x: Math.round(x * 10) / 10,
            z: Math.round(z * 10) / 10,
            scanned: false,
            holdTime: 0,
         });
         placed = true;
         break;
      }

      if (!placed) {
         // Deterministic fallback grid placement if random attempts miss
         const stepX = (siteMarginX * 2) / Math.max(1, level.sites);
         const fallbackX = -siteMarginX + (i + 0.5) * stepX;
         const fallbackZ = siteMinZ + ((i % 3) + 0.5) * ((siteMaxZ - siteMinZ) / 3);
         sites.push({
            index: i,
            x: Math.round(fallbackX * 10) / 10,
            z: Math.round(fallbackZ * 10) / 10,
            scanned: false,
            holdTime: 0,
         });
      }
   }

   // 2. Generate chargers: placed within reach of the farthest site
   const chargers: Charger[] = [];
   // Sort sites by distance from base descending to find the farthest site(s)
   const sortedByDist = [...sites].sort(
      (a, b) => Math.hypot(b.x - basePad.x, b.z - basePad.z) - Math.hypot(a.x - basePad.x, a.z - basePad.z)
   );

   for (let c = 0; c < level.chargers; c++) {
      const anchorSite = sortedByDist[c % sortedByDist.length];
      let placed = false;
      for (let attempt = 0; attempt < 100; attempt++) {
         const angle = rng() * Math.PI * 2;
         const dist = 4.2 + rng() * 3.5;
         let cx = anchorSite.x + Math.cos(angle) * dist;
         let cz = anchorSite.z + Math.sin(angle) * dist;

         // Clamp within plain boundaries
         cx = Math.max(-halfW + 3.5, Math.min(halfW - 3.5, cx));
         cz = Math.max(-halfD + 3.5, Math.min(halfD - 5.5, cz));

         // Check distance to base pad and sites
         if (Math.hypot(cx - basePad.x, cz - basePad.z) < 5.0) continue;
         let closeToSite = false;
         for (const s of sites) {
            if (Math.hypot(cx - s.x, cz - s.z) < 3.5) {
               closeToSite = true;
               break;
            }
         }
         if (closeToSite) continue;

         // Check distance to other chargers
         let closeToCharger = false;
         for (const ch of chargers) {
            if (Math.hypot(cx - ch.x, cz - ch.z) < 6.0) {
               closeToCharger = true;
               break;
            }
         }
         if (closeToCharger) continue;

         chargers.push({
            index: c,
            x: Math.round(cx * 10) / 10,
            z: Math.round(cz * 10) / 10,
         });
         placed = true;
         break;
      }

      if (!placed) {
         // Fallback offset from anchor site
         const offsetSign = c === 0 ? 1 : -1;
         const cx = Math.max(-halfW + 3.5, Math.min(halfW - 3.5, anchorSite.x + offsetSign * 5.0));
         const cz = Math.max(-halfD + 3.5, Math.min(halfD - 5.5, anchorSite.z));
         chargers.push({
            index: c,
            x: Math.round(cx * 10) / 10,
            z: Math.round(cz * 10) / 10,
         });
      }
   }

   // 3. Generate rocks (solid circles): >= 3 m from base and sites
   const rocks: Rock[] = [];
   for (let r = 0; r < level.rocks; r++) {
      for (let attempt = 0; attempt < 150; attempt++) {
         const rx = (rng() * 2 - 1) * (halfW - 3.0);
         const rz = -halfD + 3.0 + rng() * (level.depth - 6.0);

         // Avoid base pad
         if (Math.hypot(rx - basePad.x, rz - basePad.z) < 5.0) continue;

         // Avoid sites (>= 3 m from solids)
         let nearSite = false;
         for (const s of sites) {
            if (Math.hypot(rx - s.x, rz - s.z) < SITE_RING_RADIUS + ROCK_RADIUS + 1.2) {
               nearSite = true;
               break;
            }
         }
         if (nearSite) continue;

         // Avoid chargers
         let nearCharger = false;
         for (const ch of chargers) {
            if (Math.hypot(rx - ch.x, rz - ch.z) < CHARGER_PAD_RADIUS + ROCK_RADIUS + 1.0) {
               nearCharger = true;
               break;
            }
         }
         if (nearCharger) continue;

         // Avoid other rocks
         let nearRock = false;
         for (const existing of rocks) {
            if (Math.hypot(rx - existing.x, rz - existing.z) < ROCK_RADIUS * 2 + 1.0) {
               nearRock = true;
               break;
            }
         }
         if (nearRock) continue;

         rocks.push({
            index: r,
            x: Math.round(rx * 10) / 10,
            z: Math.round(rz * 10) / 10,
            radius: ROCK_RADIUS,
         });
         break;
      }
   }

   // 4. Generate boulders (rolling down the canyon along straight seeded lanes)
   const boulders: Boulder[] = [];
   if (level.boulders > 0) {
      const laneSpread = (halfW - 4.5) * 2;
      const laneStep = laneSpread / (level.boulders + 1);
      for (let b = 0; b < level.boulders; b++) {
         let laneX = -halfW + 4.5 + (b + 1) * laneStep + (rng() * 2 - 1) * 0.8;
         const startZ = -halfD + 2.0 + rng() * (level.depth - 4.0);

         // Ensure laneX has clearance from base pad (>= 3.5m), sites (>= 3.0m), and chargers (>= 3.0m)
         for (let attempt = 0; attempt < 30; attempt++) {
            let conflict = false;
            if (Math.abs(laneX - basePad.x) < 3.5) conflict = true;
            if (!conflict) {
               for (const s of sites) {
                  if (Math.abs(laneX - s.x) < 3.0) {
                     conflict = true;
                     break;
                  }
               }
            }
            if (!conflict) {
               for (const ch of chargers) {
                  if (Math.abs(laneX - ch.x) < 3.0) {
                     conflict = true;
                     break;
                  }
               }
            }
            if (!conflict) break;
            const shiftSign = attempt % 2 === 0 ? 1 : -1;
            const shiftAmount = Math.ceil((attempt + 1) / 2) * 0.6;
            laneX += shiftSign * shiftAmount;
            laneX = Math.max(-halfW + 3.0, Math.min(halfW - 3.0, laneX));
         }

         boulders.push({
            index: b,
            x: Math.round(laneX * 10) / 10,
            z: Math.round(startZ * 10) / 10,
            speed: level.boulderSpeed,
            minZ: -halfD + 1.5,
            maxZ: halfD - 1.5,
         });
      }
   }

   const rover: RoverState = {
      x: 0,
      z: baseZ,
      yaw: 0, // facing north (-z)
      speed: 0,
      vx: 0,
      vz: 0,
      battery: 100,
      invulnerable: 0,
   };

   return {
      seed,
      level,
      rover,
      sites,
      chargers,
      rocks,
      boulders,
      basePad,
      score: 0,
      lives: LIVES,
      samplesScanned: 0,
      baseHoldTime: 0,
      over: null,
      charging: false,
      ev: {
         score: 0,
         siteScanned: -1,
         centerBonus: false,
         charging: false,
         rockHit: false,
         boulderHit: false,
         lifeLost: false,
         won: false,
         lost: false,
         timeBonus: 0,
      },
      time: 0,
   };
}

const ROVER_PREV = { x: 0, y: 0, z: 0 };
const ROVER_HALF = { x: ROVER.radius, y: 1, z: ROVER.radius };
const BOULDER_HALF = { x: BOULDER_RADIUS, y: 1, z: BOULDER_RADIUS };
const ROVER_AABB: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const BOULDER_AABB: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const REL_DELTA = { x: 0, z: 0 };

export function step(run: Run, input: MarsInput, dt: number, timeLeftMs: number): StepEvents {
   const ev: StepEvents = {
      score: 0,
      siteScanned: -1,
      centerBonus: false,
      charging: false,
      rockHit: false,
      boulderHit: false,
      lifeLost: false,
      won: false,
      lost: false,
      timeBonus: 0,
   };
   run.ev = ev;

   if (!(dt > 0) || run.over) return ev;
   run.time += dt;

   // Invulnerability cooldown
   if (run.rover.invulnerable > 0) {
      run.rover.invulnerable = Math.max(0, run.rover.invulnerable - dt);
   }

   // 1. Controls & longitudinal physics
   // input.moveY: up (W/Up) is negative -> forward throttle; down (S/Down) is positive -> brake / reverse
   const throttle = Math.max(0, Math.min(1, -input.moveY));
   const reverseBrake = Math.max(0, Math.min(1, input.moveY));
   const steer = Math.max(-1, Math.min(1, input.moveX));

   let speed = run.rover.speed;

   if (speed >= 0) {
      if (throttle > 0) {
         speed = Math.min(ROVER.topSpeed, speed + ROVER.accel * throttle * dt);
      } else if (reverseBrake > 0) {
         speed -= ROVER.brake * reverseBrake * dt;
         if (speed < 0) speed = Math.max(-ROVER.reverse, speed);
      } else {
         speed *= Math.exp(-ROVER.drag * dt);
         if (speed < 0.02) speed = 0;
      }
   } else {
      if (reverseBrake > 0) {
         speed = Math.max(-ROVER.reverse, speed - ROVER.accel * reverseBrake * dt);
      } else if (throttle > 0) {
         speed += ROVER.brake * throttle * dt;
         if (speed > 0) speed = Math.min(ROVER.topSpeed, speed);
      } else {
         speed *= Math.exp(-ROVER.drag * dt);
         if (speed > -0.02) speed = 0;
      }
   }
   run.rover.speed = speed;

   // 2. Steering (rover steer rate in rad/s)
   if (steer !== 0) {
      run.rover.yaw += steer * ROVER.steer * dt;
      while (run.rover.yaw > Math.PI) run.rover.yaw -= 2 * Math.PI;
      while (run.rover.yaw < -Math.PI) run.rover.yaw += 2 * Math.PI;
   }

   // 3. Velocity & position update
   run.rover.vx = Math.sin(run.rover.yaw) * run.rover.speed;
   run.rover.vz = -Math.cos(run.rover.yaw) * run.rover.speed;

   ROVER_PREV.x = run.rover.x;
   ROVER_PREV.z = run.rover.z;

   const movedDist = Math.abs(run.rover.speed) * dt;
   run.rover.x += run.rover.vx * dt;
   run.rover.z += run.rover.vz * dt;

   // 4. Arena boundary clamp (mesa walls)
   const minX = -run.level.width / 2 + ROVER.radius;
   const maxX = run.level.width / 2 - ROVER.radius;
   const minZ = -run.level.depth / 2 + ROVER.radius;
   const maxZ = run.level.depth / 2 - ROVER.radius;

   if (run.rover.x < minX) {
      run.rover.x = minX;
      run.rover.speed = Math.min(0, run.rover.speed * -0.2);
   } else if (run.rover.x > maxX) {
      run.rover.x = maxX;
      run.rover.speed = Math.min(0, run.rover.speed * -0.2);
   }

   if (run.rover.z < minZ) {
      run.rover.z = minZ;
      run.rover.speed = Math.min(0, run.rover.speed * -0.2);
   } else if (run.rover.z > maxZ) {
      run.rover.z = maxZ;
      run.rover.speed = Math.min(0, run.rover.speed * -0.2);
   }

   // 5. Rock collisions (solid circles)
   for (const rock of run.rocks) {
      const dx = run.rover.x - rock.x;
      const dz = run.rover.z - rock.z;
      const minDist = ROVER.radius + rock.radius;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDist * minDist) {
         const dist = Math.sqrt(distSq) || 0.001;
         const push = minDist - dist;
         run.rover.x += (dx / dist) * push;
         run.rover.z += (dz / dist) * push;

         const impactSpeed = Math.abs(run.rover.speed);
         if (impactSpeed > ROCK_HIT_SPEED) {
            if (run.rover.invulnerable <= 0) {
               run.lives -= 1;
               ev.lifeLost = true;
               ev.rockHit = true;
               run.rover.invulnerable = 1.0;
            }
         }
         run.rover.speed = -0.3 * run.rover.speed;
      }
   }

   // 6. Boulder collisions (sweptAabbXZ against the rover)
   ROVER_AABB.min.x = ROVER_PREV.x - ROVER_HALF.x;
   ROVER_AABB.min.y = -1;
   ROVER_AABB.min.z = ROVER_PREV.z - ROVER_HALF.z;
   ROVER_AABB.max.x = ROVER_PREV.x + ROVER_HALF.x;
   ROVER_AABB.max.y = 1;
   ROVER_AABB.max.z = ROVER_PREV.z + ROVER_HALF.z;

   for (const boulder of run.boulders) {
      const bDeltaZ = boulder.speed * dt;

      BOULDER_AABB.min.x = boulder.x - BOULDER_HALF.x;
      BOULDER_AABB.min.y = -1;
      BOULDER_AABB.min.z = boulder.z - BOULDER_HALF.z;
      BOULDER_AABB.max.x = boulder.x + BOULDER_HALF.x;
      BOULDER_AABB.max.y = 1;
      BOULDER_AABB.max.z = boulder.z + BOULDER_HALF.z;

      REL_DELTA.x = run.rover.vx * dt;
      REL_DELTA.z = run.rover.vz * dt - bDeltaZ;

      const hit = sweptAabbXZ(ROVER_AABB, REL_DELTA, BOULDER_AABB);
      if (hit !== null) {
         if (run.rover.invulnerable <= 0) {
            run.lives -= 1;
            ev.lifeLost = true;
            ev.boulderHit = true;
            run.rover.invulnerable = 1.0;
            run.rover.speed = -0.3 * run.rover.speed;
         }
      }

      boulder.z += bDeltaZ;
      if (boulder.z > boulder.maxZ) {
         boulder.z = boulder.minZ;
      }
   }

   // Check lives
   if (run.lives <= 0) {
      run.lives = 0;
      run.rover.speed = 0;
      run.over = "lose";
      ev.lost = true;
      return ev;
   }

   // 7. Charging pad check & battery drain
   let inCharger = false;
   for (const ch of run.chargers) {
      if (Math.hypot(run.rover.x - ch.x, run.rover.z - ch.z) <= CHARGER_PAD_RADIUS) {
         inCharger = true;
         break;
      }
   }

   const stopped = Math.abs(run.rover.speed) < SCAN_SPEED_MAX;
   if (inCharger && stopped) {
      run.charging = true;
      ev.charging = true;
      run.rover.battery = Math.min(100, run.rover.battery + CHARGE_RATE * dt);
   } else {
      run.charging = false;
      const drain = 0.35 * dt + 0.9 * movedDist * run.level.drainScale;
      run.rover.battery = Math.max(0, run.rover.battery - drain);

      if (run.rover.battery <= 0) {
         run.rover.battery = 0;
         run.rover.speed = 0;
         run.over = "lose";
         ev.lost = true;
         return ev;
      }
   }

   // 8. Scanning sites
   for (const site of run.sites) {
      if (site.scanned) continue;

      const dist = Math.hypot(run.rover.x - site.x, run.rover.z - site.z);
      if (dist <= SITE_RING_RADIUS && stopped) {
         site.holdTime += dt;
         if (site.holdTime >= SCAN_HOLD_S) {
            site.scanned = true;
            run.samplesScanned += 1;
            const center = dist <= CENTER_BONUS_RADIUS;
            const pts = BASE_SCAN_SCORE + (center ? CENTER_BONUS_SCORE : 0);
            run.score += pts;
            ev.score += pts;
            ev.siteScanned = site.index;
            ev.centerBonus = center;
         }
      } else {
         site.holdTime = 0;
      }
   }

   // 9. Base pad parking & win check
   if (run.samplesScanned === run.level.sites) {
      const distToBase = Math.hypot(run.rover.x - run.basePad.x, run.rover.z - run.basePad.z);
      if (distToBase <= run.basePad.radius && stopped) {
         run.baseHoldTime += dt;
         if (run.baseHoldTime >= WIN_HOLD_S) {
            run.over = "win";
            ev.won = true;
            const levelId = ((run.level.sites - 2) as LevelId) || 1;
            const limits = PROPOSED_LEVEL_LIMITS[levelId] ?? PROPOSED_LEVEL_LIMITS[1];
            const bonus = timeBonus(timeLeftMs);
            const added = Math.min(bonus, Math.max(0, limits.maxScore - run.score));
            run.score += added;
            ev.score += added;
            ev.timeBonus = added;
         }
      } else {
         run.baseHoldTime = 0;
      }
   }

   return ev;
}
