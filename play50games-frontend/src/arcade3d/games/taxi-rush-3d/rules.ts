// Taxi Rush 3D. Pure and seeded: one createRun, one step. The street-vehicle integrator lives
// here (docs/menu1-new/specs-31-40.md §32). No Math.random, no Date.now, no three.js.
import { aabbFromCenter, aabbOverlap, resolveSphereAabb, sweptAabbXZ, type AABB, type SweepHit, type Vec3Like } from "@/arcade3d/core/collision";
import { createFixedStep, fixedStep, type FixedStepState } from "@/arcade3d/core/kinematics";
import { createRng } from "@/arcade3d/core/math";
import type { ScoringRules, LevelId } from "@/arcade3d/types";
import type { TaxiLevel } from "./levels";

/**
 * World scale: metres per design unit. The game was designed round a 2.8 m cab; every length, speed and
 * acceleration here is that design times U, so the cab is a real 4.55 m car next to a 1.75 m rider, and a
 * run is the same run in seconds (an exact similarity: the same timings, scores and limit proofs).
 */
export const U = 1.625;
export const BLOCK = 14 * U;
export const STREET = 6 * U;
export const PITCH = BLOCK + STREET;
export const INSET = 0.4 * U;
export const HALF_STREET = STREET / 2;
export const TOP_SPEED = 9 * U;
export const ACCEL = 12 * U;
export const BRAKE = 18 * U;
export const REVERSE = 3 * U;
export const STEER = 2.2;
export const RADIUS = 1.15 * U;
export const DRAG = 0.4 * U;
export const DEAD = 0.2;
export const STRIKE = 3 * U;
export const PAD_R = 2.2 * U;
export const CLOSE_R = 1.2 * U;
export const DWELL_S = 0.5;
export const STOP_SPEED = 0.5 * U;
export const RED_SPEED = 1 * U;
/** One physical hit (wall, car, red light) spends one life, then this lock. Patience ignores it. */
export const HIT_LOCK_S = 0.8;
export const GREEN_S = 4;
export const LIGHT_CYCLE = 8;
export const LIGHT_OFFSET = 1.7;
export const TICK_S = 1 / 120;
export const LIVES = 3;
export const DROP_POINTS = 100;
export const CLOSE_POINTS = 60;
export const CALM_POINTS = 40;
export const TIME_POINTS = 5;
export const CAR_W = 0.7 * U;
export const CAR_L = 1.55 * U;
/** Pads stand at least this far apart. */
export const PAD_SPACING = 16 * U;
const CAR_GAP = CAR_L * 2 + 2.4 * U;
/** Half the paved road between the kerbs; the rest of the street (and the inset) is pavement the cab may still mount. */
export const ROAD_HALF = 3.25;
/** The corner turn's radius: the turn starts on the corner's stop line. */
export const TURN_R = HALF_STREET;
/** A car waits at a red light with its nose on the stop line (its centre this far from the junction centre). */
const STOP_GAP = HALF_STREET + CAR_L + 0.35 * U;

export interface TaxiInput {
   moveX: number;
   moveY: number;
}

export function idleInput(): TaxiInput {
   return { moveX: 0, moveY: 0 };
}

export interface Pad {
   x: number;
   z: number;
   /** vertical street index */
   i: number;
   /** segment starts at this horizontal street */
   j0: number;
}

export interface Car {
   s: number;
   x: number;
   z: number;
   /** heading: the car faces (sin yaw, cos yaw), like the cab */
   yaw: number;
   /** the street axis it is nearest to (0 = along x) and its sense along it */
   axis: 0 | 1;
   dir: 1 | -1;
   /** in a corner turn (0 on a straight, else the turn's progress 0..1) */
   turn: number;
   /** metres driven (wheel spin) */
   odo: number;
   /** current speed (m/s): 0 while it waits */
   v: number;
   hx: number;
   hz: number;
   ox: number;
   oz: number;
   ohx: number;
   ohz: number;
   pin: boolean;
}

export interface TaxiEvent {
   score: number;
   lives: number;
   won: boolean;
   pickup: boolean;
   drop: boolean;
   hit: boolean;
   red: boolean;
   miss: boolean;
   close: boolean;
   calm: boolean;
}

interface Fare { pick: number; drop: number }

/** One centreline segment of the traffic loop, between two junctions. */
interface Seg {
   x0: number;
   z0: number;
   x1: number;
   z1: number;
   len: number;
   s0: number;
   axis: 0 | 1;
   dir: 1 | -1;
}

/** A corner of the loop: its progress s at the corner junction, the lane arc's centre and start angle. */
interface Corner {
   s: number;
   cx: number;
   cz: number;
   a0: number;
}

interface StopLine {
   axis: 0 | 1;
   coord: number;
   span0: number;
   span1: number;
   ns: boolean;
   into: 1 | -1;
   light: number;
}

export interface Run {
   level: TaxiLevel;
   seed: number;
   pads: Pad[];
   fares: Fare[];
   buildings: AABB[];
   lights: { i: number; j: number }[];
   lightAt: Int16Array;
   stops: StopLine[];
   segs: Seg[];
   corners: Corner[];
   loopLength: number;
   cars: Car[];
   fare: number;
   /** 0 pickup, 1 drop-off, 2 no fare */
   phase: 0 | 1 | 2;
   patience: number;
   dwell: number;
   dropoffs: number;
   misses: number;
   x: number;
   z: number;
   yaw: number;
   speed: number;
   time: number;
   lock: number;
   livesLost: number;
   score: number;
   over: "win" | "lose" | null;
   moveX: number;
   moveY: number;
   timeLeft: number;
   clock: FixedStepState;
   tick: (h: number) => void;
   ev: TaxiEvent;
   marker: { x: number; y: number; z: number; hidden: boolean };
   /** 0 idle at the pad, (0, PI) hop, PI hidden while riding */
   hop: number;
   riderX: number;
   riderZ: number;
   width: number;
   depth: number;
   center: Vec3Like;
   boxA: AABB;
   boxB: AABB;
   sweep: SweepHit;
   ahead: { dist: number; x: number; z: number; axis: 0 | 1 };
   delta: { x: number; z: number };
   half: Vec3Like;
}

export function streetX(i: number): number {
   return i * PITCH + HALF_STREET;
}

export function streetZ(j: number): number {
   return j * PITCH + HALF_STREET;
}

export function citySize(level: TaxiLevel): { x: number; z: number } {
   return { x: level.blocksX * PITCH + STREET, z: level.blocksZ * PITCH + STREET };
}

/** North-south is green for the first 4 s of each light's own 8 s cycle. */
export function signalRed(lightIndex: number, time: number, ns: boolean): boolean {
   let phase = (time + lightIndex * LIGHT_OFFSET) % LIGHT_CYCLE;
   if (phase < 0) phase += LIGHT_CYCLE;
   const nsGreen = phase < GREEN_S;
   return ns ? !nsGreen : nsGreen;
}

export function lightIndexAt(run: Run, i: number, j: number): number {
   if (i < 0 || j < 0 || i > run.level.blocksX || j > run.level.blocksZ) return -1;
   return run.lightAt[j * (run.level.blocksX + 1) + i];
}

export function activePad(run: Run): Pad | null {
   if (run.over || run.phase === 2 || run.fare < 0 || run.fare >= run.fares.length) return null;
   const fare = run.fares[run.fare];
   return run.pads[run.phase === 0 ? fare.pick : fare.drop] ?? null;
}

function shuffle(order: number[], rng: () => number): void {
   for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
   }
}

function buildingsOf(level: TaxiLevel): AABB[] {
   const boxes: AABB[] = [];
   for (let r = 0; r < level.blocksZ; r++) {
      for (let c = 0; c < level.blocksX; c++) {
         const x0 = STREET + c * PITCH + INSET;
         const z0 = STREET + r * PITCH + INSET;
         boxes.push({
            min: { x: x0, y: 0, z: z0 },
            max: { x: x0 + BLOCK - INSET * 2, y: 10 * U, z: z0 + BLOCK - INSET * 2 },
         });
      }
   }
   return boxes;
}

function padPool(level: TaxiLevel): Pad[] {
   const pads: Pad[] = [];
   for (let i = 0; i <= level.blocksX; i++) {
      for (let j = 0; j < level.blocksZ; j++) {
         pads.push({ x: streetX(i), z: (streetZ(j) + streetZ(j + 1)) / 2, i, j0: j });
      }
   }
   return pads;
}

function buildFares(pads: Pad[], rides: number, sx: number, sz: number): { pads: Pad[]; fares: Fare[] } {
   const used = new Array<boolean>(pads.length).fill(false);
   const fares: Fare[] = [];
   let x = sx;
   let z = sz;
   const nearest = (x0: number, z0: number) => {
      let best = -1;
      let dist = Infinity;
      for (let i = 0; i < pads.length; i++) {
         if (used[i]) continue;
         const dd = (pads[i].x - x0) * (pads[i].x - x0) + (pads[i].z - z0) * (pads[i].z - z0);
         if (dd < dist - 1e-8 || (Math.abs(dd - dist) <= 1e-8 && (best < 0 || i < best))) {
            dist = dd;
            best = i;
         }
      }
      return best;
   };
   for (let n = 0; n < rides; n++) {
      const pick = nearest(x, z);
      if (pick < 0) break;
      used[pick] = true;
      const drop = nearest(pads[pick].x, pads[pick].z);
      if (drop < 0) break;
      used[drop] = true;
      fares.push({ pick, drop });
      x = pads[drop].x;
      z = pads[drop].z;
   }
   return { pads, fares };
}

/**
 * The traffic loop: the one-way perimeter streets (one lane, on the centreline), clockwise seen from above
 * (+x along the first street, then +z). A car's progress `s` runs along the centrelines through every
 * junction (its timing, gaps and red-light stops are measured there). At each of the four corners it turns
 * on a quarter arc of TURN_R that starts on the corner's stop line: the HALF_STREET of progress either side
 * of the corner junction is spread over the arc, so a car slows through its turn, faces along it and never
 * slides sideways.
 *
 * (A right-hand lane beside the centreline was tried: the careful-driver bot then cleared only 195 / 200
 * seeds on L4 and 184 / 200 on L5, under the proofs' 99 %, so two-lane traffic needs new score proofs.)
 */
function buildLoop(level: TaxiLevel): { segs: Seg[]; corners: Corner[]; loopLength: number } {
   const bx = level.blocksX;
   const bz = level.blocksZ;
   const pts: { x: number; z: number }[] = [];
   for (let i = 0; i <= bx; i++) pts.push({ x: streetX(i), z: streetZ(0) });
   for (let j = 1; j <= bz; j++) pts.push({ x: streetX(bx), z: streetZ(j) });
   for (let i = bx - 1; i >= 0; i--) pts.push({ x: streetX(i), z: streetZ(bz) });
   for (let j = bz - 1; j >= 1; j--) pts.push({ x: streetX(0), z: streetZ(j) });
   const segs: Seg[] = [];
   let acc = 0;
   for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const axis: 0 | 1 = Math.abs(dx) >= Math.abs(dz) ? 0 : 1;
      const dir: 1 | -1 = axis === 0 ? (dx >= 0 ? 1 : -1) : (dz >= 0 ? 1 : -1);
      segs.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, len, s0: acc, axis, dir });
      acc += len;
   }
   // the corners: where a segment's direction differs from the one before it (the turn is always to the right)
   const corners: Corner[] = [];
   for (let i = 0; i < segs.length; i++) {
      const prev = segs[(i + segs.length - 1) % segs.length];
      const seg = segs[i];
      if (prev.axis === seg.axis && prev.dir === seg.dir) continue;
      const inX = prev.axis === 0 ? prev.dir : 0;
      const inZ = prev.axis === 1 ? prev.dir : 0;
      const outX = seg.axis === 0 ? seg.dir : 0;
      const outZ = seg.axis === 1 ? seg.dir : 0;
      // the arc starts TURN_R before the corner junction, its centre to the right of the way in
      const ax = seg.x0 - TURN_R * inX;
      const az = seg.z0 - TURN_R * inZ;
      const rx = -inZ;
      const rz = inX;
      corners.push({ s: seg.s0, cx: ax + TURN_R * rx, cz: az + TURN_R * rz, a0: Math.atan2(-rx, -rz) });
   }
   return { segs, corners, loopLength: acc };
}

/** Place a car at loop progress s: its lane position, heading, nearest axis and the box round its body. */
function placeOnLoop(run: Pick<Run, "segs" | "corners" | "loopLength">, s: number, car: Car): void {
   let d = s % run.loopLength;
   if (d < 0) d += run.loopLength;
   car.turn = 0;
   for (let k = 0; k < run.corners.length; k++) {
      const c = run.corners[k];
      let off = d - c.s;
      if (off > run.loopLength / 2) off -= run.loopLength;
      else if (off < -run.loopLength / 2) off += run.loopLength;
      if (off > -HALF_STREET && off < HALF_STREET) {
         const t = (off + HALF_STREET) / (2 * HALF_STREET);
         const a = c.a0 - t * (Math.PI / 2);
         car.x = c.cx + Math.sin(a) * TURN_R;
         car.z = c.cz + Math.cos(a) * TURN_R;
         car.yaw = a - Math.PI / 2;
         car.turn = Math.max(1e-6, t);
         break;
      }
   }
   if (car.turn === 0) {
      let seg = run.segs[run.segs.length - 1];
      for (let i = 0; i < run.segs.length; i++) {
         if (d <= run.segs[i].s0 + run.segs[i].len) {
            seg = run.segs[i];
            break;
         }
      }
      const t = seg.len > 0 ? Math.min(1, Math.max(0, (d - seg.s0) / seg.len)) : 0;
      car.x = seg.x0 + (seg.x1 - seg.x0) * t;
      car.z = seg.z0 + (seg.z1 - seg.z0) * t;
      car.yaw = Math.atan2(seg.axis === 0 ? seg.dir : 0, seg.axis === 1 ? seg.dir : 0);
   }
   while (car.yaw <= -Math.PI) car.yaw += Math.PI * 2;
   while (car.yaw > Math.PI) car.yaw -= Math.PI * 2;
   const fx = Math.sin(car.yaw);
   const fz = Math.cos(car.yaw);
   const ax = Math.abs(fx);
   const az = Math.abs(fz);
   car.axis = ax >= az ? 0 : 1;
   car.dir = (car.axis === 0 ? fx : fz) >= 0 ? 1 : -1;
   // the box round the turned body (exact on the straights)
   car.hx = ax * CAR_L + az * CAR_W;
   car.hz = az * CAR_L + ax * CAR_W;
}

function distToNext(segs: Seg[], loopLength: number, s: number, out: Run["ahead"]): void {
   let d = s % loopLength;
   if (d < 0) d += loopLength;
   for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (d <= seg.len || i === segs.length - 1) {
         out.dist = Math.max(0, seg.len - d);
         out.x = seg.x1;
         out.z = seg.z1;
         out.axis = seg.axis;
         return;
      }
      d -= seg.len;
   }
   out.dist = 0;
   out.x = segs[0].x0;
   out.z = segs[0].z0;
   out.axis = segs[0].axis;
}

function freshEvent(): TaxiEvent {
   return { score: 0, lives: 0, won: false, pickup: false, drop: false, hit: false, red: false, miss: false, close: false, calm: false };
}

export function createRun(seed: number, level: TaxiLevel): Run {
   const rng = createRng(seed >>> 0);
   const size = citySize(level);
   const sx = streetX(0);
   const sz = streetZ(0);
   const pool = padPool(level);
   const order = pool.map((_, i) => i);
   shuffle(order, rng);
   const chosen = order.slice(0, level.rides * 2).map((i) => pool[i]);
   const built = buildFares(chosen, level.rides, sx, sz);
   const nodes: { i: number; j: number }[] = [];
   for (let j = 0; j <= level.blocksZ; j++) {
      for (let i = 0; i <= level.blocksX; i++) nodes.push({ i, j });
   }
   const nodeOrder = nodes.map((_, i) => i);
   shuffle(nodeOrder, rng);
   const lights = nodeOrder.slice(0, level.lights).map((i) => nodes[i]);
   const stride = level.blocksX + 1;
   const lightAt = new Int16Array(stride * (level.blocksZ + 1)).fill(-1);
   const stops: StopLine[] = [];
   for (let n = 0; n < lights.length; n++) {
      const light = lights[n];
      lightAt[light.j * stride + light.i] = n;
      const cx = streetX(light.i);
      const cz = streetZ(light.j);
      const h = HALF_STREET;
      stops.push({ axis: 1, coord: cz - h, span0: cx - h, span1: cx + h, ns: true, into: 1, light: n });
      stops.push({ axis: 1, coord: cz + h, span0: cx - h, span1: cx + h, ns: true, into: -1, light: n });
      stops.push({ axis: 0, coord: cx - h, span0: cz - h, span1: cz + h, ns: false, into: 1, light: n });
      stops.push({ axis: 0, coord: cx + h, span0: cz - h, span1: cz + h, ns: false, into: -1, light: n });
   }
   const loop = buildLoop(level);
   const run: Run = {
      level,
      seed,
      pads: built.pads,
      fares: built.fares,
      buildings: buildingsOf(level),
      lights,
      lightAt,
      stops,
      segs: loop.segs,
      corners: loop.corners,
      loopLength: loop.loopLength,
      cars: [],
      fare: 0,
      phase: 0,
      patience: 1,
      dwell: 0,
      dropoffs: 0,
      misses: 0,
      x: sx,
      z: sz,
      yaw: 0,
      speed: 0,
      time: 0,
      lock: 0,
      livesLost: 0,
      score: 0,
      over: null,
      moveX: 0,
      moveY: 0,
      timeLeft: level.durationMs,
      clock: createFixedStep(TICK_S),
      tick: () => {},
      ev: freshEvent(),
      marker: { x: 0, y: 0.45 * U, z: 0, hidden: false },
      hop: 0,
      riderX: 0,
      riderZ: 0,
      width: size.x,
      depth: size.z,
      center: { x: 0, y: 0, z: 0 },
      boxA: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      boxB: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      sweep: { time: 0, normalX: 0, normalZ: 0 },
      ahead: { dist: 0, x: 0, z: 0, axis: 0 },
      delta: { x: 0, z: 0 },
      half: { x: RADIUS, y: 1, z: RADIUS },
   };
   run.tick = (h) => integrate(run, h);
   const count = level.traffic;
   for (let k = 0; k < count; k++) {
      const car: Car = {
         s: ((k + 0.35 + rng() * 0.3) / count) * loop.loopLength,
         x: 0, z: 0, yaw: 0, axis: 0, dir: 1, turn: 0, odo: 0, v: 0, hx: CAR_W, hz: CAR_L, ox: 0, oz: 0, ohx: CAR_W, ohz: CAR_L, pin: false,
      };
      placeOnLoop(run, car.s, car);
      car.ox = car.x;
      car.oz = car.z;
      car.ohx = car.hx;
      car.ohz = car.hz;
      run.cars.push(car);
   }
   const pad = activePad(run);
   if (pad) {
      run.marker.x = pad.x;
      run.marker.z = pad.z;
      run.riderX = pad.x;
      run.riderZ = pad.z;
   }
   return run;
}

function spendLife(run: Run, kind: "hit" | "red" | "miss"): void {
   if (run.over) return;
   if (kind !== "miss" && run.lock > 0) return;
   if (kind !== "miss") run.lock = HIT_LOCK_S;
   if (kind === "hit") run.ev.hit = true;
   if (kind === "red") run.ev.red = true;
   if (kind === "miss") run.ev.miss = true;
   run.livesLost += 1;
   run.ev.lives += 1;
   if (run.livesLost >= LIVES) {
      run.over = "lose";
      run.phase = 2;
   }
}

function advanceFare(run: Run): void {
   run.fare += 1;
   run.dwell = 0;
   run.hop = 0;
   if (run.fare >= run.fares.length) {
      run.phase = 2;
      return;
   }
   run.phase = 0;
   run.patience = 1;
   const pad = run.pads[run.fares[run.fare].pick];
   run.riderX = pad.x;
   run.riderZ = pad.z;
}

function missFare(run: Run): void {
   run.patience = 0;
   run.misses += 1;
   run.dwell = 0;
   spendLife(run, "miss");
   if (run.over) return;
   advanceFare(run);
}

function completeStop(run: Run): void {
   const pad = activePad(run);
   if (!pad || run.over) return;
   if (run.phase === 0) {
      run.phase = 1;
      run.dwell = 0;
      run.hop = 0.0001;
      run.ev.pickup = true;
      return;
   }
   const dist = Math.hypot(run.x - pad.x, run.z - pad.z);
   let add = DROP_POINTS;
   if (dist <= CLOSE_R) {
      add += CLOSE_POINTS;
      run.ev.close = true;
   }
   if (run.patience > 0.5) {
      add += CALM_POINTS;
      run.ev.calm = true;
   }
   run.score += add;
   run.ev.score += add;
   run.ev.drop = true;
   run.dropoffs += 1;
   run.dwell = 0;
   if (run.dropoffs >= run.level.rides) {
      const bonus = TIME_POINTS * Math.floor(run.timeLeft / 1000);
      if (bonus > 0) {
         run.score += bonus;
         run.ev.score += bonus;
      }
      run.ev.won = true;
      run.over = "win";
      run.phase = 2;
      return;
   }
   advanceFare(run);
}

function driveCab(run: Run, h: number): void {
   const y = run.moveY;
   let speed = run.speed;
   if (y < -DEAD) speed += ACCEL * h;
   else if (y > DEAD) speed -= BRAKE * h;
   else if (speed !== 0) {
      const next = speed - Math.sign(speed) * DRAG * h;
      speed = next * speed < 0 ? 0 : next;
   }
   if (speed > TOP_SPEED) speed = TOP_SPEED;
   else if (speed < -REVERSE) speed = -REVERSE;
   run.speed = speed;
   const raw = Math.abs(speed) / (2 * U);
   const scale = raw < 0.35 ? 0.35 : raw > 1 ? 1 : raw;
   // the cab faces (sin yaw, cos yaw) and a growing yaw turns it towards +x, which is the
   // driver's LEFT (three.js is right-handed, y up): so right on the stick (moveX > 0) lowers the yaw
   run.yaw -= run.moveX * STEER * scale * h;
   if (run.yaw > Math.PI) run.yaw -= Math.PI * 2;
   else if (run.yaw < -Math.PI) run.yaw += Math.PI * 2;
   run.x += Math.sin(run.yaw) * speed * h;
   run.z += Math.cos(run.yaw) * speed * h;
}

function pushWalls(run: Run): boolean {
   let hit = false;
   const c = run.center;
   for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < run.buildings.length; i++) {
         c.x = run.x;
         c.y = 0;
         c.z = run.z;
         resolveSphereAabb(c, RADIUS, run.buildings[i], c);
         if (c.x !== run.x || c.z !== run.z) {
            hit = true;
            run.x = c.x;
            run.z = c.z;
         }
      }
   }
   const maxX = run.width - RADIUS;
   const maxZ = run.depth - RADIUS;
   if (run.x < RADIUS) { run.x = RADIUS; hit = true; }
   else if (run.x > maxX) { run.x = maxX; hit = true; }
   if (run.z < RADIUS) { run.z = RADIUS; hit = true; }
   else if (run.z > maxZ) { run.z = maxZ; hit = true; }
   return hit;
}

function moveCars(run: Run, h: number): void {
   const cabX = Math.sin(run.yaw);
   const cabZ = Math.cos(run.yaw);
   for (let i = 0; i < run.cars.length; i++) {
      const car = run.cars[i];
      car.ox = car.x;
      car.oz = car.z;
      car.ohx = car.hx;
      car.ohz = car.hz;
      if (car.pin) continue;
      let cruise = run.level.trafficSpeed;
      // a red light at the next junction: wait with the nose on the stop line
      const ahead = run.ahead;
      distToNext(run.segs, run.loopLength, car.s, ahead);
      const light = lightIndexAt(run, Math.round((ahead.x - HALF_STREET) / PITCH), Math.round((ahead.z - HALF_STREET) / PITCH));
      if (light >= 0 && signalRed(light, run.time, ahead.axis === 1) && ahead.dist <= STOP_GAP && ahead.dist >= 0.45 * U) cruise = 0;
      let gap = Infinity;
      for (let k = 0; k < run.cars.length; k++) {
         if (k === i || run.cars[k].pin) continue;
         let g = run.cars[k].s - car.s;
         if (g < 0) g += run.loopLength;
         if (g < gap) gap = g;
      }
      if (gap < CAR_GAP) cruise = 0;
      // the cab ahead in its lane, going its way or stopped: wait behind it
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      const rx = run.x - car.x;
      const rz = run.z - car.z;
      const taxiLateral = Math.abs(rx * fz - rz * fx);
      const taxiAhead = rx * fx + rz * fz;
      const sameWay = cabX * fx + cabZ * fz > 0.2;
      const parked = Math.abs(run.speed) < 0.8 * U;
      if ((sameWay || parked) && taxiLateral < 1.8 * U && taxiAhead > -0.4 * U && taxiAhead < CAR_GAP) cruise = 0;
      car.v = cruise;
      car.s += cruise * h;
      car.odo += cruise * h;
      if (car.s >= run.loopLength) car.s -= run.loopLength;
      placeOnLoop(run, car.s, car);
   }
}

function hitCars(run: Run, x0: number, z0: number): void {
   const cdx = run.x - x0;
   const cdz = run.z - z0;
   run.center.x = x0;
   run.center.y = 0;
   run.center.z = z0;
   for (let i = 0; i < run.cars.length; i++) {
      const car = run.cars[i];
      aabbFromCenter(run.center, run.half, run.boxA);
      run.half.x = car.ohx;
      run.half.z = car.ohz;
      run.center.x = car.ox;
      run.center.z = car.oz;
      aabbFromCenter(run.center, run.half, run.boxB);
      run.half.x = RADIUS;
      run.half.z = RADIUS;
      run.center.x = x0;
      run.center.z = z0;
      run.delta.x = cdx - (car.x - car.ox);
      run.delta.z = cdz - (car.z - car.oz);
      const t = sweptAabbXZ(run.boxA, run.delta, run.boxB, run.sweep);
      if (t === null) continue;
      if (Math.abs(run.speed) > STRIKE) {
         run.x = x0 + cdx * t + run.sweep.normalX * 0.05 * U;
         run.z = z0 + cdz * t + run.sweep.normalZ * 0.05 * U;
         spendLife(run, "hit");
         run.speed *= -0.3;
      } else {
         const push = car.axis === 1 ? (run.x >= car.ox ? 1 : -1) : 0;
         const pushZ = car.axis === 0 ? (run.z >= car.oz ? 1 : -1) : 0;
         run.x += push * 0.18 * U;
         run.z += pushZ * 0.18 * U;
         if (Math.abs(run.speed) > 0.2 * U) run.speed *= 0.35;
      }
      return;
   }
}

function checkLights(run: Run, x0: number, z0: number, h: number): void {
   if (run.over || Math.abs(run.speed) <= RED_SPEED) return;
   const x1 = run.x;
   const z1 = run.z;
   for (let i = 0; i < run.stops.length; i++) {
      const stop = run.stops[i];
      const a0 = stop.axis === 0 ? x0 : z0;
      const a1 = stop.axis === 0 ? x1 : z1;
      const b0 = stop.axis === 0 ? z0 : x0;
      const b1 = stop.axis === 0 ? z1 : x1;
      if ((a0 - stop.coord) * stop.into >= 0 || (a1 - stop.coord) * stop.into < 0) continue;
      const denom = a1 - a0;
      const frac = denom === 0 ? 0 : (stop.coord - a0) / denom;
      const span = b0 + (b1 - b0) * frac;
      if (span < stop.span0 - 0.05 * U || span > stop.span1 + 0.05 * U) continue;
      if (!signalRed(stop.light, run.time + h * frac, stop.ns)) continue;
      spendLife(run, "red");
      return;
   }
}

function integrate(run: Run, h: number): void {
   if (run.over) return;
   if (run.lock > 0) run.lock = Math.max(0, run.lock - h);
   const x0 = run.x;
   const z0 = run.z;
   driveCab(run, h);
   const bumped = pushWalls(run);
   if (bumped && Math.abs(run.speed) > STRIKE) {
      spendLife(run, "hit");
      run.speed *= -0.3;
   } else if (bumped && Math.abs(run.speed) > 0.3 * U) {
      run.speed *= 0.2;
   }
   moveCars(run, h);
   if (!run.over) hitCars(run, x0, z0);
   if (!run.over) checkLights(run, x0, z0, h);
   if (!run.over && run.phase !== 2) {
      run.patience -= run.level.patienceDrain * h;
      if (run.patience <= 0) missFare(run);
      else {
         const pad = activePad(run);
         const inside = !!pad && Math.hypot(run.x - pad.x, run.z - pad.z) <= PAD_R && Math.abs(run.speed) < STOP_SPEED;
         run.dwell = inside ? run.dwell + h : 0;
         if (run.dwell >= DWELL_S) completeStop(run);
      }
   }
   run.time += h;
}

function clearEvent(ev: TaxiEvent): void {
   ev.score = 0;
   ev.lives = 0;
   ev.won = false;
   ev.pickup = false;
   ev.drop = false;
   ev.hit = false;
   ev.red = false;
   ev.miss = false;
   ev.close = false;
   ev.calm = false;
}

export function step(run: Run, input: TaxiInput, dt: number, timeLeftMs: number): TaxiEvent {
   clearEvent(run.ev);
   run.moveX = input.moveX;
   run.moveY = input.moveY;
   run.timeLeft = timeLeftMs;
   if (!run.over && dt > 0) fixedStep(run.clock, dt, run.tick);
   if (run.hop > 0 && run.hop < Math.PI) run.hop = Math.min(Math.PI, run.hop + dt * (Math.PI / 0.45));
   const pad = activePad(run);
   if (pad && !run.over) {
      run.marker.x = pad.x;
      run.marker.z = pad.z;
      run.marker.hidden = false;
   } else run.marker.hidden = true;
   return run.ev;
}

/** Every street node is reachable, and every pad sits on a centreline at least PAD_SPACING from the others. */
export function padsReachable(run: Run): boolean {
   const w = run.level.blocksX + 1;
   const h = run.level.blocksZ + 1;
   const seen = new Uint8Array(w * h);
   const queue = [0];
   seen[0] = 1;
   let qi = 0;
   while (qi < queue.length) {
      const k = queue[qi++];
      const i = k % w;
      const j = (k / w) | 0;
      if (i + 1 <= run.level.blocksX && !seen[k + 1]) { seen[k + 1] = 1; queue.push(k + 1); }
      if (i - 1 >= 0 && !seen[k - 1]) { seen[k - 1] = 1; queue.push(k - 1); }
      if (j + 1 <= run.level.blocksZ && !seen[k + w]) { seen[k + w] = 1; queue.push(k + w); }
      if (j - 1 >= 0 && !seen[k - w]) { seen[k - w] = 1; queue.push(k - w); }
   }
   if (queue.length !== w * h) return false;
   if (run.fares.length !== run.level.rides) return false;
   for (let a = 0; a < run.pads.length; a++) {
      const pad = run.pads[a];
      if (!seen[pad.j0 * w + pad.i] || !seen[(pad.j0 + 1) * w + pad.i]) return false;
      for (let b = 0; b < run.buildings.length; b++) {
         const box = run.buildings[b];
         if (pad.x >= box.min.x && pad.x <= box.max.x && pad.z >= box.min.z && pad.z <= box.max.z) return false;
      }
      for (let b = a + 1; b < run.pads.length; b++) {
         if (Math.hypot(pad.x - run.pads[b].x, pad.z - run.pads[b].z) < PAD_SPACING) return false;
      }
   }
   return true;
}

/** Cars stay on their lane loop, so their body (the turned rectangle, corners included) never enters a building. */
export function carsClearBuildings(run: Run): boolean {
   const car: Car = {
      s: 0, x: 0, z: 0, yaw: 0, axis: 0, dir: 1, turn: 0, odo: 0, v: 0, hx: CAR_W, hz: CAR_L, ox: 0, oz: 0, ohx: CAR_W, ohz: CAR_L, pin: false,
   };
   const box: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
   for (let i = 0; i < run.segs.length; i++) {
      const seg = run.segs[i];
      const steps = Math.max(1, Math.ceil(seg.len / 0.5));
      for (let s = 0; s <= steps; s++) {
         placeOnLoop(run, seg.s0 + (seg.len * s) / steps, car);
         aabbFromCenter({ x: car.x, y: 1, z: car.z }, { x: car.hx, y: 1, z: car.hz }, box);
         for (let b = 0; b < run.buildings.length; b++) {
            if (aabbOverlap(box, run.buildings[b]) && bodyHitsBox(car, run.buildings[b])) return false;
         }
      }
   }
   return true;
}

/** Separating axes: the car's turned body rectangle against an axis-aligned box (ground plane). */
function bodyHitsBox(car: Car, box: AABB): boolean {
   const fx = Math.sin(car.yaw);
   const fz = Math.cos(car.yaw);
   const bx = (box.max.x - box.min.x) / 2;
   const bz = (box.max.z - box.min.z) / 2;
   const dx = (box.min.x + box.max.x) / 2 - car.x;
   const dz = (box.min.z + box.max.z) / 2 - car.z;
   // the box's axes
   if (Math.abs(dx) > bx + Math.abs(fx) * CAR_L + Math.abs(fz) * CAR_W) return false;
   if (Math.abs(dz) > bz + Math.abs(fz) * CAR_L + Math.abs(fx) * CAR_W) return false;
   // the car's axes (forward, side)
   if (Math.abs(dx * fx + dz * fz) > CAR_L + bx * Math.abs(fx) + bz * Math.abs(fz)) return false;
   if (Math.abs(dx * fz - dz * fx) > CAR_W + bx * Math.abs(fz) + bz * Math.abs(fx)) return false;
   return true;
}

/** Where a car will be after travelling `extra` metres along its loop. Restores the car. */
export function carPoint(run: Run, index: number, extra: number, out: { x: number; z: number }): void {
   const car = run.cars[index];
   const saved = car.s;
   placeOnLoop(run, saved + extra, car);
   out.x = car.x;
   out.z = car.z;
   car.s = saved;
   placeOnLoop(run, saved, car);
}

const POINTS = { kind: "points", unitLabel: "pts", display: "int", minDurationMs: 4000 } as const;

/** Bobj = 200 per fare (+100 drop-off, +60 close stop, +40 calm fare), each fare pays once. */
export function objectiveCeiling(rides: number): number {
   return (DROP_POINTS + CLOSE_POINTS + CALM_POINTS) * rides;
}

/** The earliest win each proof assumes (s): 0.8 x the fastest oracle / honest win over 200 seeds (tests pin it). */
export const PROOF_EARLIEST_WIN_S: Record<LevelId, number> = { 1: 31.5, 2: 39.14, 3: 58.51, 4: 71.18, 5: 103.42 };

/**
 * Per level (README "Server limits and why they hold"): base = Bobj; the time bonus 5 * floor(D - t) is
 * paid only on the win, largest at the earliest win M, so maxScore >= Bobj + 5 floor(D - M) and
 * pps >= 5 (D / M - 1). A lost or timed-out run holds at most Bobj = base. maxDurationMs is the clock.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 600, D 120 s, M 31.5 s → peak 1040; pps 14.05 */
   1: { ...POINTS, maxScore: 1075, maxDurationMs: 120_000, base: 600, maxPointsPerSec: 15 },
   /** L2: Bobj 800, D 150 s, M 39.14 s → peak 1350; pps 14.16 */
   2: { ...POINTS, maxScore: 1390, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 15 },
   /** L3: Bobj 1000, D 180 s, M 58.51 s → peak 1605; pps 10.38 */
   3: { ...POINTS, maxScore: 1655, maxDurationMs: 180_000, base: 1000, maxPointsPerSec: 11 },
   /** L4: Bobj 1200, D 210 s, M 71.18 s → peak 1890; pps 9.75 */
   4: { ...POINTS, maxScore: 1950, maxDurationMs: 210_000, base: 1200, maxPointsPerSec: 10 },
   /** L5: Bobj 1600, D 250 s, M 103.42 s → peak 2330; pps 7.09 */
   5: { ...POINTS, maxScore: 2400, maxDurationMs: 250_000, base: 1600, maxPointsPerSec: 8 },
};
