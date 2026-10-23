import { createRng } from "@/arcade3d/core/math";
import { createFixedStep, fixedStep, stepRigidBody2D, type RigidBody2D, type RigidBodyForces, type FixedStepState } from "@/arcade3d/core/kinematics";
import { HULL, HULL_SKIN, SUPPORT } from "./assets";

export const DURATION_MS = 240000;
export const BODY = { centre: 1.1, radius: 1.35, speed: 12, omega: 1.5, spawnY: 14 } as const;
export const ENGINE = { acceleration: 12, burn: 10, torque: 3, damping: 4, assist: 8, neutral: 0.05 } as const;
export const CONTACT = { slice: 0.025, bisections: 12, vy: 2, vx: 1, angle: Math.PI / 18, skin: HULL_SKIN } as const;
export const TRANSITION = 1.2;
export const WORLD = { left: -10, right: 10, bottom: -1, top: 20, padY: 2, padThickness: 0.4, roofLeft: -3, roofRight: 3, roofBottom: 9, roofTop: 10 } as const;
export const PLANETS = [
   { name: "Moon", gravity: 1.6, width: 6, fuel: 100, color: "#d6d3d1" },
   { name: "Desert", gravity: 3.7, width: 5.5, fuel: 100, color: "#fdba74" },
   { name: "Ice", gravity: 5, width: 5, fuel: 95, color: "#bae6fd" },
   { name: "Gas moon", gravity: 2.5, width: 4.5, fuel: 90, color: "#c4b5fd" },
   { name: "Asteroid", gravity: 1, width: 4, fuel: 85, color: "#78716c" },
] as const;
const STEP = 1 / 120;
const TAU = 2 * Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const wrap = (v: number) => v >= -Math.PI && v < Math.PI ? v : ((v + Math.PI) % TAU + TAU) % TAU - Math.PI;
export interface Layout { pad: number; spawnX: number; phase: number; wind: number; terrain: number[]; fallback: boolean }
export interface Controls { rotate: number; thrust: boolean }
export interface Award { soft: number; centre: number; reserve: number; total: number }
interface Point { x: number; y: number }
interface Polygon { points: Point[]; minX: number; maxX: number; minY: number; maxY: number }
export interface Run {
   layouts: Layout[]; body: RigidBody2D; previous: RigidBody2D; next: RigidBody2D; probe: RigidBody2D;
   clock: FixedStepState; tick: (dt: number) => void; controls: Controls; forces: RigidBodyForces;
   assist: boolean; planet: number; completed: number; lives: number; crashes: number; fuel: number;
   attemptTime: number; simTime: number; hold: number; impactTime: number; powered: boolean;
   mode: "flight" | "landed" | "crashed"; terminal: "win" | "lose" | null;
   score: number; awards: number[]; award: Award; events: { award: number; crash: boolean; spawn: boolean; lowFuel: boolean };
   lowFuel: boolean; obstacles: Polygon[][]; pad: Polygon; roof: Polygon; a: Point[]; b: Point[]; quad: Point[];
   contactMask: number; contactSlices: number; sweepSkin: number; pivot: Point;
}
export function padX(l: Layout, p: number, t: number): number { return p === 4 ? 2 * Math.sin(TAU * t / 16 + l.phase) : l.pad; }
export function padVx(l: Layout, p: number, t: number): number { return p === 4 ? Math.PI / 4 * Math.cos(TAU * t / 16 + l.phase) : 0; }
export function fallbackLayout(p: number): Layout { return { pad: 0, spawnX: 4.5, phase: 0, wind: 0, terrain: new Array<number>(13).fill(0), fallback: true }; }
export function isValidLayout(l: Layout, p: number): boolean {
   const offset = Math.abs(l.spawnX - padX(l, p, 0));
   return l.terrain.length === 13 && l.terrain.every((v) => Number.isFinite(v) && v >= -0.5 && v <= 0.5) &&
      Number.isFinite(l.spawnX) && Math.abs(l.spawnX) <= 7.5 && Math.abs(l.pad) <= 1 &&
      offset >= (p === 4 ? 4.5 : 3) && offset <= 6 && Number.isFinite(l.wind) &&
      (l.phase === 0 || l.phase === Math.PI);
}
export function generateCampaign(seed: number): Layout[] {
   const rng = createRng(seed);
   return PLANETS.map((_, p) => {
      for (let n = 0; n < 16; n++) {
         const pad = p === 4 ? 0 : rng() * 2 - 1;
         const spawnX = pad + (rng() < 0.5 ? -1 : 1) * ((p === 4 ? 4.5 : 3) + rng() * (p === 4 ? 1.5 : 3));
         const l = { pad, spawnX, phase: rng() < 0.5 ? 0 : Math.PI, wind: rng() * TAU, terrain: Array.from({ length: 13 }, () => rng() - 0.5), fallback: false };
         if (isValidLayout(l, p)) return l;
      }
      return fallbackLayout(p);
   });
}
const body = (): RigidBody2D => ({ x: 0, y: 0, angle: 0, vx: 0, vy: 0, omega: 0 });
const points = (n: number): Point[] => Array.from({ length: n }, () => ({ x: 0, y: 0 }));
function polygon(a: Point[]): Polygon {
   return { points: a, minX: Math.min(...a.map((p) => p.x)), maxX: Math.max(...a.map((p) => p.x)), minY: Math.min(...a.map((p) => p.y)), maxY: Math.max(...a.map((p) => p.y)) };
}
function rect(x0: number, x1: number, y0: number, y1: number): Polygon { return polygon([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]); }
function movePad(r: Run, t: number): void {
   const x = padX(r.layouts[r.planet], r.planet, t), w = PLANETS[r.planet].width / 2;
   r.pad.minX = x - w; r.pad.maxX = x + w;
   r.pad.points[0].x = r.pad.points[3].x = x - w;
   r.pad.points[1].x = r.pad.points[2].x = x + w;
}
export function createRun(seed: number, assist: boolean): Run {
   const layouts = generateCampaign(seed);
   const r: Run = {
      layouts, body: body(), previous: body(), next: body(), probe: body(), clock: createFixedStep(STEP), tick: () => {},
      controls: { rotate: 0, thrust: false }, forces: { thrust: 0, torque: 0, gravity: 0 }, assist,
      planet: 0, completed: 0, lives: 3, crashes: 0, fuel: 100, attemptTime: 0, simTime: 0,
      hold: 0, impactTime: 0, powered: false, mode: "flight", terminal: null, score: 0, awards: new Array<number>(5).fill(0),
      award: { soft: 0, centre: 0, reserve: 0, total: 0 }, events: { award: 0, crash: false, spawn: false, lowFuel: false }, lowFuel: false,
      obstacles: layouts.map((l) => Array.from({ length: 12 }, (_, i) => {
         const x0 = -10 + i * 20 / 12, x1 = -10 + (i + 1) * 20 / 12;
         return polygon([{ x: x0, y: -2 }, { x: x1, y: -2 }, { x: x1, y: l.terrain[i + 1] }, { x: x0, y: l.terrain[i] }]);
      })),
      pad: rect(-3, 3, 1.6, 2), roof: rect(-3, 3, 9, 10), a: points(HULL.length), b: points(HULL.length), quad: points(4),
      contactMask: 0, contactSlices: 0, sweepSkin: 0, pivot: { x: 0, y: 0 },
   };
   r.tick = (dt) => tick(r, dt);
   spawn(r);
   return r;
}
function copy(out: RigidBody2D, a: RigidBody2D): void { out.x = a.x; out.y = a.y; out.angle = a.angle; out.vx = a.vx; out.vy = a.vy; out.omega = a.omega; }
function interpolate(out: RigidBody2D, a: RigidBody2D, b: RigidBody2D, t: number): void {
   out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t;
   out.angle = a.angle + wrap(b.angle - a.angle) * t;
   out.vx = a.vx + (b.vx - a.vx) * t; out.vy = a.vy + (b.vy - a.vy) * t; out.omega = a.omega + (b.omega - a.omega) * t;
}
function spawn(r: Run): void {
   const b = r.body;
   b.x = r.layouts[r.planet].spawnX; b.y = BODY.spawnY;
   b.vx = b.vy = b.angle = b.omega = 0;
   r.fuel = PLANETS[r.planet].fuel; r.attemptTime = 0; r.mode = "flight";
   r.hold = 0; r.lowFuel = false; r.powered = false; r.events.spawn = true;
}
function transform(out: Point[], b: RigidBody2D): void {
   const c = Math.cos(b.angle), s = Math.sin(b.angle);
   for (let i = 0; i < HULL.length; i++) {
      const x = HULL[i][0], y = HULL[i][1] - BODY.centre;
      out[i].x = b.x + c * x - s * y; out[i].y = b.y + s * x + c * y;
   }
}
function separated(a: Point[], b: Point[], nx: number, ny: number, skin: number): boolean {
   let alo = Infinity, ahi = -Infinity, blo = Infinity, bhi = -Infinity;
   for (let i = 0; i < a.length; i++) { const d = a[i].x * nx + a[i].y * ny; alo = Math.min(alo, d); ahi = Math.max(ahi, d); }
   for (let i = 0; i < b.length; i++) { const d = b[i].x * nx + b[i].y * ny; blo = Math.min(blo, d); bhi = Math.max(bhi, d); }
   const tolerance = skin * Math.hypot(nx, ny);
   return ahi < blo - tolerance || bhi < alo - tolerance;
}
function overlaps(a: Point[], b: Point[], skin: number): boolean {
   for (let pass = 0; pass < 2; pass++) {
      const p = pass ? b : a;
      for (let i = 0; i < p.length; i++) {
         const j = (i + 1) % p.length, dx = p[j].x - p[i].x, dy = p[j].y - p[i].y;
         if ((dx !== 0 || dy !== 0) && separated(a, b, -dy, dx, skin)) return false;
      }
   }
   return true;
}
function sweptObstacle(r: Run, o: Polygon, minX: number, maxX: number, minY: number, maxY: number, padMove: number): boolean {
   if (maxX < o.minX - Math.abs(padMove) - r.sweepSkin || minX > o.maxX + Math.abs(padMove) + r.sweepSkin || maxY < o.minY - r.sweepSkin || minY > o.maxY + r.sweepSkin) return false;
   // Translate the old hull into the new pad's frame; hazard callers pass zero.
   if (padMove) for (let i = 0; i < r.a.length; i++) r.a[i].x += padMove;
   let hit = overlaps(r.a, o.points, r.sweepSkin) || overlaps(r.b, o.points, r.sweepSkin);
   for (let i = 0; !hit && i < r.a.length; i++) {
      const j = (i + 1) % r.a.length, q = r.quad;
      q[0].x = r.a[i].x; q[0].y = r.a[i].y; q[1].x = r.a[j].x; q[1].y = r.a[j].y;
      q[2].x = r.b[j].x; q[2].y = r.b[j].y; q[3].x = r.b[i].x; q[3].y = r.b[i].y;
      hit = overlaps(q, o.points, r.sweepSkin);
   }
   if (padMove) for (let i = 0; i < r.a.length; i++) r.a[i].x -= padMove;
   return hit;
}
function sweep(r: Run, a: RigidBody2D, b: RigidBody2D, ta: number, tb: number): number {
   // Covers the rotation arc outside its chord and the analytic moving-pad arc.
   r.sweepSkin = BODY.radius * (1 - Math.cos(wrap(b.angle - a.angle) / 2)) + (r.planet === 4 ? 2 * (1 - Math.cos(Math.PI * (tb - ta) / 16)) : 0) + 1e-8;
   transform(r.a, a); transform(r.b, b);
   let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
   for (let i = 0; i < HULL.length; i++) {
      minX = Math.min(minX, r.a[i].x, r.b[i].x); maxX = Math.max(maxX, r.a[i].x, r.b[i].x);
      minY = Math.min(minY, r.a[i].y, r.b[i].y); maxY = Math.max(maxY, r.a[i].y, r.b[i].y);
   }
   let mask = minX - r.sweepSkin <= WORLD.left || maxX + r.sweepSkin >= WORLD.right || minY - r.sweepSkin <= WORLD.bottom || maxY + r.sweepSkin >= WORLD.top ? 2 : 0;
   const obstacles = r.obstacles[r.planet];
   for (let i = 0; ! (mask & 2) && i < obstacles.length; i++) if (sweptObstacle(r, obstacles[i], minX, maxX, minY, maxY, 0)) mask |= 2;
   if (r.planet === 4 && sweptObstacle(r, r.roof, minX, maxX, minY, maxY, 0)) mask |= 2;
   movePad(r, tb);
   const dx = padX(r.layouts[r.planet], r.planet, tb) - padX(r.layouts[r.planet], r.planet, ta);
   if (sweptObstacle(r, r.pad, minX, maxX, minY, maxY, dx)) mask |= 1;
   return mask;
}
export function landingSafe(r: Run, t: number): boolean {
   const b = r.body, l = r.layouts[r.planet], half = PLANETS[r.planet].width / 2, px = padX(l, r.planet, t);
   if (!(b.vy < 0 && Math.abs(b.vy) < CONTACT.vy && Math.abs(b.vx - padVx(l, r.planet, t)) < CONTACT.vx && Math.abs(wrap(b.angle)) < CONTACT.angle)) return false;
   for (let i = 0; i < SUPPORT.length; i++) {
      const x = b.x + Math.cos(b.angle) * SUPPORT[i][0] - Math.sin(b.angle) * (SUPPORT[i][1] - BODY.centre);
      if (x < px - half - 1e-9 || x > px + half + 1e-9) return false;
   }
   return true;
}
export function landingAward(vy: number, dx: number, width: number, fuel: number, initial: number, out: Award = { soft: 0, centre: 0, reserve: 0, total: 0 }): Award {
   const soft = clamp(Math.floor(200 * (1 - Math.abs(vy) / 2)), 0, 200);
   const centre = clamp(Math.floor(150 * (1 - Math.abs(dx) / (width / 2))), 0, 150);
   const reserve = clamp(Math.floor(150 * fuel / initial), 0, 150);
   out.soft = soft; out.centre = centre; out.reserve = reserve; out.total = soft + centre + reserve;
   return out;
}
function impact(r: Run, mask: number): void {
   const b = r.body, c = Math.cos(b.angle), s = Math.sin(b.angle);
   let foot = 0, lowest = Infinity;
   for (let i = 0; i < 2; i++) {
      const y = b.y + s * SUPPORT[i][0] + c * (SUPPORT[i][1] - BODY.centre);
      if (y < lowest) { lowest = y; foot = i; }
   }
   // The first hull contact must be on the top support edge, within the mesh contact skin.
   const top = Math.abs(lowest - WORLD.padY) <= CONTACT.skin + 0.018;
   if (mask === 1 && top && landingSafe(r, r.attemptTime)) {
      const p = PLANETS[r.planet];
      const award = landingAward(b.vy, b.x - padX(r.layouts[r.planet], r.planet, r.attemptTime), p.width, r.fuel, p.fuel, r.award);
      r.awards[r.planet] = award.total; r.score += award.total; r.events.award += award.total; r.completed++;
      r.mode = "landed";
      r.pivot.x = b.x + c * SUPPORT[foot][0] - s * (SUPPORT[foot][1] - BODY.centre);
      r.pivot.y = WORLD.padY;
      if (r.completed === 5) {
         if (!r.crashes) { r.score += 300; r.events.award += 300; }
         r.terminal = "win";
      }
   } else {
      r.mode = "crashed"; r.crashes++; r.lives--; r.events.crash = true;
      if (!r.lives) r.terminal = "lose";
   }
   r.hold = TRANSITION; r.impactTime = r.simTime; r.powered = false;
}
// Nearest hull/surface pair at the resolved impact, for crash feedback only.
export function crashContact(r: Run, out: { x: number; y: number; z: number }): void {
   const b = r.body, c = Math.cos(b.angle), s = Math.sin(b.angle);
   let nearest = Infinity;
   const consider = (x: number, y: number, qx: number, qy: number) => {
      const d = (x - qx) ** 2 + (y - qy) ** 2;
      if (d < nearest) { nearest = d; out.x = qx; out.y = qy; }
   };
   const surfaces = (r.contactMask & 1 ? [r.pad] : []).concat(r.contactMask & 2 ? [...r.obstacles[r.planet], ...(r.planet === 4 ? [r.roof] : [])] : []);
   for (const [hx, hy] of HULL) {
      const x = b.x + c * hx - s * (hy - BODY.centre), y = b.y + s * hx + c * (hy - BODY.centre);
      if (r.contactMask & 2) {
         consider(x, y, WORLD.left, clamp(y, WORLD.bottom, WORLD.top));
         consider(x, y, WORLD.right, clamp(y, WORLD.bottom, WORLD.top));
         consider(x, y, clamp(x, WORLD.left, WORLD.right), WORLD.bottom);
         consider(x, y, clamp(x, WORLD.left, WORLD.right), WORLD.top);
      }
      for (const surface of surfaces) for (let i = 0; i < surface.points.length; i++) {
         const a = surface.points[i], q = surface.points[(i + 1) % surface.points.length];
         const dx = q.x - a.x, dy = q.y - a.y;
         const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
         consider(x, y, a.x + t * dx, a.y + t * dy);
      }
   }
   // A pad/terrain corner can touch the middle of a hull edge.
   for (const surface of surfaces) for (const q of surface.points) for (let i = 0; i < HULL.length; i++) {
      const a = HULL[i], e = HULL[(i + 1) % HULL.length];
      const ax = b.x + c * a[0] - s * (a[1] - BODY.centre), ay = b.y + s * a[0] + c * (a[1] - BODY.centre);
      const dx = c * (e[0] - a[0]) - s * (e[1] - a[1]), dy = s * (e[0] - a[0]) + c * (e[1] - a[1]);
      const t = clamp(((q.x - ax) * dx + (q.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      consider(ax + t * dx, ay + t * dy, q.x, q.y);
   }
   out.z = 0.5;
}
function flight(r: Run, dt: number, thrust: boolean): number {
   const b = r.body, p = PLANETS[r.planet], oldFuel = r.fuel;
   copy(r.previous, b);
   const rotate = clamp(r.controls.rotate, -1, 1);
   r.forces.thrust = thrust ? ENGINE.acceleration : 0;
   r.forces.gravity = p.gravity;
   r.forces.torque = r.assist && Math.abs(rotate) <= ENGINE.neutral ? clamp(-ENGINE.assist * wrap(b.angle) - ENGINE.damping * b.omega, -3, 3) : -ENGINE.torque * rotate - ENGINE.damping * b.omega;
   stepRigidBody2D(b, dt, r.forces);
   if (r.planet === 3) {
      const wind = 0.4 * Math.sin(TAU * r.attemptTime / 8 + r.layouts[3].wind);
      b.vx += wind * dt; b.x += wind * dt * dt;
   }
   const speed = Math.hypot(b.vx, b.vy);
   if (speed > BODY.speed) {
      b.vx *= BODY.speed / speed; b.vy *= BODY.speed / speed;
      b.x = r.previous.x + b.vx * dt; b.y = r.previous.y + b.vy * dt;
   }
   b.omega = clamp(b.omega, -BODY.omega, BODY.omega); b.angle = wrap(b.angle);
   copy(r.next, b);
   const travel = Math.hypot(b.x - r.previous.x, b.y - r.previous.y) + BODY.radius * Math.abs(wrap(b.angle - r.previous.angle)) + Math.PI / 4 * dt;
   const slices = Math.max(1, Math.ceil(travel / CONTACT.slice));
   r.contactSlices = slices;
   let start = 0, end = 0, mask = 0;
   // Previous/probe are immutable endpoints; body is reused for each slice start.
   for (let n = 1; n <= slices; n++) {
      end = n / slices;
      interpolate(b, r.previous, r.next, start); interpolate(r.probe, r.previous, r.next, end);
      mask = sweep(r, b, r.probe, r.attemptTime + start * dt, r.attemptTime + end * dt);
      if (mask) break;
      start = end;
   }
   if (mask) {
      const sliceStart = start;
      for (let i = 0; i < CONTACT.bisections; i++) {
         const mid = (start + end) / 2;
         interpolate(b, r.previous, r.next, sliceStart); interpolate(r.probe, r.previous, r.next, mid);
         const m = sweep(r, b, r.probe, r.attemptTime + sliceStart * dt, r.attemptTime + mid * dt);
         if (m) { end = mid; mask = m; } else start = mid;
      }
      interpolate(b, r.previous, r.next, end);
      r.contactMask = mask;
   } else { copy(b, r.next); end = 1; }
   const used = dt * end;
   r.fuel = Math.max(0, oldFuel - (thrust ? ENGINE.burn * used : 0));
   r.attemptTime += used; r.simTime += used; r.powered = thrust && r.fuel > 0;
   if (!r.lowFuel && r.fuel <= p.fuel * 0.2) { r.lowFuel = true; r.events.lowFuel = true; }
   if (mask) impact(r, mask);
   return used;
}
function tick(r: Run, dt: number): void {
   let left = dt;
   while (left > 1e-10 && !r.terminal) {
      if (r.mode !== "flight") {
         const used = Math.min(left, r.hold); r.hold -= used; r.simTime += used; left -= used;
         if (r.hold <= 1e-10) { if (r.mode === "landed") r.planet++; spawn(r); }
      } else {
         const on = r.controls.thrust && r.fuel > 1e-10;
         const part = on ? Math.min(left, r.fuel / ENGINE.burn) : left;
         const used = flight(r, part, on);
         left -= used;
         if (used < 1e-12 && r.mode === "flight") break;
      }
   }
}
export function stepRun(r: Run, input: Controls, dt: number): void {
   r.events.award = 0; r.events.crash = r.events.spawn = r.events.lowFuel = false;
   if (r.terminal || !(dt > 0)) return;
   r.controls.rotate = input.rotate; r.controls.thrust = input.thrust;
   fixedStep(r.clock, Math.min(dt, 0.05), r.tick);
}
