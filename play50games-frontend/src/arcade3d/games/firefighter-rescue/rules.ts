// Firefighter Rescue rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// One corridor (3 m) with rooms alternating left and right (6 m along the hall, 5 m deep).
// A locked door is a fire in that doorway: the flood fill keeps the room shut until it is out.
// Movement is the on-foot mover (accel 22, brake 28, radius 0.38, top speed 4.6).
import { resolveSphereAabb, sphereAabbOverlap, sweptAabbXZ, type AABB } from "@/arcade3d/core/collision";
import { arrive } from "@/arcade3d/core/ai/steering";
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type FireLevel } from "./levels";

// ---------- tuning (the scoring proof cites these) ----------

export const LIVES = 3;
export const FIRE_POINTS = 100;
export const SAVE_POINTS = 150;
export const CLEAN_POINTS = 50;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 6;

export const HALL_HALF = 1.5;
export const ROOM_LEN = 6;
export const ROOM_DEEP = 5;
export const DOOR_HALF = 0.8;
export const PORCH_Z = -3.4;
export const RADIUS = 0.38;
export const FOLLOW_RADIUS = 0.32;
export const MAX_SPEED = 4.6;
export const ACCEL = 22;
export const BRAKE = 28;
export const SMOKE_SCALE = 0.65;
export const SPRAY_RANGE = 1.3;
export const SPRAY_FIRE_S = 0.75;
export const SPRAY_TALK_S = 0.3;
export const HOP_S = 0.4;
export const HOP_H = 0.55;
export const STUN_S = 0.5;
export const BREATH_REFILL = 0.25;
export const FOLLOW_SPEED = 3.2;
export const FOLLOW_GAP = 1.1;
export const STUCK_SPEED = 0.15;
export const STUCK_TIME = 1.2;
export const STUCK_AWAY = 2;
export const SMOKE_R = 0.95;
export const DEBRIS_WARN = 0.6;
export const DEBRIS_TRAVEL = 4;
export const DEBRIS_CYCLE = DEBRIS_WARN + DEBRIS_TRAVEL + DEBRIS_WARN + DEBRIS_TRAVEL;
export const DEBRIS_X0 = -1.05;
export const DEBRIS_X1 = 1.05;
export const DEBRIS_HALF = { x: 0.34, y: 0.45, z: 0.34 } as const;

export const EXIT = { minX: -1.15, maxX: 1.15, minZ: -2.9, maxZ: -1.15 } as const;
export const EXIT_AT = { x: 0, z: -2.7 } as const;
export const START = { x: 0, z: 0.85 } as const;

export const FURN_SIZE = {
   sofa: { x: 0.7, y: 0.72, z: 1.7 },
   bed: { x: 0.9, y: 0.48, z: 1.55 },
   cabinet: { x: 0.48, y: 1.05, z: 0.7 },
   chair: { x: 0.46, y: 0.82, z: 0.46 },
} as const;

export type FurnKind = keyof typeof FURN_SIZE;

/** Sketch limits from the spec. The proof in README retunes these to the oracle. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 1100, minDurationMs: 4000, maxDurationMs: 120_000, base: 400, maxPointsPerSec: 96, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1650, minDurationMs: 4000, maxDurationMs: 150_000, base: 800, maxPointsPerSec: 40, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 2200, minDurationMs: 4000, maxDurationMs: 180_000, base: 1200, maxPointsPerSec: 32, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 2550, minDurationMs: 4000, maxDurationMs: 180_000, base: 1600, maxPointsPerSec: 24, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 3050, minDurationMs: 4000, maxDurationMs: 210_000, base: 2000, maxPointsPerSec: 20, unitLabel: "pts", display: "int" },
};

// ---------- layout ----------

export interface Fire {
   x: number;
   z: number;
   room: number;
   /** sitting in the doorway: the room stays shut until this fire is out */
   door: boolean;
   out: boolean;
}

export interface Civilian {
   x: number;
   z: number;
   vx: number;
   vz: number;
   yaw: number;
   phase: number;
   homeX: number;
   homeZ: number;
   room: number;
   following: boolean;
   saved: boolean;
   /** +50 on save unless the hero's breath hit 0 while this civilian was following */
   clean: boolean;
   stuck: number;
}

export interface SmokeDisc { x: number; z: number; r: number }
export interface Debris { z: number; phase: number; x: number; prev: number }

export interface Furniture {
   kind: FurnKind;
   x: number;
   z: number;
   rotY: number;
}

export interface Solid {
   box: AABB;
   on: boolean;
   room: number;
}

interface Rect { x0: number; x1: number; z0: number; z1: number; room: number }

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   fire: number;
   save: number;
   debris: boolean;
   hop: boolean;
   breathBreak: boolean;
   spraying: boolean;
}

export interface Run {
   seed: number;
   level: FireLevel;
   hero: { x: number; y: number; z: number; vx: number; vz: number; yaw: number; hop: number; stun: number; breath: number };
   fires: Fire[];
   civilians: Civilian[];
   smoke: SmokeDisc[];
   debris: Debris[];
   furniture: Furniture[];
   solids: Solid[];
   rects: Rect[];
   follower: number;
   lives: number;
   score: number;
   firesOut: number;
   saved: number;
   over: "win" | "lose" | null;
   holdKind: 0 | 1 | 2;
   holdIndex: number;
   holdTime: number;
   time: number;
   ev: StepEvents;
}

export interface FireInput {
   moveX: number;
   moveY: number;
   action: boolean;
   jumpPressed: boolean;
   /** camera yaw, the same value useFittedView returns; keyboard and touch both land here */
   yaw: number;
}

export const idleInput = (): FireInput => ({ moveX: 0, moveY: 0, action: false, jumpPressed: false, yaw: 0 });

const hallEnd = (level: FireLevel) => level.rooms * ROOM_LEN;

export function inExit(x: number, z: number): boolean {
   return x >= EXIT.minX && x <= EXIT.maxX && z >= EXIT.minZ && z <= EXIT.maxZ;
}

/** Which side of the hall a room opens on (the level's plan; level 1 alternates from the left). */
export function roomSide(level: FireLevel, room: number): -1 | 1 {
   return level.plan.sides[room] ?? (room % 2 === 0 ? -1 : 1);
}

/** A room wing's depth (m) from the hall wall to its outer wall (the level's plan). */
export function roomDeep(level: FireLevel): number {
   return level.plan.deep;
}

export function doorMidZ(level: FireLevel, room: number): number {
   return room * ROOM_LEN + ROOM_LEN / 2 + (level.plan.doorShift[room] ?? 0);
}

/** Hall side of a doorway, where a spray from the corridor reaches the lock fire. */
export function doorPoint(level: FireLevel, room: number): { x: number; z: number } {
   return { x: roomSide(level, room) < 0 ? -1.02 : 1.02, z: doorMidZ(level, room) };
}

export function doorClosed(run: Run, room: number, gone?: readonly boolean[]): boolean {
   for (let i = 0; i < run.fires.length; i++) {
      const fire = run.fires[i];
      if (fire.door && fire.room === room && !fire.out && !(gone && gone[i])) return true;
   }
   return false;
}

/** -1 hall or porch, else the room index. -2 is outside the floor. */
export function roomOf(level: FireLevel, x: number, z: number): number {
   if (Math.abs(x) <= HALL_HALF + 1e-6 && z >= PORCH_Z - 1e-6 && z <= hallEnd(level) + 1e-6) return -1;
   const deep = roomDeep(level);
   for (let i = 0; i < level.rooms; i++) {
      const left = roomSide(level, i) < 0;
      const x0 = left ? -HALL_HALF - deep : HALL_HALF;
      const x1 = left ? -HALL_HALF : HALL_HALF + deep;
      const z0 = i * ROOM_LEN;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z0 + ROOM_LEN) return i;
   }
   return -2;
}

function rectsFor(level: FireLevel): Rect[] {
   const rects: Rect[] = [{ x0: -HALL_HALF, x1: HALL_HALF, z0: PORCH_Z, z1: hallEnd(level), room: -1 }];
   const deep = roomDeep(level);
   for (let i = 0; i < level.rooms; i++) {
      const left = roomSide(level, i) < 0;
      const x0 = left ? -HALL_HALF - deep : HALL_HALF;
      const x1 = left ? -HALL_HALF : HALL_HALF + deep;
      const z0 = i * ROOM_LEN;
      rects.push({ x0, x1, z0, z1: z0 + ROOM_LEN, room: -1 });
      // wide enough that erosion still joins the room to the hall through the 1.6 m door
      const zMid = doorMidZ(level, i);
      rects.push({
         x0: left ? -HALL_HALF - 1.35 : HALL_HALF - 1.15,
         x1: left ? -HALL_HALF + 1.15 : HALL_HALF + 1.35,
         z0: zMid - DOOR_HALF,
         z1: zMid + DOOR_HALF,
         room: i,
      });
   }
   return rects;
}

export function pointInside(run: Run, x: number, z: number, radius: number, gone?: readonly boolean[]): boolean {
   for (const rect of run.rects) {
      if (rect.room >= 0 && doorClosed(run, rect.room, gone)) continue;
      if (x >= rect.x0 + radius && x <= rect.x1 - radius && z >= rect.z0 + radius && z <= rect.z1 - radius) return true;
   }
   return false;
}

function overlapsSolid(run: Run, x: number, z: number, radius: number, gone?: readonly boolean[]): boolean {
   const at = { x, y: 0.4, z };
   for (const solid of run.solids) {
      if (solid.room >= 0 && !doorClosed(run, solid.room, gone)) continue;
      if (!solid.on) continue;
      if (sphereAabbOverlap(at, radius, solid.box)) return true;
   }
   return false;
}

export function standable(run: Run, x: number, z: number, radius = RADIUS, gone?: readonly boolean[]): boolean {
   return pointInside(run, x, z, radius, gone) && !overlapsSolid(run, x, z, radius, gone);
}

function boxAt(x: number, z: number, sx: number, sy: number, sz: number, rotY: number): AABB {
   const c = Math.abs(Math.cos(rotY));
   const s = Math.abs(Math.sin(rotY));
   const hx = (c * sx + s * sz) / 2;
   const hz = (s * sx + c * sz) / 2;
   return { min: { x: x - hx, y: 0, z: z - hz }, max: { x: x + hx, y: sy, z: z + hz } };
}

function pushFurn(run: Run, kind: FurnKind, x: number, z: number, rotY: number): void {
   const size = FURN_SIZE[kind];
   run.furniture.push({ kind, x, z, rotY });
   run.solids.push({ box: boxAt(x, z, size.x, size.y, size.z, rotY), on: true, room: -1 });
}

/** Where one debris box is, and whether it is sliding (the 0.6 s ends are the warning). */
export function debrisPose(phase: number): { x: number; moving: boolean } {
   const t = ((phase % DEBRIS_CYCLE) + DEBRIS_CYCLE) % DEBRIS_CYCLE;
   const leg = DEBRIS_WARN + DEBRIS_TRAVEL;
   if (t < DEBRIS_WARN) return { x: DEBRIS_X0, moving: false };
   if (t < leg) return { x: DEBRIS_X0 + (DEBRIS_X1 - DEBRIS_X0) * ((t - DEBRIS_WARN) / DEBRIS_TRAVEL), moving: true };
   if (t < leg + DEBRIS_WARN) return { x: DEBRIS_X1, moving: false };
   return { x: DEBRIS_X1 + (DEBRIS_X0 - DEBRIS_X1) * ((t - leg - DEBRIS_WARN) / DEBRIS_TRAVEL), moving: true };
}

// Each theme keeps every piece at least 1.4 m of wing depth from the hall wall or well off the
// door lane in z, so the doorway rect, the fire spots and the civilian spot stay clear
// (levels-variety.test.ts checks pieces against the doorway rects; createRun flood-fills the rest).
function placeFurniture(run: Run, room: number, sign: -1 | 1, z0: number, mid: number, face: number): void {
   const level = run.level;
   const depth = (d: number) => sign * (HALL_HALF + d);
   switch (level.plan.furn) {
      case "house":
         // the kids' bed by the porch end, the sofa facing the door at the far end, an armchair
         pushFurn(run, "bed", depth(3.55), z0 + 1.2, 0);
         pushFurn(run, "sofa", depth(2.3), z0 + 5.1, 0);
         pushFurn(run, "cabinet", depth(1.2), z0 + 0.7, face);
         pushFurn(run, "chair", depth(2.2), mid - 1.5, face === 0 ? Math.PI / 2 : -Math.PI / 2);
         break;
      case "office":
         // two desks along the hall wall, a visitor chair and the break-area sofa by the outer wall
         pushFurn(run, "cabinet", depth(1.05), z0 + 0.9, face);
         pushFurn(run, "cabinet", depth(1.05), z0 + 5.1, face);
         pushFurn(run, "chair", depth(4.15), z0 + 0.9, face === 0 ? Math.PI / 2 : -Math.PI / 2);
         pushFurn(run, "sofa", depth(4.2), z0 + 5.05, 0);
         break;
      case "hotel":
         // a double bed under the far window, a dresser, an armchair, a porch-end settee
         pushFurn(run, "bed", depth(3.5), z0 + 4.6, 0);
         pushFurn(run, "cabinet", depth(1.1), z0 + 5.25, face);
         pushFurn(run, "chair", depth(2.0), z0 + 3.4, face === 0 ? Math.PI / 2 : -Math.PI / 2);
         pushFurn(run, "sofa", depth(2.3), z0 + 0.9, 0);
         break;
      case "warehouse":
         // crates along the outer wall, a plank stack, a locker bench at the far end
         pushFurn(run, "cabinet", depth(1.1), z0 + 1.0, face);
         pushFurn(run, "cabinet", depth(1.1), z0 + 5.0, face);
         pushFurn(run, "chair", depth(2.4), z0 + 1.0, face === 0 ? Math.PI / 2 : -Math.PI / 2);
         pushFurn(run, "sofa", depth(2.6), z0 + 5.1, 0);
         break;
      default:
         // apartment: today's layout, unchanged
         pushFurn(run, "sofa", depth(2.15), z0 + 1.15, 0);
         pushFurn(run, "bed", depth(3.55), z0 + 5.05, 0);
         pushFurn(run, "cabinet", depth(1.15), z0 + 5.15, face);
         pushFurn(run, "chair", depth(4.15), mid + 0.35, face === 0 ? Math.PI / 2 : -Math.PI / 2);
   }
}

function placeRoom(run: Run, room: number, rng: () => number): { fire: { x: number; z: number }; extra: { x: number; z: number }; civ: { x: number; z: number } } {
   const sign = roomSide(run.level, room);
   const z0 = room * ROOM_LEN;
   const mid = doorMidZ(run.level, room);
   placeFurniture(run, room, sign, z0, mid, sign < 0 ? 0 : Math.PI);
   const jx = (rng() - 0.5) * 0.2;
   return {
      fire: { x: sign * (HALL_HALF + 1.7) + jx, z: mid },
      extra: { x: sign * (HALL_HALF + 2.7) + jx, z: mid + 1.15 },
      civ: { x: sign * (HALL_HALF + 3.15), z: mid + 0.15 },
   };
}

export function createRun(seed: number, level: FireLevel = LEVELS[1]): Run {
   const rng = createRng(seed >>> 0);
   const run: Run = {
      seed: seed >>> 0,
      level,
      hero: { x: START.x, y: 0, z: START.z, vx: 0, vz: 0, yaw: 0, hop: 0, stun: 0, breath: 1 },
      fires: [],
      civilians: [],
      smoke: [],
      debris: [],
      furniture: [],
      solids: [],
      rects: rectsFor(level),
      follower: -1,
      lives: LIVES,
      score: 0,
      firesOut: 0,
      saved: 0,
      over: null,
      holdKind: 0,
      holdIndex: -1,
      holdTime: 0,
      time: 0,
      ev: { score: 0, lifeLost: false, won: false, lost: false, fire: -1, save: -1, debris: false, hop: false, breathBreak: false, spraying: false },
   };

   const spots = [];
   for (let room = 0; room < level.rooms; room++) spots.push(placeRoom(run, room, rng));

   const blocked = new Set<number>();
   for (let i = 0; i < level.blockedDoors; i++) blocked.add(level.rooms - 1 - i);

   for (let room = 0; room < level.rooms; room++) {
      if (blocked.has(room)) {
         const at = doorPoint(level, room);
         run.fires.push({ x: at.x, z: at.z, room, door: true, out: false });
         const left = roomSide(level, room) < 0;
         run.solids.push({
            box: {
               min: { x: left ? -HALL_HALF - 0.28 : HALL_HALF - 0.08, y: 0, z: doorMidZ(level, room) - DOOR_HALF },
               max: { x: left ? -HALL_HALF + 0.08 : HALL_HALF + 0.28, y: 2.2, z: doorMidZ(level, room) + DOOR_HALF },
            },
            on: true,
            room,
         });
      } else {
         const at = spots[room].fire;
         run.fires.push({ x: at.x, z: at.z, room, door: false, out: false });
      }
   }
   let extra = level.fires - level.rooms;
   let cursor = 0;
   while (extra > 0) {
      const room = cursor % level.rooms;
      const at = spots[room].extra;
      run.fires.push({ x: at.x + (extra % 2) * 0.15 * (roomSide(level, room) < 0 ? -1 : 1), z: at.z, room, door: false, out: false });
      extra -= 1;
      cursor += 1;
   }

   for (let i = 0; i < level.civilians; i++) {
      const room = level.rooms - level.civilians + i;
      const at = spots[room].civ;
      run.civilians.push({
         x: at.x, z: at.z, vx: 0, vz: 0, yaw: roomSide(level, room) < 0 ? Math.PI / 2 : -Math.PI / 2, phase: 0,
         homeX: at.x, homeZ: at.z, room, following: false, saved: false, clean: true, stuck: 0,
      });
   }

   for (let i = 0; i < level.smoke; i++) {
      const room = i % level.rooms;
      const side = rng() < 0.5 ? -1 : 1;
      run.smoke.push({ x: side * 1.05, z: room * ROOM_LEN + 1.15, r: SMOKE_R });
   }

   for (let i = 0; i < level.debris; i++) {
      const room = level.rooms - 1 - i;
      const phase = rng() * DEBRIS_CYCLE;
      const x = debrisPose(phase).x;
      run.debris.push({ z: room * ROOM_LEN + 4.65, phase, x, prev: x });
   }

   if (!objectivesReachable(run)) throw new Error(`firefighter layout unreachable (seed ${seed})`);
   return run;
}

// ---------- flood fill ----------

const CELL = 0.4;

function flood(run: Run, gone: boolean[]): Uint8Array {
   const deep = roomDeep(run.level);
   const x0 = -HALL_HALF - deep;
   const z0 = PORCH_Z;
   const cols = Math.ceil((deep * 2 + HALL_HALF * 2) / CELL) + 2;
   const rows = Math.ceil((hallEnd(run.level) - PORCH_Z) / CELL) + 2;
   const open = new Uint8Array(cols * rows);
   const seen = new Uint8Array(cols * rows);
   const qx = new Int16Array(cols * rows);
   const qz = new Int16Array(cols * rows);
   const at = (c: number, r: number) => r * cols + c;
   const wx = (c: number) => x0 + (c + 0.5) * CELL;
   const wz = (r: number) => z0 + (r + 0.5) * CELL;
   for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
         if (standable(run, wx(c), wz(r), RADIUS * 0.92, gone)) open[at(c, r)] = 1;
      }
   }
   const sc = Math.round((START.x - x0) / CELL - 0.5);
   const sr = Math.round((START.z - z0) / CELL - 0.5);
   let head = 0;
   let tail = 0;
   const push = (c: number, r: number) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      const id = at(c, r);
      if (!open[id] || seen[id]) return;
      seen[id] = 1;
      qx[tail] = c;
      qz[tail] = r;
      tail += 1;
   };
   push(sc, sr);
   if (!seen[at(sc, sr)] && open[at(sc, sr)] !== 1) {
      // start cell clipped by a rounding edge: seed every open neighbour
      for (let r = sr - 1; r <= sr + 1; r++) for (let c = sc - 1; c <= sc + 1; c++) push(c, r);
   }
   while (head < tail) {
      const c = qx[head];
      const r = qz[head];
      head += 1;
      push(c + 1, r);
      push(c - 1, r);
      push(c, r + 1);
      push(c, r - 1);
   }
   return seen;
}

function near(run: Run, seen: Uint8Array, x: number, z: number): boolean {
   const deep = roomDeep(run.level);
   const x0 = -HALL_HALF - deep;
   const z0 = PORCH_Z;
   const cols = Math.ceil((deep * 2 + HALL_HALF * 2) / CELL) + 2;
   const rows = Math.ceil((hallEnd(run.level) - PORCH_Z) / CELL) + 2;
   const c0 = Math.round((x - x0) / CELL - 0.5);
   const r0 = Math.round((z - z0) / CELL - 0.5);
   for (let r = r0 - 2; r <= r0 + 2; r++) {
      for (let c = c0 - 2; c <= c0 + 2; c++) {
         if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
         if (!seen[r * cols + c]) continue;
         const dx = x0 + (c + 0.5) * CELL - x;
         const dz = z0 + (r + 0.5) * CELL - z;
         if (dx * dx + dz * dz <= 0.85 * 0.85) return true;
      }
   }
   return false;
}

export interface ReachMap {
   fires: boolean[];
   civilians: boolean[];
   exit: boolean;
}

/** One flood with the fires in `gone` treated as already out (their doors open). */
export function reachWith(run: Run, gone: boolean[]): ReachMap {
   const seen = flood(run, gone);
   return {
      fires: run.fires.map((fire, i) => gone[i] || fire.out || near(run, seen, fire.x, fire.z)),
      civilians: run.civilians.map((civ) => civ.saved || near(run, seen, civ.x, civ.z)),
      exit: near(run, seen, 0, (EXIT.minZ + EXIT.maxZ) / 2),
   };
}

/**
 * Staged fill: a blocked door stays shut until its fire is reached from the open side.
 * Every fire, civilian and the exit must join the reached set. createRun refuses a miss.
 */
export function objectivesReachable(run: Run): boolean {
   const gone = run.fires.map((fire) => fire.out);
   for (let pass = 0; pass <= run.fires.length; pass++) {
      const reach = reachWith(run, gone);
      let opened = false;
      for (let i = 0; i < run.fires.length; i++) {
         if (!gone[i] && reach.fires[i]) {
            gone[i] = true;
            opened = true;
         }
      }
      const civs = reachWith(run, gone).civilians.every(Boolean);
      const exit = reachWith(run, gone).exit;
      if (gone.every(Boolean) && civs && exit) return true;
      if (!opened) return false;
   }
   return false;
}

// ---------- step ----------

const DIR = { x: 0, z: 0 };
const CENTER = { x: 0, y: 0.4, z: 0 };
const STEER = { x: 0, y: 0, z: 0 };
const AGENT = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
const FREE = { x: 0, z: 0 };
const PBOX: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1, z: 0 } };
const DBOX: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1, z: 0 } };

function inSmoke(run: Run, x: number, z: number): boolean {
   for (const disc of run.smoke) {
      const dx = x - disc.x;
      const dz = z - disc.z;
      if (dx * dx + dz * dz <= disc.r * disc.r) return true;
   }
   return false;
}

function slide(run: Run, body: { x: number; z: number; vx: number; vz: number }, radius: number, dt: number): void {
   const ox = body.x;
   const oz = body.z;
   body.x += body.vx * dt;
   body.z += body.vz * dt;
   const push = () => {
      for (const solid of run.solids) {
         if (!solid.on) continue;
         CENTER.x = body.x;
         CENTER.z = body.z;
         resolveSphereAabb(CENTER, radius, solid.box, CENTER);
         body.x = CENTER.x;
         body.z = CENTER.z;
      }
   };
   push();
   if (pointInside(run, body.x, body.z, radius)) return;
   const nx = body.x;
   const nz = body.z;
   body.x = nx;
   body.z = oz;
   push();
   if (pointInside(run, body.x, body.z, radius)) {
      body.vz = 0;
      return;
   }
   body.x = ox;
   body.z = nz;
   push();
   if (pointInside(run, body.x, body.z, radius)) {
      body.vx = 0;
      return;
   }
   body.x = ox;
   body.z = oz;
   body.vx = 0;
   body.vz = 0;
}

/** Nearest standable point on the segment, preferring the hero's end. False when none. */
export function nearestFreePoint(run: Run, x0: number, z0: number, x1: number, z1: number, out = FREE): boolean {
   const dist = Math.hypot(x1 - x0, z1 - z0);
   const steps = Math.max(2, Math.ceil(dist / 0.25));
   let best = Infinity;
   let found = false;
   for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (!standable(run, x, z, FOLLOW_RADIUS)) continue;
      const dHero = (x - x1) * (x - x1) + (z - z1) * (z - z1);
      if (dHero < best) {
         best = dHero;
         out.x = x;
         out.z = z;
         found = true;
      }
   }
   return found;
}

function nearestTarget(run: Run): { kind: 1 | 2; index: number; d: number } | null {
   let best: { kind: 1 | 2; index: number; d: number } | null = null;
   const consider = (kind: 1 | 2, index: number, x: number, z: number) => {
      const dx = run.hero.x - x;
      const dz = run.hero.z - z;
      const d = Math.hypot(dx, dz);
      if (d > SPRAY_RANGE) return;
      if (!best || d < best.d) best = { kind, index, d };
   };
   for (let i = 0; i < run.fires.length; i++) {
      if (!run.fires[i].out) consider(1, i, run.fires[i].x, run.fires[i].z);
   }
   if (run.follower < 0) {
      for (let i = 0; i < run.civilians.length; i++) {
         const civ = run.civilians[i];
         if (!civ.saved) consider(2, i, civ.x, civ.z);
      }
   }
   return best;
}

function breakBreath(run: Run): void {
   run.ev.breathBreak = true;
   run.ev.lifeLost = true;
   run.lives -= 1;
   run.hero.breath = 1;
   if (run.follower >= 0) {
      const civ = run.civilians[run.follower];
      civ.x = civ.homeX;
      civ.z = civ.homeZ;
      civ.vx = 0;
      civ.vz = 0;
      civ.following = false;
      civ.clean = false;
      civ.stuck = 0;
      run.follower = -1;
   }
   if (run.lives <= 0) {
      run.over = "lose";
      run.ev.lost = true;
   }
}

function integrate(body: { vx: number; vz: number }, dirX: number, dirZ: number, dt: number, scale: number): void {
   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }
   const top = MAX_SPEED * scale;
   let dvx = dirX * top - body.vx;
   let dvz = dirZ * top - body.vz;
   const dv = Math.hypot(dvx, dvz);
   const cap = (len > 0.01 ? ACCEL : BRAKE) * dt;
   if (dv > cap && dv > 0) {
      dvx *= cap / dv;
      dvz *= cap / dv;
   }
   body.vx += dvx;
   body.vz += dvz;
}

function clearHold(run: Run): void {
   run.holdKind = 0;
   run.holdIndex = -1;
   run.holdTime = 0;
}

function finishFire(run: Run, index: number): void {
   const fire = run.fires[index];
   if (fire.out) return;
   fire.out = true;
   run.firesOut += 1;
   run.score += FIRE_POINTS;
   run.ev.score += FIRE_POINTS;
   run.ev.fire = index;
   if (fire.door) {
      for (const solid of run.solids) if (solid.room === fire.room) solid.on = false;
   }
   clearHold(run);
}

function finishTalk(run: Run, index: number): void {
   if (run.follower >= 0) return;
   const civ = run.civilians[index];
   if (civ.saved) return;
   civ.following = true;
   run.follower = index;
   clearHold(run);
}

function stepSpray(run: Run, action: boolean, dt: number): void {
   if (!action) {
      clearHold(run);
      return;
   }
   if (run.holdKind === 1) {
      const fire = run.fires[run.holdIndex];
      const dist = fire ? Math.hypot(run.hero.x - fire.x, run.hero.z - fire.z) : Infinity;
      if (!fire || fire.out || dist > SPRAY_RANGE) {
         clearHold(run);
         return;
      }
      run.holdTime += dt;
      run.ev.spraying = true;
      if (run.holdTime >= SPRAY_FIRE_S) finishFire(run, run.holdIndex);
      return;
   }
   const target = nearestTarget(run);
   if (!target) {
      clearHold(run);
      return;
   }
   // a civilian hold only counts while that civilian is strictly the nearest target
   if (run.holdKind !== target.kind || run.holdIndex !== target.index) {
      run.holdKind = target.kind;
      run.holdIndex = target.index;
      run.holdTime = 0;
   }
   run.holdTime += dt;
   run.ev.spraying = true;
   if (target.kind === 2 && target.d <= SPRAY_RANGE && run.holdTime >= SPRAY_TALK_S) finishTalk(run, target.index);
   else if (target.kind === 1 && run.holdTime >= SPRAY_FIRE_S) finishFire(run, target.index);
}

function stepFollower(run: Run, dt: number): void {
   if (run.follower < 0) return;
   const civ = run.civilians[run.follower];
   const dx = run.hero.x - civ.x;
   const dz = run.hero.z - civ.z;
   const dist = Math.hypot(dx, dz);
   const gap = dist > 1e-4 ? FOLLOW_GAP / dist : 0;
   AGENT.x = civ.x;
   AGENT.z = civ.z;
   AGENT.vx = civ.vx;
   AGENT.vz = civ.vz;
   STEER.x = run.hero.x - dx * gap;
   STEER.z = run.hero.z - dz * gap;
   STEER.y = 0;
   arrive(AGENT, STEER, FOLLOW_SPEED, 1.15, STEER);
   civ.vx += STEER.x * dt * 8;
   civ.vz += STEER.z * dt * 8;
   const sp = Math.hypot(civ.vx, civ.vz);
   if (sp > FOLLOW_SPEED) {
      civ.vx = (civ.vx / sp) * FOLLOW_SPEED;
      civ.vz = (civ.vz / sp) * FOLLOW_SPEED;
   }
   const beforeX = civ.x;
   const beforeZ = civ.z;
   slide(run, civ, FOLLOW_RADIUS, dt);
   const moved = dt > 0 ? Math.hypot(civ.x - beforeX, civ.z - beforeZ) / dt : 0;
   civ.phase += moved * dt * 6;
   if (moved > 0.2) civ.yaw = turnTowards(civ.yaw, Math.atan2(civ.vx, civ.vz), Math.min(1, dt * 10));
   if (moved < STUCK_SPEED && dist > STUCK_AWAY) civ.stuck += dt;
   else civ.stuck = 0;
   if (civ.stuck >= STUCK_TIME && nearestFreePoint(run, civ.x, civ.z, run.hero.x, run.hero.z, FREE)) {
      civ.x = FREE.x;
      civ.z = FREE.z;
      civ.vx = 0;
      civ.vz = 0;
      civ.stuck = 0;
   }
   if (inExit(civ.x, civ.z)) {
      civ.following = false;
      civ.saved = true;
      civ.vx = 0;
      civ.vz = 0;
      run.ev.save = run.follower;
      run.follower = -1;
      run.saved += 1;
      const bonus = SAVE_POINTS + (civ.clean ? CLEAN_POINTS : 0);
      run.score += bonus;
      run.ev.score += bonus;
   }
}

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** Objective points only (fires + saves). The clock bonus is separate and win-only. */
export function objectiveCeiling(level: FireLevel): number {
   return FIRE_POINTS * level.fires + (SAVE_POINTS + CLEAN_POINTS) * level.civilians;
}

/**
 * One played frame. `timeLeftMs` is the shell clock (already ticked). Keyboard and touch share
 * this function: only `action`, `jumpPressed` and the stick axes matter, for the same durations.
 */
export function step(run: Run, input: FireInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.fire = -1;
   ev.save = -1;
   ev.debris = false;
   ev.hop = false;
   ev.breathBreak = false;
   ev.spraying = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;

   const stunned = run.hero.stun > 0;
   if (stunned) run.hero.stun = Math.max(0, run.hero.stun - dt);
   if (!stunned && input.jumpPressed && run.hero.hop <= 0) {
      run.hero.hop = HOP_S;
      ev.hop = true;
   }
   if (run.hero.hop > 0) {
      run.hero.hop = Math.max(0, run.hero.hop - dt);
      run.hero.y = Math.sin(Math.PI * (1 - run.hero.hop / HOP_S)) * HOP_H;
   } else run.hero.y = 0;

   for (const debris of run.debris) {
      debris.prev = debris.x;
      debris.phase += dt;
      debris.x = debrisPose(debris.phase).x;
   }

   if (inSmoke(run, run.hero.x, run.hero.z)) run.hero.breath -= run.level.breathDrain * dt;
   else run.hero.breath = Math.min(1, run.hero.breath + BREATH_REFILL * dt);
   if (run.hero.breath <= 0) {
      breakBreath(run);
      if (run.over) return ev;
   }

   inputToWorld(stunned ? 0 : input.moveX, stunned ? 0 : input.moveY, input.yaw, DIR);
   const scale = inSmoke(run, run.hero.x, run.hero.z) ? SMOKE_SCALE : 1;
   integrate(run.hero, DIR.x, DIR.z, dt, scale);
   const ox = run.hero.x;
   const oz = run.hero.z;
   slide(run, run.hero, RADIUS, dt);
   const speed = Math.hypot(run.hero.vx, run.hero.vz);
   if (speed > 0.25) run.hero.yaw = turnTowards(run.hero.yaw, Math.atan2(run.hero.vx, run.hero.vz), Math.min(1, dt * 12));

   // debris already advanced; sweep against the motion that just happened
   if (run.hero.hop <= 0 && run.hero.stun <= 0) {
      for (let i = 0; i < run.debris.length; i++) {
         const debris = run.debris[i];
         const before = debris.prev;
         PBOX.min.x = ox - RADIUS;
         PBOX.max.x = ox + RADIUS;
         PBOX.min.z = oz - RADIUS;
         PBOX.max.z = oz + RADIUS;
         PBOX.min.y = 0;
         PBOX.max.y = 1.2;
         DBOX.min.x = before - DEBRIS_HALF.x;
         DBOX.max.x = before + DEBRIS_HALF.x;
         DBOX.min.z = debris.z - DEBRIS_HALF.z;
         DBOX.max.z = debris.z + DEBRIS_HALF.z;
         DBOX.min.y = 0;
         DBOX.max.y = 0.9;
         const hit = sweptAabbXZ(PBOX, { x: (run.hero.x - ox) - (debris.x - before), z: run.hero.z - oz }, DBOX);
         if (hit === null) continue;
         run.hero.x = ox;
         run.hero.z = oz;
         run.hero.vx *= -0.3;
         run.hero.vz *= -0.3;
         run.hero.stun = STUN_S;
         run.lives -= 1;
         ev.lifeLost = true;
         ev.debris = true;
         if (run.lives <= 0) {
            run.over = "lose";
            ev.lost = true;
            return ev;
         }
         break;
      }
   }

   if (!stunned) stepSpray(run, input.action, dt);
   else clearHold(run);
   stepFollower(run, dt);

   if (!run.over && run.firesOut === run.fires.length && run.saved === run.civilians.length && run.fires.length > 0) {
      const bonus = timeBonus(timeLeftMs);
      run.score += bonus;
      ev.score += bonus;
      run.over = "win";
      ev.won = true;
   }
   return ev;
}
