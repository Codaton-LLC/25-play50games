// The open city: a block grid between 6 m streets, built from a level spec (levels.ts), and the pure
// queries the rules, the bots, the scene and the limit proof share. Intersections sit CELL metres
// apart; a street edge joins two neighbouring intersections. Blocks are buildings (solid), plazas,
// open lots (cones), construction sites (solid until Riko smashes the hoarding) or ghost shops (Vexa
// phases through). Nothing here mutates a run.
import type { LevelId } from "../../types";
import { CELL, LEVELS, RAIL_Y, type BlockKind, type CitySpec, type XYZ, type XZ } from "./levels";

export { CELL, RAIL_Y };

/** Half a street, kerb to kerb (asphalt plus pavement): blocks are CELL - 2 * STREET_HALF wide. */
export const STREET_HALF = 3;
export const HERO_R = 0.32;
/** A beacon takes you within this many metres of its centre (any height under BEACON_TOP). */
export const PICKUP_R = 1.6;
export const BEACON_TOP = 4;
/** A bus beacon: stand on that bus's roof within this many metres of its centre. */
export const BUS_PICK_R = 2.6;

/** The bus: 8.5 m long, 2.6 m wide, its roof a deck you stand on (a plain jump falls short of it). */
export const BUS_HALF_L = 4.25;
export const BUS_HALF_W = 1.3;
export const BUS_ROOF = 3.4;

/** A street ramp: 5 m long, rising to RAMP_H at its lip. A jump off the lip clears a bus roof. */
export const RAMP_LEN = 5;
export const RAMP_HALF_W = 1.3;
export const RAMP_H = 1.4;
/** The rail deck's half width. */
export const RAIL_HALF_W = 1.3;

/** Greyout (the level 5 sweeper truck): 6.4 m long, 3.4 m wide, 3.8 m tall; its brush units on the roof. */
export const TRUCK_HALF_L = 3.2;
export const TRUCK_HALF_W = 1.7;
export const TRUCK_ROOF = 3.8;
/** A hit on the roof brushes: over the roof with the feet at this height or more (a plain jump peaks at 3.27 m). */
export const BRUSH_HIT_Y = 3.5;
/** The valves sit on its back. */
export const VALVE_BACK = 3.5;
export const VALVE_HIT_R = 1.8;

/** Colour gates: 8 s cycle, green the first half (phase 0) or the second (phase 1). */
export const GATE_PERIOD = 8000;
export const GATE_GREEN = 4000;
/** The gate bar is this deep along the street. */
export const GATE_HALF_D = 0.45;

/** Steam vents: 3 s cycle, venting the first 1.2 s. */
export const VENT_PERIOD = 3000;
export const VENT_ON = 1200;

/** Cones in an open lot, metres in from its corners. */
export const CONE_R = 0.35;

/**
 * The proof's obstacle margin: the proof grows each building by HERO_R - PROOF_MARGIN (so by 2 cm),
 * not HERO_R. The rules keep the hero's centre HERO_R out of every building but cap a ms's travel
 * at V_RED, so a push may leave it a few mm inside for a ms; this margin covers that many times over.
 */
export const PROOF_MARGIN = 0.3;

export interface Block {
   bx: number;
   bz: number;
   kind: BlockKind;
   x0: number;
   z0: number;
   x1: number;
   z1: number;
}

export interface Edge {
   a: number;
   b: number;
   ax: number;
   az: number;
   bx: number;
   bz: number;
   /** along x (else along z) */
   horiz: boolean;
   /** level 5: Greyout Avenue, red from the start and never swept */
   permanent: boolean;
   /** level 4: part of the perfect loop */
   ring: boolean;
}

export interface Gate {
   edge: number;
   x: number;
   z: number;
   /** the bar's half extents (across the street, along it) */
   hx: number;
   hz: number;
   phase: 0 | 1;
}

export interface BusPath {
   pts: XZ[];
   /** segment lengths and the total */
   segs: number[];
   len: number;
   cycleMs: number;
   phaseMs: number;
   parked: boolean;
   /** a parked bus's heading (rad, 0 = +z) */
   yaw: number;
}

export interface Ramp {
   /** the lip */
   x: number;
   z: number;
   /** unit direction it rises toward */
   dx: number;
   dz: number;
}

export interface Orb extends XYZ {
   main: boolean;
   /** a coin pulled out of a storm drain: only Zuno's magnet frees it (index into drains) */
   drain: number;
}

export type Beacon = { bus: -1; x: number; z: number } | { bus: number; x: number; z: number };

export interface Course {
   id: LevelId;
   name: string;
   spec: CitySpec;
   nx: number;
   nz: number;
   laps: number;
   timerMs: number;
   starTargetMs: number;
   startX: number;
   startZ: number;
   /** the yaw that puts the orbit camera behind the start, looking at the first beacon */
   startYaw: number;
   beacons: Beacon[];
   blocks: Block[];
   /** blockAt[bz * (nx - 1) + bx] */
   edges: Edge[];
   /** edge index of the street from node (ix, iz) toward +x / +z, -1 at the border */
   hEdge: Int16Array;
   vEdge: Int16Array;
   gates: Gate[];
   buses: BusPath[];
   ramps: Ramp[];
   rail: { ax: number; az: number; bx: number; bz: number; y: number } | null;
   cones: { x: number; z: number }[];
   sludge: { x: number; z: number; r: number }[];
   vents: { x: number; z: number; r: number }[];
   drains: XZ[];
   orbs: Orb[];
   mainOrbs: number;
   secrets: XYZ[];
   night: boolean;
   boss: boolean;
   ringEdges: number[];
   permanentEdges: number[];
   brushStops: CitySpec["brushStops"];
   valveStops: CitySpec["valveStops"];
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
}

/** Coins per storm drain (Zuno's hidden trail), in a ring round it. */
export const DRAIN_COINS = 3;

export function nodeId(c: { nx: number }, ix: number, iz: number): number {
   return iz * c.nx + ix;
}

export function nodeX(c: { nx: number }, id: number): number {
   return (id % c.nx) * CELL;
}

export function nodeZ(c: { nx: number }, id: number): number {
   return Math.floor(id / c.nx) * CELL;
}

const DIR: Record<"+x" | "-x" | "+z" | "-z", [number, number]> = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] };

/** The street edge between two neighbouring nodes, or -1. */
export function edgeBetween(c: Course, a: [number, number], b: [number, number]): number {
   const [ax, az] = a;
   const [bx, bz] = b;
   if (az === bz && Math.abs(ax - bx) === 1) return c.hEdge[nodeId(c, Math.min(ax, bx), az)];
   if (ax === bx && Math.abs(az - bz) === 1) return c.vEdge[nodeId(c, ax, Math.min(az, bz))];
   return -1;
}

/** Every edge on the straight node-to-node walk through `pts` (closed when `closed`). */
function edgesAlong(c: Course, pts: [number, number][], closed: boolean): number[] {
   const out: number[] = [];
   const count = closed ? pts.length : pts.length - 1;
   for (let i = 0; i < count; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      const sx = Math.sign(bx - ax);
      const sz = Math.sign(bz - az);
      if (sx !== 0 && sz !== 0) throw new Error(`edgesAlong: diagonal ${pts[i]} -> ${pts[(i + 1) % pts.length]}`);
      let x = ax;
      let z = az;
      while (x !== bx || z !== bz) {
         const e = edgeBetween(c, [x, z], [x + sx, z + sz]);
         if (e < 0) throw new Error(`edgesAlong: no street at ${x},${z}`);
         out.push(e);
         x += sx;
         z += sz;
      }
   }
   return out;
}

export function buildCourse(spec: CitySpec): Course {
   const { nx, nz } = spec;
   const edges: Edge[] = [];
   const hEdge = new Int16Array(nx * nz).fill(-1);
   const vEdge = new Int16Array(nx * nz).fill(-1);
   for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
         const id = iz * nx + ix;
         if (ix + 1 < nx) {
            hEdge[id] = edges.length;
            edges.push({ a: id, b: id + 1, ax: ix * CELL, az: iz * CELL, bx: (ix + 1) * CELL, bz: iz * CELL, horiz: true, permanent: false, ring: false });
         }
         if (iz + 1 < nz) {
            vEdge[id] = edges.length;
            edges.push({ a: id, b: id + nx, ax: ix * CELL, az: iz * CELL, bx: ix * CELL, bz: (iz + 1) * CELL, horiz: false, permanent: false, ring: false });
         }
      }
   }
   const blocks: Block[] = [];
   for (let bz = 0; bz < nz - 1; bz++) {
      for (let bx = 0; bx < nx - 1; bx++) {
         const over = spec.blocks.find((b) => b.at[0] === bx && b.at[1] === bz);
         blocks.push({
            bx,
            bz,
            kind: over ? over.kind : "building",
            x0: bx * CELL + STREET_HALF,
            z0: bz * CELL + STREET_HALF,
            x1: (bx + 1) * CELL - STREET_HALF,
            z1: (bz + 1) * CELL - STREET_HALF,
         });
      }
   }
   const cones: Course["cones"] = [];
   for (const b of blocks) {
      if (b.kind !== "lot") continue;
      // a staggered field across the lot's diagonal: weave through it or go round
      const w = b.x1 - b.x0;
      const d = b.z1 - b.z0;
      const marks: [number, number][] = [
         [0.22, 0.5],
         [0.5, 0.22],
         [0.5, 0.78],
         [0.78, 0.5],
         [0.36, 0.36],
         [0.64, 0.64],
      ];
      for (const [u, v] of marks) cones.push({ x: b.x0 + u * w, z: b.z0 + v * d });
   }
   const buses: BusPath[] = spec.buses.map((s) => {
      const pts = s.loop.map(([ix, iz]) => ({ x: ix * CELL, z: iz * CELL }));
      if (s.parked) {
         return { pts: [{ x: pts[0].x + s.parked.dx, z: pts[0].z + s.parked.dz }], segs: [0], len: 0, cycleMs: 0, phaseMs: 0, parked: true, yaw: s.parked.yaw };
      }
      const segs: number[] = [];
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
         const q = pts[(i + 1) % pts.length];
         const l = Math.hypot(q.x - pts[i].x, q.z - pts[i].z);
         segs.push(l);
         len += l;
      }
      return { pts, segs, len, cycleMs: s.cycleMs, phaseMs: s.phaseMs, parked: false, yaw: 0 };
   });
   const ramps: Ramp[] = spec.ramps.map((r) => ({ x: r.x, z: r.z, dx: DIR[r.dir][0], dz: DIR[r.dir][1] }));
   const rail = spec.rail
      ? { ax: spec.rail.a[0] * CELL, az: spec.rail.a[1] * CELL, bx: spec.rail.b[0] * CELL, bz: spec.rail.b[1] * CELL, y: RAIL_Y }
      : null;
   const orbs: Orb[] = spec.orbs.map((o) => ({ ...o, drain: -1 }));
   spec.drains.forEach((d, i) => {
      for (let k = 0; k < DRAIN_COINS; k++) {
         const a = (k / DRAIN_COINS) * Math.PI * 2 + 0.4;
         orbs.push({ x: d.x + Math.cos(a) * 1.1, y: 0.55, z: d.z + Math.sin(a) * 1.1, main: false, drain: i });
      }
   });
   const beacons: Beacon[] = spec.beacons.map((b) => ("bus" in b ? { bus: b.bus, x: 0, z: 0 } : { bus: -1, x: b.x, z: b.z }));
   const first = spec.beacons[0];
   const fx = "bus" in first ? buses[first.bus].pts[0].x : first.x;
   const fz = "bus" in first ? buses[first.bus].pts[0].z : first.z;
   const course: Course = {
      id: spec.id,
      name: spec.name,
      spec,
      nx,
      nz,
      laps: spec.laps,
      timerMs: spec.timerMs,
      starTargetMs: spec.starTargetMs,
      startX: spec.start.x,
      startZ: spec.start.z,
      // the orbit's yaw puts the camera at pivot + (sin yaw, cos yaw): behind = away from the beacon
      startYaw: Math.atan2(spec.start.x - fx, spec.start.z - fz),
      beacons,
      blocks,
      edges,
      hEdge,
      vEdge,
      gates: [],
      buses,
      ramps,
      rail,
      cones,
      sludge: spec.sludge.map((s) => ({ ...s })),
      vents: spec.vents.map((s) => ({ ...s })),
      drains: spec.drains.map((s) => ({ ...s })),
      orbs,
      mainOrbs: orbs.filter((o) => o.main).length,
      secrets: spec.secrets.map((s) => ({ ...s })),
      night: spec.night,
      boss: spec.boss,
      ringEdges: [],
      permanentEdges: [],
      brushStops: spec.brushStops,
      valveStops: spec.valveStops,
      minX: -STREET_HALF,
      maxX: (nx - 1) * CELL + STREET_HALF,
      minZ: -STREET_HALF,
      maxZ: (nz - 1) * CELL + STREET_HALF,
   };
   for (const g of spec.gates) {
      const e = edgeBetween(course, g.a, g.b);
      if (e < 0) throw new Error(`gate on no street: ${g.a} ${g.b}`);
      const ed = edges[e];
      const mx = (ed.ax + ed.bx) / 2;
      const mz = (ed.az + ed.bz) / 2;
      // the bar lies across the street: along x streets it is thin in x
      course.gates.push({ edge: e, x: mx, z: mz, hx: ed.horiz ? GATE_HALF_D : STREET_HALF, hz: ed.horiz ? STREET_HALF : GATE_HALF_D, phase: g.phase });
   }
   if (spec.ring) {
      course.ringEdges = edgesAlong(course, spec.ring, true);
      for (const e of course.ringEdges) edges[e].ring = true;
   }
   if (spec.avenue) {
      course.permanentEdges = edgesAlong(course, spec.avenue, false);
      for (const e of course.permanentEdges) edges[e].permanent = true;
   }
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

export function blockAt(c: Course, bx: number, bz: number): Block | null {
   if (bx < 0 || bz < 0 || bx >= c.nx - 1 || bz >= c.nz - 1) return null;
   return c.blocks[bz * (c.nx - 1) + bx];
}

// ---------------------------------------------------------------------------------------------
// streets

/** Distance from (px, pz) to an axis-aligned edge, and where along it (0..1). */
function edgeDist(e: Edge, px: number, pz: number, out: { d: number; t: number }): void {
   if (e.horiz) {
      const t = Math.max(0, Math.min(1, (px - e.ax) / CELL));
      const qx = e.ax + t * CELL;
      out.d = Math.hypot(px - qx, pz - e.az);
      out.t = t;
   } else {
      const t = Math.max(0, Math.min(1, (pz - e.az) / CELL));
      const qz = e.az + t * CELL;
      out.d = Math.hypot(px - e.ax, pz - qz);
      out.t = t;
   }
}

const tmpD = { d: 0, t: 0 };

/**
 * The street edges within STREET_HALF of a point (up to four round a crossing), written into `out`;
 * returns how many. O(1): only the edges of the cell the point is in can be that near.
 */
export function edgesNear(c: Course, x: number, z: number, out: Int16Array): number {
   let n = 0;
   const ix = Math.floor(x / CELL);
   const iz = Math.floor(z / CELL);
   for (let dz = 0; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
         const jx = ix + dx;
         const jz = iz + dz;
         if (jx < 0 || jz < 0 || jx >= c.nx || jz >= c.nz) continue;
         const h = c.hEdge[jz * c.nx + jx];
         if (h >= 0 && dz <= 1) {
            edgeDist(c.edges[h], x, z, tmpD);
            if (tmpD.d <= STREET_HALF && n < out.length) out[n++] = h;
         }
      }
   }
   for (let dx = 0; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
         const jx = ix + dx;
         const jz = iz + dz;
         if (jx < 0 || jz < 0 || jx >= c.nx || jz >= c.nz) continue;
         const v = c.vEdge[jz * c.nx + jx];
         if (v >= 0) {
            edgeDist(c.edges[v], x, z, tmpD);
            if (tmpD.d <= STREET_HALF && n < out.length) out[n++] = v;
         }
      }
   }
   return n;
}

/**
 * The street a point is running along (for the paint): within STREET_HALF of the edge and clear of
 * both crossings (t in 0.15..0.85), so a crossing street is not painted by passing over it. -1 if none.
 */
export function streetUnder(c: Course, x: number, z: number): number {
   const ix = Math.floor(x / CELL);
   const iz = Math.floor(z / CELL);
   const fx = x / CELL - ix;
   const fz = z / CELL - iz;
   // along x: nearest row of nodes
   const rz = Math.round(z / CELL);
   if (fx > 0.15 && fx < 0.85 && ix >= 0 && ix < c.nx - 1 && rz >= 0 && rz < c.nz && Math.abs(z - rz * CELL) <= STREET_HALF) {
      return c.hEdge[rz * c.nx + ix];
   }
   const rx = Math.round(x / CELL);
   if (fz > 0.15 && fz < 0.85 && iz >= 0 && iz < c.nz - 1 && rx >= 0 && rx < c.nx && Math.abs(x - rx * CELL) <= STREET_HALF) {
      return c.vEdge[iz * c.nx + rx];
   }
   return -1;
}

// ---------------------------------------------------------------------------------------------
// moving things

export function gateShut(g: Gate, ms: number): boolean {
   const t = ms % GATE_PERIOD;
   const green = g.phase === 0 ? t < GATE_GREEN : t >= GATE_GREEN;
   return !green;
}

/** Ms until this gate next changes (green to red or back). */
export function gateChangeIn(g: Gate, ms: number): number {
   const t = ms % GATE_PERIOD;
   const edge = t < GATE_GREEN ? GATE_GREEN : GATE_PERIOD;
   return edge - t;
}

export function ventOn(ms: number, i: number): boolean {
   return (ms + i * 900) % VENT_PERIOD < VENT_ON;
}

export interface BusPose {
   x: number;
   z: number;
   vx: number;
   vz: number;
   /** heading, rad (0 = +z) */
   yaw: number;
}

export function createBusPose(): BusPose {
   return { x: 0, z: 0, vx: 0, vz: 0, yaw: 0 };
}

/** Where a bus is at rules ms `ms` (allocation-free). */
export function busAt(bus: BusPath, ms: number, out: BusPose): BusPose {
   if (bus.parked) {
      out.x = bus.pts[0].x;
      out.z = bus.pts[0].z;
      out.vx = 0;
      out.vz = 0;
      out.yaw = bus.yaw;
      return out;
   }
   const t = (((ms + bus.phaseMs) % bus.cycleMs) + bus.cycleMs) % bus.cycleMs;
   let left = (t / bus.cycleMs) * bus.len;
   const speed = bus.len / (bus.cycleMs / 1000);
   const pts = bus.pts;
   for (let i = 0; i < pts.length; i++) {
      const seg = bus.segs[i];
      if (left <= seg || i === pts.length - 1) {
         const q = pts[(i + 1) % pts.length];
         const dx = q.x - pts[i].x;
         const dz = q.z - pts[i].z;
         const k = seg > 0 ? Math.min(1, left / seg) : 0;
         out.x = pts[i].x + dx * k;
         out.z = pts[i].z + dz * k;
         out.vx = seg > 0 ? (dx / seg) * speed : 0;
         out.vz = seg > 0 ? (dz / seg) * speed : 0;
         out.yaw = Math.atan2(dx, dz);
         return out;
      }
      left -= seg;
   }
   out.x = pts[0].x;
   out.z = pts[0].z;
   out.vx = out.vz = 0;
   return out;
}

/** In a bus's (or the truck's) box: along its heading within halfL, across within halfW (+ grow). */
export function inBox(x: number, z: number, cx: number, cz: number, yaw: number, halfL: number, halfW: number, grow = 0): boolean {
   const fx = Math.sin(yaw);
   const fz = Math.cos(yaw);
   const dx = x - cx;
   const dz = z - cz;
   const along = dx * fx + dz * fz;
   const side = dx * fz - dz * fx;
   return Math.abs(along) <= halfL + grow && Math.abs(side) <= halfW + grow;
}

/** The ramp surface's height at a point (0 off every ramp). */
export function rampY(c: Course, x: number, z: number): number {
   let y = 0;
   for (const r of c.ramps) {
      const back = (r.x - x) * r.dx + (r.z - z) * r.dz;
      if (back < 0 || back > RAMP_LEN) continue;
      const side = Math.abs((x - r.x) * r.dz - (z - r.z) * r.dx);
      if (side > RAMP_HALF_W) continue;
      const h = (1 - back / RAMP_LEN) * RAMP_H;
      if (h > y) y = h;
   }
   return y;
}

/** Over the rail deck (xz only). */
export function overRail(c: Course, x: number, z: number): boolean {
   const r = c.rail;
   if (!r) return false;
   if (r.az === r.bz) return Math.abs(z - r.az) <= RAIL_HALF_W && x >= Math.min(r.ax, r.bx) - 0.5 && x <= Math.max(r.ax, r.bx) + 0.5;
   return Math.abs(x - r.ax) <= RAIL_HALF_W && z >= Math.min(r.az, r.bz) - 0.5 && z <= Math.max(r.az, r.bz) + 0.5;
}

export function inCircles(list: readonly { x: number; z: number; r: number }[], x: number, z: number): number {
   for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < s.r * s.r) return i;
   }
   return -1;
}

// ---------------------------------------------------------------------------------------------
// collision

export interface Passage {
   /** Vexa is phasing */
   phase: boolean;
   /** the ghost block the hero is inside (it stays passable until she is out), -1 none */
   insideGhost: number;
   /** the construction site is open (Riko smashed its hoarding) */
   siteOpen: boolean;
}

/** Is block `b` solid for this hero right now? */
export function blockSolid(b: Block, index: number, p: Passage): boolean {
   if (b.kind === "building") return true;
   if (b.kind === "site") return !p.siteOpen;
   if (b.kind === "ghost") return !p.phase && p.insideGhost !== index;
   return false;
}

/** The block a point is inside (its rectangle), or -1. */
export function blockIndexAt(c: Course, x: number, z: number): number {
   const bx = Math.floor(x / CELL);
   const bz = Math.floor(z / CELL);
   const b = blockAt(c, bx, bz);
   if (!b) return -1;
   if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return bz * (c.nx - 1) + bx;
   return -1;
}

const pushOut = { x: 0, z: 0 };

/**
 * Pushes a hero centre out of every solid block (grown by HERO_R), the lot cones and the city's edge.
 * The result is written to `out`. A shut gate is handled by the rules (it only stops entry).
 */
export function resolveXZ(c: Course, x: number, z: number, p: Passage, out: { x: number; z: number }): { x: number; z: number } {
   let px = Math.max(c.minX + HERO_R, Math.min(c.maxX - HERO_R, x));
   let pz = Math.max(c.minZ + HERO_R, Math.min(c.maxZ - HERO_R, z));
   const bx = Math.floor(px / CELL);
   const bz = Math.floor(pz / CELL);
   for (let pass = 0; pass < 2; pass++) {
      for (let dz = -1; dz <= 1; dz++) {
         for (let dx = -1; dx <= 1; dx++) {
            const b = blockAt(c, bx + dx, bz + dz);
            if (!b) continue;
            const idx = (bz + dz) * (c.nx - 1) + bx + dx;
            if (!blockSolid(b, idx, p)) continue;
            if (px <= b.x0 - HERO_R || px >= b.x1 + HERO_R || pz <= b.z0 - HERO_R || pz >= b.z1 + HERO_R) continue;
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
      }
      for (const cone of c.cones) {
         const ddx = px - cone.x;
         const ddz = pz - cone.z;
         const reach = CONE_R + HERO_R;
         const d2 = ddx * ddx + ddz * ddz;
         if (d2 < reach * reach && d2 > 1e-12) {
            const k = reach / Math.sqrt(d2);
            px = cone.x + ddx * k;
            pz = cone.z + ddz * k;
         }
      }
   }
   pushOut.x = px;
   pushOut.z = pz;
   out.x = pushOut.x;
   out.z = pushOut.z;
   return out;
}

/** Inside a gate's bar, grown by HERO_R. */
export function inGate(g: Gate, x: number, z: number): boolean {
   return Math.abs(x - g.x) < g.hx + HERO_R && Math.abs(z - g.z) < g.hz + HERO_R;
}

// ---------------------------------------------------------------------------------------------
// street routes (the bots and Greyout drive along the streets)

/** The nearest intersection to a point. */
export function closestNode(c: Course, x: number, z: number): number {
   const ix = Math.max(0, Math.min(c.nx - 1, Math.round(x / CELL)));
   const iz = Math.max(0, Math.min(c.nz - 1, Math.round(z / CELL)));
   return iz * c.nx + ix;
}

/** The node path between two nodes along the streets (BFS, x moves first on ties). */
export function streetRoute(c: Course, a: number, b: number, blocked?: (edge: number) => boolean): number[] {
   if (a === b) return [a];
   const n = c.nx * c.nz;
   const prev = new Int16Array(n).fill(-1);
   const seen = new Uint8Array(n);
   const queue: number[] = [a];
   seen[a] = 1;
   for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      if (u === b) break;
      const ux = u % c.nx;
      const uz = Math.floor(u / c.nx);
      const tryEdge = (v: number, e: number) => {
         if (e < 0 || seen[v] || (blocked && blocked(e))) return;
         seen[v] = 1;
         prev[v] = u;
         queue.push(v);
      };
      if (ux + 1 < c.nx) tryEdge(u + 1, c.hEdge[u]);
      if (ux > 0) tryEdge(u - 1, c.hEdge[u - 1]);
      if (uz + 1 < c.nz) tryEdge(u + c.nx, c.vEdge[u]);
      if (uz > 0) tryEdge(u - c.nx, c.vEdge[u - c.nx]);
   }
   if (!seen[b]) return [a];
   const out: number[] = [];
   for (let v = b; v >= 0; v = prev[v]) {
      out.push(v);
      if (v === a) break;
   }
   return out.reverse();
}

// ---------------------------------------------------------------------------------------------
// the proof's geometry: shortest paths round the buildings (a visibility graph)

interface Rect {
   x0: number;
   z0: number;
   x1: number;
   z1: number;
}

/** True when the segment (ax, az)-(bx, bz) passes through the open inside of the rectangle. */
function segHitsRect(ax: number, az: number, bx: number, bz: number, r: Rect): boolean {
   let t0 = 0;
   let t1 = 1;
   const dx = bx - ax;
   const dz = bz - az;
   const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) < 1e-12) return q > 0;
      const t = q / p;
      if (p < 0) {
         if (t > t1) return false;
         if (t > t0) t0 = t;
      } else {
         if (t < t0) return false;
         if (t < t1) t1 = t;
      }
      return true;
   };
   // strict inside: shrink by a hair so grazing a corner or running along a side is free
   const e = 1e-7;
   if (!clip(-dx, ax - (r.x0 + e))) return false;
   if (!clip(dx, r.x1 - e - ax)) return false;
   if (!clip(-dz, az - (r.z0 + e))) return false;
   if (!clip(dz, r.z1 - e - az)) return false;
   return t1 - t0 > 1e-9;
}

export interface Geodesic {
   rects: Rect[];
   corners: XZ[];
   /** corner-to-corner visibility distances (Infinity = blocked) */
   cc: Float64Array;
}

/** The proof's obstacles: the buildings only (lots, plazas, sites, ghost shops and props are free). */
export function buildGeodesic(c: Course): Geodesic {
   const g = HERO_R - PROOF_MARGIN;
   const rects: Rect[] = c.blocks.filter((b) => b.kind === "building").map((b) => ({ x0: b.x0 - g, z0: b.z0 - g, x1: b.x1 + g, z1: b.z1 + g }));
   const corners: XZ[] = [];
   const out = 1e-6;
   for (const r of rects) {
      corners.push({ x: r.x0 - out, z: r.z0 - out }, { x: r.x1 + out, z: r.z0 - out }, { x: r.x1 + out, z: r.z1 + out }, { x: r.x0 - out, z: r.z1 + out });
   }
   const n = corners.length;
   const cc = new Float64Array(n * n).fill(Infinity);
   for (let i = 0; i < n; i++) {
      cc[i * n + i] = 0;
      for (let j = i + 1; j < n; j++) {
         const d = visible(rects, corners[i].x, corners[i].z, corners[j].x, corners[j].z) ? Math.hypot(corners[i].x - corners[j].x, corners[i].z - corners[j].z) : Infinity;
         cc[i * n + j] = d;
         cc[j * n + i] = d;
      }
   }
   return { rects, corners, cc };
}

export function visible(rects: readonly Rect[], ax: number, az: number, bx: number, bz: number): boolean {
   for (const r of rects) if (segHitsRect(ax, az, bx, bz, r)) return false;
   return true;
}

/** Shortest-path distances from a point to every corner (Dijkstra over the visibility graph). */
export function cornerDistances(geo: Geodesic, x: number, z: number): Float64Array {
   const n = geo.corners.length;
   const dist = new Float64Array(n).fill(Infinity);
   const done = new Uint8Array(n);
   for (let i = 0; i < n; i++) {
      const c = geo.corners[i];
      if (visible(geo.rects, x, z, c.x, c.z)) dist[i] = Math.hypot(c.x - x, c.z - z);
   }
   for (let iter = 0; iter < n; iter++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
         if (!done[i] && dist[i] < best) {
            best = dist[i];
            u = i;
         }
      }
      if (u < 0) break;
      done[u] = 1;
      for (let v = 0; v < n; v++) {
         const w = geo.cc[u * n + v];
         if (w === Infinity || done[v]) continue;
         if (best + w < dist[v]) dist[v] = best + w;
      }
   }
   return dist;
}

/** The shortest path length between two points round the proof's obstacles. */
export function geoDistance(geo: Geodesic, fromCorners: Float64Array, fx: number, fz: number, tx: number, tz: number): number {
   let best = visible(geo.rects, fx, fz, tx, tz) ? Math.hypot(tx - fx, tz - fz) : Infinity;
   for (let i = 0; i < geo.corners.length; i++) {
      const d = fromCorners[i];
      if (d === Infinity || d >= best) continue;
      const c = geo.corners[i];
      const rest = Math.hypot(tx - c.x, tz - c.z);
      if (d + rest >= best) continue;
      if (visible(geo.rects, c.x, c.z, tx, tz)) best = d + rest;
   }
   return best;
}
