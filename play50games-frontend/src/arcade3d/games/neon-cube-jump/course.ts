// Neon Cube Jump's courses (pure data, no three.js): a field of 2 m neon cubes floating over the void.
// A cube belongs to set A (square glyph) or set B (triangle glyph), is neutral (N: checkpoints, the
// start, the goal, energy pads, the boss arena's floor: always solid) or rogue (R: a ring glyph, solid
// on its own 1.6 s clock). Only one of A / B is solid at a time; every jump flips it (rules.ts).
//
// Grid: cell (i, j, h) is the cube centred at x = 2i, z = -2j whose top is at y = 2h (the cube spans
// y 2h-2 .. 2h). Courses run north (-z), the way the orbit camera looks at yaw 0.
//
// Each level also carries the honest bot's route (bot.ts): the cubes in order and how to get onto each
// (walk across, or jump), so the bot plays with the same inputs a player has.
import type { LevelId } from "../../types";
import { LEVELS, type NeonLevel } from "./levels";

export const CUBE = 2;
export const HALF = 1;
/** the rogue cubes' clock (ms per state), the card's 1.6 s */
export const ROGUE_MS = 1600;
/** moving cubes slide at this speed (m/s) while solid */
export const RAIL_SPEED = 2;

export type CubeSet = "A" | "B" | "N" | "R";

export interface Rail {
   /** unit axis on the plane and the half travel (m); the cube ping-pongs from its home */
   ax: number;
   az: number;
   amp: number;
}

export interface Cube {
   id: number;
   x: number;
   z: number;
   /** the top face's height */
   top: number;
   set: CubeSet;
   /** rogue cubes: 0 solid on even clock beats, 1 on odd */
   phase: number;
   rail: Rail | null;
   /** a laser wall on top, live while its set is solid (L4) */
   laser: "A" | "B" | null;
   checkpoint: boolean;
   goal: boolean;
   /** an energy pad on top: launches without a flip */
   pad: boolean;
   /** level 5: part of the arena (its floor, its cubes or the core tower) */
   arena: boolean;
   /** level 5: a core tower cube (P3 climbs it) */
   tower: boolean;
}

export interface Point {
   x: number;
   y: number;
   z: number;
}

export interface GhostWall {
   id: number;
   /** the panel's centre and its normal axis ("x": the panel lies in the yz plane) */
   x: number;
   y: number;
   z: number;
   normal: "x" | "z";
   /** the crystal behind it (a secret) */
   crystal: Point;
}

export interface Drone {
   id: number;
   /** the set it belongs to: it only harms while that set is solid */
   set: "A" | "B";
   x: number;
   y: number;
   z: number;
   ax: number;
   az: number;
   amp: number;
   periodMs: number;
}

export interface RouteStep {
   cube: number;
   mode: "walk" | "jump";
}

export interface BossSpec {
   /** Flipframe's centre (it stands north of the arena) */
   x: number;
   z: number;
   /** the arena's z band (the hero wakes it on entering) */
   wakeZ: number;
   /** the core tower's top cube (P3) */
   towerTop: number;
}

export interface Course {
   level: LevelId;
   cfg: NeonLevel;
   cubes: Cube[];
   start: number;
   goal: number;
   orbs: Point[];
   coins: Point[];
   ghostWalls: GhostWall[];
   /** the parity shard (picked up only after an even number of jumps since the checkpoint) */
   shard: Point;
   /** level 3: Nami's same-set ledge sticker */
   ledge: Point | null;
   drones: Drone[];
   route: RouteStep[];
   boss: BossSpec | null;
   durationMs: number;
   targetMs: number;
}

interface CubeOpts {
   phase?: number;
   rail?: Rail;
   laser?: "A" | "B";
   checkpoint?: boolean;
   goal?: boolean;
   pad?: boolean;
   arena?: boolean;
   tower?: boolean;
}

class Builder {
   cubes: Cube[] = [];
   route: RouteStep[] = [];
   orbs: Point[] = [];
   coins: Point[] = [];
   walls: GhostWall[] = [];
   drones: Drone[] = [];

   /** a cube at grid cell (i, j, h) */
   cube(set: CubeSet, i: number, j: number, h: number, o: CubeOpts = {}): number {
      const id = this.cubes.length;
      this.cubes.push({
         id,
         x: i * CUBE,
         z: -j * CUBE,
         top: h * CUBE,
         set,
         phase: o.phase ?? 0,
         rail: o.rail ?? null,
         laser: o.laser ?? null,
         checkpoint: o.checkpoint ?? false,
         goal: o.goal ?? false,
         pad: o.pad ?? false,
         arena: o.arena ?? false,
         tower: o.tower ?? false,
      });
      return id;
   }

   /** a cube on the route, reached by walking (adjacent) or a jump */
   step(mode: "walk" | "jump", set: CubeSet, i: number, j: number, h: number, o: CubeOpts = {}): number {
      const id = this.cube(set, i, j, h, o);
      this.route.push({ cube: id, mode });
      return id;
   }

   /** an orb `up` m over cell (i, j)'s top at height h (1 = over the cube, 2.4 = on a jump's arc) */
   orb(i: number, j: number, h: number, up = 1): void {
      this.orbs.push({ x: i * CUBE, y: h * CUBE + up, z: -j * CUBE });
   }

   /** a coin inside cell (i, j, h)'s cube (Zuno's magnet pulls it) */
   coin(i: number, j: number, h: number): void {
      this.coins.push({ x: i * CUBE, y: h * CUBE - 1, z: -j * CUBE });
   }

   /**
    * A Vexa ghost wall: an alcove cube (neutral) at (i, j, h) beside the path, its crystal on top, and
    * the glass panel between it and the path cell next to it (dir: the side the path is on, +1 / -1 in x).
    */
   ghost(i: number, j: number, h: number, dir: 1 | -1): void {
      this.cube("N", i, j, h);
      this.walls.push({
         id: this.walls.length,
         x: i * CUBE + dir * HALF,
         y: h * CUBE + 1.2,
         z: -j * CUBE,
         normal: "x",
         crystal: { x: i * CUBE, y: h * CUBE + 0.9, z: -j * CUBE },
      });
   }

   drone(set: "A" | "B", i: number, j: number, h: number, amp: number, periodMs: number): void {
      this.drones.push({ id: this.drones.length, set, x: i * CUBE, y: h * CUBE + 1.1, z: -j * CUBE, ax: 1, az: 0, amp, periodMs });
   }
}

function finish(level: LevelId, b: Builder, shard: Point, extra: { ledge?: Point; boss?: BossSpec } = {}): Course {
   const cfg = LEVELS[level];
   const start = b.cubes.findIndex((c) => c.checkpoint);
   const goal = b.cubes.findIndex((c) => c.goal);
   return {
      level,
      cfg,
      cubes: b.cubes,
      start,
      goal,
      orbs: b.orbs,
      coins: b.coins,
      ghostWalls: b.walls,
      shard,
      ledge: extra.ledge ?? null,
      drones: b.drones,
      route: b.route,
      boss: extra.boss ?? null,
      durationMs: cfg.durationMs,
      targetMs: cfg.targetMs,
   };
}

const at = (i: number, j: number, h: number, up = 0.9): Point => ({ x: i * CUBE, y: h * CUBE + up, z: -j * CUBE });

/**
 * L1 Static Grid, in three beats: (1) a gap with only B holograms ahead: jump and they turn solid;
 * (2) the lone A cube behind you vanishes on your next jump: no going back; (3) a six-cube A/B
 * staircase. The solid set starts at A.
 */
function level1(): Course {
   const b = new Builder();
   b.cube("N", 0, 0, 0, { checkpoint: true });
   b.step("walk", "A", 0, 1, 0);
   b.step("jump", "B", 0, 3, 0);
   b.step("walk", "B", 0, 4, 0);
   b.step("jump", "A", 0, 6, 0);
   b.step("walk", "A", 1, 6, 0);
   b.step("jump", "B", 3, 6, 0);
   b.step("walk", "N", 3, 7, 0, { checkpoint: true });
   b.step("jump", "A", 3, 9, 1);
   b.step("jump", "B", 3, 11, 2);
   b.step("jump", "A", 3, 13, 3);
   b.step("jump", "B", 3, 15, 4);
   b.step("jump", "A", 3, 17, 5);
   b.step("jump", "B", 3, 19, 6);
   b.step("jump", "N", 3, 21, 6, { goal: true });
   // the parity shard beside the path (after two jumps from the start: even)
   b.cube("N", -1, 6, 0);
   // Vexa's two ghost walls: alcoves east of the field
   b.cube("B", 4, 6, 0);
   b.ghost(5, 6, 0, -1);
   b.cube("B", 4, 19, 6);
   b.ghost(5, 19, 6, -1);
   for (const [i, j, h, up] of [
      [0, 1, 0, 1],
      [0, 2, 0, 2.4],
      [0, 4, 0, 1],
      [1, 6, 0, 1],
      [3, 6, 0, 1],
      [3, 7, 0, 1],
      [3, 10, 1, 2.6],
      [3, 12, 2, 2.6],
      [3, 14, 3, 2.6],
      [3, 16, 4, 2.6],
      [3, 18, 5, 2.6],
      [3, 20, 6, 2.4],
   ] as const)
      b.orb(i, j, h, up);
   for (const [i, j, h] of [
      [0, 3, 0],
      [0, 4, 0],
      [3, 11, 2],
      [3, 15, 4],
      [3, 19, 6],
   ] as const)
      b.coin(i, j, h);
   return finish(1, b, at(-1, 6, 0));
}

/**
 * L2 Moving Cubes: B cubes slide on rails at 2 m/s, but only while they are solid; holograms freeze
 * where they are, so you "park" a cube by timing your jumps.
 */
function level2(): Course {
   const b = new Builder();
   b.cube("N", 0, 0, 0, { checkpoint: true });
   b.step("walk", "A", 0, 1, 0);
   b.step("jump", "B", 0, 3, 0, { rail: { ax: 1, az: 0, amp: 3 } });
   b.step("jump", "A", 0, 5, 0);
   b.step("walk", "A", 0, 6, 0);
   b.step("jump", "B", 0, 8, 0, { rail: { ax: 1, az: 0, amp: 4 } });
   b.step("jump", "A", 0, 10, 0);
   b.step("walk", "N", 0, 11, 0, { checkpoint: true });
   b.step("jump", "B", 0, 13, 1, { rail: { ax: 1, az: 0, amp: 3 } });
   b.step("jump", "A", 0, 15, 1);
   b.step("jump", "B", 0, 17, 2, { rail: { ax: 1, az: 0, amp: 2.5 } });
   b.step("jump", "A", 0, 19, 2);
   b.step("jump", "B", 0, 21, 2, { rail: { ax: 1, az: 0, amp: 3 } });
   b.step("jump", "N", 0, 23, 2, { goal: true });
   b.cube("N", 1, 6, 0);
   b.cube("A", -1, 10, 0);
   b.ghost(-2, 10, 0, 1);
   b.cube("A", 1, 19, 2);
   b.ghost(2, 19, 2, -1);
   for (const [i, j, h, up] of [
      [0, 1, 0, 1],
      [0, 3, 0, 1],
      [0, 4, 0, 2.4],
      [0, 6, 0, 1],
      [0, 8, 0, 1],
      [0, 11, 0, 1],
      [0, 13, 1, 1],
      [0, 15, 1, 1],
      [0, 17, 2, 1],
      [0, 19, 2, 1],
      [0, 21, 2, 1],
      [0, 22, 2, 2.4],
   ] as const)
      b.orb(i, j, h, up);
   for (const [i, j, h] of [
      [0, 3, 0],
      [0, 8, 0],
      [0, 13, 1],
      [0, 17, 2],
      [0, 21, 2],
      [0, 22, 2],
   ] as const)
      b.coin(i, j, h);
   return finish(2, b, at(1, 6, 0));
}

/**
 * L3 Blink Grid: rogue ring cubes flip on their own 1.6 s clock, whatever you do; sync your jumps to
 * them. Nami's same-set ledge (a double jump flips twice) holds a sticker.
 */
function level3(): Course {
   const b = new Builder();
   b.cube("N", 0, 0, 0, { checkpoint: true });
   b.step("walk", "A", 0, 1, 0);
   b.step("jump", "R", 0, 3, 0, { phase: 0 });
   b.step("jump", "A", 0, 5, 0);
   b.step("walk", "A", 0, 6, 0);
   b.step("jump", "R", 0, 8, 0, { phase: 1 });
   b.step("jump", "R", 0, 10, 0, { phase: 0 });
   b.step("walk", "N", 0, 11, 0, { checkpoint: true });
   b.step("jump", "B", 0, 13, 1);
   b.step("jump", "R", 0, 15, 1, { phase: 1 });
   b.step("jump", "B", 0, 17, 2);
   b.step("jump", "A", 0, 19, 2);
   b.step("jump", "N", 0, 21, 2, { goal: true });
   // Nami's ledge: a same-set A cube 4 m up beside the A pair
   b.cube("A", 2, 6, 2);
   b.cube("N", -1, 11, 0);
   b.cube("A", 1, 5, 0);
   b.ghost(2, 5, 0, -1);
   b.cube("B", -1, 17, 2);
   b.ghost(-2, 17, 2, 1);
   for (const [i, j, h, up] of [
      [0, 1, 0, 1],
      [0, 2, 0, 2.4],
      [0, 3, 0, 1],
      [0, 6, 0, 1],
      [0, 7, 0, 2.4],
      [0, 9, 0, 2.4],
      [0, 11, 0, 1],
      [0, 13, 1, 1],
      [0, 15, 1, 1],
      [0, 17, 2, 1],
      [0, 19, 2, 1],
      [0, 20, 2, 2.4],
   ] as const)
      b.orb(i, j, h, up);
   for (const [i, j, h] of [
      [0, 3, 0],
      [0, 8, 0],
      [0, 15, 1],
      [0, 17, 2],
   ] as const)
      b.coin(i, j, h);
   return finish(3, b, at(-1, 11, 0), { ledge: at(2, 6, 2) });
}

/**
 * L4 Laser Grid: laser walls belong to the sets (a B-laser is live while B is solid), so your jumps
 * switch them; sentry drones patrol only while their set is solid.
 */
function level4(): Course {
   const b = new Builder();
   b.cube("N", 0, 0, 0, { checkpoint: true });
   b.step("walk", "A", 0, 1, 0, { laser: "B" });
   b.step("jump", "B", 0, 3, 0, { laser: "A" });
   b.step("walk", "B", 0, 4, 0);
   b.step("jump", "A", 0, 6, 0);
   b.step("walk", "A", 0, 7, 0, { laser: "B" });
   b.step("walk", "N", 0, 8, 0, { checkpoint: true });
   b.step("jump", "B", 0, 10, 1);
   b.step("jump", "A", 0, 12, 1, { laser: "B" });
   b.step("jump", "B", 0, 14, 2);
   b.step("walk", "B", 0, 15, 2, { laser: "A" });
   b.step("jump", "A", 0, 17, 2);
   b.step("jump", "B", 0, 19, 3);
   b.step("jump", "N", 0, 21, 3, { goal: true });
   b.drone("A", 0, 6.5, 0, 2.2, 3200);
   b.drone("B", 0, 14.5, 2, 2.2, 2800);
   // Kiro's laser route: a live A-laser over the A side cube (stand in its beam with the shield)
   b.cube("A", 1, 12, 1, { laser: "A" });
   b.cube("A", 1, 7, 0);
   b.ghost(2, 7, 0, -1);
   b.cube("B", -1, 15, 2);
   b.ghost(-2, 15, 2, 1);
   b.cube("N", -1, 8, 0);
   for (const [i, j, h, up] of [
      [0, 1, 0, 1],
      [0, 2, 0, 2.4],
      [0, 4, 0, 1],
      [0, 6, 0, 1],
      [0, 8, 0, 1],
      [0, 10, 1, 1],
      [0, 12, 1, 1],
      [1, 12, 1, 1],
      [0, 14, 2, 1],
      [0, 17, 2, 1],
      [0, 19, 3, 1],
      [0, 20, 3, 2.4],
   ] as const)
      b.orb(i, j, h, up);
   for (const [i, j, h] of [
      [0, 3, 0],
      [0, 10, 1],
      [0, 14, 2],
      [0, 19, 3],
   ] as const)
      b.coin(i, j, h);
   return finish(4, b, at(-1, 8, 0));
}

/**
 * L5 Neon Overdrive: a short approach, then Flipframe's arena: a neutral floor, a 5 x 5 checkerboard of
 * A / B cubes on it, and the core tower (P3) in front of the giant.
 */
function level5(): Course {
   const b = new Builder();
   b.cube("N", 0, 0, 0, { checkpoint: true });
   b.step("walk", "A", 0, 1, 0);
   b.step("jump", "B", 0, 3, 0);
   b.step("jump", "A", 0, 5, 0);
   b.step("walk", "N", 0, 6, 0, { checkpoint: true });
   // the arena floor (neutral, one level down) and the checkerboard on it
   for (let i = -3; i <= 3; i++) for (let j = 7; j <= 14; j++) b.cube("N", i, j, -1, { arena: true });
   for (let i = -2; i <= 2; i++) for (let j = 8; j <= 12; j++) b.cube((i + j) % 2 === 0 ? "A" : "B", i, j, 0, { arena: true });
   b.cube("B", 0, 13, 1, { arena: true, tower: true });
   const top = b.cube("A", 0, 14, 2, { arena: true, tower: true });
   b.route.push({ cube: b.cubes.findIndex((c) => c.arena && c.set === "B" && c.x === 2 && c.z === -16), mode: "jump" });
   b.cube("N", -1, 5, 0);
   b.cube("B", 1, 3, 0);
   b.ghost(2, 3, 0, -1);
   b.cube("B", -1, 3, 0);
   b.ghost(-2, 3, 0, 1);
   for (const [i, j, h, up] of [
      [0, 1, 0, 1],
      [0, 2, 0, 2.4],
      [0, 3, 0, 1],
      [0, 4, 0, 2.4],
      [0, 5, 0, 1],
      [0, 6, 0, 1],
      [-2, 8, 0, 1],
      [2, 8, 0, 1],
      [-2, 12, 0, 1],
      [2, 12, 0, 1],
      [0, 13, 1, 1],
      [0, 10, 0, 2.4],
   ] as const)
      b.orb(i, j, h, up);
   for (const [i, j, h] of [
      [0, 3, 0],
      [-1, 9, 0],
      [1, 11, 0],
   ] as const)
      b.coin(i, j, h);
   return finish(5, b, at(-1, 5, 0), { boss: { x: 0, z: -2 * 17.5, wakeZ: -2 * 7 + 1, towerTop: top } });
}

const BUILDERS: Record<LevelId, () => Course> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
const CACHE: Partial<Record<LevelId, Course>> = {};

export function buildCourse(level: LevelId): Course {
   return BUILDERS[level]();
}

export function courseFor(level: LevelId): Course {
   return (CACHE[level] ??= buildCourse(level));
}

/** Triangle wave in [-1, 1] over a travel parameter (m) for a rail of half travel amp: 0 at home. */
export function railOffset(p: number, amp: number): number {
   if (amp <= 0) return 0;
   const period = 4 * amp;
   const u = ((p % period) + period) % period;
   if (u < amp) return u;
   if (u < 3 * amp) return 2 * amp - u;
   return u - 4 * amp;
}
