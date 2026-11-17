// Test-only bots for Taxi Rush 3D (never imported by runtime code). They drive the real rules through a
// fresh store exactly like the canvas (advanceRunClock + playedFrameDt) and the Scene's store calls.
//
// The driver: a street-graph route (BFS over the junctions) drawn as a lane polyline (centre of the
// inner streets; on the perimeter loop, where the cars run on the centreline, a lane 2.0 m to the city's
// inside, clear of the cars), pure pursuit on it, and a speed plan: corners at a speed the cab turns at,
// red stop lines crossed under 1 m/s, near cars and the final pad approach under the strike speed.
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import {
   CAR_L,
   CAR_W,
   HALF_STREET,
   LIVES,
   PITCH,
   RADIUS,
   RED_SPEED,
   TOP_SPEED,
   U,
   activePad,
   createRun,
   idleInput,
   signalRed,
   step,
   streetX,
   streetZ,
   type Run,
   type TaxiInput,
} from "../rules";

export type Style = "oracle" | "human" | "idle" | "spam";

const wrap = (a: number) => {
   let v = a;
   while (v > Math.PI) v -= Math.PI * 2;
   while (v < -Math.PI) v += Math.PI * 2;
   return v;
};
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

interface Node {
   i: number;
   j: number;
}

/** The junction nearest to (x, z). */
function nodeOf(run: Run, x: number, z: number): Node {
   let best = Infinity;
   let out = { i: 0, j: 0 };
   for (let j = 0; j <= run.level.blocksZ; j++) {
      for (let i = 0; i <= run.level.blocksX; i++) {
         const d = (streetX(i) - x) ** 2 + (streetZ(j) - z) ** 2;
         if (d < best) {
            best = d;
            out = { i, j };
         }
      }
   }
   return out;
}

/** May the cab drive from junction a to its neighbour b? The perimeter loop is one-way, with the cars. */
export function edgeOpen(run: Run, a: Node, b: Node): boolean {
   const bx = run.level.blocksX;
   const bz = run.level.blocksZ;
   if (a.j === b.j && (a.j === 0 || a.j === bz)) return a.j === 0 ? b.i === a.i + 1 : b.i === a.i - 1;
   if (a.i === b.i && (a.i === 0 || a.i === bx)) return a.i === bx ? b.j === a.j + 1 : b.j === a.j - 1;
   return true;
}

function bfs(run: Run, a: Node, b: Node): Node[] {
   const w = run.level.blocksX + 1;
   const prev = new Int32Array(w * (run.level.blocksZ + 1)).fill(-1);
   const start = a.j * w + a.i;
   const goal = b.j * w + b.i;
   prev[start] = -2;
   const queue = [start];
   for (let q = 0; q < queue.length; q++) {
      const k = queue[q];
      if (k === goal) break;
      const i = k % w;
      const j = (k / w) | 0;
      for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
         if (ni < 0 || nj < 0 || ni > run.level.blocksX || nj > run.level.blocksZ) continue;
         const nk = nj * w + ni;
         if (prev[nk] !== -1 || !edgeOpen(run, { i, j }, { i: ni, j: nj })) continue;
         prev[nk] = k;
         queue.push(nk);
      }
   }
   if (prev[goal] === -1) return [b];
   const path: Node[] = [];
   for (let k = goal; k !== -2 && k >= 0; k = prev[k]) path.push({ i: k % w, j: (k / w) | 0 });
   return path.reverse();
}

/** Lane offset of a street (perimeter streets: to the city's inside; inner streets: the centre). */
function laneX(run: Run, i: number): number {
   if (i === 0) return streetX(0) + LANE;
   if (i === run.level.blocksX) return streetX(i) - LANE;
   return streetX(i);
}
function laneZ(run: Run, j: number): number {
   if (j === 0) return streetZ(0) + LANE;
   if (j === run.level.blocksZ) return streetZ(j) - LANE;
   return streetZ(j);
}
const LANE = 0;

interface Plan {
   pts: { x: number; z: number; corner: boolean }[];
   key: string;
}

/** The lane polyline from the cab to the active pad. */
function planRoute(run: Run): Plan | null {
   const pad = activePad(run);
   if (!pad) return null;
   const here = startNode(run);
   const bx = run.level.blocksX;
   // the pad's leg: on a one-way perimeter street only from its upstream junction
   const ends: Node[] = pad.i === bx ? [{ i: pad.i, j: pad.j0 }] : pad.i === 0 ? [{ i: 0, j: pad.j0 + 1 }] : [{ i: pad.i, j: pad.j0 }, { i: pad.i, j: pad.j0 + 1 }];
   let nodes: Node[] = [];
   let bestLen = Infinity;
   for (const end of ends) {
      const path = bfs(run, here, end);
      let len = 0;
      for (let k = 1; k < path.length; k++) len += PITCH;
      len += Math.hypot(streetX(end.i) - pad.x, streetZ(end.j) - pad.z) + Math.hypot(streetX(here.i) - run.x, streetZ(here.j) - run.z);
      if (len < bestLen) {
         bestLen = len;
         nodes = path;
      }
   }
   const pts: Plan["pts"] = [];
   // each junction: the lane of the vertical leg gives x, the lane of the horizontal leg gives z
   for (let k = 0; k < nodes.length; k++) {
      const n = nodes[k];
      const prev = k > 0 ? nodes[k - 1] : null;
      const next = k + 1 < nodes.length ? nodes[k + 1] : null;
      const inVertical = prev ? prev.i === n.i : null;
      const outVertical = next ? next.i === n.i : true; // the last leg runs along the pad's vertical street
      const vertical = outVertical || inVertical === true;
      const horizontal = !outVertical || inVertical === false;
      pts.push({ x: vertical ? laneX(run, n.i) : streetX(n.i), z: horizontal ? laneZ(run, n.j) : streetZ(n.j), corner: inVertical !== null && inVertical !== outVertical });
   }
   pts.push({ x: pad.x, z: pad.z, corner: false });
   return { pts, key: `${run.fare}:${run.phase}:${nodes.map((n) => `${n.i},${n.j}`).join(";")}` };
}

/** The junction to plan from: the nearest one, or on a one-way perimeter street the one ahead with the flow. */
function startNode(run: Run): Node {
   const n = nodeOf(run, run.x, run.z);
   const bx = run.level.blocksX;
   const bz = run.level.blocksZ;
   const onRow = (j: number) => Math.abs(run.z - streetZ(j)) < HALF_STREET + 0.4 * U;
   const onCol = (i: number) => Math.abs(run.x - streetX(i)) < HALF_STREET + 0.4 * U;
   const nearNode = Math.hypot(streetX(n.i) - run.x, streetZ(n.j) - run.z) < HALF_STREET + 0.5 * U;
   if (nearNode) return n;
   if (onRow(0)) return { i: Math.min(bx, Math.floor((run.x - HALF_STREET) / PITCH) + 1), j: 0 };
   if (onRow(bz)) return { i: Math.max(0, Math.ceil((run.x - HALF_STREET) / PITCH) - 1), j: bz };
   if (onCol(bx)) return { i: bx, j: Math.min(bz, Math.floor((run.z - HALF_STREET) / PITCH) + 1) };
   if (onCol(0)) return { i: 0, j: Math.max(0, Math.ceil((run.z - HALF_STREET) / PITCH) - 1) };
   return n;
}

/** Distance along the cab's heading to the first building (grown by the radius) or the city edge. */
function rayToWalls(run: Run, fx: number, fz: number): number {
   let best = 60 * U;
   const slab = (o: number, d: number, lo: number, hi: number): [number, number] => {
      if (Math.abs(d) < 1e-9) return o >= lo && o <= hi ? [-Infinity, Infinity] : [Infinity, -Infinity];
      const a = (lo - o) / d;
      const b = (hi - o) / d;
      return a < b ? [a, b] : [b, a];
   };
   for (const box of run.buildings) {
      const [x0, x1] = slab(run.x, fx, box.min.x - RADIUS, box.max.x + RADIUS);
      const [z0, z1] = slab(run.z, fz, box.min.z - RADIUS, box.max.z + RADIUS);
      const tin = Math.max(x0, z0);
      const tout = Math.min(x1, z1);
      if (tin <= tout && tout > 0) best = Math.min(best, Math.max(0, tin));
   }
   if (fx > 1e-6) best = Math.min(best, (run.width - RADIUS - run.x) / fx);
   if (fx < -1e-6) best = Math.min(best, (RADIUS - run.x) / fx);
   if (fz > 1e-6) best = Math.min(best, (run.depth - RADIUS - run.z) / fz);
   if (fz < -1e-6) best = Math.min(best, (RADIUS - run.z) / fz);
   return best;
}

/** The cab is more than 6 m from the leg it is driving: plan again. */
function offRoute(run: Run, mem: Memory): boolean {
   if (!mem.plan) return true;
   const pts = mem.plan.pts;
   const b = pts[mem.seg];
   if (mem.seg === 0) return Math.hypot(b.x - run.x, b.z - run.z) > 30 * U;
   const a = pts[mem.seg - 1];
   const lx = b.x - a.x;
   const lz = b.z - a.z;
   const l2 = lx * lx + lz * lz || 1;
   const t = clamp(((run.x - a.x) * lx + (run.z - a.z) * lz) / l2, 0, 1);
   return Math.hypot(a.x + lx * t - run.x, a.z + lz * t - run.z) > 6 * U;
}

interface Memory {
   plan: Plan | null;
   seg: number;
   stuck: number;
   backUp: number;
}

function drive(run: Run, input: TaxiInput, dt: number, style: Style, rng: () => number, mem: Memory): void {
   input.moveX = 0;
   input.moveY = 0;
   if (style === "idle" || run.over || run.phase === 2) return;
   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() > 0.4 ? -1 : 1;
      return;
   }
   const oracle = style === "oracle";
   const pad = activePad(run);
   if (!pad) return;
   const key = `${run.fare}:${run.phase}`;
   // on the pad's own street segment: straight for the pad
   const onPadLeg = Math.abs(run.x - pad.x) < HALF_STREET + 0.4 * U && Math.abs(run.z - pad.z) < PITCH / 2 + 0.5 * U;
   if (onPadLeg) {
      if (!mem.plan || mem.plan.key !== `${key}:pad`) {
         mem.plan = { pts: [{ x: pad.x, z: pad.z, corner: false }], key: `${key}:pad` };
         mem.seg = 0;
      }
   } else if (!mem.plan || !mem.plan.key.startsWith(key) || mem.plan.key.endsWith(":pad") || offRoute(run, mem)) {
      const plan = planRoute(run);
      if (!plan) return;
      mem.plan = { pts: plan.pts, key };
      mem.seg = 0;
   }
   const pts = mem.plan.pts;
   // advance along the polyline: pass a point once the cab is past it along its leg
   while (mem.seg < pts.length - 1) {
      const a = mem.seg === 0 ? { x: run.x, z: run.z } : pts[mem.seg - 1];
      const b = pts[mem.seg];
      const lx = b.x - a.x;
      const lz = b.z - a.z;
      const l = Math.hypot(lx, lz) || 1;
      const ahead = ((b.x - run.x) * lx + (b.z - run.z) * lz) / l;
      if (ahead < (b.corner ? 1.2 : 0.6) * U || Math.hypot(b.x - run.x, b.z - run.z) < 1.0 * U) mem.seg++;
      else break;
   }
   const fx = Math.sin(run.yaw);
   const fz = Math.cos(run.yaw);
   let target = pts[mem.seg];
   // a car ahead coming the other way (or parked across our way) in this street: pass it on the city's
   // inside, 2.05 m off the centreline (its body 0.7 + the cab 1.15 + air), slowly
   let passing = false;
   for (const car of run.cars) {
      const dx = car.x - run.x;
      const dz = car.z - run.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      const facing = car.axis === 1 ? car.dir * fz < 0.2 : car.dir * fx < 0.2;
      if (along > -1 * U && along < 14 * U && side < 2.0 * U && facing) passing = true;
   }
   if (passing) {
      const vertical = Math.abs(fz) >= Math.abs(fx);
      if (vertical) {
         const i = Math.round((run.x - HALF_STREET) / PITCH);
         const inside = i === 0 ? 1 : i === run.level.blocksX ? -1 : run.x >= streetX(i) ? 1 : -1;
         target = { x: streetX(i) + inside * 2.05 * U, z: target.z, corner: target.corner };
      } else {
         const j = Math.round((run.z - HALF_STREET) / PITCH);
         const inside = j === 0 ? 1 : j === run.level.blocksZ ? -1 : run.z >= streetZ(j) ? 1 : -1;
         target = { x: target.x, z: streetZ(j) + inside * 2.05 * U, corner: target.corner };
      }
   }
   const toPad = Math.hypot(pad.x - run.x, pad.z - run.z);

   // backing out of a wall
   if (mem.backUp > 0) {
      mem.backUp -= dt;
      input.moveY = 1;
      input.moveX = clamp(wrap(Math.atan2(target.x - run.x, target.z - run.z) - run.yaw) / 0.5, -1, 1);
      return;
   }

   // steering: pure pursuit on the next point (a little ahead of it on long legs)
   const heading = Math.atan2(target.x - run.x, target.z - run.z);
   const err = wrap(heading - run.yaw);
   // right on the stick lowers the yaw (rules.ts driveCab)
   input.moveX = -clamp(err / 0.45, -1, 1);

   // speed plan
   const cornerV = (oracle ? 4.2 : 3.8) * U;
   const decel = (oracle ? 11 : 9) * U;
   let want = TOP_SPEED;
   let d = Math.hypot(target.x - run.x, target.z - run.z);
   for (let k = mem.seg; k < pts.length; k++) {
      if (k > mem.seg) d += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
      if (pts[k].corner) {
         want = Math.min(want, Math.sqrt(cornerV * cornerV + 2 * decel * Math.max(0, d - 1.5 * U)));
         break;
      }
   }
   // the pad: stop on its centre, the last metres under the strike speed
   want = Math.min(want, Math.sqrt(2 * decel * Math.max(0, toPad - 0.35 * U)));
   if (toPad < 7 * U) want = Math.min(want, (oracle ? 2.9 : 2.6) * U);
   if (Math.abs(err) > 0.9) want = Math.min(want, 2.2 * U);
   if (passing) want = Math.min(want, 2.0 * U);
   // red stop lines ahead: cross under 1 m/s
   for (const stop of run.stops) {
      const ahead = stop.axis === 1 ? (stop.coord - run.z) * stop.into : (stop.coord - run.x) * stop.into;
      if (ahead < -0.2 * U || ahead > 14 * U) continue;
      const span = stop.axis === 1 ? run.x : run.z;
      if (span < stop.span0 - 1.5 * U || span > stop.span1 + 1.5 * U) continue;
      const toward = stop.axis === 1 ? fz * stop.into : fx * stop.into;
      if (toward < 0.3) continue;
      const eta = ahead / Math.max(1 * U, Math.abs(run.speed));
      if (!signalRed(stop.light, run.time, stop.ns) && !signalRed(stop.light, run.time + eta + 0.4, stop.ns)) continue;
      const crawl = RED_SPEED * 0.6;
      want = Math.min(want, Math.sqrt(crawl * crawl + 2 * decel * Math.max(0, ahead - 0.35 * U)));
   }
   // cars near the cab's way: under the strike speed (a touch then only nudges)
   for (const car of run.cars) {
      const dx = car.x - run.x;
      const dz = car.z - run.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      const reach = RADIUS + Math.max(CAR_W, CAR_L) + 0.6 * U;
      if (along > -1 * U && along < 9 * U && side < reach) want = Math.min(want, (oracle ? 2.8 : 2.2) * U);
      if (Math.hypot(dx, dz) < 6.5 * U) want = Math.min(want, (oracle ? 2.8 : 2.4) * U);
      // a car ahead in the cab's lane going the same way: stay behind it
      const sameWay = car.axis === 1 ? car.dir * fz > 0.5 : car.dir * fx > 0.5;
      if (sameWay && along > 0 && side < RADIUS + CAR_W + 0.2 * U) want = Math.min(want, Math.sqrt(2 * decel * Math.max(0, along - RADIUS - CAR_L - 1.2 * U)));
   }
   // walls ahead (buildings grown by the cab's radius, the city edge): reach them under the strike speed
   const wall = rayToWalls(run, fx, fz);
   want = Math.min(want, Math.sqrt(2.6 * U * 2.6 * U + 2 * decel * Math.max(0, wall - 0.4 * U)));
   // stuck against something: back up a little
   if (Math.abs(run.speed) < 0.15 * U && want > 1 * U && toPad > 2.2 * U) mem.stuck += dt;
   else mem.stuck = 0;
   if (mem.stuck > 1.2) {
      mem.stuck = 0;
      mem.backUp = 0.7;
   }
   const sp = run.speed;
   if (sp < want - 0.15 * U) input.moveY = -1;
   else if (sp > want + 0.15 * U) input.moveY = sp > 0.3 * U ? 1 : 0;
}

export interface PlayResult {
   score: number;
   ms: number;
   reason: ArcadeStore["endReason"];
   run: Run;
   hits: number;
   reds: number;
   misses: number;
   /** the run's own score before the shell (equal to the store's score unless the cap changed it) */
   rawScore: number;
}

/** One run of `style` on level `id`, frame rate `hz` (0 = seeded random frames). */
export function play(id: LevelId, seed: number, hz: number, style: Style): PlayResult {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: LIVES, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();
   const input = idleInput();
   const mem: Memory = { plan: null, seg: 0, stuck: 0, backUp: 0 };
   const rng = createRng((seed + 1) * 10007 + id * 17 + (style === "spam" ? 3 : 0));
   const frames = createRng(seed * 31 + 7);
   let hits = 0;
   let reds = 0;
   let misses = 0;
   for (let f = 0; f < 1e6; f++) {
      advanceRunClock(store, hz > 0 ? 1 / hz : 0.004 + frames() * 0.046);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;
      drive(run, input, dt, style, rng, mem);
      const ev = step(run, input, dt, state.timeLeftMs ?? 0);
      if (ev.score) state.addScore(ev.score);
      for (let n = 0; n < ev.lives; n++) state.loseLife();
      if (ev.won) state.end("win");
      if (ev.hit) hits += 1;
      if (ev.red) reds += 1;
      if (ev.miss) misses += 1;
   }
   const state = store.getState();
   return { score: state.score, ms: state.elapsedMs, reason: state.endReason, run, hits, reds, misses, rawScore: run.score };
}
