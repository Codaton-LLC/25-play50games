import { circlesOverlapXZ } from "@/arcade3d/core/collision";
import { substep } from "@/arcade3d/core/kinematics";
import { createRng } from "@/arcade3d/core/math";
import { createPath, createPathGraph, pointAt, tangentAt, type Path, type PathGraph } from "@/arcade3d/core/path";

export const COURSE = { chunk: 60, radius: 0.35, width: 3.5, narrow: 2.25, split: 1.25, corridor: 0.6, taper: 20, preview: 20, separation: 12, attempts: 16 } as const;
export const DRIVE = { initial: 8, max: 22, lateral: 4, smoothing: 4, impulse: 0.1, carve: 0.02, crashSpeed: 0.6, tumble: 1, step: 1 / 120 } as const;
export const AIR = { hopTime: 0.6, hopHeight: 0.5, rampHeight: 1.2, rate: 600, tolerance: 30, spins: 2 } as const;
export const CLOCK = { initial: 30, gate: 8, ceiling: 180, firstGate: 120, gateSpacing: 120, gateGrowth: 60, gateGrowthCount: 10 } as const;
export const POINTS = { fish: 10, spin: 50, fishBudget: 12, fishSpacing: 3, fishReach: 0.55, fishHeight: 0.6 } as const;
export const PROPOSED_LIMITS = { kind: "points", maxScore: 18700, minDurationMs: 9000, maxDurationMs: 182000, base: 440, maxPointsPerSec: 104, unitLabel: "pts", display: "int" } as const;
const DEG = Math.PI / 180;
const FORMS = ["straight", "curve", "s-bend", "ramp", "narrow", "split"] as const;
export type Form = typeof FORMS[number];
export type Branch = -1 | 0 | 1;
export interface Point { x: number; y: number; z: number }
export interface Entry { x: number; y: number; z: number; heading: number; grade: number }
export interface Item { id: string; s: number; d: number; branch: Branch; used: boolean }
export interface Obstacle extends Item { kind: "ice" | "snowman" | "crack"; radius: number }
export interface Chunk {
   index: number; form: Form; entry: Entry; exit: Entry; grade: number; path: Path; branches: [Path, Path] | null; graph: PathGraph;
   fish: Item[]; obstacles: Obstacle[]; ramp: Item | null; attempts: number; fallback: boolean;
}
export interface StepInput { steer: number; left: boolean; right: boolean; jump: boolean }
export interface Run {
   seed: number; s: number; d: number; speed: number; steer: number; impulse: number; impulseTime: number;
   elapsed: number; remaining: number; crashes: number; tumble: number; air: number; airDuration: number;
   rampAir: boolean; yaw: number; branch: Branch; fishCollected: number; trickPoints: number; gates: number;
   gateIndex: number; gateS: number; assist: boolean; end: "lose" | "timeup" | null; chunks: Chunk[];
   events: { score: number; fish: number; spins: number; crash: boolean; gate: boolean; hop: boolean };
   target: number; step: (dt: number) => void;
   scratch: { a: Point; b: Point; closest: Point; obstacle: Point; tangent: Point };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const taper = (s: number) => {
   const u = Math.min(1, Math.max(0, s / COURSE.taper), Math.max(0, (COURSE.chunk - s) / COURSE.taper));
   return u * u * (3 - 2 * u);
};
export function widthAt(c: Chunk, s: number): number {
   return c.form === "narrow" ? COURSE.width - (COURSE.width - COURSE.narrow) * taper(s) : COURSE.width;
}
export function safeCentre(c: Chunk, s: number, branch: Branch = -1): number {
   return c.form === "split" ? (branch === 1 ? 1 : -1) * 1.5 * taper(s) : 0;
}

function pathFor(entry: Entry, grade: number, form: Form, turn: number): Path {
   const points: Point[] = [];
   for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const lateral = form === "curve" ? Math.sin(Math.PI * u) * turn * 2 : form === "s-bend" ? Math.sin(2 * Math.PI * u) * turn : 0;
      const along = COURSE.chunk * u;
      points.push({ x: entry.x + Math.sin(entry.heading) * along + Math.cos(entry.heading) * lateral, y: entry.y - grade * along, z: entry.z + Math.cos(entry.heading) * along - Math.sin(entry.heading) * lateral });
   }
   const raw = createPath(points, { smooth: true, samples: 24 });
   const scale = COURSE.chunk / raw.total;
   const resampled: Point[] = [];
   for (let i = 0; i <= 144; i++) {
      const p = pointAt(raw, raw.total * i / 144);
      resampled.push({ x: entry.x + (p.x - entry.x) * scale, y: entry.y + (p.y - entry.y) * scale, z: entry.z + (p.z - entry.z) * scale });
   }
   // Exact boundary tangents, including the incoming slope, survive arc-length normalization.
   const end = resampled[144];
   resampled[1] = { x: entry.x + Math.sin(entry.heading) * 0.4, y: entry.y - entry.grade * 0.4, z: entry.z + Math.cos(entry.heading) * 0.4 };
   resampled[143] = { x: end.x - Math.sin(entry.heading) * 0.4, y: end.y + grade * 0.4, z: end.z - Math.cos(entry.heading) * 0.4 };
   const sampled = createPath(resampled);
   const correction = COURSE.chunk / sampled.total;
   for (const p of resampled) {
      p.x = entry.x + (p.x - entry.x) * correction;
      p.y = entry.y + (p.y - entry.y) * correction;
      p.z = entry.z + (p.z - entry.z) * correction;
   }
   return createPath(resampled);
}

function splitPaths(entry: Entry, grade: number): [Path, Path] {
   const make = (length: number, side: number) => {
      const points: Point[] = [];
      for (let i = 0; i <= 6; i++) {
         const s = i * COURSE.chunk / 6, along = length * i / 6;
         const d = side * 1.5 * taper(s);
         points.push({ x: entry.x + Math.sin(entry.heading) * along + Math.cos(entry.heading) * d, y: entry.y - grade * along, z: entry.z + Math.cos(entry.heading) * along - Math.sin(entry.heading) * d });
      }
      const sampled = createPath(points, { smooth: true, samples: 24 });
      for (const p of sampled.points) {
         const x = p.x - entry.x, z = p.z - entry.z;
         const lateral = x * Math.cos(entry.heading) - z * Math.sin(entry.heading);
         const limited = clamp(lateral, -1.5, 1.5) - lateral;
         p.x += Math.cos(entry.heading) * limited; p.z -= Math.sin(entry.heading) * limited;
      }
      sampled.points[1].x = entry.x + Math.sin(entry.heading) * length / 144;
      sampled.points[1].z = entry.z + Math.cos(entry.heading) * length / 144;
      sampled.points[1].y = entry.y - entry.grade * length / 144;
      const end = sampled.points[144];
      sampled.points[143].x = end.x - Math.sin(entry.heading) * length / 144;
      sampled.points[143].z = end.z - Math.cos(entry.heading) * length / 144;
      sampled.points[143].y = end.y + grade * length / 144;
      return createPath(sampled.points);
   };
   let lo = 55, hi = 60;
   for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (make(mid, -1).total > 60) hi = mid; else lo = mid;
   }
   const length = (lo + hi) / 2;
   return [make(length, -1), make(length, 1)];
}

export function generateChunk(seed: number, index: number, entry: Entry, elapsed: number, attempt = 0, accept: (chunk: Chunk) => boolean = validChunk): Chunk {
   const rng = createRng((seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(attempt, 0x85ebca6b)) >>> 0);
   const form: Form = index <= 0 ? "straight" : FORMS[Math.floor(rng() * FORMS.length)];
   const grade = index <= 0 ? entry.grade : 0.03 + rng() * 0.05;
   const branches = form === "split" ? splitPaths(entry, grade) : null;
   const path = branches ? branches[0] : pathFor(entry, grade, form, rng() * 2 - 1);
   const endpoint = pointAt(path, COURSE.chunk);
   const tangent = tangentAt(path, COURSE.chunk);
   const exit = { ...endpoint, heading: Math.atan2(tangent.x, tangent.z), grade };
   const graph = branches ? createPathGraph([createPath([entry]), ...branches, createPath([endpoint])], [[1, 2], [3], [3], []]) : createPathGraph([path], [[]]);
   const c: Chunk = { index, entry: { ...entry }, exit, grade, form, path, branches, graph, fish: [], obstacles: [], ramp: null, attempts: attempt + 1, fallback: false };
   if (index <= 0) return c;
   const start = index * COURSE.chunk;
   const count = 2 + Math.floor(3 * Math.min(elapsed / 120, 1));
   for (let i = 0; i < count; i++) {
      const s = start + i * COURSE.separation;
      const kind = (["ice", "snowman", "crack"] as const)[Math.floor(rng() * 3)];
      const radius = kind === "snowman" ? 0.5 : 0.6;
      // The centre line is reserved; optional obstacles sit at the outside banks.
      const side = rng() < 0.5 ? -1 : 1;
      const d = side * (c.form === "split" ? 3.3 : c.form === "narrow" ? 1.8 : 2.4);
      c.obstacles.push({ id: `${seed}:${index}:o${i}`, s, d, radius, kind, branch: 0, used: false });
   }
   for (let i = 0; i < POINTS.fishBudget; i++) {
      const local = 3 + i * 4.5;
      const branch: Branch = c.form === "split" ? (i % 2 ? 1 : -1) : 0;
      c.fish.push({ id: `${seed}:${index}:f${i}`, s: start + local, d: safeCentre(c, local, branch), branch, used: false });
   }
   if (form === "ramp") c.ramp = { id: `${seed}:${index}:r`, s: start + 24, d: 1.5, branch: 0, used: false };
   if (!accept(c)) {
      if (attempt + 1 < COURSE.attempts) return generateChunk(seed, index, entry, elapsed, attempt + 1, accept);
      c.form = "straight";
      c.path = pathFor(entry, grade, "straight", 0);
      c.branches = null;
      c.graph = createPathGraph([c.path], [[]]);
      c.exit = { ...pointAt(c.path, COURSE.chunk), heading: entry.heading, grade };
      for (const o of c.obstacles) o.d = o.d < 0 ? -2.4 : 2.4;
      for (const f of c.fish) { f.d = 0; f.branch = 0; }
      c.ramp = null;
      c.attempts = COURSE.attempts;
      c.fallback = true;
   }
   return c;
}

export function validChunk(c: Chunk): boolean {
   if (Math.abs(c.path.total - COURSE.chunk) > 1e-6 || c.fish.length > POINTS.fishBudget || c.grade < 0.03 || c.grade > 0.08) return false;
   if (c.branches && (Math.abs(c.branches[1].total - COURSE.chunk) > 1e-6 || c.graph.next(0, 0) !== 1 || c.graph.next(0, 1) !== 2)) return false;
   for (let i = 0; i < c.obstacles.length; i++) {
      const o = c.obstacles[i];
      if (o.s < 60 || o.s < c.index * 60 || o.s >= (c.index + 1) * 60) return false;
      if (i && o.s - c.obstacles[i - 1].s < COURSE.separation) return false;
      if (!Number.isFinite(o.d) || !Number.isFinite(o.s)) return false;
      // Conservative whole-corridor envelope also covers swept footprints at tapers.
      const envelope = c.form === "split" ? 1.5 : 0;
      if (Math.abs(o.d) - envelope < COURSE.corridor + COURSE.radius + o.radius) return false;
   }
   for (let i = 0; i < c.fish.length; i++) {
      const f = c.fish[i];
      if (f.s < 60 || f.s < c.index * 60 || f.s >= (c.index + 1) * 60 || !Number.isFinite(f.d) || (i && f.s - c.fish[i - 1].s < POINTS.fishSpacing)) return false;
   }
   return true;
}

export function createRun(seed: number, assist = false): Run {
   const entry: Entry = { x: 0, y: 0, z: 0, heading: 0, grade: 0.08 };
   const current = generateChunk(seed, 0, entry, 0);
   const preceding = COURSE.chunk / Math.sqrt(1 + entry.grade * entry.grade);
   const previous = generateChunk(seed, -1, { ...entry, y: preceding * entry.grade, z: -preceding }, 0);
   const next = generateChunk(seed, 1, current.exit, 0);
   const run: Run = {
      seed, s: 0, d: 0, speed: DRIVE.initial, steer: 0, impulse: 0, impulseTime: 0, elapsed: 0, remaining: CLOCK.initial,
      crashes: 0, tumble: 0, air: 0, airDuration: 0, rampAir: false, yaw: 0, branch: 0, fishCollected: 0, trickPoints: 0,
      gates: 0, gateIndex: 0, gateS: CLOCK.firstGate, assist, end: null, chunks: [previous, current, next], target: 0,
      events: { score: 0, fish: 0, spins: 0, crash: false, gate: false, hop: false }, step: () => {},
      scratch: { a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 0, z: 0 }, closest: { x: 0, y: 0, z: 0 }, obstacle: { x: 0, y: 0, z: 0 }, tangent: { x: 0, y: 0, z: 0 } },
   };
   run.step = (dt) => integrate(run, dt);
   return run;
}

export const runScore = (r: Run): number => Math.floor(r.s) + POINTS.fish * r.fishCollected + r.trickPoints;
export function airHeight(r: Run, at = r.air): number {
   if (!(r.airDuration > 0)) return 0;
   const u = clamp(at / r.airDuration, 0, 1);
   return 4 * (r.rampAir ? AIR.rampHeight : AIR.hopHeight) * u * (1 - u);
}
export function landingSpins(yaw: number): number {
   const wrapped = ((yaw + 180) % 360 + 360) % 360 - 180;
   return Math.abs(wrapped) <= AIR.tolerance + 1e-8 ? Math.min(AIR.spins, Math.round(Math.abs(yaw) / 360)) : -1;
}
function launch(r: Run, ramp: boolean): void {
   if (r.airDuration || r.tumble || r.end) return;
   r.air = 0; r.yaw = 0; r.rampAir = ramp;
   r.airDuration = AIR.hopTime + (ramp ? AIR.hopTime * Math.min(r.elapsed / 120, 1) : 0);
   r.events.hop = true;
}
function crash(r: Run): void {
   if (r.tumble || r.end) return;
   r.crashes++;
   r.speed *= DRIVE.crashSpeed;
   r.tumble = DRIVE.tumble;
   r.air = r.airDuration = r.yaw = 0;
   r.rampAir = false;
   const c = chunkAt(r, r.s);
   r.d = safeCentre(c, r.s - c.index * 60, r.branch);
   r.events.crash = true;
   if (r.crashes >= 3) r.end = "lose";
}
export function chunkAt(r: Run, s: number): Chunk {
   const index = Math.floor(s / COURSE.chunk);
   for (let i = 0; i < 3; i++) if (r.chunks[i].index === index) return r.chunks[i];
   return r.chunks[1];
}
function recycle(r: Run): void {
   if (r.s < (r.chunks[1].index + 1) * COURSE.chunk) return;
   r.chunks[0] = r.chunks[1];
   r.chunks[1] = r.chunks[2];
   r.chunks[2] = generateChunk(r.seed, r.chunks[1].index + 1, r.chunks[1].exit, r.elapsed);
   r.branch = 0;
}

// First contact time for a moving circle against a static circle, in track (s,d) coordinates.
function contact(r: Run, s: number, d: number, ds: number, dd: number, os: number, od: number, radius: number): number {
   const a = r.scratch.a, o = r.scratch.obstacle, p = r.scratch.closest;
   a.x = s; a.y = 0; a.z = d; o.x = os; o.y = 0; o.z = od;
   if (circlesOverlapXZ(a, radius, o, 0)) return 0;
   const x = s - os, z = d - od, length = ds * ds + dd * dd;
   if (!(length > 0)) return Infinity;
   const t = clamp(-(x * ds + z * dd) / length, 0, 1);
   p.x = s + ds * t; p.y = 0; p.z = d + dd * t;
   if (!circlesOverlapXZ(p, radius, o, 0)) return Infinity;
   const dot = x * ds + z * dd;
   const disc = dot * dot - length * (x * x + z * z - radius * radius);
   return clamp((-dot - Math.sqrt(Math.max(0, disc))) / length, 0, 1);
}

function integrate(r: Run, dt: number): void {
   let left = dt;
   while (left > 1e-10 && !r.end) {
      let h = Math.min(left, r.remaining, CLOCK.ceiling - r.elapsed);
      if (h <= 1e-10) {
         if (r.remaining <= 1e-10) r.remaining = 0;
         if (CLOCK.ceiling - r.elapsed <= 1e-10) r.elapsed = CLOCK.ceiling;
         r.end = "timeup"; break;
      }
      if (r.tumble > 0) {
         h = Math.min(h, r.tumble);
         r.tumble = Math.max(0, r.tumble - h);
         r.remaining -= h; r.elapsed += h; left -= h;
         if (r.remaining <= 1e-10 || r.elapsed >= CLOCK.ceiling - 1e-10) {
            if (r.remaining <= 1e-10) r.remaining = 0;
            if (r.elapsed >= CLOCK.ceiling - 1e-10) r.elapsed = CLOCK.ceiling;
            r.end = "timeup";
         }
         continue;
      }
      recycle(r);
      const c = chunkAt(r, r.s);
      const local = r.s - c.index * 60;
      if (c.form === "split" && r.branch === 0) r.branch = r.d > 0 ? 1 : -1;
      if (r.airDuration) h = Math.min(h, r.airDuration - r.air);
      if (r.impulseTime > 0) h = Math.min(h, r.impulseTime);
      const steer = r.steer + clamp(r.target - r.steer, -DRIVE.smoothing * h, DRIVE.smoothing * h);
      const acceleration = 0.1 + 2 * c.grade;
      const speed = Math.min(DRIVE.max, r.speed + acceleration * h) * (Math.abs(steer) >= 0.75 ? Math.exp(-DRIVE.carve * h) : 1);
      const ds = speed * h;
      const centre = safeCentre(c, local + ds, r.branch);
      const half = c.form === "split" ? COURSE.width - (COURSE.width - COURSE.split) * taper(local + ds) : widthAt(c, local + ds);
      const d = clamp(r.d + DRIVE.lateral * steer * h, centre - half + COURSE.radius, centre + half - COURSE.radius);
      const dd = d - r.d;
      let fraction = 1;
      let kind: "none" | "obstacle" | "fish" | "ramp" | "gate" | "boundary" = "none";
      let selected: Item | Obstacle | null = null;
      const boundary = (c.index + 1) * 60;
      if (ds > 0 && r.s + ds >= boundary - 1e-10) { fraction = clamp((boundary - r.s) / ds, 0, 1); kind = "boundary"; }
      if (ds > 0 && r.s <= r.gateS && r.s + ds >= r.gateS) {
         const f = (r.gateS - r.s) / ds;
         if (f <= fraction) { fraction = f; kind = "gate"; }
      }
      for (let ci = 1; ci < 3; ci++) {
         const chunk = r.chunks[ci];
         for (const o of chunk.obstacles) {
            if (o.used) continue;
            const f = contact(r, r.s, r.d, ds, dd, o.s, o.d, o.radius + COURSE.radius);
            const height = airHeight(r, r.air + h * f);
            if (f <= fraction && height < (o.kind === "crack" ? 0.15 : 1)) { fraction = f; kind = "obstacle"; selected = o; }
         }
         for (const f of chunk.fish) {
            if (f.s < r.s - POINTS.fishReach) f.used = true;
            if (f.used || (f.branch && r.branch && f.branch !== r.branch)) continue;
            const hit = contact(r, r.s, r.d, ds, dd, f.s, f.d, POINTS.fishReach);
            if (hit < fraction && airHeight(r, r.air + h * hit) <= POINTS.fishHeight) { fraction = hit; kind = "fish"; selected = f; }
         }
         const ramp = chunk.ramp;
         if (ramp && !ramp.used && r.s <= ramp.s && ds > 0 && r.s + ds >= ramp.s) {
            const f = (ramp.s - r.s) / ds;
            if (f < fraction) { fraction = f; kind = "ramp"; selected = ramp; }
         }
      }
      const consumed = h * fraction;
      const expires = r.remaining <= consumed + 1e-10 || CLOCK.ceiling - r.elapsed <= consumed + 1e-10;
      r.steer += clamp(r.target - r.steer, -DRIVE.smoothing * consumed, DRIVE.smoothing * consumed);
      r.speed = Math.min(DRIVE.max, r.speed + acceleration * consumed) * (Math.abs(r.steer) >= 0.75 ? Math.exp(-DRIVE.carve * consumed) : 1);
      r.s += ds * fraction; r.d += dd * fraction;
      r.elapsed = Math.min(CLOCK.ceiling, r.elapsed + consumed); r.remaining = Math.max(0, r.remaining - consumed);
      if (r.airDuration) { r.air += consumed; if (r.rampAir) r.yaw += AIR.rate * r.steer * consumed; }
      if (r.impulseTime > 0) {
         r.impulseTime = Math.max(0, r.impulseTime - consumed);
         if (r.impulseTime <= 1e-10) { r.impulseTime = 0; r.target = 0; }
      }
      left -= consumed;
      if (expires) {
         if (r.remaining <= 1e-10) r.remaining = 0;
         if (r.elapsed >= CLOCK.ceiling - 1e-10) r.elapsed = CLOCK.ceiling;
         r.end = "timeup"; break;
      }
      if (r.airDuration && r.air >= r.airDuration - 1e-10) {
         const spins = r.rampAir ? landingSpins(r.yaw) : 0;
         r.airDuration = r.air = 0; r.rampAir = false;
         if (spins < 0) crash(r);
         else { r.trickPoints += spins * POINTS.spin; r.events.spins += spins; r.yaw = 0; }
      }
      if (kind === "obstacle" && selected) { selected.used = true; crash(r); }
      else if (kind === "fish" && selected && !r.tumble) { selected.used = true; r.fishCollected++; r.events.fish++; }
      else if (kind === "ramp" && selected) { selected.used = true; if (Math.abs(r.d - selected.d) <= 0.8) launch(r, true); }
      else if (kind === "gate") {
         const gateChunk = chunkAt(r, r.gateS);
         const gateD = safeCentre(gateChunk, r.gateS - gateChunk.index * 60, r.branch);
         if (!r.tumble && Math.abs(r.d - gateD) <= 1) { r.remaining += CLOCK.gate; r.gates++; r.events.gate = true; }
         r.gateS += CLOCK.gateSpacing + CLOCK.gateGrowth * Math.min(r.gateIndex++ / CLOCK.gateGrowthCount, 1);
      } else if (kind === "boundary") recycle(r);
      if (consumed <= 1e-10 && kind === "none") break;
   }
}

export function stepRun(r: Run, input: StepInput, dt: number): void {
   r.events.score = r.events.fish = r.events.spins = 0;
   r.events.crash = r.events.gate = r.events.hop = false;
   if (r.end || !(dt > 0) || !Number.isFinite(dt)) return;
   const before = runScore(r);
   const held = clamp(input.steer, -1, 1);
   if (held !== 0) { r.target = held; r.impulseTime = 0; }
   else {
      if (input.left || input.right) {
         r.impulse = Number(input.right) - Number(input.left);
         r.impulseTime = r.impulse ? DRIVE.impulse : 0;
      }
      r.target = r.impulseTime > 0 ? r.impulse : 0;
   }
   if (input.jump) launch(r, false);
   else if (r.assist && !r.airDuration && !r.tumble) {
      for (let ci = 1; ci < 3; ci++) for (const o of r.chunks[ci].obstacles) {
         if (!o.used && o.kind === "crack" && contact(r, r.s, r.d, r.speed * 0.1, DRIVE.lateral * r.steer * 0.1, o.s, o.d, o.radius + COURSE.radius) < Infinity) launch(r, false);
      }
   }
   substep(dt, DRIVE.step, r.step);
   r.events.score = runScore(r) - before;
}

export function worldAt(r: Run, s: number, d: number, out: Point): Point {
   const c = chunkAt(r, s), here = chunkAt(r, r.s);
   sampleTrack(here, r.s - here.index * 60, 0, r.scratch.a, r.scratch.tangent, r.branch);
   sampleTrack(c, s - c.index * 60, d, r.scratch.b, r.scratch.closest, d > 0 ? 1 : -1);
   const dx = r.scratch.b.x - r.scratch.a.x;
   const dz = r.scratch.b.z - r.scratch.a.z;
   const yaw = Math.atan2(r.scratch.tangent.x, r.scratch.tangent.z), cos = Math.cos(yaw), sin = Math.sin(yaw);
   out.x = cos * dx - sin * dz;
   out.y = r.scratch.b.y - r.scratch.a.y;
   out.z = -(sin * dx + cos * dz);
   return out;
}

export function sampleTrack(c: Chunk, s: number, d: number, out: Point, tangent: Point, branch: Branch = d > 0 ? 1 : -1): Point {
   const path = c.branches ? c.branches[branch === 1 ? 1 : 0] : c.path;
   pointAt(path, s, out); tangentAt(path, s, tangent);
   const offset = d - (c.branches ? safeCentre(c, s, branch) : 0);
   const length = Math.hypot(tangent.x, tangent.z) || 1;
   out.x += tangent.z / length * offset;
   out.z -= tangent.x / length * offset;
   return out;
}
