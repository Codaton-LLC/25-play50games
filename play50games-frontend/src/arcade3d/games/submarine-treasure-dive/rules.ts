// Submarine Treasure Dive rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// XZ flight (accel 9, top speed 5.5, drag 0.9). Hold Dive to sink from 3.0 m to 0.8 m in 0.60 s.
// Treasure collects only below 1.2 m. Arches and the double battery drain apply while low (y <= 1.5).
import type { Agent } from "@/arcade3d/core/ai/steering";
import { stepPatrol, type PatrolState } from "@/arcade3d/core/ai/patrol";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import { createPath, type Path } from "@/arcade3d/core/path";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type SubLevel } from "./levels";

// ---------- tuning (the scoring proof cites these) ----------

export const BATTERY = 100;
export const TREASURE_POINTS = 150;
export const CLEAN_POINTS = 50;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 5;

export const SUB_R = 0.9;
export const ACCEL = 9;
export const MAX_SPEED = 5.5;
/** Exponential drag coefficient: velocity decays as e^(-DRAG * dt), terminal speed ACCEL/DRAG. */
export const DRAG = 0.9;
export const CRUISE_Y = 3;
export const FLOOR_Y = 0.8;
export const SINK_S = 0.6;
export const SINK_RATE = (CRUISE_Y - FLOOR_Y) / SINK_S;
/** Center at or below this is "low": double drain, and arches are solid. */
export const LOW_Y = 1.5;
/** Scoop only while the center is strictly below this. */
export const COLLECT_Y = 1.2;
export const TREASURE_R = 0.5;
export const COLLECT_DIST = SUB_R + TREASURE_R;
export const DOCK_R = 2;
export const TREASURE_GAP = 6;
export const SOLID_CLEAR = 1.5;
export const CORAL_R = 1;
export const JELLY_R = 0.75;
export const MERCY_S = 0.8;
export const JELLY_COST = 8;
export const JELLY_PUSH = 1.5;
export const BUMP_SPEED = 3;
export const BUMP_COST = 4;

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   // base = 200 * treasures (every pickup clean). pps is above the sketch: the time bonus pays more
   // for a fast finish, and a fair route on these floors ends well under the sketch's minute marks.
   1: { kind: "points", maxScore: 1180, minDurationMs: 4000, maxDurationMs: 120_000, base: 600, maxPointsPerSec: 42, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1520, minDurationMs: 4000, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 40, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1880, minDurationMs: 4000, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 38, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 1960, minDurationMs: 4000, maxDurationMs: 180_000, base: 1200, maxPointsPerSec: 32, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 2780, minDurationMs: 4000, maxDurationMs: 240_000, base: 1600, maxPointsPerSec: 32, unitLabel: "pts", display: "int" },
};

const KINDS = ["chest", "amphora", "shell", "coins"] as const;
export type TreasureKind = (typeof KINDS)[number];

export function isLow(y: number): boolean {
   return y <= LOW_Y;
}

// ---------- layout ----------

export interface Treasure {
   kind: TreasureKind;
   x: number;
   z: number;
   taken: boolean;
}

export interface CircleSolid {
   kind: "rock" | "coral" | "arch" | "anchor";
   x: number;
   z: number;
   r: number;
   lowOnly: boolean;
}

export interface BoxSolid {
   kind: "wreck" | "column";
   x: number;
   z: number;
   hx: number;
   hz: number;
   rotY: number;
}

export interface Kelp {
   x: number;
   z: number;
   rotY: number;
   height: number;
}

export interface Jelly {
   agent: Agent;
   state: PatrolState;
   route: Path;
   r: number;
}

export interface StepEvents {
   score: number;
   won: boolean;
   lost: boolean;
   pickup: number;
   clean: boolean;
   jelly: boolean;
   bump: boolean;
}

export interface Run {
   seed: number;
   level: SubLevel;
   sub: { x: number; y: number; z: number; vx: number; vz: number; yaw: number; battery: number };
   dock: { x: number; z: number };
   treasures: Treasure[];
   circles: CircleSolid[];
   boxes: BoxSolid[];
   kelp: Kelp[];
   jellies: Jelly[];
   found: number;
   score: number;
   clean: boolean;
   mercy: number;
   circleTouch: boolean[];
   boxTouch: boolean[];
   wall: number;
   over: "win" | "lose" | null;
   time: number;
   wish: { x: number; z: number };
   ev: StepEvents;
}

export interface SubInput {
   moveX: number;
   moveY: number;
   action: boolean;
   /** camera yaw from useFittedView; keyboard and touch both land here */
   yaw: number;
}

export const idleInput = (): SubInput => ({ moveX: 0, moveY: 0, action: false, yaw: 0 });

export function halfExtents(level: SubLevel): { hx: number; hz: number } {
   return { hx: level.width / 2, hz: level.depth / 2 };
}

export function onDock(run: Run): boolean {
   return Math.hypot(run.sub.x - run.dock.x, run.sub.z - run.dock.z) <= DOCK_R;
}

export function quotaMet(run: Run): boolean {
   return run.found >= run.treasures.length;
}

/** Nearest untaken treasure, otherwise the dock. */
export function guide(run: Run): { x: number; z: number; dock: boolean } {
   let best = -1;
   let bestD = Infinity;
   const sub = run.sub;
   for (let i = 0; i < run.treasures.length; i++) {
      const t = run.treasures[i];
      if (t.taken) continue;
      const d = (t.x - sub.x) * (t.x - sub.x) + (t.z - sub.z) * (t.z - sub.z);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   }
   if (best >= 0) return { x: run.treasures[best].x, z: run.treasures[best].z, dock: false };
   return { x: run.dock.x, z: run.dock.z, dock: true };
}

function surfaceGap(px: number, pz: number, box: BoxSolid): number {
   const dx = Math.max(Math.abs(px - box.x) - box.hx, 0);
   const dz = Math.max(Math.abs(pz - box.z) - box.hz, 0);
   return Math.hypot(dx, dz);
}

function blocked(run: Run, x: number, z: number, r: number, dockPad: number, lowOnly: boolean): boolean {
   const { hx, hz } = halfExtents(run.level);
   if (Math.abs(x) > hx - r - 0.6 || Math.abs(z) > hz - r - 0.6) return true;
   if (Math.hypot(x - run.dock.x, z - run.dock.z) < DOCK_R + r + dockPad) return true;
   // A lane north from the dock so the sub can leave the pad at cruise height.
   if (!lowOnly && Math.abs(x - run.dock.x) < SUB_R * 2 + 0.4 && z > run.dock.z && z < run.dock.z + 8) return true;
   for (const t of run.treasures) {
      if (Math.hypot(x - t.x, z - t.z) < r + SOLID_CLEAR) return true;
   }
   const pass = SUB_R * 2 + 0.4;
   for (const c of run.circles) {
      const gap = lowOnly || c.lowOnly ? 0.35 : pass;
      if (Math.hypot(x - c.x, z - c.z) < r + c.r + gap) return true;
   }
   for (const b of run.boxes) {
      const gap = lowOnly ? 0.4 : pass;
      if (surfaceGap(x, z, b) < r + gap) return true;
   }
   return false;
}

function pushTreasures(run: Run): void {
   const { hx, hz } = halfExtents(run.level);
   const list = run.treasures;
   for (let n = 0; n < 8; n++) {
      for (let i = 0; i < list.length; i++) {
         for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            let dx = b.x - a.x;
            let dz = b.z - a.z;
            const d = Math.hypot(dx, dz);
            if (d >= TREASURE_GAP || d < 1e-6) continue;
            const push = (TREASURE_GAP - d) / 2 + 0.05;
            dx /= d || 1;
            dz /= d || 1;
            a.x -= dx * push;
            a.z -= dz * push;
            b.x += dx * push;
            b.z += dz * push;
         }
         const t = list[i];
         const minZ = run.dock.z + TREASURE_GAP + 1.2;
         t.x = Math.max(-hx + 2.4, Math.min(hx - 2.4, t.x));
         t.z = Math.max(minZ, Math.min(hz - 2.4, t.z));
      }
   }
}

function wreckCount(level: SubLevel): number {
   if (level.treasures >= 8) return 2;
   if (level.jellies > 0) return 1;
   return 0;
}

function columnCount(level: SubLevel): number {
   if (level.treasures >= 8) return 5;
   if (level.lighting === "night") return 3;
   if (level.lighting === "sunset") return 1;
   if (level.coral >= 8) return 1;
   return 0;
}

function archCount(level: SubLevel): number {
   if (level.rocks >= 8) return 3;
   if (level.rocks >= 6) return 2;
   return 1;
}

function anchorCount(level: SubLevel): number {
   return level.treasures >= 6 ? 4 : level.jellies > 0 ? 3 : 2;
}

function placeBox(run: Run, kind: BoxSolid["kind"], hx: number, hz: number, rotY: number, rng: () => number): void {
   const { hx: boundX, hz: boundZ } = halfExtents(run.level);
   for (let i = 0; i < 50; i++) {
      const x = (rng() * 2 - 1) * (boundX - hx - 1.5);
      const z = (rng() * 2 - 1) * (boundZ * 0.75);
      const box: BoxSolid = { kind, x, z, hx, hz, rotY };
      if (surfaceGap(run.dock.x, run.dock.z, box) < DOCK_R + SUB_R * 2) continue;
      if (Math.abs(x - run.dock.x) < box.hx + SUB_R * 2 && z > run.dock.z && z < run.dock.z + box.hz + 8) continue;
      let hit = false;
      for (const t of run.treasures) {
         if (surfaceGap(t.x, t.z, box) < SOLID_CLEAR) hit = true;
      }
      const pass = SUB_R * 2 + 0.4;
      for (const b of run.boxes) {
         if (Math.abs(b.x - x) < b.hx + hx + pass && Math.abs(b.z - z) < b.hz + hz + pass) hit = true;
      }
      if (!hit) {
         run.boxes.push(box);
         return;
      }
   }
}

export function createRun(seed: number, level: SubLevel = LEVELS[1]): Run {
   const rng = createRng(seed >>> 0);
   const { hx, hz } = halfExtents(level);
   const dock = { x: 0, z: -hz + DOCK_R + 1.4 };
   const run: Run = {
      seed,
      level,
      sub: { x: dock.x, y: CRUISE_Y, z: dock.z, vx: 0, vz: 0, yaw: 0, battery: BATTERY },
      dock,
      treasures: [],
      circles: [],
      boxes: [],
      kelp: [],
      jellies: [],
      found: 0,
      score: 0,
      clean: true,
      mercy: 0,
      circleTouch: [],
      boxTouch: [],
      wall: 0,
      over: null,
      time: 0,
      wish: { x: 0, z: 0 },
      ev: { score: 0, won: false, lost: false, pickup: -1, clean: false, jelly: false, bump: false },
   };

   const n = level.treasures;
   const cols = n <= 3 ? n : n <= 4 ? 2 : 3;
   const rows = Math.ceil(n / cols);
   const x0 = -hx + 4;
   const x1 = hx - 4;
   const z0 = dock.z + 8;
   const z1 = hz - 3.2;
   for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const fx = cols === 1 ? 0.5 : c / (cols - 1);
      const fz = rows === 1 ? 0.55 : r / (rows - 1);
      run.treasures.push({
         kind: KINDS[i % KINDS.length],
         x: x0 + (x1 - x0) * fx + (rng() - 0.5) * 0.8,
         z: z0 + (z1 - z0) * fz + (rng() - 0.5) * 0.8,
         taken: false,
      });
   }
   pushTreasures(run);

   for (let i = 0; i < wreckCount(level); i++) {
      const alongX = rng() > 0.5;
      placeBox(run, "wreck", alongX ? 2.5 : 1.15, alongX ? 1.15 : 2.5, alongX ? 0 : Math.PI / 2, rng);
   }
   for (let i = 0; i < columnCount(level); i++) {
      const alongX = i % 2 === 0;
      placeBox(run, "column", alongX ? 1.2 : 0.42, alongX ? 0.42 : 1.2, alongX ? 0 : Math.PI / 2, rng);
   }

   const addCircle = (kind: CircleSolid["kind"], r: number, lowOnly: boolean) => {
      const { hx: boundX, hz: boundZ } = halfExtents(level);
      const tryAt = (x: number, z: number) => {
         if (blocked(run, x, z, r, 1.4, lowOnly)) return false;
         run.circles.push({ kind, x, z, r, lowOnly });
         return true;
      };
      for (let i = 0; i < 80; i++) {
         const x = (rng() * 2 - 1) * (boundX - r - 1);
         const z = -boundZ + 2 + rng() * (level.depth - 4);
         if (tryAt(x, z)) return;
      }
      for (let z = -boundZ + r + 2; z <= boundZ - r - 1; z += 2.4) {
         for (let x = -boundX + r + 1.5; x <= boundX - r - 1; x += 2.4) {
            if (tryAt(x, z)) return;
         }
      }
   };
   for (let i = 0; i < level.rocks; i++) addCircle("rock", 0.85 + rng() * 0.45, false);
   for (let i = 0; i < level.coral; i++) addCircle("coral", CORAL_R, false);
   for (let i = 0; i < archCount(level); i++) addCircle("arch", 1.15, true);
   for (let i = 0; i < anchorCount(level); i++) addCircle("anchor", 0.65, false);

   for (let i = 0; i < level.coral; i++) {
      const host = run.circles.find((c, index) => c.kind === "coral" && index % level.coral === i % Math.max(1, level.coral));
      const base = host ?? run.treasures[i % n];
      const ang = rng() * Math.PI * 2;
      const dist = host ? host.r + 0.55 : 1.4;
      run.kelp.push({
         x: Math.max(-hx + 1, Math.min(hx - 1, base.x + Math.cos(ang) * dist)),
         z: Math.max(-hz + 1, Math.min(hz - 1, base.z + Math.sin(ang) * dist)),
         rotY: rng() * Math.PI,
         height: 1.15 + rng() * 0.55,
      });
   }

   for (let i = 0; i < level.jellies; i++) {
      let cx = 0;
      let cz = 0;
      let ok = false;
      const clearOf = (x: number, z: number) => {
         if (Math.abs(x) > hx - 6 || z > hz - 5 || z < run.dock.z + 9) return false;
         if (Math.hypot(x - run.dock.x, z - run.dock.z) < 8) return false;
         for (const item of run.treasures) {
            if (Math.hypot(item.x - x, item.z - z) < 7.4) return false;
         }
         for (const jelly of run.jellies) {
            if (Math.hypot(jelly.agent.x - x, jelly.agent.z - z) < 8) return false;
         }
         return true;
      };
      for (let t = 0; t < 50; t++) {
         cx = (rng() * 2 - 1) * (hx - 6);
         cz = run.dock.z + 10 + rng() * (hz - run.dock.z - 16);
         if (clearOf(cx, cz)) {
            ok = true;
            break;
         }
      }
      if (!ok) {
         for (let z = run.dock.z + 10; z <= hz - 6 && !ok; z += 3.2) {
            for (let x = -hx + 6; x <= hx - 6 && !ok; x += 3.2) {
               if (!clearOf(x, z)) continue;
               cx = x;
               cz = z;
               ok = true;
            }
         }
      }
      if (!ok) {
         cx = (i % 2 === 0 ? -1 : 1) * (hx * 0.62);
         cz = (i % 3 - 1) * (hz * 0.28);
      }
      const y = 1.5;
      const s = 3.1;
      const route = createPath(
         [
            { x: cx + s, y, z: cz },
            { x: cx, y, z: cz + s * 0.85 },
            { x: cx - s, y, z: cz },
            { x: cx, y, z: cz - s * 0.85 },
         ],
         { closed: true },
      );
      const agent: Agent = { x: cx + s, y, z: cz, vx: 0, vy: 0, vz: 0, yaw: 0 };
      const state: PatrolState = { index: 0, wait: 0, mode: "patrol", target: { x: cx, y, z: cz } };
      run.jellies.push({ agent, state, route, r: JELLY_R });
   }

   run.circleTouch = run.circles.map(() => false);
   run.boxTouch = run.boxes.map(() => false);
   return run;
}

function zeroEvents(ev: StepEvents): StepEvents {
   ev.score = 0;
   ev.won = false;
   ev.lost = false;
   ev.pickup = -1;
   ev.clean = false;
   ev.jelly = false;
   ev.bump = false;
   return ev;
}

function chargeBump(run: Run, ev: StepEvents): void {
   run.sub.battery -= BUMP_COST;
   run.clean = false;
   ev.bump = true;
}

function resolveSolids(run: Run, ev: StepEvents, charge: boolean): void {
   const sub = run.sub;
   const low = isLow(sub.y);
   for (let i = 0; i < run.circles.length; i++) {
      const c = run.circles[i];
      if (c.lowOnly && !low) {
         run.circleTouch[i] = false;
         continue;
      }
      let dx = sub.x - c.x;
      let dz = sub.z - c.z;
      let dist = Math.hypot(dx, dz);
      const min = SUB_R + c.r;
      if (dist >= min) {
         run.circleTouch[i] = false;
         continue;
      }
      if (dist < 1e-6) {
         dx = 1;
         dz = 0;
         dist = 1;
      }
      const nx = dx / dist;
      const nz = dz / dist;
      sub.x = c.x + nx * min;
      sub.z = c.z + nz * min;
      const into = sub.vx * nx + sub.vz * nz;
      if (into < 0) {
         const impact = -into;
         sub.vx -= into * nx;
         sub.vz -= into * nz;
         if (charge && impact > BUMP_SPEED && !run.circleTouch[i]) chargeBump(run, ev);
      }
      run.circleTouch[i] = true;
   }
   for (let i = 0; i < run.boxes.length; i++) {
      const b = run.boxes[i];
      const cx = Math.max(b.x - b.hx, Math.min(sub.x, b.x + b.hx));
      const cz = Math.max(b.z - b.hz, Math.min(sub.z, b.z + b.hz));
      let dx = sub.x - cx;
      let dz = sub.z - cz;
      let dist = Math.hypot(dx, dz);
      let nx = 0;
      let nz = 0;
      if (dist >= SUB_R) {
         run.boxTouch[i] = false;
         continue;
      }
      if (dist < 1e-6) {
         const px = b.hx + SUB_R - Math.abs(sub.x - b.x);
         const pz = b.hz + SUB_R - Math.abs(sub.z - b.z);
         if (px < pz) {
            nx = sub.x >= b.x ? 1 : -1;
            sub.x = b.x + nx * (b.hx + SUB_R);
         } else {
            nz = sub.z >= b.z ? 1 : -1;
            sub.z = b.z + nz * (b.hz + SUB_R);
         }
      } else {
         nx = dx / dist;
         nz = dz / dist;
         sub.x += nx * (SUB_R - dist);
         sub.z += nz * (SUB_R - dist);
      }
      const into = sub.vx * nx + sub.vz * nz;
      if (into < 0) {
         const impact = -into;
         sub.vx -= into * nx;
         sub.vz -= into * nz;
         if (charge && impact > BUMP_SPEED && !run.boxTouch[i]) chargeBump(run, ev);
      }
      run.boxTouch[i] = true;
   }
}

function clampWalls(run: Run, ev: StepEvents, charge: boolean): void {
   const { hx, hz } = halfExtents(run.level);
   const sub = run.sub;
   const minX = -hx + SUB_R;
   const maxX = hx - SUB_R;
   const minZ = -hz + SUB_R;
   const maxZ = hz - SUB_R;
   const hit = (bit: number, impact: number) => {
      if (charge && impact > BUMP_SPEED && (run.wall & bit) === 0) chargeBump(run, ev);
      run.wall |= bit;
   };
   if (sub.x < minX) {
      hit(1, -sub.vx);
      sub.x = minX;
      if (sub.vx < 0) sub.vx = 0;
   } else run.wall &= ~1;
   if (sub.x > maxX) {
      hit(2, sub.vx);
      sub.x = maxX;
      if (sub.vx > 0) sub.vx = 0;
   } else run.wall &= ~2;
   if (sub.z < minZ) {
      hit(4, -sub.vz);
      sub.z = minZ;
      if (sub.vz < 0) sub.vz = 0;
   } else run.wall &= ~4;
   if (sub.z > maxZ) {
      hit(8, sub.vz);
      sub.z = maxZ;
      if (sub.vz > 0) sub.vz = 0;
   } else run.wall &= ~8;
}

function pushFromJelly(run: Run, jelly: Jelly): void {
   const sub = run.sub;
   const sp = Math.hypot(sub.vx, sub.vz);
   if (sp > 0.05) {
      sub.x -= (sub.vx / sp) * JELLY_PUSH;
      sub.z -= (sub.vz / sp) * JELLY_PUSH;
   } else {
      let dx = sub.x - jelly.agent.x;
      let dz = sub.z - jelly.agent.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      sub.x += dx * JELLY_PUSH;
      sub.z += dz * JELLY_PUSH;
   }
   sub.vx *= 0.25;
   sub.vz *= 0.25;
}

export function step(run: Run, input: SubInput, dt: number, timeLeftMs: number): StepEvents {
   const ev = zeroEvents(run.ev);
   if (!(dt > 0) || run.over) return ev;
   const sub = run.sub;
   const y0 = sub.y;

   for (const jelly of run.jellies) {
      stepPatrol(jelly.agent, jelly.state, jelly.route, dt, { speed: run.level.jellySpeed });
   }

   inputToWorld(input.moveX, input.moveY, input.yaw, run.wish);
   let wishLen = Math.hypot(run.wish.x, run.wish.z);
   if (wishLen > 1) {
      run.wish.x /= wishLen;
      run.wish.z /= wishLen;
   }
   const ax = run.wish.x * ACCEL + run.level.current;
   const az = run.wish.z * ACCEL;
   const decay = Math.exp(-DRAG * dt);
   sub.vx = sub.vx * decay + (ax / DRAG) * (1 - decay);
   sub.vz = sub.vz * decay + (az / DRAG) * (1 - decay);
   const sp = Math.hypot(sub.vx, sub.vz);
   if (sp > MAX_SPEED) {
      sub.vx *= MAX_SPEED / sp;
      sub.vz *= MAX_SPEED / sp;
   }
   sub.x += sub.vx * dt;
   sub.z += sub.vz * dt;
   if (sp > 0.25) sub.yaw = turnTowards(sub.yaw, Math.atan2(sub.vx, sub.vz), 1 - Math.exp(-8 * dt));

   resolveSolids(run, ev, true);
   clampWalls(run, ev, true);

   if (run.mercy > 0) run.mercy = Math.max(0, run.mercy - dt);
   if (run.mercy <= 0) {
      for (const jelly of run.jellies) {
         const dx = sub.x - jelly.agent.x;
         const dz = sub.z - jelly.agent.z;
         const reach = SUB_R + jelly.r;
         if (dx * dx + dz * dz <= reach * reach) {
            sub.battery -= JELLY_COST;
            run.clean = false;
            run.mercy = MERCY_S;
            ev.jelly = true;
            pushFromJelly(run, jelly);
            break;
         }
      }
   }

   resolveSolids(run, ev, false);
   clampWalls(run, ev, false);

   for (let i = 0; i < run.treasures.length; i++) {
      const t = run.treasures[i];
      if (t.taken || y0 >= COLLECT_Y) continue;
      const dx = sub.x - t.x;
      const dz = sub.z - t.z;
      if (dx * dx + dz * dz > COLLECT_DIST * COLLECT_DIST) continue;
      t.taken = true;
      run.found += 1;
      let gained = TREASURE_POINTS;
      const clean = run.clean;
      if (clean) gained += CLEAN_POINTS;
      run.clean = true;
      run.score += gained;
      ev.score += gained;
      ev.pickup = i;
      ev.clean = clean;
   }

   const drain = (isLow(y0) ? run.level.drain * 2 : run.level.drain) * dt;
   sub.battery -= drain;
   if (sub.battery <= 0) {
      sub.battery = 0;
      run.over = "lose";
      ev.lost = true;
   } else if (quotaMet(run) && onDock(run)) {
      const bonus = TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
      run.score += bonus;
      ev.score += bonus;
      run.over = "win";
      ev.won = true;
   }

   if (input.action) sub.y = Math.max(FLOOR_Y, y0 - SINK_RATE * dt);
   else sub.y = Math.min(CRUISE_Y, y0 + SINK_RATE * dt);

   run.time += dt;
   return ev;
}
