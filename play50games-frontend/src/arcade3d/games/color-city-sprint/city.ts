// The open city: a block grid, the street graph, and the queries the rules and the proof share.
// Intersections sit on CELL metres. Streets are the open corridors between the blocks. An alley,
// a smashed hoarding and a phased shop are extra edges. Nothing here moves; the run owns the paint.
import type { LevelId } from "../../types";
import { LEVELS, type CitySpec } from "./levels";

export const CELL = 12;
export const STREET_HALF = 2.4;
export const ALLEY_HALF = 1.4;
export const HERO_R = 0.32;
/** How much a right-angle corner can save against the centre line, for an edge of `len` metres. */
export function cornerSave(len: number): number {
   return len + STREET_HALF - Math.hypot(len, STREET_HALF);
}

export const RAIL_Y = 5.2;
export const BUS_ROOF = 3.15;
export const RAMP_LEN = 6;
export const BRUSH_Y = 3.75;
export const GATE_PERIOD = 4000;
export const GATE_OPEN_MS = 2200;
/** Shifts the cycle so level 5's ram windows fall while the plaza gate is shut. */
export const GATE_SHIFT = 3300;

export function gateClosed(ms: number): boolean {
   return ((ms + GATE_SHIFT) % GATE_PERIOD) >= GATE_OPEN_MS;
}

/** Ms left in the open half (0 while the gate is shut). */
export function gateOpenLeft(ms: number): number {
   const p = (ms + GATE_SHIFT) % GATE_PERIOD;
   return p >= GATE_OPEN_MS ? 0 : GATE_OPEN_MS - p;
}

export interface Edge {
   a: number;
   b: number;
   len: number;
   half: number;
   kind: "street" | "alley" | "cut" | "ghost" | "rail";
   gate: number;
   ring: boolean;
   ax: number;
   az: number;
   bx: number;
   bz: number;
   mx: number;
   mz: number;
}

export interface Block {
   x0: number;
   z0: number;
   x1: number;
   z1: number;
   ghost: boolean;
   ix: number;
   iz: number;
}

export interface GateBox {
   x: number;
   z: number;
   hx: number;
   hz: number;
   edge: number;
}

export interface Ramp {
   /** the lip, on the intersection */
   x: number;
   z: number;
   /** unit direction from the base up to the lip */
   dx: number;
   dz: number;
   len: number;
   half: number;
}

export interface BusPath {
   pts: { x: number; z: number }[];
   len: number;
   cycleMs: number;
}

export interface Course {
   id: LevelId;
   name: string;
   nx: number;
   nz: number;
   laps: number;
   timerMs: number;
   starTargetMs: number;
   start: number;
   startX: number;
   startZ: number;
   beacons: { node: number; bus: boolean }[];
   edges: Edge[];
   blocks: Block[];
   cones: { x: number; z: number; r: number }[];
   sludge: { x: number; z: number; r: number }[];
   gates: GateBox[];
   alley: { ax: number; az: number; bx: number; bz: number } | null;
   cut: { ax: number; az: number; bx: number; bz: number; edge: number } | null;
   ramps: Ramp[];
   bus: BusPath | null;
   busBeacon: number;
   orbs: { x: number; y: number; z: number; main: boolean }[];
   secrets: { x: number; y: number; z: number }[];
   night: boolean;
   boss: boolean;
   ringEdges: number[];
   /** where the brushes park, where the valves park, where the ram gate is, and the safe side */
   brush: { x: number; z: number };
   rear: { x: number; z: number };
   slam: { x: number; z: number };
   far: { x: number; z: number };
   rampLip: { x: number; z: number };
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
   mainOrbs: number;
   prePaint: number[];
}

export function nodeX(c: Course, i: number): number {
   return (i % c.nx) * CELL;
}

export function nodeZ(c: Course, i: number): number {
   return Math.floor(i / c.nx) * CELL;
}

function pushEdge(edges: Edge[], a: number, b: number, ax: number, az: number, bx: number, bz: number, half: number, kind: Edge["kind"], ring: boolean): Edge {
   const len = Math.hypot(bx - ax, bz - az);
   const e: Edge = { a, b, len, half, kind, gate: -1, ring, ax, az, bx, bz, mx: (ax + bx) / 2, mz: (az + bz) / 2 };
   edges.push(e);
   return e;
}

function perimeter(nx: number, nz: number, a: number, b: number): boolean {
   const ax = a % nx;
   const az = Math.floor(a / nx);
   const bx = b % nx;
   const bz = Math.floor(b / nx);
   const outer = (x: number, z: number) => x === 0 || z === 0 || x === nx - 1 || z === nz - 1;
   return outer(ax, az) && outer(bx, bz) && (ax === 0 || ax === nx - 1 || az === 0 || az === nz - 1) && (ax === bx || az === bz);
}

export function buildCourse(spec: CitySpec): Course {
   const { nx, nz } = spec;
   const xOf = (i: number) => (i % nx) * CELL;
   const zOf = (i: number) => Math.floor(i / nx) * CELL;
   const edges: Edge[] = [];
   for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
         const id = iz * nx + ix;
         if (ix + 1 < nx) {
            const b = id + 1;
            pushEdge(edges, id, b, xOf(id), zOf(id), xOf(b), zOf(b), STREET_HALF, "street", spec.ring && perimeter(nx, nz, id, b));
         }
         if (iz + 1 < nz) {
            const b = id + nx;
            pushEdge(edges, id, b, xOf(id), zOf(id), xOf(b), zOf(b), STREET_HALF, "street", spec.ring && perimeter(nx, nz, id, b));
         }
      }
   }
   let alley: Course["alley"] = null;
   if (spec.alley) {
      const [a, b] = spec.alley;
      const e = pushEdge(edges, a, b, xOf(a), zOf(a), xOf(b), zOf(b), ALLEY_HALF, "alley", false);
      alley = { ax: e.ax, az: e.az, bx: e.bx, bz: e.bz };
   }
   let cut: Course["cut"] = null;
   if (spec.cut) {
      const [a, b] = spec.cut;
      const e = pushEdge(edges, a, b, xOf(a), zOf(a), xOf(b), zOf(b), 1.25, "cut", false);
      cut = { ax: e.ax, az: e.az, bx: e.bx, bz: e.bz, edge: edges.length - 1 };
   }
   if (spec.ghost) {
      const [ix, iz] = spec.ghost;
      const a = iz * nx + ix;
      const b = a + nx + 1;
      if (b < nx * nz) pushEdge(edges, a, b, xOf(a), zOf(a), xOf(b), zOf(b), 1.2, "ghost", false);
   }
   // the elevated rail runs the north edge; same length as the street under it, so it is not a faster route
   const north = (nz - 1) * nx;
   pushEdge(edges, north, north + nx - 1, xOf(north), zOf(north), xOf(north + nx - 1), zOf(north), 1.1, "rail", false);

   const blocks: Block[] = [];
   for (let iz = 0; iz < nz - 1; iz++) {
      for (let ix = 0; ix < nx - 1; ix++) {
         blocks.push({
            x0: ix * CELL + STREET_HALF,
            z0: iz * CELL + STREET_HALF,
            x1: (ix + 1) * CELL - STREET_HALF,
            z1: (iz + 1) * CELL - STREET_HALF,
            ghost: !!spec.ghost && spec.ghost[0] === ix && spec.ghost[1] === iz,
            ix,
            iz,
         });
      }
   }

   const gates: GateBox[] = [];
   for (const [a, b] of spec.gates) {
      const e = edges.find((g) => (g.a === a && g.b === b) || (g.a === b && g.b === a));
      if (!e) continue;
      e.gate = gates.length;
      const dx = e.bx - e.ax;
      const dz = e.bz - e.az;
      const horiz = Math.abs(dx) >= Math.abs(dz);
      gates.push({ x: e.mx, z: e.mz, hx: horiz ? 0.45 : STREET_HALF, hz: horiz ? STREET_HALF : 0.45, edge: edges.indexOf(e) });
   }

   const cones: Course["cones"] = [];
   if (alley && spec.alleyCones > 0) {
      const dx = alley.bx - alley.ax;
      const dz = alley.bz - alley.az;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len;
      const pz = dx / len;
      for (let i = 0; i < spec.alleyCones; i++) {
         const t = (i + 1) / (spec.alleyCones + 1);
         const side = i % 2 === 0 ? 1 : -1;
         cones.push({ x: alley.ax + dx * t + px * 0.95 * side, z: alley.az + dz * t + pz * 0.95 * side, r: 0.36 });
      }
   }

   const ramps: Ramp[] = [];
   if (spec.ramp) {
      const len = Math.hypot(spec.ramp.dx, spec.ramp.dz) || 1;
      ramps.push({
         x: xOf(spec.ramp.node),
         z: zOf(spec.ramp.node),
         dx: spec.ramp.dx / len,
         dz: spec.ramp.dz / len,
         len: RAMP_LEN,
         half: 1.6,
      });
   }

   let bus: BusPath | null = null;
   if (spec.busNodes && spec.busNodes.length >= 2) {
      const pts = spec.busNodes.map((n) => ({ x: xOf(n), z: zOf(n) }));
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
         const q = pts[(i + 1) % pts.length];
         len += Math.hypot(q.x - pts[i].x, q.z - pts[i].z);
      }
      bus = { pts, len, cycleMs: spec.busCycleMs };
   }

   const prePaint: number[] = [];
   for (const [a, b] of spec.prePaint) {
      const i = edges.findIndex((g) => (g.a === a && g.b === b) || (g.a === b && g.b === a));
      if (i >= 0) prePaint.push(i);
   }

   const startX = xOf(spec.start);
   const startZ = zOf(spec.start);
   const lip = ramps[0] ? { x: ramps[0].x, z: ramps[0].z } : { x: startX + CELL, z: startZ };
   const course: Course = {
      id: spec.id,
      name: spec.name,
      nx,
      nz,
      laps: spec.laps,
      timerMs: spec.timerMs,
      starTargetMs: spec.starTargetMs,
      start: spec.start,
      startX,
      startZ,
      beacons: spec.beacons.map((node, i) => ({ node, bus: i === spec.busBeacon })),
      edges,
      blocks,
      cones,
      sludge: spec.sludge.map((s) => ({ ...s })),
      gates,
      alley,
      cut,
      ramps,
      bus,
      busBeacon: spec.busBeacon,
      orbs: spec.orbs.map((o) => ({ ...o })),
      secrets: spec.secrets.map((s) => ({ ...s })),
      night: spec.night,
      boss: spec.boss,
      ringEdges: edges.map((e, i) => (e.ring ? i : -1)).filter((i) => i >= 0),
      brush: { x: lip.x, z: lip.z + (spec.boss ? 1.2 : 0) },
      rear: { x: startX, z: startZ },
      slam: { x: startX, z: startZ + CELL / 2 },
      far: { x: startX, z: startZ + CELL },
      rampLip: lip,
      minX: -STREET_HALF,
      maxX: (nx - 1) * CELL + STREET_HALF,
      minZ: -STREET_HALF,
      maxZ: (nz - 1) * CELL + STREET_HALF,
      mainOrbs: spec.orbs.filter((o) => o.main).length,
      prePaint,
   };
   return course;
}

const CACHE = new Map<LevelId, Course>();

export function courseFor(id: LevelId): Course {
   let c = CACHE.get(id);
   if (!c) {
      c = buildCourse(LEVELS[id]);
      CACHE.set(id, c);
   }
   return c;
}

/** Distance from a point to a segment, and the 0..1 parameter. */
export function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { dist: number; t: number } {
   const dx = bx - ax;
   const dz = bz - az;
   const l2 = dx * dx + dz * dz;
   const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
   const qx = ax + dx * t - px;
   const qz = az + dz * t - pz;
   return { dist: Math.hypot(qx, qz), t };
}

export function nearestEdge(c: Course, x: number, z: number): number {
   let best = -1;
   let bestD = Infinity;
   const edges = c.edges;
   for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (e.kind === "rail" || e.kind === "ghost" || e.kind === "cut") continue;
      const d = distToSeg(x, z, e.ax, e.az, e.bx, e.bz);
      if (d.dist <= e.half && d.dist < bestD) {
         bestD = d.dist;
         best = i;
      }
   }
   return best;
}

function inCorridor(x: number, z: number, ax: number, az: number, bx: number, bz: number, half: number): boolean {
   return distToSeg(x, z, ax, az, bx, bz).dist <= half;
}

/** A point a hero's centre may occupy (buildings, hoarding, cones and a shut gate pushed out). */
export function resolveXZ(c: Course, x: number, z: number, phase: boolean, cutOpen: boolean, dashing: boolean, gateShut: boolean): { x: number; z: number } {
   let px = Math.max(c.minX + HERO_R, Math.min(c.maxX - HERO_R, x));
   let pz = Math.max(c.minZ + HERO_R, Math.min(c.maxZ - HERO_R, z));
   for (let pass = 0; pass < 3; pass++) {
      for (const b of c.blocks) {
         if (px < b.x0 - HERO_R || px > b.x1 + HERO_R || pz < b.z0 - HERO_R || pz > b.z1 + HERO_R) continue;
         if (b.ghost && phase) continue;
         if (c.alley && inCorridor(px, pz, c.alley.ax, c.alley.az, c.alley.bx, c.alley.bz, ALLEY_HALF)) continue;
         if (c.cut && (cutOpen || dashing) && inCorridor(px, pz, c.cut.ax, c.cut.az, c.cut.bx, c.cut.bz, 1.25)) continue;
         const dl = px - (b.x0 - HERO_R);
         const dr = b.x1 + HERO_R - px;
         const db = pz - (b.z0 - HERO_R);
         const dt = b.z1 + HERO_R - pz;
         const m = Math.min(dl, dr, db, dt);
         if (m === dl) px = b.x0 - HERO_R;
         else if (m === dr) px = b.x1 + HERO_R;
         else if (m === db) pz = b.z0 - HERO_R;
         else pz = b.z1 + HERO_R;
      }
      if (c.cut && !cutOpen && !dashing) {
         const d = distToSeg(px, pz, c.cut.ax, c.cut.az, c.cut.bx, c.cut.bz);
         if (d.dist < 0.55 && d.t > 0.35 && d.t < 0.65) {
            const dx = c.cut.bx - c.cut.ax;
            const dz = c.cut.bz - c.cut.az;
            const len = Math.hypot(dx, dz) || 1;
            const nx = -dz / len;
            const nz = dx / len;
            const side = (px - c.cut.ax) * nx + (pz - c.cut.az) * nz >= 0 ? 1 : -1;
            px += nx * side * (0.55 - d.dist);
            pz += nz * side * (0.55 - d.dist);
         }
      }
      for (const cone of c.cones) {
         const dx = px - cone.x;
         const dz = pz - cone.z;
         const reach = cone.r + HERO_R;
         const d = Math.hypot(dx, dz);
         if (d < reach && d > 1e-6) {
            const k = reach / d;
            px = cone.x + dx * k;
            pz = cone.z + dz * k;
         }
      }
      if (gateShut) {
         const gated = pushGates(c, px, pz, true);
         px = gated.x;
         pz = gated.z;
      }
   }
   return { x: px, z: pz };
}

/** Shut-gate push. `closed` is passed in so the hot loop does not recompute the phase. */
export function pushGates(c: Course, x: number, z: number, closed: boolean): { x: number; z: number } {
   if (!closed) return { x, z };
   let px = x;
   let pz = z;
   for (const g of c.gates) {
      const hx = g.hx + HERO_R;
      const hz = g.hz + HERO_R;
      if (Math.abs(px - g.x) >= hx || Math.abs(pz - g.z) >= hz) continue;
      const dl = px - (g.x - hx);
      const dr = g.x + hx - px;
      const db = pz - (g.z - hz);
      const dt = g.z + hz - pz;
      const m = Math.min(dl, dr, db, dt);
      if (m === dl) px = g.x - hx;
      else if (m === dr) px = g.x + hx;
      else if (m === db) pz = g.z - hz;
      else pz = g.z + hz;
   }
   return { x: px, z: pz };
}

export function rampY(c: Course, x: number, z: number): number {
   let y = 0;
   for (const r of c.ramps) {
      const along = (r.x - x) * r.dx + (r.z - z) * r.dz;
      if (along < 0 || along > r.len) continue;
      const side = Math.abs((x - r.x) * -r.dz + (z - r.z) * r.dx);
      if (side > r.half) continue;
      const t = 1 - along / r.len;
      if (t * BUS_ROOF > y) y = t * BUS_ROOF;
   }
   return y;
}

export function busAt(bus: BusPath, ms: number): { x: number; z: number; vx: number; vz: number } {
   const dist = ((ms % bus.cycleMs) / bus.cycleMs) * bus.len;
   let left = dist;
   const pts = bus.pts;
   for (let i = 0; i < pts.length; i++) {
      const q = pts[(i + 1) % pts.length];
      const dx = q.x - pts[i].x;
      const dz = q.z - pts[i].z;
      const seg = Math.hypot(dx, dz);
      if (left <= seg || i === pts.length - 1) {
         const t = seg > 0 ? Math.max(0, Math.min(1, left / seg)) : 0;
         const speed = bus.len / (bus.cycleMs / 1000);
         const vx = seg > 0 ? (dx / seg) * speed : 0;
         const vz = seg > 0 ? (dz / seg) * speed : 0;
         return { x: pts[i].x + dx * t, z: pts[i].z + dz * t, vx, vz };
      }
      left -= seg;
   }
   return { x: pts[0].x, z: pts[0].z, vx: 0, vz: 0 };
}

/** Roof box along the bus heading (long axis 3.4 m, across 1.15 m). A parked bus faces +z. */
export function onBusRoof(x: number, z: number, busX: number, busZ: number, vx = 0, vz = 1): boolean {
   let fx = vx;
   let fz = vz;
   const len = Math.hypot(fx, fz);
   if (len < 1e-4) {
      fx = 0;
      fz = 1;
   } else {
      fx /= len;
      fz /= len;
   }
   const dx = x - busX;
   const dz = z - busZ;
   const along = dx * fx + dz * fz;
   const side = -dx * fz + dz * fx;
   return Math.abs(along) <= 3.4 && Math.abs(side) <= 1.15;
}

/** Metres of the shortest corner-cut path. The first edge off `a` pays its full length. */
export function pathMetres(c: Course, a: number, b: number, allow: (e: Edge) => boolean): number {
   if (a === b) return 0;
   const n = c.nx * c.nz;
   const dirs = 4;
   const dist = new Float64Array(n * dirs);
   dist.fill(Infinity);
   const used = new Uint8Array(n * dirs);
   const edges = c.edges;
   // Dijkstra over (node, incoming dir). Incoming -1 is the start.
   const heapN: number[] = [];
   const heapD: number[] = [];
   const heapDir: number[] = [];
   const push = (node: number, dir: number, d: number) => {
      heapN.push(node);
      heapDir.push(dir);
      heapD.push(d);
      let i = heapD.length - 1;
      while (i > 0) {
         const p = (i - 1) >> 1;
         if (heapD[p] <= heapD[i]) break;
         let tmp = heapD[p];
         heapD[p] = heapD[i];
         heapD[i] = tmp;
         tmp = heapN[p];
         heapN[p] = heapN[i];
         heapN[i] = tmp;
         tmp = heapDir[p];
         heapDir[p] = heapDir[i];
         heapDir[i] = tmp;
         i = p;
      }
   };
   push(a, -1, 0);
   while (heapD.length) {
      const u = heapN[0];
      const ud = heapDir[0];
      const du = heapD[0];
      const last = heapD.length - 1;
      heapD[0] = heapD[last];
      heapN[0] = heapN[last];
      heapDir[0] = heapDir[last];
      heapD.pop();
      heapN.pop();
      heapDir.pop();
      let i = 0;
      for (;;) {
         const l = i * 2 + 1;
         const r = l + 1;
         let s = i;
         if (l < heapD.length && heapD[l] < heapD[s]) s = l;
         if (r < heapD.length && heapD[r] < heapD[s]) s = r;
         if (s === i) break;
         let tmp = heapD[s];
         heapD[s] = heapD[i];
         heapD[i] = tmp;
         tmp = heapN[s];
         heapN[s] = heapN[i];
         heapN[i] = tmp;
         tmp = heapDir[s];
         heapDir[s] = heapDir[i];
         heapDir[i] = tmp;
         i = s;
      }
      if (u === b && ud >= 0) return du;
      const key = ud < 0 ? -1 : u * dirs + ud;
      if (ud >= 0) {
         if (used[key]) continue;
         used[key] = 1;
         if (du > dist[key]) continue;
      }
      for (let ei = 0; ei < edges.length; ei++) {
         const e = edges[ei];
         if (!allow(e)) continue;
         const v = e.a === u ? e.b : e.b === u ? e.a : -1;
         if (v < 0) continue;
         const vx = v === e.b ? e.bx : e.ax;
         const vz = v === e.b ? e.bz : e.az;
         const ux = u === e.a ? e.ax : e.bx;
         const uz = u === e.a ? e.az : e.bz;
         const dx = vx - ux;
         const dz = vz - uz;
         const dir = Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 0 : 1) : dz >= 0 ? 2 : 3;
         const turn = ud >= 0 && dir !== ud;
         const w = e.len - (turn ? cornerSave(e.len) : 0);
         const nd = du + Math.max(0.3, w);
         const nk = v * dirs + dir;
         if (nd < dist[nk]) {
            dist[nk] = nd;
            push(v, dir, nd);
         }
      }
   }
   // no path: a long penalty so the proof still has a number, and tests notice
   return (c.nx + c.nz) * CELL * 4;
}

/** Node path for the bot (full centre-line lengths, no corner cuts). */
export function routeNodes(c: Course, a: number, b: number, allow: (e: Edge) => boolean): number[] {
   if (a === b) return [a];
   const n = c.nx * c.nz;
   const dist = new Float64Array(n);
   dist.fill(Infinity);
   const prev = new Int16Array(n);
   prev.fill(-1);
   const used = new Uint8Array(n);
   dist[a] = 0;
   const edges = c.edges;
   for (let iter = 0; iter < n; iter++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) if (!used[i] && dist[i] < best) {
         best = dist[i];
         u = i;
      }
      if (u < 0 || u === b) break;
      used[u] = 1;
      for (let ei = 0; ei < edges.length; ei++) {
         const e = edges[ei];
         if (!allow(e)) continue;
         const v = e.a === u ? e.b : e.b === u ? e.a : -1;
         if (v < 0) continue;
         const nd = dist[u] + e.len;
         if (nd < dist[v]) {
            dist[v] = nd;
            prev[v] = u;
         }
      }
   }
   if (!Number.isFinite(dist[b])) return [a];
   const out: number[] = [];
   for (let v = b; v >= 0; v = prev[v]) {
      out.push(v);
      if (v === a) break;
   }
   out.reverse();
   return out;
}

export function closestNode(c: Course, x: number, z: number): number {
   let best = 0;
   let bestD = Infinity;
   const n = c.nx * c.nz;
   for (let i = 0; i < n; i++) {
      const dx = nodeX(c, i) - x;
      const dz = nodeZ(c, i) - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   }
   return best;
}

/** Straight-line metres from a node to the nearest point on the bus loop (a lower bound). */
export function busMeetMetres(c: Course, node: number): number {
   if (!c.bus) return 0;
   const x = nodeX(c, node);
   const z = nodeZ(c, node);
   let best = Infinity;
   const pts = c.bus.pts;
   for (let i = 0; i < pts.length; i++) {
      const q = pts[(i + 1) % pts.length];
      const d = distToSeg(x, z, pts[i].x, pts[i].z, q.x, q.z).dist;
      if (d < best) best = d;
   }
   return best;
}

export function allowAll(e: Edge): boolean {
   return e.kind !== "rail";
}

export function allowHero(e: Edge, hero: string, cutOpen: boolean): boolean {
   if (e.kind === "rail") return false;
   if (e.kind === "ghost") return hero === "vexa";
   if (e.kind === "cut") return cutOpen || hero === "riko";
   return true;
}
