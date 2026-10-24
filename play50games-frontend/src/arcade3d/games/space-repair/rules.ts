import { rngNext, turnTowards } from "@/arcade3d/core/math";
import { circlesOverlapXZ } from "@/arcade3d/core/collision";
import { circleSegmentXZ, resolveCircleSegmentXZ, substep, type CircleBodyXZ, type SegmentContact, type SegmentXZ } from "@/arcade3d/core/kinematics";
import { advance, createPath } from "@/arcade3d/core/path";
import { judgeTiming, needlePosition, type TimingZone } from "@/arcade3d/core/hud/timingMath";

export const STATION = { edge: 10, moduleRadius: 4.2, serviceRadius: 6, dock: 0.6, moduleInradius: 0.65, moduleSides: 12, hubInradius: 1.2, hubSides: 16 } as const;
export const SUIT = { radius: 0.45, thrust: 6, brake: 3, speed: 7, deadZone: 0.12, dockSpeed: 1, restitution: 0.5, wobble: 0.5, rearm: 0.05, turn: 8 } as const;
export const BREAKS = { times: [6, 12, 18, 24, 30, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 83, 86, 89, 92, 95, 98, 101, 104, 107, 110, 113, 116, 119], drain: 1 } as const;
export const REPAIR = { hits: [1, 1, 2, 1, 1, 2, 1, 3], periods: [1.2, 1, 0.8], fine: [60, 45, 35], coarse: [60, 45, 35], arcs: [60, 45, 35], perfectShare: 1 / 3, lock: 0.5, centre: 0.5, jitter: 0.05 } as const;
export const DEBRIS = { radius: 7.6, bodyRadius: 0.25, points: 32, count: 4, speeds: [1, 1.2, 1.4], impulse: 2, cooldown: 1, jitter: 0.025 } as const;
export const CELL = { milestones: [4, 12, 20], offset: 1.3, delay: 0.35, lifetime: 8, radius: 2, power: 25 } as const;
export const SCORE = { repair: 100, perfect: 50, power: 2 } as const;
export const CLOCK = { duration: 120, stage: 40, slice: 1 / 120, resultDelayMs: 1200, low: 25, rearm: 30 } as const;
export const PROPOSED_LIMITS = { kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" } as const;
const EPS = 1e-9, TAU = Math.PI * 2;

export const MODULES = Array.from({ length: 8 }, (_, id) => {
   const angle = id * Math.PI / 4;
   return { id, x: STATION.moduleRadius * Math.sin(angle), z: STATION.moduleRadius * Math.cos(angle), dx: STATION.serviceRadius * Math.sin(angle), dz: STATION.serviceRadius * Math.cos(angle), angle };
});
function polygon(x: number, z: number, inradius: number, sides: number): SegmentXZ[] {
   const r = inradius / Math.cos(Math.PI / sides);
   return Array.from({ length: sides }, (_, i) => ({ a: { x: x + r * Math.sin(TAU * i / sides), z: z + r * Math.cos(TAU * i / sides) }, b: { x: x + r * Math.sin(TAU * (i + 1) / sides), z: z + r * Math.cos(TAU * (i + 1) / sides) } }));
}
export const SOLIDS = [
   ...MODULES.map((m) => polygon(m.x, m.z, STATION.moduleInradius, STATION.moduleSides)),
   polygon(0, 0, STATION.hubInradius, STATION.hubSides),
   ...[-1, 1].map((side) => {
      const x0 = side > 0 ? 8.1 : -9.3, x1 = side > 0 ? 9.3 : -8.1;
      return [{ a: { x: x0, z: -1 }, b: { x: x0, z: 1 } }, { a: { x: x0, z: 1 }, b: { x: x1, z: 1 } }, { a: { x: x1, z: 1 }, b: { x: x1, z: -1 } }, { a: { x: x1, z: -1 }, b: { x: x0, z: -1 } }];
   }),
];
export const SEGMENTS = SOLIDS.flat();
const SOLID_BOUNDS = SOLIDS.map((poly) => ({ minX: Math.min(...poly.map((e) => e.a.x)), maxX: Math.max(...poly.map((e) => e.a.x)), minZ: Math.min(...poly.map((e) => e.a.z)), maxZ: Math.max(...poly.map((e) => e.a.z)) }));
export const DEBRIS_PATH = createPath(Array.from({ length: DEBRIS.points }, (_, i) => ({ x: DEBRIS.radius * Math.sin(TAU * i / DEBRIS.points), y: 0.95, z: DEBRIS.radius * Math.cos(TAU * i / DEBRIS.points) })), { closed: true });
export interface Controls { x: number; z: number; repair: boolean }
export interface ModuleState { broken: boolean; hits: number; perfect: boolean; centre: number; period: number; zones: TimingZone[]; lockUntil: number; issued: number; generation: number; fixedAt: number }
export interface CellState { active: boolean; used: boolean; born: number; x: number; y: number; z: number }
export interface Run {
   time: number; power: number; score: number; repairs: number; perfectRepairs: number; bonus: number;
   coarse: boolean; direction: number; ticket: number; terminal: "win" | "lose" | null;
   body: CircleBodyXZ & { y: number }; yaw: number; docked: number; needleAge: number; wobbleUntil: number;
   contactArmed: boolean; debrisUntil: number; lowArmed: boolean; thrusting: boolean;
   modules: ModuleState[]; cells: CellState[]; debris: Array<{ path: typeof DEBRIS_PATH; s: number; position: { x: number; y: number; z: number } }>;
   events: { award: number; module: number; hit: boolean; miss: boolean; contact: boolean; cell: boolean; alarm: boolean; lap: boolean };
   controls: Controls; contact: SegmentContact; integrate: (dt: number) => void;
}
export function stageAt(t: number): number { return Math.min(2, Math.floor(t / CLOCK.stage)); }
export function createRun(seed: number, coarse = false): Run {
   const rng = { s: (seed >>> 0) || 1 }, direction = rngNext(rng) < 0.5 ? -1 : 1;
   const modules = MODULES.map((): ModuleState => ({ broken: false, hits: 0, perfect: true, centre: REPAIR.centre + REPAIR.jitter * (2 * rngNext(rng) - 1), period: REPAIR.periods[0], zones: [{ start: 0, end: 0 }], lockUntil: 0, issued: -1, generation: 0, fixedAt: -10 }));
   const debris = Array.from({ length: DEBRIS.count }, (_, i) => {
      const rider = { path: DEBRIS_PATH, s: (i / DEBRIS.count + DEBRIS.jitter * (2 * rngNext(rng) - 1)) * DEBRIS_PATH.total, position: { x: 0, y: 0.95, z: 0 } };
      advance(rider, 0); return rider;
   });
   const run: Run = {
      time: 0, power: 100, score: 0, repairs: 0, perfectRepairs: 0, bonus: 0, coarse, direction, ticket: 0, terminal: null,
      body: { x: 0, y: 1.1, z: 6, vx: 0, vz: 0, radius: SUIT.radius }, yaw: Math.PI, docked: -1, needleAge: 0, wobbleUntil: 0,
      contactArmed: true, debrisUntil: 0, lowArmed: true, thrusting: false, modules, debris,
      cells: CELL.milestones.map(() => ({ active: false, used: false, born: -10, x: 0, y: 1.1, z: 0 })),
      events: { award: 0, module: -1, hit: false, miss: false, contact: false, cell: false, alarm: false, lap: false },
      controls: { x: 0, z: 0, repair: false }, contact: { x: 0, z: 0, nx: 0, nz: 0, depth: 0, vx: 0, vz: 0 }, integrate: () => {},
   };
   run.integrate = (dt) => integrate(run, dt);
   return run;
}
export function brokenCount(r: Run): number {
   let n = 0; for (let i = 0; i < 8; i++) if (r.modules[i].broken) n++; return n;
}
export function needle(r: Run): number {
   if (r.docked < 0) return 0;
   return needlePosition(r.needleAge, r.modules[r.docked].period, "loop");
}
export function clearance(x: number, z: number): number {
   let d = STATION.edge - Math.max(Math.abs(x), Math.abs(z));
   for (const poly of SOLIDS) {
      let inside = true;
      for (const e of poly) {
         const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z;
         if (dx * (z - e.a.z) - dz * (x - e.a.x) > EPS) inside = false;
         const t = Math.max(0, Math.min(1, ((x - e.a.x) * dx + (z - e.a.z) * dz) / (dx * dx + dz * dz)));
         d = Math.min(d, Math.hypot(x - e.a.x - t * dx, z - e.a.z - t * dz));
      }
      if (inside) return -1;
   }
   return d;
}
function capVelocity(b: CircleBodyXZ): void {
   const speed = Math.hypot(b.vx, b.vz);
   if (speed > SUIT.speed) { b.vx *= SUIT.speed / speed; b.vz *= SUIT.speed / speed; }
}
export function resolveContacts(r: Run): boolean {
   const b = r.body, hit = r.contact, limit = STATION.edge - b.radius;
   let touched = false;
   if (b.x > limit) { b.x = limit; if (b.vx > 0) b.vx *= -SUIT.restitution; touched = true; }
   if (b.x < -limit) { b.x = -limit; if (b.vx < 0) b.vx *= -SUIT.restitution; touched = true; }
   if (b.z > limit) { b.z = limit; if (b.vz > 0) b.vz *= -SUIT.restitution; touched = true; }
   if (b.z < -limit) { b.z = -limit; if (b.vz < 0) b.vz *= -SUIT.restitution; touched = true; }
   for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let solid = 0; solid < SOLIDS.length; solid++) {
         const box = SOLID_BOUNDS[solid];
         if (b.x < box.minX - b.radius || b.x > box.maxX + b.radius || b.z < box.minZ - b.radius || b.z > box.maxZ + b.radius) continue;
         const poly = SOLIDS[solid];
         let inside = true, nearest = Infinity, nx = 0, nz = 0;
         for (const e of poly) {
            const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, len = Math.hypot(dx, dz);
            const signed = (dx * (b.z - e.a.z) - dz * (b.x - e.a.x)) / len;
            if (signed > 0) inside = false;
            const ex = -dz / len, ez = dx / len, depth = -signed + b.radius + EPS;
            // An interior exit must also fit inside the arena (the wing-side gap is too narrow).
            if (-signed < nearest && Math.abs(b.x + ex * depth) <= limit && Math.abs(b.z + ez * depth) <= limit) { nearest = -signed; nx = ex; nz = ez; }
         }
         if (inside) {
            hit.nx = nx; hit.nz = nz; hit.depth = nearest + b.radius + EPS; hit.vx = 0; hit.vz = 0;
            resolveCircleSegmentXZ(b, hit, SUIT.restitution, 0); changed = true; touched = true;
         }
         for (const e of poly) if (circleSegmentXZ(b, e, hit) && hit.depth > EPS) {
            if (Math.abs(b.x + hit.nx * hit.depth) > limit || Math.abs(b.z + hit.nz * hit.depth) > limit) {
               hit.nx = nx; hit.nz = nz; hit.depth = nearest + b.radius + EPS;
            }
            resolveCircleSegmentXZ(b, hit, SUIT.restitution, 0); changed = true; touched = true;
         }
      }
      if (!changed) break;
   }
   capVelocity(b);
   return touched;
}
function wobble(r: Run): void {
   r.docked = -1; r.needleAge = 0;
   if (r.time + EPS >= r.wobbleUntil) { r.wobbleUntil = r.time + SUIT.wobble; r.events.contact = true; }
}
function dock(r: Run): void {
   let target = -1, best = Infinity;
   if (!r.thrusting && r.time + EPS >= r.wobbleUntil && Math.hypot(r.body.vx, r.body.vz) <= SUIT.dockSpeed + EPS) {
      for (let i = 0; i < 8; i++) {
         if (!r.modules[i].broken) continue;
         const m = MODULES[i], d = Math.hypot(r.body.x - m.dx, r.body.z - m.dz);
         if (d <= STATION.dock + EPS && d < best) { target = i; best = d; }
      }
   }
   if (target !== r.docked) r.needleAge = 0;
   r.docked = target;
   if (target >= 0) { r.body.vx = 0; r.body.vz = 0; }
}
function collectCells(r: Run): void {
   for (const c of r.cells) {
      if (!c.active) continue;
      const age = r.time - c.born;
      if (age + EPS >= CELL.lifetime) { c.active = false; continue; }
      if (age + EPS >= CELL.delay && Math.hypot(r.body.x - c.x, r.body.z - c.z) <= CELL.radius + EPS) {
         c.active = false; r.power = Math.min(100, r.power + CELL.power); r.events.cell = true;
      }
   }
   if (r.power > CLOCK.rearm) r.lowArmed = true;
}
function integrate(r: Run, dt: number): void {
   if (r.terminal) return;
   const drain = brokenCount(r) * BREAKS.drain;
   dt = Math.min(dt, drain ? r.power / drain : dt);
   const b = r.body, oldX = b.x, oldZ = b.z, vx = b.vx, vz = b.vz;
   if (r.docked < 0 || r.thrusting) {
      if (r.thrusting) { b.vx += r.controls.x * SUIT.thrust * dt; b.vz += r.controls.z * SUIT.thrust * dt; }
      else {
         const speed = Math.hypot(b.vx, b.vz), k = speed ? Math.max(0, 1 - SUIT.brake * dt / speed) : 0;
         b.vx *= k; b.vz *= k;
      }
      capVelocity(b); b.x += (vx + b.vx) * 0.5 * dt; b.z += (vz + b.vz) * 0.5 * dt;
   }
   const oldNeedle = needle(r);
   if (r.docked >= 0 && r.time + EPS >= r.modules[r.docked].lockUntil) r.needleAge += dt;
   if (needle(r) < oldNeedle) r.events.lap = true;
   const stage = stageAt(r.time);
   r.time += dt; r.power = Math.max(0, r.power - drain * dt);
   if (r.power <= EPS) { r.power = 0; r.terminal = "lose"; return; }
   if (r.lowArmed && r.power < CLOCK.low) { r.events.alarm = true; r.lowArmed = false; }
   const touched = resolveContacts(r);
   if (touched && clearance(b.x, b.z) < b.radius - 1e-6) { b.x = oldX; b.z = oldZ; b.vx = 0; b.vz = 0; }
   if (touched && r.contactArmed) { wobble(r); r.contactArmed = false; }
   if (!r.contactArmed && clearance(b.x, b.z) >= b.radius + SUIT.rearm) r.contactArmed = true;
   for (let i = 0; i < DEBRIS.count; i++) {
      const d = r.debris[i]; advance(d, DEBRIS.speeds[stage] * dt);
      if (i >= stage + 2 || r.time < r.debrisUntil) continue;
      if (circlesOverlapXZ(b, b.radius, d.position, DEBRIS.bodyRadius)) {
         let nx = b.x - d.position.x, nz = b.z - d.position.z, len = Math.hypot(nx, nz);
         if (len < EPS) { nx = b.x; nz = b.z; len = Math.hypot(nx, nz); }
         if (len < EPS) { nz = 1; len = 1; }
         b.vx += nx / len * DEBRIS.impulse; b.vz += nz / len * DEBRIS.impulse;
         capVelocity(b); r.debrisUntil = r.time + DEBRIS.cooldown; wobble(r);
      }
   }
   dock(r);
   let facing = r.yaw;
   if (r.docked >= 0) facing = Math.atan2(MODULES[r.docked].x - b.x, MODULES[r.docked].z - b.z);
   else if (Math.hypot(b.vx, b.vz) > 0.2) facing = Math.atan2(b.vx, b.vz);
   r.yaw = turnTowards(r.yaw, facing, 1 - Math.exp(-SUIT.turn * dt));
   collectCells(r);
}
function issue(r: Run): void {
   while (r.ticket < BREAKS.times.length && BREAKS.times[r.ticket] <= r.time + EPS) {
      const k = r.ticket++, id = ((r.direction * k) % 8 + 8) % 8, m = r.modules[id];
      if (m.broken) continue;
      const stage = stageAt(r.time), width = (r.coarse ? REPAIR.coarse[stage] : REPAIR.fine[stage]) / 360;
      m.broken = true; m.hits = 0; m.perfect = true; m.period = REPAIR.periods[stage];
      m.zones[0].start = m.centre - width / 2; m.zones[0].end = m.centre + width / 2;
      m.issued = k; m.generation++; m.lockUntil = 0;
   }
   dock(r);
}
function attempt(r: Run): void {
   if (r.docked < 0) return;
   const id = r.docked, m = r.modules[id];
   if (r.time + EPS < m.lockUntil) return;
   const grade = judgeTiming(needle(r), m.zones, REPAIR.perfectShare);
   r.needleAge = 0;
   if (grade === "miss") { m.perfect = false; m.lockUntil = r.time + REPAIR.lock; r.events.miss = true; return; }
   r.events.hit = true; m.hits++; m.perfect = m.perfect && grade === "perfect";
   if (m.hits < REPAIR.hits[id]) return;
   m.broken = false; m.fixedAt = r.time; r.repairs++;
   if (m.perfect) r.perfectRepairs++;
   const award = SCORE.repair + (m.perfect ? SCORE.perfect : 0);
   r.score += award; r.events.award = award; r.events.module = id;
   for (let i = 0; i < CELL.milestones.length; i++) if (r.repairs === CELL.milestones[i] && !r.cells[i].used) {
      const c = r.cells[i], p = MODULES[id];
      c.used = true; c.active = true; c.born = r.time;
      c.x = p.dx + CELL.offset * Math.cos(p.angle); c.z = p.dz - CELL.offset * Math.sin(p.angle);
   }
   r.docked = -1;
}
export function stepRun(r: Run, controls: Controls, dt: number): void {
   if (r.terminal || !(dt > 0) || !Number.isFinite(dt)) return;
   const ev = r.events;
   ev.award = 0; ev.module = -1; ev.hit = false; ev.miss = false; ev.contact = false; ev.cell = false; ev.alarm = false; ev.lap = false;
   const mag = Math.hypot(controls.x, controls.z), scale = mag > 1 ? 1 / mag : 1;
   r.controls.x = controls.x * scale; r.controls.z = controls.z * scale;
   r.thrusting = mag > SUIT.deadZone;
   if (r.thrusting) { r.docked = -1; r.needleAge = 0; }
   const sample = r.time + dt, end = Math.min(CLOCK.duration, sample);
   while (r.time < end - EPS && !r.terminal) {
      issue(r);
      let boundary = Math.min(end, BREAKS.times[r.ticket] ?? CLOCK.duration);
      if (r.docked >= 0) {
         const lock = r.modules[r.docked].lockUntil;
         if (lock > r.time + EPS) boundary = Math.min(boundary, lock);
      }
      if (r.wobbleUntil > r.time + EPS) boundary = Math.min(boundary, r.wobbleUntil);
      for (const c of r.cells) if (c.active) {
         if (c.born + CELL.delay > r.time + EPS) boundary = Math.min(boundary, c.born + CELL.delay);
         if (c.born + CELL.lifetime > r.time + EPS) boundary = Math.min(boundary, c.born + CELL.lifetime);
      }
      const count = brokenCount(r);
      if (count) boundary = Math.min(boundary, r.time + r.power / (count * BREAKS.drain));
      substep(Math.max(0, boundary - r.time), CLOCK.slice, r.integrate);
      if (!r.terminal && Math.abs(r.time - boundary) < EPS) r.time = boundary;
   }
   if (r.terminal) return;
   r.time = end; issue(r);
   if (controls.repair && sample <= CLOCK.duration + EPS) attempt(r);
   collectCells(r);
   if (r.time >= CLOCK.duration - EPS) {
      r.time = CLOCK.duration; r.bonus = SCORE.power * Math.floor(r.power);
      r.score += r.bonus; r.terminal = "win";
   }
}
