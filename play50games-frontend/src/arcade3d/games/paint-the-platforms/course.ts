// Paint the Platforms' courses: each level's platforms, cut into 2 m tiles (pure data, no three.js).
// 1 unit = 1 m; the hero starts on the south edge of the first platform and "north" is -z (the camera's
// first view). Every fixed platform's tile grid sits on one 2 m lattice (even x0 / z0), so a fixed tile
// is the lattice cell the hero stands in; a raft carries its own grid. Low rims (1 m, jumpable) line the
// edges so nobody walks off by accident; openings let you onto bridges, gaps and rafts.
//
// - Vexa's cage: a glass cage on a ledge outside the rim, four ghost panels round a prism blob (a
//   shard); only her phase passes them, and a lid keeps everyone out from above.
// - Nami's pillar: 4 m high outside the rim (a single jump from the rim reaches 3.6 m), a gold blob on
//   top (a sticker).
import type { LevelId } from "../../types";
import { LEVELS, type PaintLevel } from "./levels";

export const TILE = 2;
export const RIM_H = 1;
export const RIM_T = 0.4;
export const PILLAR_TOP = 4;
export const CAGE_HALF = 1;
export const CAGE_LID = 3;
export const RAFT_SPEED = 2;
export const RAFT_DWELL_MS = 1500;

export interface Point {
   x: number;
   y: number;
   z: number;
}

export type BoxKind = "floor" | "rim" | "ledge" | "pillar" | "lid" | "pedestal";

export interface Box {
   id: number;
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
   top: number;
   bottom: number;
   kind: BoxKind;
   /** a raft's id (the box rides it), else -1 */
   raft: number;
}

export interface Platform {
   id: number;
   box: number;
   /** the tile grid's min corner (at the raft's home) and size in tiles */
   x0: number;
   z0: number;
   nx: number;
   nz: number;
   raft: number;
   /** tile id per cell (iz * nx + ix), -1 for a hole */
   cells: Int32Array;
   /** where a fall puts the hero back (fixed platforms only) */
   spawn: Point;
}

export interface Tile {
   id: number;
   plat: number;
   ix: number;
   iz: number;
   /** the centre at the raft's home */
   x: number;
   z: number;
   row: number;
}

export interface Raft {
   id: number;
   box: number;
   plat: number;
   /** the rail's axis (a unit vector) and half travel (m); offset -amp / +amp are its two docks */
   ax: number;
   az: number;
   amp: number;
}

export interface Blot {
   id: number;
   /** a closed loop on a fixed platform */
   path: { x: number; z: number }[];
   speed: number;
   /** where along the loop it starts (m) */
   start: number;
}

export interface Pickup {
   id: number;
   x: number;
   y: number;
   z: number;
   /** the tile its splash centres on */
   tile: number;
}

export interface GhostWall {
   x: number;
   y: number;
   z: number;
   normal: "x" | "z";
}

export interface Link {
   from: number;
   to: number;
   /** the departure point (on `from`) and the arrival point (on `to`) */
   x: number;
   z: number;
   tx: number;
   tz: number;
   /** boarding or leaving this raft at the dock where its offset is `dock` (-amp or +amp) */
   raft: number;
   dock: number;
}

export interface BossSpec {
   x: number;
   y: number;
   z: number;
   /** the body's radius (solid) */
   r: number;
}

export interface Course {
   level: LevelId;
   cfg: PaintLevel;
   boxes: Box[];
   platforms: Platform[];
   tiles: Tile[];
   /** tile ids per row (one platform's z band) */
   rows: number[][];
   /** tiles to paint for the win */
   need: number;
   start: Point;
   rafts: Raft[];
   blots: Blot[];
   pickups: Pickup[];
   cage: Point;
   ghostWalls: GhostWall[];
   high: Point;
   /** the roller's platform, or -1 */
   roller: number;
   boss: BossSpec | null;
   links: Link[];
   durationMs: number;
   targetMs: number;
}

type Gaps = [number, number][] | "open";

interface RimSpec {
   n?: Gaps;
   s?: Gaps;
   e?: Gaps;
   w?: Gaps;
}

class Builder {
   boxes: Box[] = [];
   platforms: Platform[] = [];
   tiles: Tile[] = [];
   rows: number[][] = [];
   rafts: Raft[] = [];
   blots: Blot[] = [];
   pickups: Pickup[] = [];
   ghostWalls: GhostWall[] = [];
   links: Link[] = [];
   cage: Point = { x: 0, y: 0, z: 0 };
   high: Point = { x: 0, y: 0, z: 0 };

   box(minX: number, maxX: number, minZ: number, maxZ: number, top: number, kind: BoxKind, bottom = top - 1, raft = -1): Box {
      const b: Box = { id: this.boxes.length, minX, maxX, minZ, maxZ, top, bottom, kind, raft };
      this.boxes.push(b);
      return b;
   }

   /** A platform of nx x nz tiles from (x0, z0), with rims and optional holes ([ix, iz] cells). */
   plat(x0: number, z0: number, nx: number, nz: number, rims: RimSpec = {}, holes: [number, number][] = [], raft = -1): Platform {
      const x1 = x0 + nx * TILE;
      const z1 = z0 + nz * TILE;
      const b = this.box(x0, x1, z0, z1, 0, "floor", -1, raft);
      const p: Platform = { id: this.platforms.length, box: b.id, x0, z0, nx, nz, raft, cells: new Int32Array(nx * nz).fill(-1), spawn: { x: (x0 + x1) / 2, y: 0, z: z1 - TILE } };
      this.platforms.push(p);
      for (let iz = 0; iz < nz; iz++) {
         const row: number[] = [];
         const rowId = this.rows.length;
         for (let ix = 0; ix < nx; ix++) {
            if (holes.some(([hx, hz]) => hx === ix && hz === iz)) continue;
            const t: Tile = { id: this.tiles.length, plat: p.id, ix, iz, x: x0 + TILE * (ix + 0.5), z: z0 + TILE * (iz + 0.5), row: rowId };
            this.tiles.push(t);
            p.cells[iz * nx + ix] = t.id;
            row.push(t.id);
         }
         this.rows.push(row);
      }
      if (raft < 0) {
         this.rim(rims.n, x0, x1, (a, c) => this.box(a, c, z0 - RIM_T, z0, RIM_H, "rim"));
         this.rim(rims.s, x0, x1, (a, c) => this.box(a, c, z1, z1 + RIM_T, RIM_H, "rim"));
         this.rim(rims.w, z0, z1, (a, c) => this.box(x0 - RIM_T, x0, a, c, RIM_H, "rim"));
         this.rim(rims.e, z0, z1, (a, c) => this.box(x1, x1 + RIM_T, a, c, RIM_H, "rim"));
      }
      return p;
   }

   private rim(g: Gaps | undefined, from: number, to: number, make: (a: number, c: number) => void): void {
      if (g === "open") return;
      let at = from - RIM_T;
      for (const [a, c] of [...(g ?? [])].sort((u, v) => u[0] - v[0])) {
         if (a > at) make(at, a);
         at = c;
      }
      if (to + RIM_T > at) make(at, to + RIM_T);
   }

   /** A raft of nx x nz tiles whose home centre is (cx, cz), shuttling `amp` each way along (ax, az). */
   raftPlat(cx: number, cz: number, nx: number, nz: number, ax: number, az: number, amp: number): Platform {
      const id = this.rafts.length;
      const p = this.plat(cx - (nx * TILE) / 2, cz - (nz * TILE) / 2, nx, nz, {}, [], id);
      this.rafts.push({ id, box: p.box, plat: p.id, ax, az, amp });
      return p;
   }

   tileAt(p: Platform, x: number, z: number): number {
      const ix = Math.floor((x - p.x0) / TILE);
      const iz = Math.floor((z - p.z0) / TILE);
      if (ix < 0 || iz < 0 || ix >= p.nx || iz >= p.nz) throw new Error(`no tile at ${x}, ${z}`);
      return p.cells[iz * p.nx + ix];
   }

   pickup(p: Platform, ix: number, iz: number): void {
      const tile = p.cells[iz * p.nx + ix];
      if (tile < 0) throw new Error("pickup on a hole");
      const t = this.tiles[tile];
      this.pickups.push({ id: this.pickups.length, x: t.x, y: 0.75, z: t.z, tile });
   }

   blot(path: [number, number][], speed: number, start = 0): void {
      this.blots.push({ id: this.blots.length, path: path.map(([x, z]) => ({ x, z })), speed, start });
   }

   /** Vexa's cage on a 3 x 3 m ledge centred at (cx, cz), outside a rim. */
   cageAt(cx: number, cz: number): void {
      this.box(cx - 1.5, cx + 1.5, cz - 1.5, cz + 1.5, 0, "ledge");
      this.box(cx - CAGE_HALF - 0.1, cx + CAGE_HALF + 0.1, cz - CAGE_HALF - 0.1, cz + CAGE_HALF + 0.1, CAGE_LID + 0.2, "lid", CAGE_LID);
      const y = CAGE_LID - 1.2;
      this.ghostWalls.push({ x: cx - CAGE_HALF, y, z: cz, normal: "x" }, { x: cx + CAGE_HALF, y, z: cz, normal: "x" }, { x: cx, y, z: cz - CAGE_HALF, normal: "z" }, { x: cx, y, z: cz + CAGE_HALF, normal: "z" });
      this.cage = { x: cx, y: 0.75, z: cz };
   }

   /** Nami's pillar (1.5 x 1.5 m) centred at (cx, cz). */
   pillarAt(cx: number, cz: number): void {
      this.box(cx - 0.75, cx + 0.75, cz - 0.75, cz + 0.75, PILLAR_TOP, "pillar", -1);
      this.high = { x: cx, y: PILLAR_TOP + 0.75, z: cz };
   }

   link(from: Platform, to: Platform, x: number, z: number, tx: number, tz: number, raft = -1, dock = 0): void {
      this.links.push({ from: from.id, to: to.id, x, z, tx, tz, raft, dock });
      if (raft < 0) this.links.push({ from: to.id, to: from.id, x: tx, z: tz, tx: x, tz: z, raft, dock });
   }
}

export function buildCourse(level: LevelId): Course {
   const cfg = LEVELS[level];
   const k = new Builder();
   let roller = -1;
   let boss: BossSpec | null = null;
   const start: Point = { x: 0, y: 0, z: -2 };
   const slow = 2.2;
   const fast = 2.8;
   if (level === 1) {
      // one courtyard, 8 x 7 tiles
      const a = k.plat(-8, -14, 8, 7);
      k.pickup(a, 1, 1);
      k.pickup(a, 6, 1);
      k.pickup(a, 3, 4);
      k.cageAt(10, -7);
      k.pillarAt(-9.9, -9);
   } else if (level === 2) {
      // two courts joined by a 2 x 3 bridge; a grey blot crawls each court
      const a = k.plat(-6, -12, 6, 6, { n: [[-2, 2]] });
      const g = k.plat(-2, -18, 2, 3, { n: "open", s: "open" });
      const b = k.plat(-6, -30, 6, 6, { s: [[-2, 2]] });
      k.link(a, g, 0, -11, 0, -13);
      k.link(g, b, 0, -17, 0, -19);
      k.pickup(a, 0, 1);
      k.pickup(b, 5, 1);
      k.pickup(b, 0, 4);
      k.blot([[-3, -9], [3, -9], [3, -3], [-3, -3]], slow);
      k.blot([[-3, -27], [3, -27], [3, -21], [-3, -21]], slow, 6);
      k.cageAt(8, -25);
      k.pillarAt(-7.9, -7);
   } else if (level === 3) {
      // three islands; tile rafts shuttle across the gaps (their tiles count)
      const a = k.plat(-6, -10, 6, 5, { n: [[-2, 2]] });
      const r1 = k.raftPlat(0, -15, 2, 2, 0, 1, 3);
      const b = k.plat(-6, -32, 6, 6, { s: [[-2, 2]], e: [[-28, -24]] });
      const r2 = k.raftPlat(11, -26, 2, 2, 1, 0, 3);
      const c = k.plat(16, -32, 4, 4, { w: [[-28, -24]] });
      // r1: +3 docks at A (spans -14..-10), -3 at B (-20..-16); r2: -3 docks at B (6..10), +3 at C (12..16)
      k.link(a, r1, 0, -9.2, 0, -12.5, 0, 3);
      k.link(r1, b, 0, -17.5, 0, -21, 0, -3);
      k.link(b, r1, 0, -21, 0, -17.5, 0, -3);
      k.link(r1, a, 0, -12.5, 0, -9.2, 0, 3);
      k.link(b, r2, 5, -26, 7.5, -26, 1, -3);
      k.link(r2, c, 13.5, -26, 17, -26, 1, 3);
      k.link(c, r2, 17, -26, 13.5, -26, 1, 3);
      k.link(r2, b, 7.5, -26, 5, -26, 1, -3);
      k.pickup(a, 0, 0);
      k.pickup(b, 5, 0);
      k.pickup(b, 0, 5);
      k.pickup(c, 3, 3);
      k.blot([[-3, -7], [3, -7], [3, -3], [-3, -3]], slow);
      k.blot([[-3, -29], [3, -29], [3, -23], [-3, -23]], slow, 6);
      k.cageAt(22, -21);
      k.pillarAt(-7.9, -26);
   } else if (level === 4) {
      // the big court with the roller, and a small court each side across a 2 m gap
      const a = k.plat(-8, -16, 8, 8, { w: [[-12, -4]], e: [[-12, -4]] });
      const w = k.plat(-16, -12, 3, 4, { e: [[-12, -4]] });
      const e = k.plat(10, -12, 3, 4, { w: [[-12, -4]] });
      k.link(a, w, -7.2, -8, -10.8, -8);
      k.link(a, e, 7.2, -8, 10.8, -8);
      roller = a.id;
      k.pickup(a, 1, 1);
      k.pickup(a, 6, 1);
      k.pickup(w, 0, 0);
      k.pickup(e, 2, 3);
      k.blot([[-5, -13], [-1, -13], [-1, -9], [-5, -9]], fast);
      k.blot([[1, -7], [5, -7], [5, -3], [1, -3]], fast, 4);
      k.blot([[11, -11], [15, -11], [15, -5], [11, -5]], slow, 2);
      k.cageAt(0, -19.5);
      k.pillarAt(-14, -2.8);
   } else {
      // the Paint Blob's court: 10 x 10 tiles, the Blob on its pedestal in the middle (4 tiles)
      const a = k.plat(-10, -20, 10, 10, {}, [[4, 4], [5, 4], [4, 5], [5, 5]]);
      k.box(-2, 2, -12, -8, 0.6, "pedestal", -1);
      boss = { x: 0, y: 0.6, z: -10, r: 1.5 };
      k.pickup(a, 0, 0);
      k.pickup(a, 9, 0);
      k.pickup(a, 0, 9);
      k.pickup(a, 9, 9);
      k.blot([[-8, -18], [-4, -18], [-4, -14], [-8, -14]], slow);
      k.blot([[4, -6], [8, -6], [8, -2], [4, -2]], slow, 3);
      k.cageAt(12.5, -15);
      k.pillarAt(-11.9, -15);
   }
   const total = k.tiles.length;
   return {
      level,
      cfg,
      boxes: k.boxes,
      platforms: k.platforms,
      tiles: k.tiles,
      rows: k.rows,
      need: Math.ceil(cfg.goal * total - 1e-9),
      start,
      rafts: k.rafts,
      blots: k.blots,
      pickups: k.pickups,
      cage: k.cage,
      ghostWalls: k.ghostWalls,
      high: k.high,
      roller,
      boss,
      links: k.links,
      durationMs: cfg.durationMs,
      targetMs: cfg.targetMs,
   };
}

const CACHE: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (CACHE[level] ??= buildCourse(level));
}

/**
 * A raft's offset along its rail at time ms: it waits RAFT_DWELL_MS at each dock (-amp first), then
 * crosses at RAFT_SPEED. Pure.
 */
export function raftOffset(ms: number, amp: number): number {
   if (amp <= 0) return 0;
   const cross = ((2 * amp) / RAFT_SPEED) * 1000;
   const cycle = 2 * (cross + RAFT_DWELL_MS);
   const u = ((ms % cycle) + cycle) % cycle;
   if (u < RAFT_DWELL_MS) return -amp;
   if (u < RAFT_DWELL_MS + cross) return -amp + (2 * amp * (u - RAFT_DWELL_MS)) / cross;
   if (u < 2 * RAFT_DWELL_MS + cross) return amp;
   return amp - (2 * amp * (u - 2 * RAFT_DWELL_MS - cross)) / cross;
}

/** A point along a blot's closed loop, `dist` m from its first corner. */
export function loopPoint(path: { x: number; z: number }[], dist: number, out: { x: number; z: number }): { x: number; z: number } {
   let len = 0;
   for (let i = 0; i < path.length; i++) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      len += Math.hypot(b.x - a.x, b.z - a.z);
   }
   let d = ((dist % len) + len) % len;
   for (let i = 0; i < path.length; i++) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      if (d <= l) {
         out.x = a.x + ((b.x - a.x) * d) / l;
         out.z = a.z + ((b.z - a.z) * d) / l;
         return out;
      }
      d -= l;
   }
   out.x = path[0].x;
   out.z = path[0].z;
   return out;
}
