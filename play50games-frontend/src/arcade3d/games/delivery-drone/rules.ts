import { aabbFromCenter, clampToBounds, distanceToBoxXZ, resolveSphereAabb, sweptAabbXZ, type AABB, type SweepHit } from "@/arcade3d/core/collision";
import { landingPoint, type Projectile } from "@/arcade3d/core/ballistics";
import { circleSegmentXZ, stepPendulum2D, substep, type Pendulum2D } from "@/arcade3d/core/kinematics";
import { createRng, turnTowards } from "@/arcade3d/core/math";
import { spring } from "@/arcade3d/core/motion";
import { createPath, pointAt, tangentAt, type Path } from "@/arcade3d/core/path";

export const CITY = { half: 30, cells: 8, pitch: 7.5, footprint: 5, roofs: [2, 5, 8], towerHeight: 16, towers: 8, clearance: 1, grid: 0.5, attempts: 32 } as const;
export const DRONE = { radius: 0.5, speed: 9, accel: 10, drag: 10 / 9, turn: 10, ceiling: 11, altitude: 3, clearance: 2.6, stiffness: 36, restitution: 0.2, bank: 0.35, bob: 0.04, lookahead: 0.22, lookaheadMax: 2 } as const;
export const WINCH = { length: 2, gravity: 9.81, damping: 1.2, steadyDamping: 2.4, forcing: 0.35, angle: 0.35, speed: 1.5 } as const;
export const PARCEL = { size: 0.4, half: 0.2, lifetime: 5, fragileFrom: 8, fragilePrecision: 40 } as const;
export const BATTERY = { initial: 100, drain: 1, recharge: 12, damage: 3, cooldown: 1, grace: 1, rearm: 0.1, warning: 20, warningRearm: 25 } as const;
export const ROUTE = { count: 12, loading: 4, pickupRadius: 1.5, pickupSpeed: 0.5, padRadius: 1.25, express: 15, ceiling: 180, base: 150, precision: 100, expressPoints: 50 } as const;
export const WIND = { from: 60, size: 8, accel: 1.5 } as const;
export const PIGEON = { count: 6, initialCount: 2, middleCount: 4, middleFrom: 60, finalFrom: 120, speed: 3, radius: 0.3, heightTolerance: 0.6, rearm: 0.2 } as const;
export const BALLISTICS = { gravity: WINCH.gravity };
export const BOUNDS: AABB = { min: { x: -30, y: -100, z: -30 }, max: { x: 30, y: 100, z: 30 } };
const ZERO = { x: 0, y: 0, z: 0 };
const DRONE_HALF = { x: DRONE.radius, y: DRONE.radius, z: DRONE.radius };
const PARCEL_HALF = { x: PARCEL.half, y: PARCEL.half, z: PARCEL.half };
export interface Building { x: number; z: number; height: number; tower: boolean; cell: number; box: AABB }
export interface WindZone { x: number; z: number; ax: number; az: number }
export interface City { buildings: Building[]; cells: number[]; towers: number[]; targets: number[]; birds: Path[]; birdOffsets: number[]; winds: WindZone[]; fallback: boolean }
export interface StepInput { dirX: number; dirZ: number; drop: boolean }
export interface Impact { x: number; y: number; z: number; time: number; building: number; roof: boolean; precision: number; valid: boolean }
export interface Bird { x: number; y: number; z: number; yaw: number; touching: boolean }
export interface Events { score: number; pickup: boolean; release: boolean; miss: boolean; hit: boolean; delivery: boolean; warning: boolean }
export interface Run {
   city: City; time: number; score: number; battery: number; completed: number; loading: number; pickupAt: number;
   attached: boolean; falling: boolean; fragile: boolean; steady: boolean; warningArmed: boolean;
   reason: "win" | "lose" | "timeup" | null;
   drone: { x: number; y: number; z: number; vx: number; vz: number; heading: number };
   altitude: { x: number; v: number }; swing: Pendulum2D; fall: Projectile; fallAt: number;
   swingMetrics: { seconds: number; clampXSeconds: number; clampZSeconds: number; peakEnergy: number };
   preview: Impact; impact: Impact; parcel: { x: number; y: number; z: number }; birds: Bird[];
   contacts: boolean[]; damageAt: number; events: Events; input: StepInput;
   scratch: { moving: AABB; birdBox: AABB; delta: { x: number; z: number }; hit: SweepHit; acc: { x: number; z: number }; point: { x: number; y: number; z: number }; previous: { x: number; y: number; z: number }; projectile: Projectile; tangent: { x: number; y: number; z: number } };
   advance: (dt: number) => void;
}
function box(): AABB { return { min: { ...ZERO }, max: { ...ZERO } }; }
function impact(): Impact { return { ...ZERO, time: PARCEL.lifetime, building: -1, roof: false, precision: 0, valid: false }; }
function shuffle<T>(values: T[], rng: () => number): void {
   for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const value = values[i]; values[i] = values[j]; values[j] = value; }
}
function makeCity(seed: number, literal = false): City {
   const rng = createRng(seed);
   const buildings: Building[] = [];
   for (let row = 0; row < CITY.cells; row++) for (let col = 0; col < CITY.cells; col++) {
      if ((row === 3 || row === 4) && (col === 3 || col === 4)) continue;
      const x = (col - 3.5) * CITY.pitch, z = (row - 3.5) * CITY.pitch;
      const height = CITY.roofs[literal ? (row + col) % 3 : Math.floor(rng() * 3)];
      buildings.push({ x, z, height, cell: row * 8 + col, tower: false, box: { min: { x: x - 2.5, y: 0, z: z - 2.5 }, max: { x: x + 2.5, y: height, z: z + 2.5 } } });
   }
   const targets: number[] = [];
   for (let band = 0; band < 3; band++) {
      const choices = buildings.map((b, i) => ({ i, d: Math.hypot(b.x, b.z) })).filter(({ d }) => d >= [10, 18, 25][band] && d < [18, 25, 35.001][band]).map(({ i }) => i);
      if (!literal) shuffle(choices, rng);
      targets.push(...choices.slice(0, 4));
   }
   const towers = buildings.map((_b, i) => i).filter((i) => !targets.includes(i) && distanceToBoxXZ(0, 0, buildings[i].box) >= 3 && targets.every((t) => distanceToBoxXZ(buildings[t].x, buildings[t].z, buildings[i].box) >= 3));
   if (!literal) shuffle(towers, rng);
   for (const i of towers.slice(0, CITY.towers)) { buildings[i].tower = true; buildings[i].height = CITY.towerHeight; buildings[i].box.max.y = CITY.towerHeight; }
   const birds: Path[] = [], birdOffsets: number[] = [];
   for (let i = 0; i < PIGEON.count; i++) {
      // All loops lie on street centre lines, >= 3.75 m from every roof centre.
      const side = i % 2 ? 30 : 22.5, y = 4 + rng() * 6;
      birds.push(createPath([{ x: -side, y, z: -30 }, { x: side, y, z: -30 }, { x: side, y, z: 30 }, { x: -side, y, z: 30 }], { closed: true }));
      birdOffsets.push(rng() * birds[i].total);
   }
   const winds: WindZone[] = [];
   for (let i = 0; i < 2; i++) {
      const direction = Math.floor(rng() * 4);
      winds.push({ x: (i ? 1 : -1) * 15, z: (Math.floor(rng() * 5) - 2) * 7.5, ax: direction < 2 ? (direction ? -1 : 1) * WIND.accel : 0, az: direction >= 2 ? (direction === 3 ? -1 : 1) * WIND.accel : 0 });
   }
   const cells = new Array<number>(64).fill(-1);
   for (let i = 0; i < buildings.length; i++) cells[buildings[i].cell] = i;
   return { buildings, cells, towers: towers.slice(0, CITY.towers), targets, birds, birdOffsets, winds, fallback: literal };
}
export function clearAt(city: City, x: number, z: number, clearance: number = CITY.clearance): boolean {
   if (Math.abs(x) > CITY.half - clearance || Math.abs(z) > CITY.half - clearance) return false;
   for (const i of city.towers) { const b = city.buildings[i]; if (x >= b.box.min.x - clearance && x <= b.box.max.x + clearance && z >= b.box.min.z - clearance && z <= b.box.max.z + clearance) return false; }
   return true;
}
export function isValidCity(city: City): boolean {
   if (city.buildings.length !== 60 || new Set(city.buildings.map((b) => b.cell)).size !== 60 || city.winds.length !== 2 || city.birds.length !== 6) return false;
   for (const b of city.buildings) {
      if (!Number.isFinite(b.x + b.z + b.height) || Math.abs(b.x) > 26.25 || Math.abs(b.z) > 26.25) return false;
      if (b.tower ? b.height !== CITY.towerHeight : b.height !== 2 && b.height !== 5 && b.height !== 8) return false;
      if (b.box.min.x !== b.x - 2.5 || b.box.max.x !== b.x + 2.5 || b.box.min.z !== b.z - 2.5 || b.box.max.z !== b.z + 2.5 || b.box.max.y !== b.height) return false;
   }
   if (city.targets.length !== ROUTE.count || new Set(city.targets).size !== ROUTE.count || city.buildings.filter((b) => b.tower).length !== CITY.towers) return false;
   for (let n = 0; n < city.targets.length; n++) {
      const b = city.buildings[city.targets[n]];
      if (!b || b.tower) return false;
      const d = Math.hypot(b.x, b.z), band = Math.floor(n / 4);
      if (d < [10, 18, 25][band] || d >= [18, 25, 35.001][band]) return false;
      for (const t of city.buildings) if (t.tower && (distanceToBoxXZ(b.x, b.z, t.box) < 3 || distanceToBoxXZ(0, 0, t.box) < 3)) return false;
   }
   for (const w of city.winds) if (!Number.isFinite(w.x + w.z + w.ax + w.az) || Math.hypot(Math.max(0, Math.abs(w.x) - 4), Math.max(0, Math.abs(w.z) - 4)) < 3 || Math.hypot(w.ax, w.az) !== WIND.accel || w.ax !== 0 && w.az !== 0) return false;
   const safe = [{ x: 0, z: 0, vx: 0, vz: 0, radius: 3 }, ...city.targets.map((i) => ({ x: city.buildings[i].x, z: city.buildings[i].z, vx: 0, vz: 0, radius: 3 }))];
   for (const path of city.birds) {
      if (!path.closed || !(path.total > 0)) return false;
      for (let i = 0; i < path.points.length; i++) {
         const a = path.points[i], b = path.points[(i + 1) % path.points.length];
         if (!Number.isFinite(a.x + a.y + a.z) || a.y < 4 || a.y > 10) return false;
         for (const p of safe) if (circleSegmentXZ(p, { a, b })) return false;
      }
   }
   const side = Math.round(CITY.half * 2 / CITY.grid) + 1;
   const free = new Uint8Array(side * side), seen = new Uint8Array(side * side), queue = new Int32Array(side * side);
   for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) free[z * side + x] = clearAt(city, x * CITY.grid - CITY.half, z * CITY.grid - CITY.half) ? 1 : 0;
   const start = 60 * side + 60;
   let head = 0, tail = 1; queue[0] = start; seen[start] = 1;
   while (head < tail) {
      const n = queue[head++], x = n % side, z = Math.floor(n / side);
      for (const m of [x > 0 ? n - 1 : -1, x + 1 < side ? n + 1 : -1, z > 0 ? n - side : -1, z + 1 < side ? n + side : -1]) if (m >= 0 && free[m] && !seen[m]) { seen[m] = 1; queue[tail++] = m; }
   }
   return city.targets.every((i) => {
      const b = city.buildings[i];
      return !!seen[Math.round((b.z + CITY.half) / CITY.grid) * side + Math.round((b.x + CITY.half) / CITY.grid)];
   });
}
export function generateCity(seed: number, accept: (city: City) => boolean = isValidCity): City {
   for (let attempt = 0; attempt < CITY.attempts; attempt++) { const city = makeCity(seed + attempt * 104729); if (accept(city)) return city; }
   return makeCity(5050, true);
}
export function createRun(seed: number, steady = false): Run {
   const city = generateCity(seed);
   const run: Run = {
      city, time: 0, score: 0, battery: BATTERY.initial, completed: 0, loading: 0, pickupAt: 0,
      attached: false, falling: false, fragile: false, steady, warningArmed: true, reason: null,
      drone: { x: 0, y: 3, z: 0, vx: 0, vz: 0, heading: 0 }, altitude: { x: 3, v: 0 },
      swing: { x: { x: 0, v: 0 }, z: { x: 0, v: 0 } }, fall: { ...ZERO, vx: 0, vy: 0, vz: 0 }, fallAt: 0,
      swingMetrics: { seconds: 0, clampXSeconds: 0, clampZSeconds: 0, peakEnergy: 0 },
      preview: impact(), impact: impact(), parcel: { ...ZERO },
      birds: city.birds.map(() => ({ ...ZERO, yaw: 0, touching: false })), contacts: city.buildings.map(() => false), damageAt: -Infinity,
      events: { score: 0, pickup: false, release: false, miss: false, hit: false, delivery: false, warning: false }, input: { dirX: 0, dirZ: 0, drop: false },
      scratch: { moving: box(), birdBox: box(), delta: { x: 0, z: 0 }, hit: { time: 0, normalX: 0, normalZ: 0 }, acc: { x: 0, z: 0 }, point: { ...ZERO }, previous: { ...ZERO }, projectile: { ...ZERO, vx: 0, vy: 0, vz: 0 }, tangent: { ...ZERO } },
      advance: () => {},
   };
   run.advance = (dt) => advanceSlice(run, dt);
   for (let i = 0; i < run.birds.length; i++) pointAt(city.birds[i], city.birdOffsets[i], run.birds[i]);
   return run;
}
export function roofAt(city: City, x: number, z: number, reach = CITY.clearance): number {
   let roof = 0;
   const minCol = Math.max(0, Math.floor((x - reach + CITY.half) / CITY.pitch));
   const maxCol = Math.min(7, Math.floor((x + reach + CITY.half) / CITY.pitch));
   const minRow = Math.max(0, Math.floor((z - reach + CITY.half) / CITY.pitch));
   const maxRow = Math.min(7, Math.floor((z + reach + CITY.half) / CITY.pitch));
   for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const b = city.buildings[city.cells[row * 8 + col]];
      if (b && !b.tower && x + reach >= b.box.min.x && x - reach <= b.box.max.x && z + reach >= b.box.min.z && z - reach <= b.box.max.z) roof = Math.max(roof, b.height);
   }
   return roof;
}
export function deliveryPoints(precision: number, fragile: boolean, elapsed: number): number {
   if (fragile && precision < PARCEL.fragilePrecision) return 0;
   return ROUTE.base + Math.max(0, Math.min(100, precision)) + (elapsed <= ROUTE.express ? ROUTE.expressPoints : 0);
}
export function releaseState(run: Run, out: Projectile): void {
   const d = run.drone;
   out.x = d.x + WINCH.length * run.swing.x.x; out.y = d.y - WINCH.length - PARCEL.half; out.z = d.z + WINCH.length * run.swing.z.x;
   out.vx = d.vx + WINCH.length * run.swing.x.v; out.vy = run.altitude.v; out.vz = d.vz + WINCH.length * run.swing.z.v;
}
function flightAt(p: Projectile, t: number, out: { x: number; y: number; z: number }): void {
   out.x = p.x + p.vx * t; out.y = p.y + p.vy * t - WINCH.gravity * t * t / 2; out.z = p.z + p.vz * t;
}
function planeTime(p: Projectile, y: number): number {
   const h = p.y - PARCEL.half - y;
   if (h < 0 || (h === 0 && p.vy <= 0)) return 0;
   const root = Math.sqrt(p.vy * p.vy + 2 * WINCH.gravity * h);
   return p.vy < 0 ? 2 * h / (root - p.vy) : (p.vy + root) / WINCH.gravity;
}
/** A point follows a quadratic Y arc and a straight XZ segment: roofs and wall entry times are analytic. */
export function predictProjectile(run: Run, p: Projectile, out: Impact): void {
   const s = run.scratch;
   out.time = Math.min(PARCEL.lifetime, planeTime(p, 0)); out.building = -1; out.roof = true;
   aabbFromCenter(p, ZERO, s.moving);
   s.delta.x = p.vx * PARCEL.lifetime; s.delta.z = p.vz * PARCEL.lifetime;
   for (let i = 0; i < run.city.buildings.length; i++) {
      const b = run.city.buildings[i];
      let t = Infinity, roof = false;
      if (p.y - PARCEL.half >= b.height) {
         const top = planeTime(p, b.height);
         s.projectile.x = p.x; s.projectile.y = p.y - PARCEL.half; s.projectile.z = p.z;
         s.projectile.vx = p.vx; s.projectile.vy = p.vy; s.projectile.vz = p.vz;
         landingPoint(s.projectile, BALLISTICS, b.height, s.point);
         if (s.point.x >= b.box.min.x && s.point.x <= b.box.max.x && s.point.z >= b.box.min.z && s.point.z <= b.box.max.z) { t = top; roof = true; }
      }
      const fraction = sweptAabbXZ(s.moving, s.delta, b.box, s.hit);
      if (fraction !== null) {
         const side = fraction * PARCEL.lifetime;
         const y = p.y - PARCEL.half + p.vy * side - WINCH.gravity * side * side / 2;
         if (y >= 0 && y <= b.height && side < t) { t = side; roof = false; }
      }
      if (t < out.time - 1e-10 || (Math.abs(t - out.time) <= 1e-10 && (out.building < 0 || i < out.building))) { out.time = t; out.building = i; out.roof = roof; }
   }
   for (let axis = 0; axis < 2; axis++) {
      const velocity = axis === 0 ? p.vx : p.vz;
      if (velocity === 0) continue;
      const t = ((velocity > 0 ? CITY.half : -CITY.half) - (axis === 0 ? p.x : p.z)) / velocity;
      if (t >= 0 && t < out.time) { out.time = t; out.building = -1; out.roof = false; }
   }
   flightAt(p, out.time, out); out.y -= PARCEL.half;
   const b = run.city.buildings[run.city.targets[run.completed]];
   const distance = b ? Math.hypot(out.x - b.x, out.z - b.z) : Infinity;
   out.precision = Math.max(0, Math.min(100, Math.floor(100 * (1 - distance / ROUTE.padRadius))));
   out.valid = !!b && out.roof && out.building === run.city.targets[run.completed] && distance <= ROUTE.padRadius && (!run.fragile || out.precision >= PARCEL.fragilePrecision);
}
export function predictDrop(run: Run, out: Impact): void {
   releaseState(run, run.scratch.projectile);
   // predictProjectile uses scratch.projectile for the bottom-centre roof query.
   const p = run.fall;
   if (run.falling) { predictProjectile(run, p, out); return; }
   p.x = run.scratch.projectile.x; p.y = run.scratch.projectile.y; p.z = run.scratch.projectile.z;
   p.vx = run.scratch.projectile.vx; p.vy = run.scratch.projectile.vy; p.vz = run.scratch.projectile.vz;
   predictProjectile(run, p, out);
}
export function releaseParcel(run: Run): void {
   if (!run.attached || run.reason) return;
   releaseState(run, run.fall);
   predictProjectile(run, run.fall, run.impact);
   run.fallAt = run.time; run.falling = true; run.attached = false; run.events.release = true;
   run.loading = 0;
}
function miss(run: Run): void {
   run.attached = false; run.falling = false; run.loading = 0; run.events.miss = true;
   run.swing.x.x = run.swing.x.v = run.swing.z.x = run.swing.z.v = 0;
}
function land(run: Run): void {
   run.falling = false;
   if (!run.impact.valid) { miss(run); return; }
   const points = deliveryPoints(run.impact.precision, run.fragile, run.time - run.pickupAt);
   run.score += points; run.events.score += points; run.events.delivery = true;
   run.battery = Math.min(BATTERY.initial, run.battery + BATTERY.recharge);
   run.completed++; run.loading = 0;
   if (run.completed === ROUTE.count) run.reason = "win";
}
function acceleration(run: Run, time: number, out: { x: number; z: number }): void {
   let x = run.input.dirX, z = run.input.dirZ;
   const magnitude = Math.hypot(x, z); if (magnitude > 1) { x /= magnitude; z /= magnitude; }
   out.x = x * DRONE.accel; out.z = z * DRONE.accel;
   if (time >= WIND.from) for (const w of run.city.winds) if (run.drone.x >= w.x - 4 && run.drone.x < w.x + 4 && run.drone.z >= w.z - 4 && run.drone.z < w.z + 4) { out.x += w.ax; out.z += w.az; }
   const force = Math.hypot(out.x, out.z);
   if (force > DRONE.accel) { out.x *= DRONE.accel / force; out.z *= DRONE.accel / force; }
}
function displacement(run: Run, dt: number): void {
   const s = run.scratch, d = run.drone;
   acceleration(run, run.time, s.acc);
   const decay = Math.exp(-DRONE.drag * dt);
   s.delta.x = d.vx * (1 - decay) / DRONE.drag + s.acc.x / DRONE.drag * (dt - (1 - decay) / DRONE.drag);
   s.delta.z = d.vz * (1 - decay) / DRONE.drag + s.acc.z / DRONE.drag * (dt - (1 - decay) / DRONE.drag);
}
function canLoadAt(run: Run, dt: number): boolean {
   const s = run.scratch, d = run.drone;
   displacement(run, dt);
   const decay = Math.exp(-DRONE.drag * dt);
   const vx = d.vx * decay + s.acc.x / DRONE.drag * (1 - decay), vz = d.vz * decay + s.acc.z / DRONE.drag * (1 - decay);
   return Math.hypot(d.x + s.delta.x, d.z + s.delta.z) <= ROUTE.pickupRadius && Math.hypot(vx, vz) <= ROUTE.pickupSpeed;
}
/** Split played time at entry contacts and loading eligibility crossings, before battery or score changes. */
function physicalBoundary(run: Run, dt: number): number {
   if (!(dt > 1e-8)) return dt;
   const s = run.scratch, d = run.drone;
   let end = dt;
   aabbFromCenter(d, DRONE_HALF, s.moving);
   for (const i of run.city.towers) {
      const b = run.city.buildings[i];
      const distance = distanceToBoxXZ(d.x, d.z, b.box);
      if (distance > DRONE.radius * Math.SQRT2 + DRONE.speed * end + 0.001) continue;
      if (run.contacts[i] && distance <= DRONE.radius + BATTERY.rearm) continue;
      displacement(run, end);
      const t = sweptAabbXZ(s.moving, s.delta, b.box, s.hit);
      if (t === null || t === 0) continue;
      let low = 0, high = end;
      for (let n = 0; n < 30; n++) {
         const mid = (low + high) / 2; displacement(run, mid);
         if (sweptAabbXZ(s.moving, s.delta, b.box, s.hit) === null) low = mid; else high = mid;
      }
      if (high > 1e-8) end = Math.min(end, high);
   }
   if (!run.attached && !run.falling && (run.loading > 0 || Math.hypot(d.x, d.z) <= ROUTE.pickupRadius + DRONE.speed * end)) {
      const start = canLoadAt(run, 0);
      if (start !== canLoadAt(run, end)) {
         let low = 0, high = end;
         for (let n = 0; n < 30; n++) { const mid = (low + high) / 2; if (canLoadAt(run, mid) === start) low = mid; else high = mid; }
         if (high > 1e-8) end = Math.min(end, high);
      }
   }
   return end;
}
function move(run: Run, dt: number): void {
   const d = run.drone, s = run.scratch, oldVX = d.vx, oldVZ = d.vz, oldX = d.x, oldZ = d.z;
   acceleration(run, run.time - dt, s.acc);
   const ax = s.acc.x, az = s.acc.z;
   const decay = Math.exp(-DRONE.drag * dt);
   d.vx = oldVX * decay + ax / DRONE.drag * (1 - decay); d.vz = oldVZ * decay + az / DRONE.drag * (1 - decay);
   const speed = Math.hypot(d.vx, d.vz); if (speed > DRONE.speed) { d.vx *= DRONE.speed / speed; d.vz *= DRONE.speed / speed; }
   s.delta.x = oldVX * (1 - decay) / DRONE.drag + ax / DRONE.drag * (dt - (1 - decay) / DRONE.drag);
   s.delta.z = oldVZ * (1 - decay) / DRONE.drag + az / DRONE.drag * (dt - (1 - decay) / DRONE.drag);
   aabbFromCenter(d, DRONE_HALF, s.moving);
   let earliest = 1, nx = 0, nz = 0, collided = false;
   for (const i of run.city.towers) {
      const b = run.city.buildings[i];
      if (distanceToBoxXZ(d.x, d.z, b.box) > DRONE.radius + BATTERY.rearm) run.contacts[i] = false;
      const t = sweptAabbXZ(s.moving, s.delta, b.box, s.hit);
      if (t === null) continue;
      if (t < earliest || (!collided && t === earliest)) {
         earliest = t; nx = s.hit.normalX; nz = s.hit.normalZ; collided = true;
         if (nx === 0 && nz === 0) {
            const left = Math.abs(d.x - (b.box.min.x - DRONE.radius)), right = Math.abs(d.x - (b.box.max.x + DRONE.radius));
            const north = Math.abs(d.z - (b.box.min.z - DRONE.radius)), south = Math.abs(d.z - (b.box.max.z + DRONE.radius));
            if (Math.min(left, right) <= Math.min(north, south)) nx = left <= right ? -1 : 1;
            else nz = north <= south ? -1 : 1;
         }
      }
      if (!run.contacts[i]) {
         run.contacts[i] = true;
         if (run.time >= BATTERY.grace && run.time - run.damageAt >= BATTERY.cooldown - 1e-10) {
            run.damageAt = run.time; run.battery = Math.max(0, run.battery - BATTERY.damage); run.events.hit = true;
         }
      }
   }
   d.x += s.delta.x * (collided ? Math.max(0, earliest - 1e-7) : 1); d.z += s.delta.z * (collided ? Math.max(0, earliest - 1e-7) : 1);
   if (collided) {
      const inward = d.vx * nx + d.vz * nz;
      if (inward < 0) { d.vx -= (1 + DRONE.restitution) * inward * nx; d.vz -= (1 + DRONE.restitution) * inward * nz; }
      if (nx === 0) d.x += s.delta.x * (1 - earliest);
      if (nz === 0) d.z += s.delta.z * (1 - earliest);
      for (const i of run.city.towers) resolveSphereAabb(d, DRONE.radius, run.city.buildings[i].box, d);
   }
   clampToBounds(d, BOUNDS, DRONE.radius, d);
   if (Math.abs(d.x) >= CITY.half - DRONE.radius && d.vx * d.x > 0) d.vx = 0;
   if (Math.abs(d.z) >= CITY.half - DRONE.radius && d.vz * d.z > 0) d.vz = 0;
   s.acc.x = (d.vx - oldVX) / dt; s.acc.z = (d.vz - oldVZ) / dt;
   const accel = Math.hypot(s.acc.x, s.acc.z); if (accel > DRONE.accel) { s.acc.x *= DRONE.accel / accel; s.acc.z *= DRONE.accel / accel; }
   const ahead = Math.max(1, speed * DRONE.lookahead), inverseSpeed = speed > 0 ? 1 / speed : 0;
   const currentRoof = roofAt(run.city, d.x, d.z);
   const target = Math.min(DRONE.ceiling, Math.max(currentRoof, roofAt(run.city, d.x + d.vx * inverseSpeed * ahead, d.z + d.vz * inverseSpeed * ahead)) + DRONE.altitude);
   spring(run.altitude, target, DRONE.stiffness, -1, dt);
   if (run.altitude.x < currentRoof + DRONE.clearance) { run.altitude.x = currentRoof + DRONE.clearance; run.altitude.v = Math.max(0, run.altitude.v); }
   if (run.altitude.x > DRONE.ceiling) { run.altitude.x = DRONE.ceiling; run.altitude.v = Math.min(0, run.altitude.v); }
   d.y = run.altitude.x;
   if (speed > 0.2) d.heading = turnTowards(d.heading, Math.atan2(d.vx, d.vz), 1 - Math.exp(-DRONE.turn * dt));
   if (run.attached) {
      s.previous.x = oldX + WINCH.length * run.swing.x.x; s.previous.y = d.y - WINCH.length - PARCEL.half; s.previous.z = oldZ + WINCH.length * run.swing.z.x;
      s.acc.x *= WINCH.forcing; s.acc.z *= WINCH.forcing;
      stepWinch(run.swing, run.steady, dt, s.acc);
      run.swingMetrics.seconds += dt;
      if (Math.abs(run.swing.x.x) >= WINCH.angle) run.swingMetrics.clampXSeconds += dt;
      if (Math.abs(run.swing.z.x) >= WINCH.angle) run.swingMetrics.clampZSeconds += dt;
      run.swingMetrics.peakEnergy = Math.max(run.swingMetrics.peakEnergy, winchEnergy(run.swing));
      run.parcel.x = d.x + WINCH.length * run.swing.x.x; run.parcel.y = d.y - WINCH.length - PARCEL.half; run.parcel.z = d.z + WINCH.length * run.swing.z.x;
      aabbFromCenter(s.previous, PARCEL_HALF, s.moving);
      s.delta.x = run.parcel.x - s.previous.x; s.delta.z = run.parcel.z - s.previous.z;
      for (const b of run.city.buildings) if (run.parcel.y - PARCEL.half < b.height && sweptAabbXZ(s.moving, s.delta, b.box, s.hit) !== null) { miss(run); break; }
   }
}
const NORMAL_PENDULUM = { length: WINCH.length, gravity: WINCH.gravity, damping: WINCH.damping };
const STEADY_PENDULUM = { ...NORMAL_PENDULUM, damping: WINCH.steadyDamping };
export function winchEnergy(swing: Pendulum2D): number {
   return 0.5 * (swing.x.v ** 2 + swing.z.v ** 2 + WINCH.gravity / WINCH.length * (swing.x.x ** 2 + swing.z.x ** 2));
}
export function stepWinch(swing: Pendulum2D, steady: boolean, dt: number, acceleration: { x: number; z: number }): void {
   stepPendulum2D(swing, dt, steady ? STEADY_PENDULUM : NORMAL_PENDULUM, acceleration);
   for (let i = 0; i < 2; i++) {
      const axis = i === 0 ? swing.x : swing.z;
      axis.v = Math.max(-WINCH.speed, Math.min(WINCH.speed, axis.v));
      if (Math.abs(axis.x) >= WINCH.angle) { axis.x = Math.sign(axis.x) * WINCH.angle; if (axis.x * axis.v > 0) axis.v = 0; }
   }
}
function birds(run: Run, dt: number): void {
   const count = run.time < PIGEON.middleFrom ? PIGEON.initialCount : run.time < PIGEON.finalFrom ? PIGEON.middleCount : PIGEON.count;
   const s = run.scratch, d = run.drone;
   for (let i = 0; i < run.birds.length; i++) {
      const bird = run.birds[i];
      const oldX = bird.x, oldZ = bird.z;
      pointAt(run.city.birds[i], run.city.birdOffsets[i] + run.time * PIGEON.speed, bird);
      tangentAt(run.city.birds[i], run.city.birdOffsets[i] + run.time * PIGEON.speed, s.tangent);
      bird.yaw = Math.atan2(s.tangent.x, s.tangent.z);
      if (i >= count) continue;
      const distance = Math.hypot(d.x - bird.x, d.z - bird.z);
      if (distance > DRONE.radius + PIGEON.radius + PIGEON.rearm || Math.abs(d.y - bird.y) > PIGEON.heightTolerance + PIGEON.rearm) bird.touching = false;
      s.previous.x = d.x - d.vx * dt; s.previous.y = d.y; s.previous.z = d.z - d.vz * dt;
      aabbFromCenter(s.previous, DRONE_HALF, s.moving);
      s.point.x = oldX; s.point.y = bird.y; s.point.z = oldZ;
      // The reused point-sized AABB is expanded by the bird radius in XZ.
      const b = s.birdBox;
      b.min.x = oldX - PIGEON.radius; b.max.x = oldX + PIGEON.radius; b.min.z = oldZ - PIGEON.radius; b.max.z = oldZ + PIGEON.radius;
      s.delta.x = d.vx * dt - (bird.x - oldX); s.delta.z = d.vz * dt - (bird.z - oldZ);
      if (!bird.touching && Math.abs(d.y - bird.y) <= PIGEON.heightTolerance && sweptAabbXZ(s.moving, s.delta, b, s.hit) !== null) { bird.touching = true; releaseParcel(run); }
   }
}
function warning(run: Run): void {
   if (run.battery > BATTERY.warningRearm) run.warningArmed = true;
   if (run.battery <= BATTERY.warning && run.warningArmed) { run.warningArmed = false; run.events.warning = true; }
}
function advanceSlice(run: Run, requested: number): void {
   let remaining = requested;
   while (remaining > 1e-12 && !run.reason) {
      const loading = !run.attached && !run.falling && Math.hypot(run.drone.x, run.drone.z) <= ROUTE.pickupRadius && Math.hypot(run.drone.vx, run.drone.vz) <= ROUTE.pickupSpeed;
      const loadIn = loading ? Math.max(0, ROUTE.loading - run.loading) : Infinity;
      const landingIn = run.falling ? Math.max(0, run.fallAt + run.impact.time - run.time) : Infinity;
      let dt = Math.min(remaining, run.battery / BATTERY.drain, ROUTE.ceiling - run.time, loadIn, landingIn);
      if (run.time < PIGEON.middleFrom) dt = Math.min(dt, PIGEON.middleFrom - run.time);
      else if (run.time < PIGEON.finalFrom) dt = Math.min(dt, PIGEON.finalFrom - run.time);
      dt = physicalBoundary(run, dt);
      if (dt > 1e-12) {
         run.time += dt; run.battery = Math.max(0, run.battery - dt * BATTERY.drain);
         move(run, dt); birds(run, dt);
         if (loading && !run.attached && !run.falling && Math.hypot(run.drone.x, run.drone.z) <= ROUTE.pickupRadius && Math.hypot(run.drone.vx, run.drone.vz) <= ROUTE.pickupSpeed) run.loading += dt;
         else if (!run.attached && !run.falling) run.loading = 0;
         remaining -= dt;
      }
      // Expiry and ceiling precede any award at the same instant.
      if (run.battery <= 1e-9) { run.battery = 0; run.reason = "lose"; }
      else if (run.time >= ROUTE.ceiling - 1e-9) { run.time = ROUTE.ceiling; run.reason = "timeup"; }
      else if (run.falling && run.time >= run.fallAt + run.impact.time - 1e-9) land(run);
      else if (run.loading >= ROUTE.loading - 1e-9 && !run.attached && !run.falling) {
         run.loading = 0; run.attached = true; run.pickupAt = run.time; run.fragile = run.completed >= PARCEL.fragileFrom;
         run.swing.x.x = run.swing.x.v = run.swing.z.x = run.swing.z.v = 0; run.events.pickup = true;
      } else if (dt <= 1e-12) break;
      warning(run);
   }
}
export function stepRun(run: Run, input: StepInput, dt: number): void {
   const e = run.events;
   e.score = 0; e.pickup = e.release = e.miss = e.hit = e.delivery = e.warning = false;
   if (run.reason || !(dt > 0) || !Number.isFinite(dt)) return;
   run.input.dirX = Number.isFinite(input.dirX) ? input.dirX : 0; run.input.dirZ = Number.isFinite(input.dirZ) ? input.dirZ : 0;
   if (input.drop) releaseParcel(run);
   substep(dt, 1 / 120, run.advance);
   if (run.falling) flightAt(run.fall, run.time - run.fallAt, run.parcel);
   else if (run.attached) {
      run.parcel.x = run.drone.x + WINCH.length * run.swing.x.x; run.parcel.y = run.drone.y - WINCH.length - PARCEL.half; run.parcel.z = run.drone.z + WINCH.length * run.swing.z.x;
      predictDrop(run, run.preview);
   }
}
