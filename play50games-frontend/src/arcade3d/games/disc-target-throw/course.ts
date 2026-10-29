// The courtyards (pure data, no three.js): where each level's targets, stone columns, walls, the
// palisade, the ghost walls, the thorn zone, the raft, the monkeys and Mother Snapper stand. One ruin
// courtyard (x -11..11, z -16..6, the hero starts at (0, 3) facing north) laid out five ways (the card's
// levels). rules.ts reads it; the Scene draws it. Every target is reachable by every hero with a
// straight throw, a hook or a bank (the honest bot proves it, rules.test.ts).
import type { LevelId } from "../../types";
import { LEVELS, type DiscLevel } from "./levels";

/** The courtyard's inner faces (m). */
export const YARD = { minX: -11, maxX: 11, minZ: -16, maxZ: 6 } as const;
/** Wall height (m) and thickness. */
export const WALL_H = 2.4;
export const WALL_T = 1;

export type TargetKind = "hay" | "idol" | "post" | "orb" | "shard";

export interface Rail {
   /** unit axis on the plane */
   ax: number;
   az: number;
   /** half the travel (m) and the angular speed (rad/s): peak speed amp * omega */
   amp: number;
   omega: number;
   phase: number;
}

export interface TargetDef {
   id: number;
   kind: TargetKind;
   x: number;
   z: number;
   /** hit radius on the plane (m) */
   r: number;
   /** points before the bank multiplier */
   base: number;
   /** needed for the clear (hay / idol); posts, orbs and the shard are extra */
   required: boolean;
   /** L3: 0 green, 1 gold, 2 jade */
   colour: number;
   rail: Rail | null;
}

export interface Box {
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
   /** stone banks the disc; wood (the palisade) stops it; ghost is wood that Vexa's phased disc passes */
   kind: "stone" | "wood" | "ghost";
   /** drawn height (m) */
   h: number;
}

export interface Column {
   x: number;
   z: number;
   r: number;
}

export interface Monkey {
   /** patrol centre, axis and half-length (m) */
   x: number;
   z: number;
   ax: number;
   az: number;
   amp: number;
   omega: number;
}

export interface Course {
   level: LevelId;
   cfg: DiscLevel;
   startX: number;
   startZ: number;
   targets: TargetDef[];
   /** how many targets the clear needs */
   required: number;
   /** the main orbs (the star) */
   orbCount: number;
   columns: Column[];
   boxes: Box[];
   /** Kiro's thorn-burst zone over the best throwing spot (null: none) */
   thorns: { x: number; z: number; r: number; periodMs: number; burstMs: number } | null;
   /** L4: the raft the hero stands on (its centre drifts along x) */
   raft: { z: number; amp: number; omega: number; half: number } | null;
   monkeys: Monkey[];
   /** L5: Mother Snapper's root and her four seed pods */
   boss: { x: number; z: number; r: number; pods: { x: number; z: number }[] } | null;
   durationMs: number;
   parMs: number;
}

const perimeter = (): Box[] => [
   { minX: YARD.minX - WALL_T, maxX: YARD.maxX + WALL_T, minZ: YARD.minZ - WALL_T, maxZ: YARD.minZ, kind: "stone", h: WALL_H },
   { minX: YARD.minX - WALL_T, maxX: YARD.maxX + WALL_T, minZ: YARD.maxZ, maxZ: YARD.maxZ + WALL_T, kind: "stone", h: WALL_H },
   { minX: YARD.minX - WALL_T, maxX: YARD.minX, minZ: YARD.minZ, maxZ: YARD.maxZ, kind: "stone", h: WALL_H },
   { minX: YARD.maxX, maxX: YARD.maxX + WALL_T, minZ: YARD.minZ, maxZ: YARD.maxZ, kind: "stone", h: WALL_H },
];

/** Vexa's shrine in the east wall: the shard sits behind three ghost walls. */
const shrine = (): Box[] => [
   { minX: 8.6, maxX: 9.0, minZ: -7.2, maxZ: -3.8, kind: "ghost", h: 2 },
   { minX: 8.6, maxX: YARD.maxX, minZ: -7.6, maxZ: -7.2, kind: "ghost", h: 2 },
   { minX: 8.6, maxX: YARD.maxX, minZ: -3.8, maxZ: -3.4, kind: "ghost", h: 2 },
];

const HAY = { r: 0.8, base: 100 } as const;
const IDOL = { r: 0.7, base: 150 } as const;
const RAILED = { r: 0.8, base: 150 } as const;
const POST = { r: 0.35, base: 100 } as const;
const ORB = { r: 0.5, base: 50 } as const;
const SHARD = { r: 0.5, base: 0 } as const;

interface Spec {
   kind: TargetKind;
   x: number;
   z: number;
   colour?: number;
   rail?: Rail;
}

function build(level: LevelId, specs: Spec[], rest: Omit<Course, "level" | "cfg" | "targets" | "required" | "orbCount" | "durationMs" | "parMs" | "startX" | "startZ"> & { startX?: number; startZ?: number }): Course {
   const cfg = LEVELS[level];
   const targets: TargetDef[] = specs.map((s, id) => {
      const k = s.kind === "hay" ? (s.rail ? RAILED : HAY) : s.kind === "idol" ? IDOL : s.kind === "post" ? POST : s.kind === "orb" ? ORB : SHARD;
      return { id, kind: s.kind, x: s.x, z: s.z, r: k.r, base: k.base, required: s.kind === "hay" || s.kind === "idol", colour: s.colour ?? 0, rail: s.rail ?? null };
   });
   return {
      level,
      cfg,
      startX: rest.startX ?? 0,
      startZ: rest.startZ ?? 3,
      targets,
      required: targets.filter((t) => t.required).length,
      orbCount: targets.filter((t) => t.kind === "orb").length,
      columns: rest.columns,
      boxes: rest.boxes,
      thorns: rest.thorns,
      raft: rest.raft,
      monkeys: rest.monkeys,
      boss: rest.boss,
      durationMs: cfg.durationMs,
      parMs: cfg.parMs,
   };
}

const rail = (ax: number, az: number, amp: number, omega: number, phase = 0): Rail => ({ ax, az, amp, omega, phase });

/** Level 1 "Static Targets": ten hay targets taught in three beats (straight, round a pillar, a bank). */
function level1(): Course {
   return build(
      1,
      [
         // beat 1: straight ahead
         { kind: "hay", x: 0, z: -5 },
         { kind: "hay", x: -2.5, z: -7.5 },
         { kind: "hay", x: 2.5, z: -7.5 },
         // beat 2: behind a pillar (a hook)
         { kind: "hay", x: -5.2, z: -12 },
         // beat 3: behind the palisade (a bank off the east wall)
         { kind: "hay", x: 6, z: -12.8 },
         { kind: "hay", x: -8, z: -3 },
         { kind: "hay", x: 8, z: -1.5 },
         { kind: "hay", x: -8.5, z: -14 },
         { kind: "hay", x: 3, z: -14.6 },
         { kind: "hay", x: -1.5, z: -14.6 },
         // the four score marker posts (the gold-disc secret), the three orbs, Vexa's shard
         { kind: "post", x: -10.2, z: -15.2 },
         { kind: "post", x: 10.2, z: -15.2 },
         { kind: "post", x: -10.2, z: 5.2 },
         { kind: "post", x: 10.2, z: 5.2 },
         { kind: "orb", x: 9.6, z: -14.6 },
         { kind: "orb", x: -10.2, z: -8.5 },
         { kind: "orb", x: 0, z: -15.3 },
         { kind: "shard", x: 10.1, z: -5.5 },
      ],
      {
         columns: [
            { x: -4, z: -8.6, r: 0.55 },
            { x: 4.5, z: -4, r: 0.55 },
            { x: -6.5, z: -1, r: 0.55 },
            { x: 0.5, z: -11, r: 0.55 },
         ],
         boxes: [...perimeter(), { minX: 3.2, maxX: 8.6, minZ: -9.6, maxZ: -9.0, kind: "wood", h: 1.8 }, ...shrine()],
         thorns: { x: 0, z: -1.6, r: 1.4, periodMs: 3200, burstMs: 600 },
         raft: null,
         monkeys: [],
         boss: null,
      },
   );
}

/** Level 2 "Moving Targets": rail targets slide 1.5-3 m/s; lead the throw. */
function level2(): Course {
   return build(
      2,
      [
         { kind: "hay", x: 0, z: -5 },
         { kind: "hay", x: -3.2, z: -6.5 },
         { kind: "hay", x: 3.4, z: -6.8 },
         { kind: "hay", x: -8.2, z: -2.4 },
         { kind: "hay", x: 8.4, z: -14.8 },
         { kind: "hay", x: -8.6, z: -14.6 },
         { kind: "hay", x: -5, z: -9.6, rail: rail(1, 0, 3, 0.6) },
         { kind: "hay", x: 4, z: -12.2, rail: rail(1, 0, 3.4, 0.8, 1.2) },
         { kind: "hay", x: 0, z: -14.8, rail: rail(1, 0, 5, 0.5, 2.1) },
         { kind: "hay", x: 8.2, z: -2.6, rail: rail(0, 1, 2.6, 0.6, 0.4) },
         { kind: "orb", x: -10.2, z: 4.6 },
         { kind: "orb", x: 10.2, z: -9.6 },
         { kind: "orb", x: -3.6, z: -15.3 },
         { kind: "shard", x: 10.1, z: -5.5 },
      ],
      {
         columns: [
            { x: -5.4, z: -5.6, r: 0.55 },
            { x: 5.6, z: -9.2, r: 0.55 },
            { x: 0, z: -9.8, r: 0.55 },
            { x: -8.2, z: -10, r: 0.55 },
         ],
         boxes: [...perimeter(), ...shrine()],
         thorns: { x: 0, z: -1.4, r: 1.4, periodMs: 2800, burstMs: 650 },
         raft: null,
         monkeys: [],
         boss: null,
      },
   );
}

/** Level 3 "Color Targets": green, gold and jade idols; in order they pay double, all three in one throw is a Triple Glyph. */
function level3(): Course {
   return build(
      3,
      [
         { kind: "idol", x: -3, z: -5, colour: 0 },
         { kind: "idol", x: 0, z: -6.5, colour: 1 },
         { kind: "idol", x: 3, z: -5, colour: 2 },
         { kind: "idol", x: -6.5, z: -10, colour: 0 },
         { kind: "idol", x: -3.5, z: -12.5, colour: 1 },
         { kind: "idol", x: 0, z: -14.5, colour: 2 },
         { kind: "idol", x: 6.8, z: -10.5, colour: 0 },
         { kind: "idol", x: 8.6, z: -14.2, colour: 1 },
         { kind: "idol", x: 3.6, z: -12.4, colour: 2 },
         { kind: "hay", x: -8.6, z: -2 },
         { kind: "hay", x: 8.4, z: -1.6 },
         { kind: "hay", x: -9, z: -14.6 },
         { kind: "orb", x: -10.2, z: -6.2 },
         { kind: "orb", x: 10.2, z: 3.8 },
         { kind: "orb", x: 6, z: -15.3 },
         { kind: "shard", x: 10.1, z: -5.5 },
      ],
      {
         columns: [
            { x: -5, z: -7.4, r: 0.55 },
            { x: 5, z: -7.4, r: 0.55 },
            { x: -1.8, z: -9.6, r: 0.55 },
            { x: 1.8, z: -9.6, r: 0.55 },
            { x: 6, z: -13.2, r: 0.55 },
         ],
         boxes: [...perimeter(), ...shrine()],
         thorns: { x: 0, z: -1.6, r: 1.5, periodMs: 2600, burstMs: 700 },
         raft: null,
         monkeys: [],
         boss: null,
      },
   );
}

/** Level 4 "Fast Combo": throw from a drifting raft (the return point stays where you threw); monkeys snatch a returning disc. */
function level4(): Course {
   return build(
      4,
      [
         { kind: "hay", x: 0, z: -6 },
         { kind: "hay", x: -4, z: -7.5 },
         { kind: "hay", x: 4, z: -7.5 },
         { kind: "hay", x: -8, z: -11 },
         { kind: "hay", x: 8, z: -11 },
         { kind: "hay", x: -2.5, z: -14.4 },
         { kind: "hay", x: 2.5, z: -14.4 },
         { kind: "hay", x: -9, z: -4.5 },
         { kind: "hay", x: 0, z: -11, rail: rail(1, 0, 3, 0.7, 0.8) },
         { kind: "hay", x: 6, z: -3.5, rail: rail(0, 1, 2, 0.75) },
         { kind: "orb", x: 10.2, z: -15.2 },
         { kind: "orb", x: -10.2, z: -15.2 },
         { kind: "orb", x: -5.6, z: -15.3 },
         { kind: "shard", x: 10.1, z: -5.5 },
      ],
      {
         startZ: 3,
         columns: [
            { x: -6, z: -6.4, r: 0.55 },
            { x: 6.4, z: -8.2, r: 0.55 },
            { x: -4.6, z: -12.2, r: 0.55 },
            { x: 4.4, z: -12.6, r: 0.55 },
         ],
         boxes: [...perimeter(), ...shrine()],
         thorns: null,
         raft: { z: 3, amp: 4, omega: 0.32, half: 1.7 },
         monkeys: [
            { x: -6, z: -1.5, ax: 1, az: 0, amp: 3, omega: 0.8 },
            { x: 6, z: -2.5, ax: 1, az: 0, amp: 3, omega: 0.7 },
            { x: 0, z: -9, ax: 1, az: 0, amp: 5, omega: 0.5 },
         ],
         boss: null,
      },
   );
}

/** Level 5 "Accuracy Master": Mother Snapper rooted in the centre, her seed pods behind her, six bank columns. */
function level5(): Course {
   return build(
      5,
      [
         { kind: "orb", x: -10.2, z: -15.2 },
         { kind: "orb", x: 10.2, z: -15.2 },
         { kind: "orb", x: 0, z: -15.3 },
         { kind: "shard", x: 10.1, z: -5.5 },
      ],
      {
         columns: [
            { x: -6, z: -3.5, r: 0.6 },
            { x: 6, z: -3.5, r: 0.6 },
            { x: -8.4, z: -10.5, r: 0.6 },
            { x: 8.4, z: -10.5, r: 0.6 },
            { x: -3.4, z: -14, r: 0.6 },
            { x: 3.4, z: -14, r: 0.6 },
         ],
         boxes: [...perimeter(), ...shrine()],
         thorns: null,
         raft: null,
         monkeys: [],
         boss: {
            x: 0,
            z: -7.5,
            r: 1.8,
            pods: [
               { x: -3.2, z: -11 },
               { x: 3.2, z: -11 },
               { x: -5.4, z: -9 },
               { x: 5.4, z: -9 },
            ],
         },
      },
   );
}

const BUILDERS: Record<LevelId, () => Course> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
const CACHE: Partial<Record<LevelId, Course>> = {};

export function buildCourse(level: LevelId): Course {
   return BUILDERS[level]();
}

export function courseFor(level: LevelId): Course {
   return (CACHE[level] ??= buildCourse(level));
}

/** Where target `t` is at rules ms `ms` (a rail target slides on a sine). */
export function targetPos(t: TargetDef, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   const r = t.rail;
   if (!r) {
      out.x = t.x;
      out.z = t.z;
      return out;
   }
   const s = Math.sin((r.omega * ms) / 1000 + r.phase) * r.amp;
   out.x = t.x + r.ax * s;
   out.z = t.z + r.az * s;
   return out;
}

/** Where monkey `m` is at rules ms `ms`. */
export function monkeyPos(m: Monkey, ms: number, out: { x: number; z: number }): { x: number; z: number } {
   const s = Math.sin((m.omega * ms) / 1000) * m.amp;
   out.x = m.x + m.ax * s;
   out.z = m.z + m.az * s;
   return out;
}

/** The raft's centre x at rules ms `ms` (0 without a raft). */
export function raftX(c: Pick<Course, "raft">, ms: number): number {
   const r = c.raft;
   if (!r) return 0;
   return Math.sin((r.omega * ms) / 1000) * r.amp;
}
