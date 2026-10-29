// The playroom built from a level spec (levels.ts): desks, shelves and ledges, the chains with every
// piece placed along its polyline, and the pure queries the rules, bots, scene and proof share.
// Nothing here mutates a run.
import type { LevelId } from "../../types";
import { LEVELS, type ChainSpec, type PieceKind, type PlatSpec, type ToySpec, type XZ, type ZoneSpec } from "./levels";

/** Pieces stand this far apart along their chain. A fallen piece is PIECE_H long: they overlap. */
export const PIECE_SPACING = 1.4;
export const PIECE_H = 2;
export const PIECE_W = 1.6;
export const PIECE_T = 0.6;
/** The hero's radius. */
export const HERO_R = 0.32;
/** A timed bridge piece over a gap lies down this long, then slides off the edge. */
export const BRIDGE_MS = 1800;
/** The drum throws whoever stands on it for this long after the wave hits it. */
export const DRUM_WINDOW_MS = 350;
export const DRUM_R = 1.25;
export const DRUM_TOP = 0.7;
/** The pencil ramp: 6 m long, rising to PENCIL_H at its lip. */
export const PENCIL_LEN = 6;
export const PENCIL_H = 1.6;
export const PENCIL_HALF_W = 0.9;
/** A race car: 3.2 m long, 1.8 m wide, its roof a deck at CAR_ROOF. */
export const CAR_HALF_L = 1.6;
export const CAR_HALF_W = 0.9;
export const CAR_ROOF = 1.2;
/** Spinning tops bump within this radius. */
export const TOP_R = 1.1;
/** Kiro's cascades: a block tower falls across the zone this often, for CASCADE_ON. */
export const CASCADE_PERIOD = 3200;
export const CASCADE_ON = 1000;
/** Reach of a checkpoint, the finish, an orb, a secret. */
export const CHECKPOINT_R = 2.2;
export const FINISH_R = 2.5;
export const PICKUP_R = 1.4;
/** Below this the hero has fallen to the carpet: respawn. */
export const FALL_Y = -6;

export interface Piece {
   chain: number;
   slot: number;
   x: number;
   z: number;
   /** unit direction it falls toward */
   dx: number;
   dz: number;
   /** distance along its chain */
   s: number;
   /** over the void (a bridge piece once fallen) */
   gap: boolean;
   /** an empty slot (the wave stalls here) */
   missing: boolean;
   kind: PieceKind;
}

export interface Chain {
   spec: ChainSpec;
   /** index of its first piece in course.pieces */
   first: number;
   count: number;
   speed: number;
   length: number;
}

export interface Course {
   id: LevelId;
   name: string;
   spec: ToySpec;
   timerMs: number;
   starTargetMs: number;
   startX: number;
   startZ: number;
   startYaw: number;
   plats: PlatSpec[];
   chains: Chain[];
   pieces: Piece[];
   drums: { x: number; z: number; chain: number; piece: number }[];
   cars: { pts: XZ[]; segs: number[]; len: number; speed: number; chain: number; piece: number }[];
   tops: ToySpec["tops"];
   cascades: ZoneSpec[];
   walls: ZoneSpec[];
   ghosts: ZoneSpec[];
   castles: ZoneSpec[];
   /** the castles' solid walls (CASTLE_WALL thick), with a gap where a ghost doorway is */
   castleWalls: ZoneSpec[];
   pencils: { x: number; z: number; dx: number; dz: number }[];
   checkpoints: XZ[];
   orbs: ToySpec["orbs"];
   mainOrbs: number;
   secrets: ToySpec["secrets"];
   finish: XZ;
   night: boolean;
   boss: boolean;
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
}

const DIR: Record<"+x" | "-x" | "+z" | "-z", [number, number]> = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] };

/** A castle's walls are this thick; inside it is hollow (the sticker's room). */
export const CASTLE_WALL = 0.6;

/** The castles as four walls each; a wall a ghost doorway crosses is split round it. */
export function castleWalls(castles: readonly ZoneSpec[], ghosts: readonly ZoneSpec[]): ZoneSpec[] {
   const out: ZoneSpec[] = [];
   const T = CASTLE_WALL;
   for (const c of castles) {
      const walls: ZoneSpec[] = [
         { x0: c.x0, x1: c.x0 + T, z0: c.z0, z1: c.z1 },
         { x0: c.x1 - T, x1: c.x1, z0: c.z0, z1: c.z1 },
         { x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z0 + T },
         { x0: c.x0, x1: c.x1, z0: c.z1 - T, z1: c.z1 },
      ];
      for (const w of walls) {
         const g = ghosts.find((q) => q.x0 < w.x1 && q.x1 > w.x0 && q.z0 < w.z1 && q.z1 > w.z0);
         if (!g) {
            out.push(w);
            continue;
         }
         // the doorway: a vertical wall splits along z, a horizontal one along x
         if (w.x1 - w.x0 <= T + 1e-6) {
            if (g.z0 > w.z0) out.push({ ...w, z1: g.z0 });
            if (g.z1 < w.z1) out.push({ ...w, z0: g.z1 });
         } else {
            if (g.x0 > w.x0) out.push({ ...w, x1: g.x0 });
            if (g.x1 < w.x1) out.push({ ...w, x0: g.x1 });
         }
      }
   }
   return out;
}

/** Is (x, z) over a desk (a y = 0 platform)? */
export function onDesk(plats: readonly PlatSpec[], x: number, z: number, margin = 0): boolean {
   for (const p of plats) if (p.y === 0 && x >= p.x0 - margin && x <= p.x1 + margin && z >= p.z0 - margin && z <= p.z1 + margin) return true;
   return false;
}

export function buildCourse(spec: ToySpec): Course {
   const pieces: Piece[] = [];
   const chains: Chain[] = [];
   spec.chains.forEach((cs, ci) => {
      const first = pieces.length;
      let len = 0;
      const segs: number[] = [];
      for (let i = 1; i < cs.pts.length; i++) {
         const l = Math.hypot(cs.pts[i][0] - cs.pts[i - 1][0], cs.pts[i][1] - cs.pts[i - 1][1]);
         segs.push(l);
         len += l;
      }
      let slot = 0;
      for (let s = 0; s <= len + 1e-6; s += PIECE_SPACING) {
         let left = s;
         let k = 0;
         while (k < segs.length - 1 && left > segs[k]) {
            left -= segs[k];
            k++;
         }
         const a = cs.pts[k];
         const b = cs.pts[k + 1];
         const t = segs[k] > 0 ? Math.min(1, left / segs[k]) : 0;
         const x = a[0] + (b[0] - a[0]) * t;
         const z = a[1] + (b[1] - a[1]) * t;
         const dx = (b[0] - a[0]) / segs[k];
         const dz = (b[1] - a[1]) / segs[k];
         pieces.push({ chain: ci, slot, x, z, dx, dz, s, gap: !onDesk(spec.plats, x, z, 0.3), missing: !!cs.missing?.includes(slot), kind: cs.kind });
         slot++;
      }
      chains.push({ spec: cs, first, count: pieces.length - first, speed: cs.speed, length: len });
   });
   const pieceOf = (chain: number, index: number) => chains[chain].first + (index < 0 ? chains[chain].count + index : Math.min(index, chains[chain].count - 1));
   const cars = spec.cars.map((c) => {
      const pts = c.track.map(([x, z]) => ({ x, z }));
      const segs: number[] = [];
      let len = 0;
      for (let i = 1; i < pts.length; i++) {
         const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
         segs.push(l);
         len += l;
      }
      return { pts, segs, len, speed: c.speed, chain: c.chain, piece: pieceOf(c.chain, c.index) };
   });
   let minX = Infinity;
   let maxX = -Infinity;
   let minZ = Infinity;
   let maxZ = -Infinity;
   for (const p of spec.plats) {
      minX = Math.min(minX, p.x0);
      maxX = Math.max(maxX, p.x1);
      minZ = Math.min(minZ, p.z0);
      maxZ = Math.max(maxZ, p.z1);
   }
   return {
      id: spec.id,
      name: spec.name,
      spec,
      timerMs: spec.timerMs,
      starTargetMs: spec.starTargetMs,
      startX: spec.start.x,
      startZ: spec.start.z,
      // the orbit camera sits at pivot + (sin yaw, cos yaw): behind the start (-z), looking down the room
      startYaw: Math.PI,
      plats: spec.plats,
      chains,
      pieces,
      drums: spec.drums.map((d) => ({ x: d.x, z: d.z, chain: d.chain, piece: pieceOf(d.chain, d.index) })),
      cars,
      tops: spec.tops,
      cascades: spec.cascades,
      walls: spec.walls,
      ghosts: spec.ghosts,
      castles: spec.castles,
      castleWalls: castleWalls(spec.castles, spec.ghosts),
      pencils: spec.pencils.map((p) => ({ x: p.x, z: p.z, dx: DIR[p.dir][0], dz: DIR[p.dir][1] })),
      checkpoints: spec.checkpoints,
      orbs: spec.orbs,
      mainOrbs: spec.orbs.filter((o) => o.main).length,
      secrets: spec.secrets,
      finish: spec.finish,
      night: spec.night,
      boss: spec.boss,
      minX,
      maxX,
      minZ,
      maxZ,
   };
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

/** The pencil ramp's height at a point (0 off every ramp). */
export function pencilY(c: Course, x: number, z: number): number {
   let y = 0;
   for (const r of c.pencils) {
      const back = (r.x - x) * r.dx + (r.z - z) * r.dz;
      if (back < 0 || back > PENCIL_LEN) continue;
      const side = Math.abs((x - r.x) * r.dz - (z - r.z) * r.dx);
      if (side > PENCIL_HALF_W) continue;
      const h = (1 - back / PENCIL_LEN) * PENCIL_H;
      if (h > y) y = h;
   }
   return y;
}

export function inZone(z: ZoneSpec, x: number, zz: number, grow = 0): boolean {
   return x > z.x0 - grow && x < z.x1 + grow && zz > z.z0 - grow && zz < z.z1 + grow;
}

/** Pushes a point out of a zone (grown by HERO_R) along the shortest axis. */
export function pushOutOf(z: ZoneSpec, x: number, zz: number, out: { x: number; z: number }): boolean {
   const g = HERO_R;
   if (!(x > z.x0 - g && x < z.x1 + g && zz > z.z0 - g && zz < z.z1 + g)) return false;
   const dl = x - (z.x0 - g);
   const dr = z.x1 + g - x;
   const db = zz - (z.z0 - g);
   const dt = z.z1 + g - zz;
   const m = Math.min(dl, dr, db, dt);
   out.x = x;
   out.z = zz;
   if (m === dl) out.x = z.x0 - g;
   else if (m === dr) out.x = z.x1 + g;
   else if (m === db) out.z = z.z0 - g;
   else out.z = z.z1 + g;
   return true;
}

/** Where a car is along its track at distance d (clamped). */
export function carAt(car: Course["cars"][number], d: number, out: { x: number; z: number; yaw: number }): void {
   let left = Math.max(0, Math.min(car.len, d));
   for (let i = 0; i < car.segs.length; i++) {
      const a = car.pts[i];
      const b = car.pts[i + 1];
      if (left <= car.segs[i] || i === car.segs.length - 1) {
         const t = car.segs[i] > 0 ? Math.min(1, left / car.segs[i]) : 0;
         out.x = a.x + (b.x - a.x) * t;
         out.z = a.z + (b.z - a.z) * t;
         out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
         return;
      }
      left -= car.segs[i];
   }
}

/** A spinning top's position at rules ms. */
export function topAt(t: ToySpec["tops"][number], i: number, ms: number, out: { x: number; z: number }): void {
   const a = (ms / t.periodMs) * Math.PI * 2 + i * 1.7;
   out.x = t.x + Math.cos(a) * t.r;
   out.z = t.z + Math.sin(a) * t.r;
}

export function cascadeOn(i: number, ms: number): boolean {
   return (ms + i * 1100) % CASCADE_PERIOD < CASCADE_ON;
}

/** Is a standing piece's box (thickness along its fall direction, width across) hit by a hero at (x, z)? */
export function inPiece(p: Piece, x: number, z: number, grow = HERO_R): { along: number; side: number } | null {
   const rx = x - p.x;
   const rz = z - p.z;
   const along = rx * p.dx + rz * p.dz;
   const side = rx * p.dz - rz * p.dx;
   if (Math.abs(along) > PIECE_T / 2 + grow || Math.abs(side) > PIECE_W / 2 + grow) return null;
   return { along, side };
}

/** Is (x, z) over a fallen piece's top (it lies from its base forward PIECE_H)? */
export function onFallen(p: Piece, x: number, z: number): boolean {
   const rx = x - p.x;
   const rz = z - p.z;
   const along = rx * p.dx + rz * p.dz;
   const side = rx * p.dz - rz * p.dx;
   return along >= -0.25 && along <= PIECE_H + 0.1 && Math.abs(side) <= PIECE_W / 2 + 0.05;
}
