import { flee, wander, inViewCone, hasLineOfSightXZ } from "@/arcade3d/core/ai";
import { resolveSphereAabb, type AABB } from "@/arcade3d/core/collision";
import { substep } from "@/arcade3d/core/kinematics";
import { createRng, turnTowards } from "@/arcade3d/core/math";
import { capScore as limitScore, withinServerLimits } from "@/arcade3d/core/limits";
import { ghostVacuumMeta } from "./meta";

export const DURATION_MS = 120000;
export const COUNT = 12;
export const MANSION = { halfX: 14, halfZ: 10, hall: 3, wall: 0.2, height: 2.4, doorZ: 5, doorWidth: 2 } as const;
export const HUNTER = { radius: 0.4, speed: 4, accel: 20, brake: 24, turn: 14, startX: 0, startZ: 8 } as const;
export const GHOST = { radius: 0.4, bigRadius: 0.5, accel: 4, jitter: 0.8, reveal: 3, wander: 0.8, flee: 1.2, lateWander: 1, lateFlee: 1.5, goldWander: 1.2, goldFlee: 1.8, bigWander: 0.6, bigFlee: 0.9 } as const;
export const LIGHT = { angle: 25 * Math.PI / 180, range: 5, exposure: 0.4, bigExposure: 0.8, stun: 2 } as const;
export const PULL = { angle: 12 * Math.PI / 180, range: 4, seconds: 1, grace: 0.3, nozzle: 0.6, tug: 0.25, assistAngle: Math.PI / 4, assistTurn: Math.PI } as const;
export const SCORE = { capture: 100, gold: 200, combo: 50, second: 10 } as const;
export const SCHEDULE = [0, 0, 0, 20, 20, 30, 40, 40, 60, 60, 60, 90] as const;
export const MAX_STEP = 1 / 120;
const EPS = 1e-10;
const TAU = Math.PI * 2;
const box = (x: number, z: number, hx: number, hz: number): AABB => ({ min: { x: x - hx, y: -1, z: z - hz }, max: { x: x + hx, y: 3, z: z + hz } });
export const ROOMS = [
   { side: -1, north: -1, x: -10, z: -7, doorX: -3, doorZ: -5 },
   { side: -1, north: 1, x: -10, z: 7, doorX: -3, doorZ: 5 },
   { side: 1, north: -1, x: 10, z: -7, doorX: 3, doorZ: -5 },
   { side: 1, north: 1, x: 10, z: 7, doorX: 3, doorZ: 5 },
] as const;
export const WALLS: readonly AABB[] = [
   box(-14, 0, 0.1, 10), box(14, 0, 0.1, 10), box(0, -10, 14, 0.1), box(0, 10, 14, 0.1),
   ...[-3, 3].flatMap((x) => [box(x, -8, 0.1, 2), box(x, 0, 0.1, 4), box(x, 8, 0.1, 2)]),
   box(-8.5, 0, 5.5, 0.1), box(8.5, 0, 5.5, 0.1),
];
export const FURNITURE: readonly AABB[] = ROOMS.flatMap((r) => [box(r.x, r.z, 0.8, 0.4), box(r.x, r.north * 5.5, 0.3, 0.3)]);
export const SOLIDS = [...WALLS, ...FURNITURE];
export type Mode = "pending" | "hidden" | "wandering" | "fleeing" | "stunned" | "pulling" | "caught";
export interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number }
export interface Ghost extends Body {
   id: number; room: number; ordinal: number; kind: "normal" | "gold" | "big"; mode: Mode;
   angle: number; exposure: number; stun: number; lit: boolean; progress: number; grace: number;
   baseX: number; baseZ: number; ax: number; az: number; hx: number; hz: number; p0: number;
   homeX: number; homeZ: number; returnStage: number; admittedAt: number; caughtAt: number;
}
export interface StepInput { dirX: number; dirZ: number; held: boolean; aim: boolean; aimYaw: number; coarse: boolean }
export interface Run {
   hunter: Body; ghosts: Ghost[]; rng: () => number; elapsed: number; caught: number; gold: number;
   extras: number; session: number; score: number; won: boolean; ended: boolean;
   events: { captures: number[]; count: number; points: number; stun: number; pop: number; breaks: number; win: boolean };
   scratch: { logical: { x: number; y: number; z: number }; force: { x: number; y: number; z: number }; input: StepInput; tick: (dt: number) => void };
}
export function createRun(seed: number): Run {
   const rng = createRng(seed);
   const order = [0, 1, 2, 3];
   for (let i = 3; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const a = order[i]; order[i] = order[j]; order[j] = a; }
   const ghosts: Ghost[] = [];
   for (let id = 0; id < COUNT; id++) {
      const room = order[id % 4], r = ROOMS[room], ordinal = Math.floor(id / 4);
      const x = r.x - r.side * 2, z = r.z + [0, -1, 1][ordinal];
      ghosts.push({ id, room, ordinal, kind: id === 5 || id === 8 || id === 11 ? "gold" : id === 9 || id === 10 ? "big" : "normal",
         x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw: 0, angle: rng() * TAU, mode: "pending", exposure: 0, stun: 0, lit: false,
         progress: 0, grace: 0, baseX: x, baseZ: z, ax: x, az: z, hx: 0, hz: 0, p0: 0, homeX: x, homeZ: z,
         returnStage: 0, admittedAt: -1, caughtAt: -1 });
   }
   const run: Run = { hunter: { x: 0, y: 0, z: 8, vx: 0, vy: 0, vz: 0, yaw: Math.PI }, ghosts, rng, elapsed: 0,
      caught: 0, gold: 0, extras: 0, session: 0, score: 0, won: false, ended: false,
      events: { captures: new Array(COUNT).fill(-1), count: 0, points: 0, stun: 0, pop: 0, breaks: 0, win: false },
      scratch: { logical: { x: 0, y: 0, z: 0 }, force: { x: 0, y: 0, z: 0 }, input: { dirX: 0, dirZ: 0, held: false, aim: false, aimYaw: Math.PI, coarse: false }, tick: () => {} } };
   run.scratch.tick = (dt) => {
      let left = dt;
      while (left > EPS && !run.ended) {
         let next = left;
         for (const g of run.ghosts) if (g.mode === "stunned" && g.stun > EPS) next = Math.min(next, g.stun);
         tick(run, next); left -= next;
      }
   };
   admit(run);
   return run;
}
export const active = (g: Ghost) => g.mode !== "pending" && g.mode !== "caught";
export const radius = (g: Ghost) => g.kind === "big" ? GHOST.bigRadius : GHOST.radius;
export const exposureTime = (g: Ghost) => g.kind === "big" ? LIGHT.bigExposure : LIGHT.exposure;
export function illuminated(run: Run, g: Ghost): boolean {
   return inViewCone(run.hunter, run.hunter.yaw, LIGHT.angle, LIGHT.range, g) && hasLineOfSightXZ(run.hunter, g, WALLS);
}
function logicalPosition(run: Run, g: Ghost) {
   const point = run.scratch.logical;
   point.x = g.mode === "pulling" ? g.baseX : g.x;
   point.y = g.y;
   point.z = g.mode === "pulling" ? g.baseZ : g.z;
   return point;
}
export function pullValid(run: Run, g: Ghost): boolean {
   // Tug is cosmetic: validity follows the untugged logical position.
   const point = logicalPosition(run, g);
   const d = Math.hypot(point.x - run.hunter.x, point.z - run.hunter.z);
   return d <= PULL.range + EPS && (d <= PULL.nozzle || (inViewCone(run.hunter, run.hunter.yaw, PULL.angle, PULL.range, point) && hasLineOfSightXZ(run.hunter, point, WALLS)));
}
function admit(run: Run): void {
   let n = 0;
   for (const g of run.ghosts) if (active(g)) n++;
   const cap = run.elapsed < 40 - EPS ? 3 : 6;
   for (const g of run.ghosts) {
      if (g.mode !== "pending" || SCHEDULE[g.id] > run.elapsed + EPS || n >= cap) continue;
      let occupied = false;
      for (const other of run.ghosts) if (other.room === g.room && other.mode === "hidden") occupied = true;
      g.mode = occupied ? "wandering" : "hidden";
      g.admittedAt = run.elapsed;
      n++;
   }
}
function reveal(run: Run): void {
   for (const g of run.ghosts) if (g.mode === "hidden") {
      const r = ROOMS[g.room];
      if (Math.hypot(run.hunter.x - r.x, run.hunter.z - r.z) <= GHOST.reveal + EPS) {
         g.mode = "wandering"; run.events.pop++;
      }
   }
}
function moveHunter(run: Run, dt: number): void {
   const h = run.hunter, i = run.scratch.input;
   const len = Math.max(1, Math.hypot(i.dirX, i.dirZ));
   const tx = i.dirX / len * HUNTER.speed, tz = i.dirZ / len * HUNTER.speed;
   const dx = tx - h.vx, dz = tz - h.vz, d = Math.hypot(dx, dz), a = (tx || tz ? HUNTER.accel : HUNTER.brake) * dt;
   const k = d ? Math.min(1, a / d) : 0;
   h.vx += dx * k; h.vz += dz * k;
   const x = h.x, z = h.z;
   h.x += h.vx * dt; h.z += h.vz * dt;
   for (const b of SOLIDS) resolveSphereAabb(h, HUNTER.radius, b, h);
   h.x = Math.max(-13.5, Math.min(13.5, h.x)); h.z = Math.max(-9.5, Math.min(9.5, h.z));
   const dist = Math.hypot(h.x - x, h.z - z), max = HUNTER.speed * dt;
   if (dist > max + EPS) { h.x = x + (h.x - x) * max / dist; h.z = z + (h.z - z) * max / dist; }
   h.vx = (h.x - x) / dt; h.vz = (h.z - z) / dt;
   let aim = i.aim ? i.aimYaw : tx || tz ? Math.atan2(tx, tz) : h.yaw;
   if (i.coarse && i.held) {
      let best: Ghost | null = null, distance = Infinity;
      for (const g of run.ghosts) if (g.mode === "stunned" || g.mode === "pulling") {
         const point = logicalPosition(run, g);
         if (!inViewCone(h, aim, PULL.assistAngle, PULL.range, point) || !hasLineOfSightXZ(h, point, WALLS)) continue;
         const d = Math.hypot(point.x - h.x, point.z - h.z);
         if (d < distance - EPS) { best = g; distance = d; }
      }
      if (best) {
         const point = logicalPosition(run, best);
         aim = boundedTurn(h.yaw, Math.atan2(point.x - h.x, point.z - h.z), PULL.assistTurn * dt);
      }
   }
   h.yaw = boundedTurn(h.yaw, aim, HUNTER.turn * dt);
}
function boundedTurn(from: number, to: number, max: number): number {
   const target = turnTowards(from, to, 1), d = Math.abs(target - from);
   return turnTowards(from, to, d ? Math.min(1, max / d) : 1);
}
export function inRoom(g: Ghost): boolean {
   const r = ROOMS[g.room], rad = radius(g);
   return g.x * r.side >= 3.1 + rad && g.x * r.side <= 13.9 - rad && g.z * r.north >= 0.1 + rad && g.z * r.north <= 9.9 - rad;
}
function speed(g: Ghost, late: boolean, lit: boolean): number {
   return g.kind === "gold" ? lit ? GHOST.goldFlee : GHOST.goldWander : g.kind === "big" ? lit ? GHOST.bigFlee : GHOST.bigWander : late ? lit ? GHOST.lateFlee : GHOST.lateWander : lit ? GHOST.flee : GHOST.wander;
}
function moveGhost(run: Run, g: Ghost, dt: number): void {
   const r = ROOMS[g.room], rad = radius(g), max = speed(g, run.elapsed >= 60, g.lit), f = run.scratch.force;
   if (g.returnStage) {
      const x = g.returnStage === 1 ? r.doorX - r.side * (rad + 0.2) : r.doorX + r.side * (rad + 0.2);
      const z = r.doorZ;
      const dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz), travel = Math.min(d, max * dt);
      g.vx = d ? dx / d * max : 0; g.vz = d ? dz / d * max : 0;
      g.x += d ? dx / d * travel : 0; g.z += d ? dz / d * travel : 0;
      if (d <= travel + EPS) g.returnStage = g.returnStage === 1 ? 2 : 0;
      return;
   }
   if (g.lit) flee(g, run.hunter, max, f); else wander(g, g, run.rng, max, GHOST.jitter, dt, f);
   const length = Math.hypot(f.x, f.z), k = length > GHOST.accel ? GHOST.accel / length : 1;
   g.vx += f.x * k * dt; g.vz += f.z * k * dt;
   const v = Math.hypot(g.vx, g.vz);
   if (v > max) { g.vx *= max / v; g.vz *= max / v; }
   g.x += g.vx * dt; g.z += g.vz * dt;
   const minX = r.side < 0 ? -13.9 + rad : 3.1 + rad, maxX = r.side < 0 ? -3.1 - rad : 13.9 - rad;
   const minZ = r.north < 0 ? -9.9 + rad : 0.1 + rad, maxZ = r.north < 0 ? -0.1 - rad : 9.9 - rad;
   if (g.x < minX || g.x > maxX) { g.x = Math.max(minX, Math.min(maxX, g.x)); g.angle = -g.angle; g.vx = 0; }
   if (g.z < minZ || g.z > maxZ) { g.z = Math.max(minZ, Math.min(maxZ, g.z)); g.angle = Math.PI - g.angle; g.vz = 0; }
   g.angle = (g.angle % TAU + TAU) % TAU;
}
function rebase(run: Run, g: Ghost): void {
   g.ax = g.baseX; g.az = g.baseZ; g.hx = run.hunter.x; g.hz = run.hunter.z; g.p0 = g.progress;
}
export function pullPosition(run: Run, g: Ghost): void {
   const q = (g.progress - g.p0) / (1 - g.p0);
   g.baseX = g.ax + (g.hx - g.ax) * q; g.baseZ = g.az + (g.hz - g.az) * q;
   const dx = g.hx - g.baseX, dz = g.hz - g.baseZ, d = Math.hypot(dx, dz);
   const offset = PULL.tug * (1 - g.progress) * Math.sin(4 * Math.PI * g.progress);
   g.x = g.baseX + (d > EPS ? dz / d : Math.cos(run.hunter.yaw)) * offset;
   g.z = g.baseZ - (d > EPS ? dx / d : Math.sin(run.hunter.yaw)) * offset;
}
function breakPull(run: Run, g: Ghost): void {
   g.mode = "wandering"; g.progress = 0; g.exposure = 0; g.grace = 0; g.vx = 0; g.vz = 0;
   g.returnStage = inRoom(g) ? 0 : 1; run.events.breaks++;
}
function capture(run: Run, g: Ghost): void {
   g.mode = "caught"; g.caughtAt = run.elapsed; g.x = run.hunter.x; g.z = run.hunter.z;
   const extra = run.session > 0 ? SCORE.combo : 0;
   const points = SCORE.capture + (g.kind === "gold" ? SCORE.gold : 0) + extra;
   run.caught++; if (g.kind === "gold") run.gold++; if (extra) run.extras++;
   run.session++; run.score += points; run.events.points += points;
   run.events.captures[run.events.count++] = g.id;
}
function tick(run: Run, dt: number): void {
   if (run.ended) return;
   admit(run); reveal(run);
   moveHunter(run, dt); reveal(run);
   const i = run.scratch.input;
   for (const g of run.ghosts) {
      if (!active(g) || g.mode === "hidden") continue;
      let remaining = dt;
      g.lit = illuminated(run, g);
      if (g.mode === "stunned") {
         if (g.stun <= EPS) { g.mode = "wandering"; g.exposure = 0; }
         else if (!i.held || !pullValid(run, g)) {
            g.stun -= dt;
            if (g.stun <= EPS) { g.mode = "wandering"; g.exposure = 0; }
            continue;
         }
      }
      if (g.mode === "wandering" || g.mode === "fleeing") {
         g.mode = g.lit ? "fleeing" : "wandering";
         if (!g.lit) g.exposure = 0;
         const needed = exposureTime(g) - g.exposure;
         const travel = g.lit ? Math.min(remaining, needed) : remaining;
         moveGhost(run, g, travel);
         if (g.lit) g.exposure += travel;
         remaining -= travel;
         if (g.exposure >= exposureTime(g) - EPS) { g.mode = "stunned"; g.stun = LIGHT.stun; g.vx = 0; g.vz = 0; run.events.stun++; }
         else continue;
      }
      if (g.mode === "stunned") {
         if (i.held && pullValid(run, g)) { g.mode = "pulling"; g.progress = 0; g.grace = 0; g.baseX = g.x; g.baseZ = g.z; rebase(run, g); g.returnStage = 0; }
         else { g.stun -= remaining; continue; }
      }
      if (g.mode === "pulling") {
         if (!i.held) { breakPull(run, g); continue; }
         if (!pullValid(run, g)) { g.grace += remaining; if (g.grace > PULL.grace + EPS) breakPull(run, g); continue; }
         if (g.grace > 0 || g.hx !== run.hunter.x || g.hz !== run.hunter.z) rebase(run, g);
         g.grace = 0; g.progress = Math.min(1, g.progress + remaining / PULL.seconds);
         if (g.progress >= 1 - EPS) capture(run, g); else pullPosition(run, g);
      }
   }
   run.elapsed += dt;
   let pulling = false;
   for (const g of run.ghosts) if (g.mode === "pulling") pulling = true;
   if (!i.held || !pulling) run.session = 0;
   if (run.caught === COUNT) {
      run.won = true; run.ended = true; run.events.win = true;
      run.score += SCORE.second * Math.floor(Math.max(0, 120 - run.elapsed) + EPS);
   }
   admit(run);
}
export function stepRun(run: Run, input: StepInput, dt: number, elapsed: number): void {
   const e = run.events; e.count = 0; e.points = 0; e.stun = 0; e.pop = 0; e.breaks = 0; e.win = false;
   if (run.ended || !(dt > 0) || !Number.isFinite(dt) || elapsed >= 120 - EPS) return;
   Object.assign(run.scratch.input, input);
   run.elapsed = elapsed - dt;
   let left = dt;
   while (left > EPS && !run.ended) {
      let chunk = left;
      for (const release of SCHEDULE) if (release > run.elapsed + EPS) chunk = Math.min(chunk, release - run.elapsed);
      substep(chunk, MAX_STEP, run.scratch.tick);
      left -= chunk;
   }
}
export const runScore = (caught: number, gold: number, extras: number, won: boolean, time: number) => SCORE.capture * caught + SCORE.gold * gold + SCORE.combo * extras + (won ? SCORE.second * Math.floor(Math.max(0, 120 - time) + EPS) : 0);
export const capScore = (score: number, ms: number) => limitScore(score, ms, ghostVacuumMeta.scoring);
export const fitsLimits = (score: number, ms: number) => withinServerLimits(score, ms, ghostVacuumMeta.scoring);
