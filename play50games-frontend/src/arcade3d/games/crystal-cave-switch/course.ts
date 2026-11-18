// Crystal Cave Switch's courses (pure data, no three.js): a crystal cave of linked rooms floating over
// a chasm. Each room is a stone floor whose north edge is a rock wall with a cave gate in the middle; a
// colour beacon beside the gate shows the order its crystal switches must be struck in. Strike them in
// that order and the gate opens onto a crystal bridge to the next room; a wrong crystal (or a decoy)
// resets the room's sequence. Level 2 adds a moving slab to a crystal island, level 3 hidden crystals
// (dim until you are near), level 4 a timer once a sequence starts plus decoys, level 5 everything and
// the Hollow Prism's arena.
//
// Colours are read by shape as well as hue (the World 5 rule): ruby triangle, sapphire square, emerald
// diamond, topaz circle.
//
// Rooms run north (-z), the way the orbit camera looks at yaw 0. Each level also carries the honest
// bot's route (bot.ts): the points to go to in order, the crystals to strike, the slab to ride.
import type { LevelId } from "../../types";
import { LEVELS, type CaveLevel } from "./levels";

export const ROOM_W = 12;
export const ROOM_L = 10;
export const BRIDGE_L = 8;
export const ROOM_STEP = ROOM_L + BRIDGE_L;
export const WALL_H = 4;
export const GATE_HALF = 2;
/** a moving slab slides at this speed (m/s) */
export const RAIL_SPEED = 2;

export const COLOR_NAMES = ["ruby", "sapphire", "emerald", "topaz"] as const;
export type ColorId = 0 | 1 | 2 | 3;

export type BoxKind = "floor" | "wall" | "bridge" | "slab" | "boulder" | "ledge" | "pillar" | "goal";

export interface Rail {
   ax: number;
   az: number;
   amp: number;
}

export interface Box {
   id: number;
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
   /** the top face's height and the bottom */
   top: number;
   bottom: number;
   kind: BoxKind;
   rail: Rail | null;
}

export interface Switch {
   id: number;
   room: number;
   x: number;
   z: number;
   /** the floor it stands on */
   base: number;
   color: ColorId;
   /** not in the room's sequence: striking it resets the room */
   decoy: boolean;
   /** glows only when the hero is near (level 3 on) */
   hidden: boolean;
}

export interface Room {
   id: number;
   /** the switch ids in the order they must be struck */
   seq: number[];
   /** a started sequence must finish within this (ms); 0 = no timer */
   timerMs: number;
   /** the gate box (solid until the room is solved) */
   gate: number;
   /** where a fall puts you back */
   spawn: { x: number; y: number; z: number };
   /** the beacon pillar beside the gate */
   beacon: { x: number; z: number };
   /** the room's floor box */
   floor: number;
}

export interface Point {
   x: number;
   y: number;
   z: number;
}

export interface GhostWall {
   id: number;
   x: number;
   y: number;
   z: number;
   normal: "x" | "z";
   crystal: Point;
}

export interface RouteStep {
   x: number;
   z: number;
   /** strike this switch here */
   act?: number;
   /** ride this moving box (wait for it, jump on, ride to the next step) */
   rail?: number;
}

export interface BossSpec {
   x: number;
   y: number;
   z: number;
   /** the hero wakes it on crossing this z */
   wakeZ: number;
   /** the arena's four crystal switches */
   switches: number[];
}

export interface Course {
   level: LevelId;
   cfg: CaveLevel;
   boxes: Box[];
   switches: Switch[];
   rooms: Room[];
   start: Point;
   /** the goal pad box (-1 on level 5: the win is the boss) */
   goal: number;
   orbs: Point[];
   ghostWalls: GhostWall[];
   /** Nyla's high crystal (a sticker), on a pillar only a double jump reaches */
   high: Point;
   route: RouteStep[];
   boss: BossSpec | null;
   durationMs: number;
   targetMs: number;
}

class Builder {
   boxes: Box[] = [];
   switches: Switch[] = [];
   rooms: Room[] = [];
   orbs: Point[] = [];
   walls: GhostWall[] = [];
   route: RouteStep[] = [];

   box(kind: BoxKind, minX: number, maxX: number, minZ: number, maxZ: number, top: number, depth = 1, rail: Rail | null = null): number {
      const id = this.boxes.length;
      this.boxes.push({ id, minX, maxX, minZ, maxZ, top, bottom: top - depth, kind, rail });
      return id;
   }

   /** The north edge of room k (its floor runs from z0 to z0 - ROOM_L). */
   z0(k: number): number {
      return -k * ROOM_STEP;
   }

   /**
    * Room k: the floor, the north wall with its gate, the beacon, the bridge to the next room. Crystals
    * are given as [x, depth into the room, colour, decoy?, hidden?, base?]; seq lists their indexes in order.
    */
   room(k: number, crystals: [number, number, ColorId, boolean?, boolean?, number?][], seq: number[], timerMs = 0): Room {
      const z0 = this.z0(k);
      const north = z0 - ROOM_L;
      const floor = this.box("floor", -ROOM_W / 2, ROOM_W / 2, north, z0, 0, 1.2);
      this.box("wall", -ROOM_W / 2, -GATE_HALF, north - 0.6, north, WALL_H, WALL_H + 1.2);
      this.box("wall", GATE_HALF, ROOM_W / 2, north - 0.6, north, WALL_H, WALL_H + 1.2);
      const gate = this.box("wall", -GATE_HALF, GATE_HALF, north - 0.6, north, WALL_H, WALL_H + 1.2);
      // the bridge runs under the gate to the room edge (no gap once the gate is open)
      this.box("bridge", -GATE_HALF, GATE_HALF, north - BRIDGE_L, north, 0, 0.5);
      const ids = crystals.map(([x, d, color, decoy, hidden, base]) => {
         const id = this.switches.length;
         this.switches.push({ id, room: k, x, z: z0 - d, base: base ?? 0, color, decoy: !!decoy, hidden: !!hidden });
         return id;
      });
      const room: Room = { id: k, seq: seq.map((i) => ids[i]), timerMs, gate, spawn: { x: 0, y: 0, z: z0 - 1.2 }, beacon: { x: -GATE_HALF - 1.2, z: north + 1.2 }, floor };
      this.rooms.push(room);
      return room;
   }

   /** The bot strikes the room's crystals in order, then walks through the gate onto the next room. */
   solve(r: Room): void {
      for (const id of r.seq) {
         const s = this.switches[id];
         this.route.push({ x: s.x, z: s.z, act: id });
      }
      const north = this.z0(r.id) - ROOM_L;
      this.route.push({ x: 0, z: north + 1 });
      this.route.push({ x: 0, z: north - BRIDGE_L - 1.2 });
   }

   orb(x: number, z: number, y = 1): void {
      this.orbs.push({ x, y, z });
   }

   /** A Vexa ghost wall closing an alcove on room k's west or east side, its crystal inside. */
   ghost(k: number, side: -1 | 1, depth: number): void {
      const z = this.z0(k) - depth;
      const x0 = side * (ROOM_W / 2);
      // the alcove is exactly as wide as the glass, so nobody slips round it
      this.box("ledge", side < 0 ? x0 - 3 : x0, side < 0 ? x0 : x0 + 3, z - 1, z + 1, 0, 1.2);
      this.walls.push({ id: this.walls.length, x: x0, y: 1.6, z, normal: "x", crystal: { x: x0 + side * 1.8, y: 0.9, z } });
   }
}

function finish(level: LevelId, b: Builder, start: Point, goal: number, high: Point, boss: BossSpec | null = null): Course {
   const cfg = LEVELS[level];
   return { level, cfg, boxes: b.boxes, switches: b.switches, rooms: b.rooms, start, goal, orbs: b.orbs, ghostWalls: b.walls, high, route: b.route, boss, durationMs: cfg.durationMs, targetMs: cfg.targetMs };
}

/** The goal pad north of the last room's bridge. */
function goalPad(b: Builder, rooms: number): number {
   const z = b.z0(rooms);
   const g = b.box("goal", -3, 3, z - 4, z, 0, 1.2);
   b.route.push({ x: 0, z: z - 2 });
   return g;
}

/** Nyla's high crystal: a stone pillar 4 m tall beside room k, its crystal on top. */
function highPillar(b: Builder, k: number, x: number, depth: number): Point {
   const z = b.z0(k) - depth;
   b.box("pillar", x - 0.8, x + 0.8, z - 0.8, z + 0.8, 3.4, 4.6);
   return { x, y: 3.4 + 0.9, z };
}

/** L1 Two Crystals: two rooms, two crystals each, long windows. */
function level1(): Course {
   const b = new Builder();
   const r0 = b.room(0, [[-3.5, 4, 0], [3.5, 6.5, 1]], [0, 1]);
   b.solve(r0);
   const r1 = b.room(1, [[3.5, 3.5, 2], [-3.5, 6, 3], [0, 4.5, 0]], [1, 0, 2]);
   b.solve(r1);
   const goal = goalPad(b, 2);
   b.ghost(1, -1, 7.5);
   const high = highPillar(b, 0, 4.5, 2);
   for (const [x, z] of [[0, -3], [-3.5, -5.5], [3.5, -8], [0, -12], [0, -15], [2, -21], [-2, -23], [0, -26], [0, -31], [0, -35]] as const) b.orb(x, z);
   return finish(1, b, { x: 0, y: 0, z: -1.2 }, goal, high);
}

/** L2 Three Sequence: three rooms of three; a moving slab carries you to a crystal island. */
function level2(): Course {
   const b = new Builder();
   const r0 = b.room(0, [[-3.5, 3.5, 0], [3.5, 3.5, 1], [0, 7, 2]], [1, 0, 2]);
   b.solve(r0);
   // room 1: the third crystal stands on an island east of the room, reached by a moving slab
   const z1 = b.z0(1);
   const island = b.box("ledge", 13, 16, z1 - 7, z1 - 3, 0, 1.2);
   const slab = b.box("slab", 8.25, 10.75, z1 - 6.25, z1 - 3.75, 0, 0.5, { ax: 1, az: 0, amp: 2.25 });
   const r1 = b.room(1, [[-3.5, 4, 3], [3, 7.5, 0], [14.5, 5, 2]], [0, 2, 1]);
   void island;
   b.route.push({ x: -3.5, z: z1 - 4, act: r1.seq[0] });
   b.route.push({ x: 5.2, z: z1 - 5 });
   b.route.push({ x: 9.5, z: z1 - 5, rail: slab });
   b.route.push({ x: 14.5, z: z1 - 5, act: r1.seq[1] });
   b.route.push({ x: 9.5, z: z1 - 5, rail: slab });
   b.route.push({ x: 4.5, z: z1 - 5 });
   b.route.push({ x: 3, z: z1 - 7.5, act: r1.seq[2] });
   b.route.push({ x: 0, z: z1 - ROOM_L + 1 });
   b.route.push({ x: 0, z: z1 - ROOM_L - BRIDGE_L - 1.2 });
   const r2 = b.room(2, [[-4, 3, 2], [4, 3, 3], [-2, 7, 1], [2, 7, 0]], [3, 0, 2]);
   b.solve(r2);
   const goal = goalPad(b, 3);
   b.ghost(2, 1, 5);
   const high = highPillar(b, 1, -4.5, 8.5);
   for (const [x, z] of [[0, -4], [3.5, -7], [0, -13], [9.5, -23], [14.5, -24.5], [0, -31], [0, -38], [4, -39], [-2, -43], [0, -52]] as const) b.orb(x, z);
   return finish(2, b, { x: 0, y: 0, z: -1.2 }, goal, high);
}

/** L3 Hidden Crystal: four rooms; some crystals hide on ledges and only glow when you are near. */
function level3(): Course {
   const b = new Builder();
   const r0 = b.room(0, [[-3.5, 3.5, 0], [3.5, 3.5, 3], [0, 7, 1]], [2, 1, 0]);
   b.solve(r0);
   // room 1: a hidden crystal on a 3 m ledge, reached by a boulder step
   const z1 = b.z0(1);
   b.box("boulder", 2, 3.5, z1 - 4.2, z1 - 2.8, 1.5, 2.7);
   b.box("ledge", 3.5, 6, z1 - 4.5, z1 - 2.5, 3, 4.2);
   const r1 = b.room(1, [[-3.5, 6, 2], [4.75, 3.5, 1, false, true, 3], [0, 7.5, 3]], [1, 0, 2]);
   b.route.push({ x: 1.2, z: z1 - 3.5 });
   b.route.push({ x: 2.75, z: z1 - 3.5 });
   b.route.push({ x: 4.75, z: z1 - 3.5, act: r1.seq[0] });
   b.route.push({ x: 1.5, z: z1 - 5.5 });
   for (const id of r1.seq.slice(1)) b.route.push({ x: b.switches[id].x, z: b.switches[id].z, act: id });
   b.route.push({ x: 0, z: z1 - ROOM_L + 1 });
   b.route.push({ x: 0, z: z1 - ROOM_L - BRIDGE_L - 1.2 });
   const r2 = b.room(2, [[-4, 3.5, 3], [4, 3.5, 0], [-1.5, 7, 2, false, true], [2.5, 7.5, 1]], [0, 3, 2, 1]);
   b.solve(r2);
   const r3 = b.room(3, [[0, 3, 1], [-4.5, 6, 0, false, true], [4.5, 6, 2]], [2, 0, 1]);
   b.solve(r3);
   const goal = goalPad(b, 4);
   b.ghost(2, -1, 5);
   const high = highPillar(b, 3, 5.5, 8.5);
   for (const [x, z] of [[0, -4], [0, -13], [4.75, -21.5], [-3.5, -24], [0, -31], [0, -40], [0, -49], [0, -58], [0, -67], [0, -74]] as const) b.orb(x, z);
   return finish(3, b, { x: 0, y: 0, z: -1.2 }, goal, high);
}

/** L4 Timed Sequence: five rooms; a started sequence must finish in time, decoys reset it. */
function level4(): Course {
   const b = new Builder();
   const r0 = b.room(0, [[-3.5, 4, 0], [3.5, 4, 1], [0, 7.5, 3, true]], [1, 0], 9000);
   b.solve(r0);
   const r1 = b.room(1, [[-4, 3, 2], [4, 3, 3], [0, 5, 1, true], [0, 8, 0]], [0, 3, 1], 10000);
   b.solve(r1);
   const z2 = b.z0(2);
   b.box("boulder", -3.5, -2, z2 - 6.2, z2 - 4.8, 1.5, 2.7);
   b.box("ledge", -6, -3.5, z2 - 6.5, z2 - 4.5, 3, 4.2);
   const r2 = b.room(2, [[-4.75, 5.5, 2, false, true, 3], [4, 3, 0], [2, 8, 1], [-1, 3, 3, true]], [1, 0, 2], 12000);
   b.route.push({ x: 4, z: z2 - 3, act: r2.seq[0] });
   b.route.push({ x: -1.2, z: z2 - 5.5 });
   b.route.push({ x: -2.75, z: z2 - 5.5 });
   b.route.push({ x: -4.75, z: z2 - 5.5, act: r2.seq[1] });
   b.route.push({ x: -1.5, z: z2 - 7.5 });
   b.route.push({ x: 2, z: z2 - 8, act: r2.seq[2] });
   b.route.push({ x: 0, z: z2 - ROOM_L + 1 });
   b.route.push({ x: 0, z: z2 - ROOM_L - BRIDGE_L - 1.2 });
   const r3 = b.room(3, [[-4.5, 3.5, 1], [4.5, 3.5, 2], [-2, 7.5, 3], [2, 7.5, 0], [0, 5.5, 2, true]], [2, 1, 3, 0], 12000);
   b.solve(r3);
   const r4 = b.room(4, [[-4, 4, 3], [4, 4, 0], [0, 7.5, 1], [0, 2.5, 2, true]], [1, 2, 0], 9000);
   b.solve(r4);
   const goal = goalPad(b, 5);
   b.ghost(3, 1, 5);
   const high = highPillar(b, 1, -5.5, 6);
   for (const [x, z] of [[0, -4], [0, -13], [0, -22], [0, -31], [-4.75, -41.5], [0, -49], [0, -58], [0, -67], [0, -76], [0, -85]] as const) b.orb(x, z);
   return finish(4, b, { x: 0, y: 0, z: -1.2 }, goal, high);
}

/** L5 Crystal Master: three rooms combining everything, then the Hollow Prism's arena. */
function level5(): Course {
   const b = new Builder();
   const r0 = b.room(0, [[-3.5, 3.5, 2], [3.5, 3.5, 0], [0, 7.5, 1], [0, 2, 3, true]], [1, 0, 2], 10000);
   b.solve(r0);
   const z1 = b.z0(1);
   b.box("ledge", 13, 16, z1 - 7, z1 - 3, 0, 1.2);
   const slab = b.box("slab", 8.25, 10.75, z1 - 6.25, z1 - 3.75, 0, 0.5, { ax: 1, az: 0, amp: 2.25 });
   const r1 = b.room(1, [[-3.5, 4, 3], [14.5, 5, 1], [3, 7.5, 2]], [0, 1, 2]);
   b.route.push({ x: -3.5, z: z1 - 4, act: r1.seq[0] });
   b.route.push({ x: 5.2, z: z1 - 5 });
   b.route.push({ x: 9.5, z: z1 - 5, rail: slab });
   b.route.push({ x: 14.5, z: z1 - 5, act: r1.seq[1] });
   b.route.push({ x: 9.5, z: z1 - 5, rail: slab });
   b.route.push({ x: 4.5, z: z1 - 5 });
   b.route.push({ x: 3, z: z1 - 7.5, act: r1.seq[2] });
   b.route.push({ x: 0, z: z1 - ROOM_L + 1 });
   b.route.push({ x: 0, z: z1 - ROOM_L - BRIDGE_L - 1.2 });
   const z2 = b.z0(2);
   b.box("boulder", 2, 3.5, z2 - 4.2, z2 - 2.8, 1.5, 2.7);
   b.box("ledge", 3.5, 6, z2 - 4.5, z2 - 2.5, 3, 4.2);
   const r2 = b.room(2, [[4.75, 3.5, 3, false, true, 3], [-4, 6, 0], [0, 8, 2], [-1.5, 3, 1, true]], [0, 1, 2], 12000);
   b.route.push({ x: 1.2, z: z2 - 3.5 });
   b.route.push({ x: 2.75, z: z2 - 3.5 });
   b.route.push({ x: 4.75, z: z2 - 3.5, act: r2.seq[0] });
   b.route.push({ x: 1.5, z: z2 - 5.5 });
   for (const id of r2.seq.slice(1)) b.route.push({ x: b.switches[id].x, z: b.switches[id].z, act: id });
   b.route.push({ x: 0, z: z2 - ROOM_L + 1 });
   b.route.push({ x: 0, z: z2 - ROOM_L - BRIDGE_L - 1.2 });
   // the Hollow Prism's arena: a wide cavern floor with a crystal of each colour in its corners
   const a0 = b.z0(3);
   b.box("floor", -10, 10, a0 - 20, a0, 0, 1.2);
   const corners: [number, number, ColorId][] = [[-7, 4, 0], [7, 4, 1], [-7, 14, 2], [7, 14, 3]];
   const ids = corners.map(([x, d, color]) => {
      const id = b.switches.length;
      b.switches.push({ id, room: -1, x, z: a0 - d, base: 0, color, decoy: false, hidden: false });
      return id;
   });
   b.route.push({ x: 0, z: a0 - 6 });
   b.ghost(1, -1, 7);
   const high = highPillar(b, 2, -5.5, 3);
   for (const [x, z] of [[0, -4], [-3.5, -7], [0, -13], [9.5, -23], [14.5, -24.5], [0, -31], [0, -40], [-4, -42], [0, -49], [0, -58]] as const) b.orb(x, z);
   return finish(5, b, { x: 0, y: 0, z: -1.2 }, -1, high, { x: 0, y: 7, z: a0 - 17, wakeZ: a0 - 1, switches: ids });
}

const BUILDERS: Record<LevelId, () => Course> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
const CACHE: Partial<Record<LevelId, Course>> = {};

export function buildCourse(level: LevelId): Course {
   return BUILDERS[level]();
}

export function courseFor(level: LevelId): Course {
   return (CACHE[level] ??= buildCourse(level));
}

/** Triangle wave of half travel amp over a travel parameter p (m): 0 at home. */
export function railOffset(p: number, amp: number): number {
   if (amp <= 0) return 0;
   const period = 4 * amp;
   const u = ((p % period) + period) % period;
   if (u < amp) return u;
   if (u < 3 * amp) return 2 * amp - u;
   return u - 4 * amp;
}
