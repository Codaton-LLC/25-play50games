// Rooftop Roll Climb rules: the zigzag skyline as data (roofs.ts), the integer-ms clock and its cap,
// kinematic movement with closed-form jumps, SLOPE MOMENTUM (lean down a slanted roof and the hero
// curls into a ball that banks speed; a jump at the lip keeps it), moving gondolas and crane slabs,
// blinking and wet roofs, chimney updrafts, spark arcs, checkpoints, falls and respawns (dead time =
// the time penalty), coins (a time bonus), the flow meter, secrets, the level 5 boss (Ashback) and the
// lower bound behind the server limits. Pure and deterministic: no three.js, React, DOM, Math.random
// or Date.now. Scene.tsx passes the stick as inputToWorld(moveX, moveY, 0) plus the orbit camera's yaw
// (StepInput.yaw; step() turns it camera-relative) and calls step() once per useRunFrame; the tests
// and bot.ts drive it directly (yaw 0).
//
// Clock: whole ms, the fraction carried to the next step, stepped 1 ms at a time, so a jump arc depends
// only on the ms since take-off and is the same at 30, 60 or 144 fps. No allocation after createRun().
// README.md "Rules" and "Server limits" explain the design and the proof; the tests check them.
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { inputToWorld } from "@/arcade3d/core/math";
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, stepProgress, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS, type RoofLevel } from "./levels";
import { buildRoofs, type RoofArena, type RoofBlock, type RoofRole, type RoofSecret, type RoofSlope, type RoofStrike } from "./roofs";
import { ASHBACK, ASHBACK_HIT_SPEED, COMBO, COMBO_BASE_MS, SECRETS } from "./progression";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

/** "Nothing": no support, no coyote, no buffered press. */
export const NONE = -1;
/** the most rules ms one frame may advance (the core caps dt at 1/20 s anyway) */
export const MAX_STEP_MS = 50;
/** the hero's collision: a vertical cylinder, feet at y */
export const HERO = { radius: 0.32, height: 1.2 } as const;
/** top speed from the stick (m/s), and its acceleration (m/s²) on the ground, in the air, on a wet flat roof */
export const V_RUN = 6.5;
export const ACCEL = { ground: 50, air: 32, ice: 36 } as const;
/** a curled ball's top speed (m/s), and with Riko's dash on top of it (the card's 15.5 m/s burst) */
export const V_ROLL_MAX = 13;
export const V_TOP = 15.5;
/** uncurling above V_RUN brakes at this rate (13 -> 6.5 m/s in 0.3 s) */
export const BRAKE = 22;
/** a curled ball on a flat roof bleeds speed at this rate (m/s²) */
export const ROLL_BLEED = 4;
/** the stick's downhill share that curls the hero on a slope */
export const CURL_K = 0.5;
/** a take-off from a slope at this speed or more is a banked leap (a flow link), and at ROLLED_MIN or more a rolled leap */
export const BANK_SPEED = 10;
export const ROLLED_MIN = 9;
/** gravity (m/s²) and the jump's launch speed (m/s) */
export const G = 30;
export const V_JUMP = 14;
/** a jump still works this long after walking off an edge, and a press is kept this long */
export const COYOTE_MS = 100;
export const BUFFER_MS = 130;
/** the feet may stand this far past a platform's edge (landing and walking) */
export const FOOT = 0.15;
/** a fall this far below the last landing is lost */
export const FALL_DEPTH = 7;
/** after a fall: frozen this long out of view, then this long on the checkpoint (the time penalty) */
export const LOST_MS = 900;
export const SPAWN_MS = 600;
/** after you land on a blinking roof it stays solid this long */
export const GRIP_MS = 1600;
/** platform colliders are this deep under their surface (the visuals' walls hang lower, no collision) */
export const THICKNESS = 1.4;
/** coins: pickup radius around the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 0.95, bonusMs: 400, centerY: 0.6 } as const;
/** Nami's second jump is a flutter: at most this fast across (m/s) */
export const V_FLUTTER = V_RUN / 2;
/** a spark arc's column height (air arcs) */
export const ARC_HEIGHT = 2.6;

/** Walking across onto a touching roof may step this far down / up (m); never more than a slope's FOOT-wide sliver. */
export const STEP_DOWN = 0.06;
export const STEP_UP = 0.06;

/** the spawn on the start deck: this far along z from its centre (towards the first climb) */
export const START_DZ = -1.2;

/** the jump's apex height and time (m, ms) */
export const H_JUMP = (V_JUMP * V_JUMP) / (2 * G);
export const APEX_MS = (1000 * V_JUMP) / G;

// ---------- the course ----------

export type SupportKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

/** A moving platform: offset along `axis` = travel · (2 · smoothstep(triangle(ms / period + phase)) - 1). */
export interface Mover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

/** A platform: its top is a rectangle (centre ± half sizes at rest), THICKNESS deep under its lowest point. */
export interface Support {
   kind: SupportKind;
   role: RoofRole;
   block: number;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   /** the highest point of the top (a slope's high edge) */
   top: number;
   /** the lowest point of the top (a slope's lip; = top on a flat roof) */
   low: number;
   bottom: number;
   mover: Mover | null;
   /** a vertical launch speed (m/s) when stood on: a chimney updraft; 0 = none */
   launch: number;
   /** blinks out for `gone` of each cycle; null = always solid */
   vanish: { periodMs: number; gone: number; phase: number } | null;
   /** a wet flat roof: low traction (ACCEL.ice) */
   slippery: boolean;
   slope: RoofSlope | null;
   arena: boolean;
   /** a slope a landing keeps its roll on (roofs.ts); elsewhere a landing brings at most V_RUN */
   keep: boolean;
}

export interface Orb extends Vec3Like {
   x: number;
   y: number;
   z: number;
}

export interface Course {
   supports: Support[];
   /** support indices of the checkpoints in order; [0] is the start */
   checkpoints: number[];
   goal: number;
   orbs: Orb[];
   /** the run clock's cap (ms): "timeup" (unranked) */
   durationMs: number;
   /** the fastest any platform moves (m/s): the carry bound of the proof */
   maxCarry: number;
   strikes: RoofStrike[];
   blocks: RoofBlock[];
   secrets: RoofSecret[];
   /** the L5 boss arena, null elsewhere */
   arena: RoofArena | null;
   /** how many slopes (each can pay one banked-leap flow link) */
   slopes: number;
   /**
    * The proven fastest the hero can move on each support when it gets there (m/s, the stick's or the
    * roll's speed, not the carry): V_RUN on a roof you can only land on (a landing on a flat roof
    * thumps the ball back to running speed), more where you can roll on from a slope. On a slope the
    * speed can grow only by rolling downhill: capAt. The rules clamp to it every ms (README proof step 3).
    */
   vIn: number[];
   /** walkable seams: seam[i * n + j] = 1 when supports i and j touch at the same height (a slope's edge and its deck) */
   seams: Uint8Array;
}

export type { RoofStrike, RoofBlock, RoofSecret, RoofArena, RoofSlope };

/** Top speed of a mover (m/s): smoothstep's slope peaks at 1.5. */
export function moverTopSpeed(m: Mover): number {
   return (m.travel * 2 * 1.5 * 2 * 1000) / m.periodMs;
}

/** The mover's offset (m) at rules ms `ms`. Polynomials only (no trigonometry): the same in every engine. */
export function moverOffset(m: Mover, ms: number): number {
   const cycles = ms / m.periodMs + m.phase;
   const t = cycles - Math.floor(cycles);
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   const s = tri * tri * (3 - 2 * tri);
   return m.travel * (2 * s - 1);
}

export function supportX(s: Support, ms: number): number {
   return s.mover && s.mover.axis === "x" ? s.cx + moverOffset(s.mover, ms) : s.cx;
}

export function supportZ(s: Support, ms: number): number {
   return s.mover && s.mover.axis === "z" ? s.cz + moverOffset(s.mover, ms) : s.cz;
}

/** The height of a support's top at x (a slope falls along x from its high edge; clamped to its rectangle). Slopes never move. */
export function surfaceY(s: Support, x: number): number {
   const sl = s.slope;
   if (!sl) return s.top;
   const high = s.cx - sl.dir * s.hw;
   const d = Math.max(0, Math.min(2 * s.hw, (x - high) * sl.dir));
   return s.top - sl.grade * d;
}

/** True while a blinking roof is absent. A roof with no vanish cycle is always there. */
export function roofGone(s: Support, ms: number): boolean {
   const v = s.vanish;
   if (!v) return false;
   const t = ms / v.periodMs + v.phase;
   const frac = t - Math.floor(t);
   return frac < v.gone;
}

/** A strike is live this ms (the same fraction on every device). */
export function strikeLive(st: RoofStrike, ms: number): boolean {
   const t = ms / st.periodMs + st.phase;
   const frac = t - Math.floor(t);
   return frac < st.duty;
}

/** Every level: buildRoofs. The course does not depend on the run seed. */
export function buildCourse(level: RoofLevel = LEVELS[1]): Course {
   const c = buildCourseShape(level);
   fillEntrySpeeds(c);
   fillSeams(c);
   return c;
}

function buildCourseShape(level: RoofLevel): Course {
   const draft = buildRoofs(level);
   const supports: Support[] = draft.supports.map((s) => {
      const low = s.slope ? s.top - s.slope.grade * 2 * s.hw : s.top;
      return {
         kind: s.kind,
         role: s.role,
         block: s.block,
         cx: s.cx,
         cz: s.cz,
         hw: s.hw,
         hd: s.hd,
         top: s.top,
         low,
         bottom: low - THICKNESS,
         mover: s.mover ? { ...s.mover } : null,
         launch: s.launch,
         vanish: s.vanish ? { ...s.vanish } : null,
         slippery: s.slippery,
         slope: s.slope ? { ...s.slope } : null,
         arena: s.arena,
         keep: s.keep,
      };
   });
   const checkpoints = [0];
   supports.forEach((s, i) => {
      if (s.kind === "checkpoint") checkpoints.push(i);
   });
   const goal = supports.findIndex((s) => s.kind === "goal");
   let maxCarry = 0;
   for (const s of supports) if (s.mover) maxCarry = Math.max(maxCarry, moverTopSpeed(s.mover));
   return {
      supports,
      checkpoints,
      goal,
      orbs: draft.orbs,
      durationMs: level.durationMs,
      maxCarry,
      strikes: draft.strikes,
      blocks: draft.blocks,
      secrets: draft.secrets,
      arena: draft.arena,
      slopes: supports.filter((s) => s.slope).length,
      vIn: [],
      seams: new Uint8Array(0),
   };
}

/** Touching supports that meet at the same height: walking across never bumps into the other's side. */
function fillSeams(course: Course): void {
   const sup = course.supports;
   const n = sup.length;
   course.seams = new Uint8Array(n * n);
   for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
         if (i === j || standGap(sup[i], sup[j]) > 0) continue;
         const a = sup[i];
         const b = sup[j];
         const meet = Math.abs(a.top - b.top) < 0.02 || Math.abs(a.top - b.low) < 0.02 || Math.abs(a.low - b.top) < 0.02 || Math.abs(a.low - b.low) < 0.02;
         if (meet && (a.slope || b.slope)) course.seams[i * n + j] = 1;
      }
   }
}

/** Is (x, z) over the support's top at `ms` (its rectangle grown by FOOT)? */
export function onSupport(s: Support, x: number, z: number, ms: number): boolean {
   return Math.abs(x - supportX(s, ms)) <= s.hw + FOOT && Math.abs(z - supportZ(s, ms)) <= s.hd + FOOT;
}

// ---------- the lower bound (README "Server limits and why they hold") ----------

/** The rectangle the feet can stand in on `s` over the whole run (a mover's sweep included), grown by FOOT. */
function standRect(s: Support): { minX: number; maxX: number; minZ: number; maxZ: number } {
   const tx = s.mover?.axis === "x" ? s.mover.travel : 0;
   const tz = s.mover?.axis === "z" ? s.mover.travel : 0;
   return {
      minX: s.cx - s.hw - FOOT - tx,
      maxX: s.cx + s.hw + FOOT + tx,
      minZ: s.cz - s.hd - FOOT - tz,
      maxZ: s.cz + s.hd + FOOT + tz,
   };
}

/** The shortest distance between two supports' stand rectangles (0 when they touch or overlap). */
export function standGap(a: Support, b: Support): number {
   const ra = standRect(a);
   const rb = standRect(b);
   const dx = Math.max(0, ra.minX - rb.maxX, rb.minX - ra.maxX);
   const dz = Math.max(0, ra.minZ - rb.maxZ, rb.minZ - ra.maxZ);
   return Math.sqrt(dx * dx + dz * dz);
}

/** The fastest a flight launched at `v` lands `dy` (> 0) above its launch: up through the apex and down to dy (s). */
export function riseLandS(v: number, dy: number): number {
   const h = (v * v) / (2 * G);
   if (dy >= h) return Infinity;
   return v / G + Math.sqrt((2 * (h - dy)) / G);
}

const dist = (dx: number, dz: number) => Math.sqrt(dx * dx + dz * dz);

/** A flight's air time (s) from a launch at v to a landing dy above it, up through the apex and down; -1 when it never gets that high. */
export function airTimeS(v: number, dy: number): number {
   const h = (v * v) / (2 * G);
   if (dy >= h) return -1;
   return v / G + Math.sqrt((2 * (h - dy)) / G);
}

/**
 * The longest a jump's flight can last (s), the coyote time before it included, to land dy above the
 * edge it left: walking off for c <= COYOTE_MS drops G c^2 / 2 before the jump, so the air time is
 * c + V_JUMP / G + sqrt(R^2 - c^2) with R^2 = 2 (H_JUMP - dy) / G. That peaks at c = R / sqrt 2 (or at
 * the coyote limit). -1 when no jump lands that high.
 */
export function coyoteJumpS(dy: number): number {
   const r2 = (2 * (H_JUMP - dy)) / G;
   if (!(r2 > 0)) return -1;
   const R = Math.sqrt(r2);
   const c = Math.min(COYOTE_MS / 1000, R / Math.SQRT2);
   return c + V_JUMP / G + Math.sqrt(r2 - c * c);
}

/** How a flight may be stretched, per hero (README proof step 4): none, Riko's dash, Nami's second jump. */
export type FlightExtra = 0 | 1 | 2;
export const EXTRA_NONE = 0;
export const EXTRA_DASH = 1;
export const EXTRA_NAMI = 2;

/** A dash moves at most POWER_MS.dash + 1 ms at V_TOP instead of at least V_RUN: this much more ground (m). */
export const DASH_EXTRA_M = ((POWER_MS.dash + 1) / 1000) * (V_TOP - V_RUN);

/**
 * The most ground a flight can cover (m) to land dy above its launch (README proof step 4): at most
 * `vh` (the take-off cap + the carry) through the coyote time (100 ms) and the longest launch (a jump,
 * or the support's updraft). With Nami's second jump, its arc on top: at most V_FLUTTER across (rules.ts
 * tryDoubleJump caps it), landing back at the same height, 2 sqrt(2 (H - dy) / G) more air. With a
 * dash, DASH_EXTRA_M more. Negative when no launch lands that high.
 */
export function reachMax(vh: number, dy: number, vLaunch: number, extra: FlightExtra = EXTRA_NONE): number {
   const t = Math.max(coyoteJumpS(dy), airTimeS(vLaunch, dy) < 0 ? -1 : COYOTE_MS / 1000 + airTimeS(vLaunch, dy));
   if (t < 0) return -1;
   let r = vh * t;
   if (extra === EXTRA_NAMI) {
      const h = Math.max(H_JUMP, (vLaunch * vLaunch) / (2 * G));
      r += V_FLUTTER * 2 * Math.sqrt((2 * Math.max(0, h - dy)) / G);
   } else if (extra === EXTRA_DASH) r += DASH_EXTRA_M;
   return r;
}

/** A slope's stand range is cut into this many x slices for the bound (each with its own height range). */
export const BOUND_SLICES = 12;

export interface Slice {
   x0: number;
   x1: number;
   /** the highest and lowest surface over the slice */
   yMax: number;
   yMin: number;
   /** the furthest and the least downhill (m from the high edge) in the slice */
   dMax: number;
   dMin: number;
}

/** A slope's downhill distance (m from its high edge) at x, clamped to its rectangle; 0 on a flat roof. */
export function downhillAt(s: Support, x: number): number {
   const sl = s.slope;
   if (!sl) return 0;
   const high = s.cx - sl.dir * s.hw;
   return Math.max(0, Math.min(2 * s.hw, (x - high) * sl.dir));
}

/** The rules' clamp looks this far further downhill than the feet (the move after the clamp); the bound adds it again. */
export const CAP_MARGIN = 0.02;

/**
 * The fastest the hero may move on support `i` at downhill distance d, having been as far uphill as
 * dMin since getting onto it (m/s, not the carry): a ball that came on at vIn and rolled down from dMin
 * to d at the slope's accel has v^2 <= vIn^2 + 2 accel (d - dMin); a flat roof keeps vIn. Never above
 * V_ROLL_MAX. The rules clamp to this every ms (a dash may pass it while it lasts), so it holds by
 * construction; the physics only reaches it rolling straight down.
 */
export function capAtD(course: Course, i: number, d: number, dMin: number): number {
   const s = course.supports[i];
   const v0 = course.vIn[i] ?? V_RUN;
   if (!s.slope) return Math.min(V_ROLL_MAX, v0);
   return Math.min(V_ROLL_MAX, Math.sqrt(v0 * v0 + 2 * s.slope.accel * Math.max(0, d + CAP_MARGIN - dMin)));
}

/** The rules' cap at the feet (x) for a hero whose uphill-most point on this support was dMin. */
export function capAt(course: Course, i: number, x: number, dMin: number): number {
   return capAtD(course, i, downhillAt(course.supports[i], x), dMin);
}

/**
 * The entry speed of every support (course.vIn): V_RUN everywhere (a landing thumps the ball back to
 * running speed), V_ROLL_MAX on a `keep` slope (the L1 chained slope) and in the boss arena (the
 * half-pipe), where you land or roll on fast. These are definitions the rules enforce, not estimates.
 */
function fillEntrySpeeds(course: Course): void {
   course.vIn = course.supports.map((s) => (s.keep || s.arena ? V_ROLL_MAX : V_RUN));
}

const SLICE_CACHE = new WeakMap<Support, Slice[]>();


/**
 * The support's stand range cut along x, in downhill order. A flat roof is one slice at its top; a
 * slope's surface is monotone in x, so each slice's height range is its two ends (the surface clamps
 * past the rectangle).
 */
export function slicesOf(s: Support): Slice[] {
   const hit = SLICE_CACHE.get(s);
   if (hit) return hit;
   const r = standRect(s);
   const out: Slice[] = [];
   if (!s.slope) out.push({ x0: r.minX, x1: r.maxX, yMax: s.top, yMin: s.top, dMax: 0, dMin: 0 });
   else {
      for (let k = 0; k < BOUND_SLICES; k++) {
         const x0 = r.minX + ((r.maxX - r.minX) * k) / BOUND_SLICES;
         const x1 = r.minX + ((r.maxX - r.minX) * (k + 1)) / BOUND_SLICES;
         const a = surfaceY(s, x0);
         const b = surfaceY(s, x1);
         out.push({ x0, x1, yMax: Math.max(a, b), yMin: Math.min(a, b), dMax: Math.max(downhillAt(s, x0), downhillAt(s, x1)), dMin: Math.min(downhillAt(s, x0), downhillAt(s, x1)) });
      }
      // downhill order: slice 0 at the high edge (the bound's entry index relies on it)
      if (s.slope.dir < 0) out.reverse();
   }
   SLICE_CACHE.set(s, out);
   return out;
}

/**
 * A node of the bound's graph (README proof step 5): a flat support (one node), or a place on a slope:
 * slice `k`, with `e` the uphill-most slice stood on since getting onto the slope (the rules'
 * Hero.slopeMin: the speed there is at most capAtD from the distance rolled since slice e), and where
 * in the slice the hero is: anywhere (just landed), at its uphill boundary (rolled in from above) or at
 * its downhill boundary (walked in from below). Rolling across a whole slice costs its width at the
 * cap; that is what keeps the bound from teleporting along a slope.
 */
export interface BoundNode {
   support: number;
   e: number;
   k: number;
   /** 0 anywhere, 1 at the uphill boundary, 2 at the downhill boundary */
   at: 0 | 1 | 2;
}

export const AT_ANY = 0;
export const AT_UP = 1;
export const AT_DOWN = 2;

interface BoundGraph {
   nodes: BoundNode[];
   base: number[];
   /** the slope's slice count (0 for a flat support) */
   slices: number[];
}

const GRAPH_CACHE = new WeakMap<Course, BoundGraph>();

function nodeIndex(g: BoundGraph, s: number, e: number, k: number, at: number): number {
   const S = g.slices[s];
   if (S === 0) return g.base[s];
   // (e, k) with e <= k, packed row by row, three places each
   return g.base[s] + 3 * (e * S - (e * (e - 1)) / 2 + (k - e)) + at;
}

function graphOf(course: Course): BoundGraph {
   const hit = GRAPH_CACHE.get(course);
   if (hit) return hit;
   const nodes: BoundNode[] = [];
   const base: number[] = [];
   const slices: number[] = [];
   course.supports.forEach((s, i) => {
      base.push(nodes.length);
      if (!s.slope) {
         slices.push(0);
         nodes.push({ support: i, e: -1, k: 0, at: 0 });
         return;
      }
      const S = slicesOf(s).length;
      slices.push(S);
      for (let e = 0; e < S; e++) for (let k = e; k < S; k++) for (const at of [0, 1, 2] as const) nodes.push({ support: i, e, k, at });
   });
   const g = { nodes, base, slices };
   GRAPH_CACHE.set(course, g);
   return g;
}

/** The z gap between two supports' stand rectangles. */
function zGap(a: Support, b: Support): number {
   const ra = standRect(a);
   const rb = standRect(b);
   return Math.max(0, ra.minZ - rb.maxZ, rb.minZ - ra.maxZ);
}

/** The take-off cap (m/s, not the carry) at a node: a flat support's entry speed, a slope's roll since its entry slice. */
function nodeCap(course: Course, n: BoundNode): number {
   const s = course.supports[n.support];
   if (!s.slope) return Math.max(V_RUN, capAtD(course, n.support, 0, 0));
   const sl = slicesOf(s);
   const dMin = sl[n.e].dMin;
   return Math.max(V_RUN, capAtD(course, n.support, sl[n.k].dMax + CAP_MARGIN, dMin));
}

function sliceOf(course: Course, n: BoundNode): Slice {
   return slicesOf(course.supports[n.support])[n.k];
}

/**
 * The least ms of a flight from node u to landing on support v's slice q (README proof step 4): if it
 * can reach at all (reachMax), max(the gap at the take-off cap plus the take-off's carry (a dash
 * covers DASH_EXTRA_M of it for free), the rise time riseLandS(V_JUMP or the updraft, dy) for dy > 0).
 */
export function flightMs(course: Course, u: BoundNode, v: number, q: Slice, extra: FlightExtra = EXTRA_NONE): number {
   const a = course.supports[u.support];
   const b = course.supports[v];
   const p = sliceOf(course, u);
   const dx = Math.max(0, p.x0 - q.x1, q.x0 - p.x1);
   const dz = zGap(a, b);
   const dy = q.yMin - p.yMax;
   const carry = a.mover ? moverTopSpeed(a.mover) : 0;
   const vh = nodeCap(course, u) + carry;
   const d = Math.sqrt(dx * dx + dz * dz);
   const vMax = Math.max(V_JUMP, a.launch);
   if (d > reachMax(vh, dy, vMax, extra)) return Infinity;
   const flat = (1000 * Math.max(0, d - (extra === EXTRA_DASH ? DASH_EXTRA_M : 0))) / vh;
   if (dy <= 0) {
      // no launch goes down faster than a drop from rest: y(t) >= y0 - G t^2 / 2 for any launch >= 0
      const drop = p.yMin - q.yMax;
      return drop > 0 ? Math.max(flat, 1000 * Math.sqrt((2 * drop) / G)) : flat;
   }
   let vertical = riseLandS(V_JUMP, dy);
   if (a.launch > 0) vertical = Math.min(vertical, riseLandS(vMax, dy));
   if (!Number.isFinite(vertical)) return Infinity;
   return Math.max(flat, 1000 * vertical);
}

/** The least flight time between two supports over all their slices, from a standing start (tests and tools). */
export function edgeMinMs(course: Course, from: number, to: number, extra: FlightExtra = EXTRA_NONE): number {
   const g = graphOf(course);
   let best = Infinity;
   for (const u of g.nodes) {
      if (u.support !== from) continue;
      for (const q of slicesOf(course.supports[to])) best = Math.min(best, flightMs(course, u, to, q, extra));
   }
   return best;
}

interface Arc {
   to: number;
   ms: number;
}

const ARC_CACHE = new WeakMap<Course, Arc[][][]>();

/**
 * The graph's arcs of one kind (EXTRA_NONE also has the ground arcs):
 * - a flight from any node to a slice of another support (landing anywhere in it, entry = that slice);
 * - on a slope, rolling to the next slice down or up: from a landing or from the boundary you are at
 *   into the neighbour for free, else across the whole slice at the faster end's cap;
 * - walking across a seam at the same height (a top deck and its slope's high edge, a ramp's foot and
 *   the pad) at 0 ms, from the slope's matching boundary (or a landing in that end slice).
 */
function arcsOf(course: Course, extra: FlightExtra): Arc[][] {
   let list = ARC_CACHE.get(course);
   if (!list) {
      list = [];
      ARC_CACHE.set(course, list);
   }
   const hit = list[extra];
   if (hit) return hit;
   const g = graphOf(course);
   const sup = course.supports;
   const ns = sup.length;
   const arcs: Arc[][] = g.nodes.map(() => []);
   // flights do not depend on where in the slice you are: compute them once per (e, k)
   const flightCache = new Map<number, Arc[]>();
   g.nodes.forEach((u, ui) => {
      const key = u.support * 100000 + (u.e + 1) * 300 + u.k;
      let fl = flightCache.get(key);
      if (!fl) {
         fl = [];
         for (let v = 0; v < ns; v++) {
            if (v === u.support) continue;
            const sl = slicesOf(sup[v]);
            for (let q = 0; q < sl.length; q++) {
               const ms = flightMs(course, u, v, sl[q], extra);
               if (Number.isFinite(ms)) fl.push({ to: nodeIndex(g, v, q, q, AT_ANY), ms });
            }
         }
         flightCache.set(key, fl);
      }
      for (const a of fl) arcs[ui].push(a);
      if (extra !== EXTRA_NONE) return;
      const s = sup[u.support];
      const pu = sliceOf(course, u);
      // seams
      for (let v = 0; v < ns; v++) {
         if (v === u.support || !course.seams[u.support * ns + v]) continue;
         const t = sup[v];
         const sl = slicesOf(t);
         if (zGap(s, t) > 0) continue;
         // where u can leave: a flat support anywhere; a slope from its high end (slice 0, uphill
         // boundary or a landing) or its low end (last slice, downhill boundary or a landing)
         if (s.slope) {
            const last = slicesOf(s).length - 1;
            const highOk = u.k === 0 && u.at !== AT_DOWN;
            const lowOk = u.k === last && u.at !== AT_UP;
            if (!highOk && !lowOk) continue;
         }
         for (let q = 0; q < sl.length; q++) {
            const q0 = sl[q];
            const touch = Math.max(0, pu.x0 - q0.x1, q0.x0 - pu.x1) === 0;
            if (!touch || q0.yMin > pu.yMax + STEP_UP + 1e-9 || q0.yMax < pu.yMin - STEP_DOWN - 1e-9) continue;
            if (!t.slope) arcs[ui].push({ to: nodeIndex(g, v, 0, 0, 0), ms: 0 });
            else {
               // onto a slope across its high edge (uphill boundary of slice 0) or its lip (downhill boundary of the last)
               const at = q === 0 ? AT_UP : q === sl.length - 1 ? AT_DOWN : AT_ANY;
               arcs[ui].push({ to: nodeIndex(g, v, q, q, at), ms: 0 });
            }
         }
      }
      // rolling to the neighbouring slices
      if (s.slope) {
         const sl = slicesOf(s);
         for (const k2 of [u.k + 1, u.k - 1]) {
            if (k2 < 0 || k2 >= sl.length) continue;
            const down = k2 > u.k;
            const e2 = Math.min(u.e, k2);
            // free into the neighbour from a landing, or from the boundary you are already at
            const free = u.at === AT_ANY || (down ? u.at === AT_DOWN : u.at === AT_UP);
            const fast = Math.max(V_RUN, capAtD(course, u.support, Math.max(pu.dMax, sl[k2].dMax) + CAP_MARGIN, sl[e2].dMin));
            const width = pu.x1 - pu.x0;
            arcs[ui].push({ to: nodeIndex(g, u.support, e2, k2, down ? AT_UP : AT_DOWN), ms: free ? 0 : (1000 * width) / fast });
         }
      }
   });
   list[extra] = arcs;
   return arcs;
}

/** A small binary heap of (key, node) for Dijkstra. */
class Heap {
   private keys: number[] = [];
   private vals: number[] = [];
   get size(): number {
      return this.keys.length;
   }
   push(key: number, val: number): void {
      const k = this.keys;
      const v = this.vals;
      k.push(key);
      v.push(val);
      let i = k.length - 1;
      while (i > 0) {
         const p = (i - 1) >> 1;
         if (k[p] <= k[i]) break;
         [k[p], k[i]] = [k[i], k[p]];
         [v[p], v[i]] = [v[i], v[p]];
         i = p;
      }
   }
   pop(): [number, number] {
      const k = this.keys;
      const v = this.vals;
      const top: [number, number] = [k[0], v[0]];
      const lk = k.pop()!;
      const lv = v.pop()!;
      if (k.length > 0) {
         k[0] = lk;
         v[0] = lv;
         let i = 0;
         for (;;) {
            const l = 2 * i + 1;
            const r = l + 1;
            let m = i;
            if (l < k.length && k[l] < k[m]) m = l;
            if (r < k.length && k[r] < k[m]) m = r;
            if (m === i) break;
            [k[m], k[i]] = [k[i], k[m]];
            [v[m], v[i]] = [v[i], v[m]];
            i = m;
         }
      }
      return top;
   }
}

/**
 * Dijkstra over (node, powered flights used) with plain arcs inside a layer and `extra` flights one
 * layer up: arrival[k][support] = the least ms to stand on it having stretched at most k flights.
 */
export function layeredArrival(course: Course, extra: FlightExtra, layers: number): number[][] {
   const g = graphOf(course);
   const n = g.nodes.length;
   const plain = arcsOf(course, EXTRA_NONE);
   const up = extra === EXTRA_NONE ? null : arcsOf(course, extra);
   const L = layers + 1;
   const best = new Float64Array(n * L).fill(Infinity);
   const done = new Uint8Array(n * L);
   const start = nodeIndex(g, course.checkpoints[0], 0, 0, 0);
   best[start] = 0;
   const heap = new Heap();
   heap.push(0, start);
   while (heap.size > 0) {
      const [t0, u] = heap.pop();
      if (done[u] || t0 > best[u]) continue;
      done[u] = 1;
      const k = Math.floor(u / n);
      const s = u % n;
      for (const a of plain[s]) {
         const w = k * n + a.to;
         const t = t0 + a.ms;
         if (t < best[w]) {
            best[w] = t;
            heap.push(t, w);
         }
      }
      if (up && k + 1 < L) {
         for (const a of up[s]) {
            const w = (k + 1) * n + a.to;
            const t = t0 + a.ms;
            if (t < best[w]) {
               best[w] = t;
               heap.push(t, w);
            }
         }
      }
   }
   const ns = course.supports.length;
   const out: number[][] = [];
   for (let k = 0; k < L; k++) {
      const row = new Array<number>(ns).fill(Infinity);
      for (let i = 0; i < n; i++) {
         const sIdx = g.nodes[i].support;
         // a powered layer never needs more than it used: arrival with at most k
         let t = best[k * n + i];
         for (let j = 0; j < k; j++) t = Math.min(t, best[j * n + i]);
         if (t < row[sIdx]) row[sIdx] = t;
      }
      out.push(row);
   }
   return out;
}

/** The most powered flights the bound considers (a run long enough to fire more would be slower anyway; checked by the tests). */
export const MAX_POWERED = 8;

/**
 * The least ms to stand on each support, for every hero (README proof step 5): the plain heroes
 * (Kiro, Zuno, Vexa: their powers add no reach), Riko (each dash stretches one flight) and Nami (each
 * second jump stretches one). A run that used k powers lasted at least (k - 1) cooldowns, so its
 * arrival is at least max(arrival with k powered flights, (k - 1) x cooldown). The least over all.
 */
export function minArrivalMs(course: Course): number[] {
   const n = course.supports.length;
   const out = layeredArrival(course, EXTRA_NONE, 0)[0].slice();
   const classes: Array<[FlightExtra, number]> = [
      [EXTRA_DASH, heroById("riko").cooldownMs],
      [EXTRA_NAMI, heroById("nami").cooldownMs],
   ];
   for (const [extra, cooldown] of classes) {
      const layers = layeredArrival(course, extra, MAX_POWERED);
      for (let s = 0; s < n; s++) {
         for (let k = 0; k <= MAX_POWERED; k++) {
            // stretched at most k flights: at least k - 1 cooldowns went by
            const t = Math.max(layers[k][s], Math.max(0, k - 1) * cooldown);
            if (t < out[s]) out[s] = t;
         }
      }
   }
   return out;
}

/**
 * Ashback's least defeat time (ms after he wakes): his own machine stepped 1 ms at a time with a hit
 * landed on the very first ms of every open window (the rules step him, then check the hit, in the
 * same ms). No run can hit him sooner, because hits count only while he is open.
 */
export function bossMinMs(): number {
   const s = createBoss(ASHBACK);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, ASHBACK, 1, ev);
      if (s.step === "vulnerable" && hitBoss(s, ASHBACK, 1, ev) === "defeated") return ms;
   }
   return Infinity;
}

const BOSS_MIN_MS = bossMinMs();

/**
 * The proven least finish ms of a course (README proof step 5). With the boss (solo L5), the finish is
 * his defeat: at least the first stand on the arena plus his least defeat time.
 */
export function minFinishMs(course: Course, boss = true): number {
   const arrive = minArrivalMs(course);
   if (!course.arena || !boss) return arrive[course.goal];
   let first = Infinity;
   course.supports.forEach((s, i) => {
      if (s.arena) first = Math.min(first, arrive[i]);
   });
   return first + BOSS_MIN_MS;
}

export const COURSE: Course = buildCourse(LEVELS[1]);

/** What the course can feed the flow meter: each coin once, each first landing (the start excluded), each slope's first banked leap. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.supports.length - 1, base: COMBO_BASE_MS.roof },
         { count: course.slopes, base: COMBO_BASE_MS.bank },
      ],
   };
}

/** The least submitted duration: the least finish minus every coin's bonus and the most flow bonus (README proof step 6). */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

// ---------- limits per level (README "Server limits"; meta.ts and arcade-games.json copy these) ----------

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/**
 * minDurationMs = the bound less about 2.5 %, rounded down to 100 ms, still inside 94-100 % of the
 * bound (the bound already covers every hero's power, so the margin only absorbs the rounding and the
 * coin and flow terms). The level's own timer is timeBaseMs and maxDurationMs.
 */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.975) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   const timeBaseMs = course.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: course.durationMs, timeBaseMs };
}

// ---------- the run ----------

export type HeroState = "play" | "lost" | "spawn";

export interface Hero extends Vec3Like {
   /** feet centre: x right, y up (feet), z forward = -z */
   x: number;
   y: number;
   z: number;
   /** horizontal velocity (m/s): the stick's, or the banked roll */
   vx: number;
   vz: number;
   state: HeroState;
   grounded: boolean;
   /** the support stood on, NONE in the air */
   support: number;
   /** the last support stood on (a coyote jump's take-off) */
   from: number;
   /** curled into the ball (on a slope, or still fast after one) */
   curled: boolean;
   /** this flight is a rolled leap (left a slope curled at ROLLED_MIN or more) */
   rolled: boolean;
   /** the fastest this flight may go (its take-off's ground cap; the air stick may still reach V_RUN); -1 = Nami's flutter (V_FLUTTER) */
   flightCap: number;
   /** the uphill-most downhill distance stood at since getting onto this support (the speed cap's start) */
   slopeMin: number;
   /** the current arc in the air: y = arcY0 + arcV · t - G t² / 2, t = (ms - arcStart) / 1000 */
   arcStart: number;
   arcY0: number;
   arcV: number;
   /** the ms of the walk-off (coyote time runs from it), NONE otherwise */
   coyoteFrom: number;
   /** carry (m per ms) this ms on a mover; in the air the take-off's carry */
   carryX: number;
   carryZ: number;
   /** the height of the last landing (the fall line is FALL_DEPTH under it) */
   lastTop: number;
   /** ms left in "lost" or "spawn" */
   timerMs: number;
   /** dash is on through this rules ms (NONE = off); dashX/Z is a unit vector at dashSpeed */
   dashUntil: number;
   dashX: number;
   dashZ: number;
   dashSpeed: number;
   /** Nami's extra jump is still available this flight */
   airJump: boolean;
   /** feet may not go above this on the current flight (a double jump cannot add reach) */
   apexCap: number;
   /** Kiro / Zuno / Vexa: the power is on through this rules ms (NONE = off) */
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** a blinking roof just landed on stays solid through this rules ms */
   gripUntil: number;
}

/** One frame of input. Scene fills one object per run and passes it every step. */
export interface StepInput {
   /** the stick at camera yaw 0: inputToWorld(moveX, moveY, 0), so up is -z. Length <= 1 (longer is normalised). step() turns it by `yaw`. */
   moveX: number;
   moveZ: number;
   /**
    * The camera yaw the stick is relative to (rad, the menu2 orbit camera's viewYaw). step() maps
    * (moveX, moveZ) with inputToWorld(moveX, moveZ, yaw), so "up" moves away from the camera. 0 or
    * omitted (bots, tests) = the stick is already world space. Turning keeps the length, so the
    * proof's speed bounds hold for any yaw.
    */
   yaw?: number;
   /** a jump press this frame (keyboard and touch alike), latched at the frame's first ms */
   jumpPressed: boolean;
   /** the hero power (E/Enter or the Power button), latched at the frame's first ms */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

/** What happened in one step. The same object every step, reset at its start. */
export interface StepEvents {
   jumped: boolean;
   /** a chimney updraft launched the hero */
   bounced: boolean;
   landed: boolean;
   /** the support of the latest landing in this step, NONE without one */
   landedOn: number;
   /** a take-off from a slope at BANK_SPEED or more (the speed is in `bankSpeed`) */
   banked: boolean;
   bankSpeed: number;
   /** a checkpoint (1..) activated in this step, NONE otherwise */
   checkpoint: number;
   orbCount: number;
   orbList: number[];
   lost: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   powered: boolean;
   /** a cracked skylight smashed this step (its block index), NONE otherwise */
   broke: number;
   comboBonus: number;
   comboLinked: boolean;
   secretCount: number;
   secretList: number[];
   /** the boss: woke, telegraph, attack, a hit, a phase change, the defeat */
   bossWoke: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

/** Ashback's fight state (L5 solo). */
export interface BossRun {
   state: BossState;
   ev: BossEvents;
   /** the rules ms he woke (the first stand on the arena), NONE before */
   wokeMs: number;
   /** the side he is open on (0 = A, the entry side; 1 = B), locked when an attack starts */
   side: number;
   /** where he is now (drawn by the Scene, the contact point of hits and rams) */
   x: number;
   y: number;
   z: number;
   /** the P1 water tank (visible while rolling) */
   tankX: number;
   tankOn: boolean;
   /** the ramp sprayed grey (P2 attack), NONE otherwise: no roll speed on it */
   paint: number;
}

export interface RoofRun {
   course: Course;
   level: LevelId;
   heroId: HeroId;
   /** the seed: the course is fixed; the Scene's decor uses it */
   seed: number;
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   pressMs: number;
   actionMs: number;
   powerReadyAt: number;
   checkpoint: number;
   respawns: number;
   /** 1 = collected, per course.orbs */
   collected: Uint8Array;
   orbs: number;
   finishMs: number;
   /** the flow meter (menu2/combo): combo.bonusTotal ms come off the submitted time */
   combo: ComboState;
   /** 1 = landed on this support before (a first landing is a flow link) */
   visited: Uint8Array;
   /** 1 = this slope's banked leap was counted */
   banked: Uint8Array;
   /** 1 = this cracked skylight is smashed */
   broken: Uint8Array;
   secrets: SecretTracker;
   /** falls and hits taken (0 = the no-hit badge) */
   hits: number;
   /** the highest top stood on (HUD "height") */
   bestTop: number;
   /** the boss (solo L5), null elsewhere */
   boss: BossRun | null;
   ended: "win" | "timeup" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   const orbList = new Array<number>(32);
   for (let i = 0; i < orbList.length; i++) orbList[i] = 0;
   return {
      jumped: false,
      bounced: false,
      landed: false,
      landedOn: NONE,
      banked: false,
      bankSpeed: 0,
      checkpoint: NONE,
      orbCount: 0,
      orbList,
      lost: false,
      respawned: false,
      finished: false,
      timeup: false,
      powered: false,
      broke: NONE,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      bossWoke: false,
      bossTelegraph: false,
      bossAttack: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.bounced = false;
   ev.landed = false;
   ev.landedOn = NONE;
   ev.banked = false;
   ev.bankSpeed = 0;
   ev.checkpoint = NONE;
   ev.orbCount = 0;
   ev.lost = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
   ev.powered = false;
   ev.broke = NONE;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.bossWoke = false;
   ev.bossTelegraph = false;
   ev.bossAttack = false;
   ev.bossHit = false;
   ev.bossPhase = false;
   ev.bossDefeated = false;
}

const COURSES: Partial<Record<LevelId, Course>> = { 1: COURSE };

/** The level's course (built once per level). */
export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

/** Proposed server limits, one row per level, from that level's course. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

/** Level 1's row (the same object meta.ts ships as scoring). */
export const LEVEL1_LIMITS: LevelLimits = PROPOSED_LEVEL_LIMITS[1];

function freshHero(x: number, y: number, z: number, support: number): Hero {
   return {
      x,
      y,
      z,
      vx: 0,
      vz: 0,
      state: "play",
      grounded: true,
      support,
      from: support,
      curled: false,
      rolled: false,
      flightCap: V_RUN,
      slopeMin: 0,
      arcStart: 0,
      arcY0: y,
      arcV: 0,
      coyoteFrom: NONE,
      carryX: 0,
      carryZ: 0,
      lastTop: y,
      timerMs: 0,
      dashUntil: NONE,
      dashX: 0,
      dashZ: -1,
      dashSpeed: V_DASH,
      airJump: true,
      apexCap: y + H_JUMP,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
      gripUntil: 0,
   };
}

export interface RunOptions {
   /** L5's boss fight (solo); local multiplayer plays the arena as a plain finish */
   boss?: boolean;
}

/**
 * A new run on the start deck: at rest, grounded. Allocates everything the run will ever use.
 * `heroId` defaults to Riko; the Scene passes the overlay's pick. The power is ready at the start.
 */
export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = "riko", opts: RunOptions = {}): RoofRun {
   const course = courseFor(level);
   const start = course.supports[course.checkpoints[0]];
   const bossOn = !!course.arena && opts.boss !== false;
   return {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(start.cx, start.top, start.cz + START_DZ, course.checkpoints[0]),
      pressMs: NONE,
      actionMs: NONE,
      powerReadyAt: 0,
      checkpoint: 0,
      respawns: 0,
      collected: new Uint8Array(course.orbs.length),
      orbs: 0,
      finishMs: 0,
      combo: createCombo(),
      visited: new Uint8Array(course.supports.length),
      banked: new Uint8Array(course.supports.length),
      broken: new Uint8Array(course.blocks.length),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      bestTop: start.top,
      boss: bossOn ? createBossRun(course) : null,
      ended: null,
      events: createEvents(),
   };
}

function createBossRun(course: Course): BossRun {
   const a = course.arena!;
   const pad = course.supports[a.pad];
   return { state: createBoss(ASHBACK), ev: createBossEvents(), wokeMs: NONE, side: 0, x: pad.cx, y: pad.top, z: a.z, tankX: pad.cx, tankOn: false, paint: NONE };
}

/** Is the boss fight on in this run (solo L5)? */
export function bossOn(run: RoofRun): boolean {
   return run.boss !== null;
}

/** The feet height of the hero's current arc at rules ms `ms`. */
export function arcY(h: Hero, ms: number): number {
   const t = (ms - h.arcStart) / 1000;
   return h.arcY0 + h.arcV * t - (G / 2) * t * t;
}

/** The arc's vertical speed (m/s) at `ms`. */
export function arcVy(h: Hero, ms: number): number {
   return h.arcV - (G * (ms - h.arcStart)) / 1000;
}

function startArc(h: Hero, ms: number, y0: number, v: number): void {
   const keep = h.apexCap;
   h.arcStart = ms;
   h.arcY0 = y0;
   h.arcV = v;
   h.y = y0;
   h.grounded = false;
   h.support = NONE;
   if (v > 0) h.apexCap = y0 + (v * v) / (2 * G);
   else h.apexCap = keep;
}

/** Shield or phase is up: arcs, tanks and rams do not touch the hero. */
function hazardImmune(h: Hero, ms: number): boolean {
   return ms <= h.shieldUntil || ms <= h.phaseUntil;
}

/** Horizontal speed (m/s). */
export function heroSpeed(h: Hero): number {
   return Math.sqrt(h.vx * h.vx + h.vz * h.vz);
}

/**
 * Nami's second jump. The new apex is capped at the flight's existing apexCap, so it cannot reach a
 * platform a single jump (or the updraft that started the flight) could not already reach.
 */
function tryDoubleJump(run: RoofRun, ms: number): boolean {
   const h = run.hero;
   if (h.grounded || !h.airJump) return false;
   const y = h.y;
   const cap = h.apexCap;
   if (!(y < cap - 0.04)) return false;
   const v = Math.min(V_JUMP, Math.sqrt(Math.max(0, 2 * G * (cap - y))));
   if (!(v >= 1)) return false;
   startArc(h, ms, y, v);
   h.apexCap = cap;
   h.airJump = false;
   // the second arc is a flutter, not a roll: at most V_FLUTTER across (README proof step 4, reachMax)
   h.flightCap = -1;
   return true;
}

/** Fire the run's hero power if it is off cooldown. A press that cannot fire (Nami on the ground) does not start the cooldown. */
function tryPower(run: RoofRun, ms: number, mx: number, mz: number): void {
   if (ms < run.powerReadyAt) return;
   const def = heroById(run.heroId);
   const h = run.hero;
   if (def.power === "dash") {
      let dx = mx;
      let dz = mz;
      let len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.25) {
         dx = h.vx;
         dz = h.vz;
         len = Math.sqrt(dx * dx + dz * dz);
      }
      if (len < 0.25) {
         dx = 0;
         dz = -1;
         len = 1;
      }
      h.dashX = dx / len;
      h.dashZ = dz / len;
      // a dash on top of a banked roll is the card's burst: 3 m/s over the roll, at most V_TOP
      h.dashSpeed = Math.min(V_TOP, Math.max(V_DASH, heroSpeed(h) + 3));
      h.dashUntil = ms + POWER_MS.dash;
      run.powerReadyAt = ms + def.cooldownMs;
      run.events.powered = true;
      return;
   }
   if (def.power === "doubleJump") {
      if (!tryDoubleJump(run, ms)) return;
      run.powerReadyAt = ms + def.cooldownMs;
      run.events.powered = true;
      run.events.jumped = true;
      return;
   }
   if (def.power === "shield") h.shieldUntil = ms + POWER_MS.shield;
   else if (def.power === "magnet") h.magnetUntil = ms + POWER_MS.magnet;
   else h.phaseUntil = ms + POWER_MS.phase;
   run.powerReadyAt = ms + def.cooldownMs;
   run.events.powered = true;
}

function strikeHit(run: RoofRun, ms: number): boolean {
   const strikes = run.course.strikes;
   if (strikes.length === 0) return false;
   const h = run.hero;
   if (hazardImmune(h, ms)) return false;
   for (let i = 0; i < strikes.length; i++) {
      const st = strikes[i];
      if (!strikeLive(st, ms)) continue;
      const s = run.course.supports[st.support];
      if (st.air) {
         if (h.y > s.top + ARC_HEIGHT || h.y + HERO.height < s.top) continue;
      } else if (!h.grounded || h.support !== st.support) continue;
      const dx = h.x - (supportX(s, ms) + st.ox);
      const dz = h.z - (supportZ(s, ms) + st.oz);
      if (dx * dx + dz * dz <= st.radius * st.radius) return true;
   }
   return false;
}

/** The whole ms to simulate for a frame of `dtMs` (clamped to MAX_STEP_MS), the fraction carried. */
export function advanceClock(run: RoofRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);
/** scratch for the camera-relative stick (step() is not re-entrant) */
const TURNED = { x: 0, z: 0 };

/**
 * One frame: `dtMs` is useRunFrame's dt · 1000. Each whole ms: simMs += 1; the ms that reaches the
 * cap ends with "timeup"; else the hero's state acts (and the boss). A finish or a time-up ends the
 * step, and every later step does nothing. Returns run.events (the same object every step).
 */
export function step(run: RoofRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   const whole = advanceClock(run, dtMs);
   if (input.jumpPressed) run.pressMs = run.simMs + 1;
   if (input.actionPressed) run.actionMs = run.simMs + 1;
   let mx = finite(input.moveX);
   let mz = finite(input.moveZ);
   const yaw = finite(input.yaw ?? 0);
   if (yaw !== 0) {
      const turned = inputToWorld(mx, mz, yaw, TURNED);
      mx = turned.x;
      mz = turned.z;
   }
   const len = Math.sqrt(mx * mx + mz * mz);
   if (len > 1) {
      mx /= len;
      mz /= len;
   }
   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= run.course.durationMs) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run, mx, mz);
      if (run.ended !== null) return ev;
   }
   return ev;
}

function tick(run: RoofRun, mx: number, mz: number): void {
   const h = run.hero;
   if (h.state === "lost") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      h.y = arcY(h, run.simMs);
      if (h.timerMs <= 0) respawn(run);
   } else if (h.state === "spawn") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      if (h.timerMs <= 0) h.state = "play";
   } else playMs(run, mx, mz);
   if (run.ended === null && run.boss) bossMs(run);
}

// collision scratch (module-level: step() never yields)
const SCRATCH_P: Vec3Like = { x: 0, y: 0, z: 0 };
const SCRATCH_BOX: AABB = { min: { x: 0, y: -1000, z: 0 }, max: { x: 0, y: 1000, z: 0 } };

function box(x: number, z: number, hw: number, hd: number): AABB {
   SCRATCH_BOX.min.x = x - hw;
   SCRATCH_BOX.max.x = x + hw;
   SCRATCH_BOX.min.z = z - hd;
   SCRATCH_BOX.max.z = z + hd;
   return SCRATCH_BOX;
}

function pushOut(h: Hero, x: number, z: number, hw: number, hd: number): void {
   SCRATCH_P.x = h.x;
   SCRATCH_P.y = 0;
   SCRATCH_P.z = h.z;
   resolveSphereAabb(SCRATCH_P, HERO.radius, box(x, z, hw, hd), SCRATCH_P);
   h.x = SCRATCH_P.x;
   h.z = SCRATCH_P.z;
}

/** Does the hero's cylinder overlap a block (in plan and in height)? */
function touchesBlock(h: Hero, b: RoofBlock): boolean {
   if (h.y >= b.y1 || h.y + HERO.height <= b.y0) return false;
   const dx = Math.max(0, Math.abs(h.x - b.cx) - b.hw);
   const dz = Math.max(0, Math.abs(h.z - b.cz) - b.hd);
   return dx * dx + dz * dz < HERO.radius * HERO.radius;
}

function sideCollisions(run: RoofRun, h: Hero, ms: number): void {
   const course = run.course;
   const head = h.y + HERO.height;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      const gripped = i === h.support && ms <= h.gripUntil;
      if (!gripped && roofGone(s, ms)) continue;
      if (i === h.support) continue;
      if (h.support !== NONE && course.seams[h.support * supports.length + i]) continue;
      if (!(h.y < surfaceY(s, h.x) - 1e-9 && head > s.bottom)) continue;
      pushOut(h, supportX(s, ms), supportZ(s, ms), s.hw, s.hd);
   }
   // the skylights and billboards: a dash smashes a skylight, phase passes a billboard
   const blocks = course.blocks;
   for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === "crack" && run.broken[i]) continue;
      if (b.kind === "ghost" && ms <= h.phaseUntil) continue;
      if (!touchesBlock(h, b)) continue;
      if (b.kind === "crack" && h.dashUntil >= ms) {
         run.broken[i] = 1;
         run.events.broke = i;
         continue;
      }
      pushOut(h, b.cx, b.cz, b.hw, b.hd);
   }
}

/** Is the hero's centre inside a support's box at a height that collides (the progress guard's fallback)? */
function insideSolid(course: Course, x: number, z: number, feet: number, ms: number): boolean {
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      if (!(feet < surfaceY(s, x) - 1e-9 && feet + HERO.height > s.bottom)) continue;
      if (Math.abs(x - supportX(s, ms)) < s.hw && Math.abs(z - supportZ(s, ms)) < s.hd) return true;
   }
   return false;
}

/** The highest support whose surface the feet crossed downwards this ms with the centre over it. */
function landingSupport(course: Course, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   let best = NONE;
   let bestY = -Infinity;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      const ys = surfaceY(s, x);
      if (!(yOld >= ys - 1e-9 && ys > yNew)) continue;
      if (ys <= bestY) continue;
      if (onSupport(s, x, z, ms)) {
         best = i;
         bestY = ys;
      }
   }
   return best;
}

/** A rising head that crosses a support's underside (centre under its box) stops rising. */
function headSupport(course: Course, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      if (!(yOld + HERO.height <= s.bottom && s.bottom < yNew + HERO.height)) continue;
      if (Math.abs(x - supportX(s, ms)) < s.hw && Math.abs(z - supportZ(s, ms)) < s.hd) return i;
   }
   return NONE;
}

function supportUnder(course: Course, h: Hero, ms: number): number {
   if (h.support !== NONE) {
      const current = course.supports[h.support];
      const gripped = ms <= h.gripUntil;
      if ((gripped || !roofGone(current, ms)) && onSupport(current, h.x, h.z, ms)) return h.support;
   }
   // walking across onto a touching roof: its surface under the feet at most STEP_DOWN lower (a slope's
   // high edge seen from its top deck) or STEP_UP higher (a slope's low edge seen from the roof at its foot)
   const supports = course.supports;
   let best = NONE;
   let bestY = -Infinity;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (roofGone(s, ms)) continue;
      const y = surfaceY(s, h.x);
      if (y > h.y + STEP_UP || y < h.y - STEP_DOWN || y <= bestY) continue;
      if (onSupport(s, h.x, h.z, ms)) {
         best = i;
         bestY = y;
      }
   }
   return best;
}


/** Ease (vx, vz) towards (tx, tz) by at most `rate` (m/s this ms). */
function easeVel(h: Hero, tx: number, tz: number, rate: number): void {
   let dvx = tx - h.vx;
   let dvz = tz - h.vz;
   const dv = Math.sqrt(dvx * dvx + dvz * dvz);
   if (dv > rate) {
      dvx *= rate / dv;
      dvz *= rate / dv;
   }
   h.vx += dvx;
   h.vz += dvz;
}

/** Curled on a flat roof: turn towards the stick, and bleed ROLL_BLEED; uncurl at V_RUN or with the stick released. */
function flatCurl(h: Hero, mx: number, mz: number, m: number, speed: number): boolean {
   if (!(h.curled && speed > V_RUN && m > 0.3)) return false;
   easeVel(h, (mx / m) * speed, (mz / m) * speed, 20 / 1000);
   const s2 = heroSpeed(h);
   const k = s2 > 0 ? Math.max(0, s2 - ROLL_BLEED / 1000) / s2 : 0;
   h.vx *= k;
   h.vz *= k;
   return true;
}

function playMs(run: RoofRun, mx: number, mz: number): void {
   const course = run.course;
   const h = run.hero;
   const ev = run.events;
   const ms = run.simMs;
   const x0 = h.x;
   const z0 = h.z;
   comboTick(run.combo, COMBO, ms);

   // 1. carry: the mover's own step this ms when grounded on one; in the air the take-off's
   let cx = h.carryX;
   let cz = h.carryZ;
   if (h.grounded) {
      const s = course.supports[h.support];
      cx = supportX(s, ms) - supportX(s, ms - 1);
      cz = supportZ(s, ms) - supportZ(s, ms - 1);
      h.carryX = cx;
      h.carryZ = cz;
   }

   // 2. jump: a buffered press, grounded or within coyote time. Off a slope, curled and fast, it is a
   // rolled leap; at BANK_SPEED a banked leap (a flow link, once per slope)
   if (run.pressMs !== NONE) {
      if (ms - run.pressMs > BUFFER_MS) {
         run.pressMs = NONE;
      } else if (h.grounded || (h.coyoteFrom !== NONE && ms - h.coyoteFrom <= COYOTE_MS)) {
         const y0 = h.grounded ? h.y : arcY(h, ms);
         const off = h.grounded ? h.support : h.from;
         const speed = heroSpeed(h);
         const fromSlope = off !== NONE && course.supports[off].slope !== null;
         if (h.grounded) h.flightCap = capAt(course, h.support, h.x, h.slopeMin);
         startArc(h, ms, y0, V_JUMP);
         h.coyoteFrom = NONE;
         h.rolled = fromSlope && h.curled && speed >= ROLLED_MIN;
         run.pressMs = NONE;
         ev.jumped = true;
         if (fromSlope && speed >= BANK_SPEED) {
            ev.banked = true;
            ev.bankSpeed = speed;
            if (!run.banked[off]) {
               run.banked[off] = 1;
               ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.bank);
               ev.comboLinked = true;
            }
         }
      }
   }

   // 2b. hero power: the same action press on keyboard and touch. A double jump on the same ms as a
   // ground jump would only replace that jump, so it waits for a later press.
   if (run.actionMs === ms) {
      run.actionMs = NONE;
      if (!(heroById(run.heroId).power === "doubleJump" && ev.jumped)) tryPower(run, ms, mx, mz);
   }

   // 3. velocity: the dash; on a slope the curl (lean downhill) banks speed; curled on a flat it bleeds;
   // uncurled above V_RUN it brakes; in the air a fast flight keeps its speed (the stick only turns it)
   const dashing = h.dashUntil >= ms;
   const m = Math.sqrt(mx * mx + mz * mz);
   const speed = heroSpeed(h);
   if (dashing) {
      h.vx = h.dashX * h.dashSpeed;
      h.vz = h.dashZ * h.dashSpeed;
   } else if (h.grounded) {
      const s = course.supports[h.support];
      const sl = s.slope;
      const painted = run.boss !== null && run.boss.paint === h.support;
      if (sl && !painted && (mx * sl.dir > CURL_K || sl.wet)) {
         h.curled = true;
         h.vx += (sl.dir * sl.accel) / 1000;
         // the stick steers across the slope
         let dvz = V_RUN * mz - h.vz;
         const r = ACCEL.ground / 1000;
         if (dvz > r) dvz = r;
         else if (dvz < -r) dvz = -r;
         h.vz += dvz;
      } else if (sl && painted && mx * sl.dir > CURL_K) {
         // grey paint: no speed gain, the ball only bleeds
         h.curled = true;
         if (!flatCurl(h, mx, mz, m, speed)) easeVel(h, V_RUN * mx, V_RUN * mz, ACCEL.ground / 1000);
      } else if (!flatCurl(h, mx, mz, m, speed)) {
         h.curled = false;
         const rate = speed > V_RUN + 1e-9 ? BRAKE : s.slippery ? ACCEL.ice : ACCEL.ground;
         easeVel(h, V_RUN * mx, V_RUN * mz, rate / 1000);
      }
   } else if (speed > V_RUN) {
      if (m > 0.1) easeVel(h, (mx / m) * speed, (mz / m) * speed, ACCEL.air / 1000);
   } else {
      easeVel(h, V_RUN * mx, V_RUN * mz, ACCEL.air / 1000);
   }
   // the proof's speed caps (README proof step 3): a dash; on the ground the support's cap at the feet;
   // in the air the take-off's cap (the air stick may still reach V_RUN)
   const speedCap = dashing ? V_TOP : h.grounded ? capAt(course, h.support, x0, h.slopeMin) : h.flightCap < 0 ? V_FLUTTER : Math.max(V_RUN, h.flightCap);
   const sp = heroSpeed(h);
   if (sp > speedCap) {
      h.vx *= speedCap / sp;
      h.vz *= speedCap / sp;
   }

   // 4. move by the velocity plus the carry
   h.x += h.vx / 1000 + cx;
   h.z += h.vz / 1000 + cz;

   // 5. vertical: walk-off, the surface under the feet, the arc (head bump, landing)
   if (h.grounded) {
      const s = supportUnder(course, h, ms);
      if (s === NONE) {
         h.flightCap = capAt(course, h.support, h.x, h.slopeMin);
         startArc(h, ms, h.y, 0);
         h.coyoteFrom = ms;
         h.rolled = false;
      } else {
         const d = downhillAt(course.supports[s], h.x);
         // walking onto another roof starts its entry there; on the same one the uphill-most point holds
         h.slopeMin = s === h.support ? Math.min(h.slopeMin, d) : d;
         h.support = s;
         h.from = s;
         h.y = surfaceY(course.supports[s], h.x);
         h.airJump = true;
         h.apexCap = h.y + H_JUMP;
      }
   } else {
      const yOld = h.y;
      let yNew = arcY(h, ms);
      if (yNew > yOld) {
         const hit = headSupport(course, h.x, h.z, yOld, yNew, ms);
         if (hit !== NONE) {
            yNew = Math.min(yOld, course.supports[hit].bottom - HERO.height - 1e-6);
            startArc(h, ms, yNew, 0);
            h.coyoteFrom = NONE;
         }
      }
      h.y = yNew;
      if (yNew < yOld) {
         const s = landingSupport(course, h.x, h.z, yOld, yNew, ms);
         if (s !== NONE) {
            const sup = course.supports[s];
            const y = surfaceY(sup, h.x);
            h.y = y;
            h.grounded = true;
            h.support = s;
            h.slopeMin = downhillAt(sup, h.x);
            h.from = s;
            h.coyoteFrom = NONE;
            h.lastTop = y;
            h.airJump = true;
            h.apexCap = y + H_JUMP;
            h.rolled = false;
            h.gripUntil = sup.vanish ? ms + GRIP_MS : 0;
            if (sup.top > run.bestTop) run.bestTop = sup.top;
            ev.landed = true;
            ev.landedOn = s;
            if (!run.visited[s] && s !== course.checkpoints[0]) {
               run.visited[s] = 1;
               ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.roof);
               ev.comboLinked = true;
            }
         }
      }
   }

   // 6. side collisions (roofs, skylights, billboards)
   sideCollisions(run, h, ms);

   // 7. progress guard: the non-carry step (velocity + push-outs) is at most the speed cap
   const maxMove = speedCap / 1000;
   const dx = h.x - x0 - cx;
   const dz = h.z - z0 - cz;
   const moved = Math.sqrt(dx * dx + dz * dz);
   if (moved > maxMove) {
      const k = maxMove / moved;
      h.x = x0 + cx + dx * k;
      h.z = z0 + cz + dz * k;
      if (insideSolid(course, h.x, h.z, h.y, ms)) {
         h.x = x0 + cx;
         h.z = z0 + cz;
      }
   }
   if (h.grounded) h.y = surfaceY(course.supports[h.support], h.x);

   // 8. coins
   const orbs = course.orbs;
   const my = h.y + ORB.centerY;
   const magnet = h.magnetUntil >= ms;
   const reach = magnet ? MAGNET_REACH : ORB.pickup;
   for (let i = 0; i < orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = orbs[i];
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach) {
         run.collected[i] = 1;
         run.orbs += 1;
         if (ev.orbCount < ev.orbList.length) ev.orbList[ev.orbCount++] = i;
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.orb);
         ev.comboLinked = true;
      }
   }

   // 8b. secrets (no score): an open one at coin reach (the magnet's too); a gated one only through its gate
   const secrets = course.secrets;
   for (let i = 0; i < secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const o = secrets[i];
      let r = reach;
      if (o.gate === "crack") {
         if (!run.broken[o.box]) continue;
         r = ORB.pickup;
      } else if (o.gate === "ghost") {
         if (ms > h.phaseUntil) continue;
         r = ORB.pickup;
      } else if (o.gate === "arc") {
         if (!hazardImmune(h, ms)) continue;
         r = ORB.pickup;
      }
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= r * r && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }

   // 9. the fall line
   if (!h.grounded && h.y < h.lastTop - FALL_DEPTH) {
      lose(run);
      return;
   }

   // 10. spark arcs (shield and phase ignore them)
   if (strikeHit(run, ms)) {
      lose(run);
      return;
   }
   if (!h.grounded) return;

   // 11. a chimney updraft under the feet launches at once
   const s = course.supports[h.support];
   if (s.launch > 0) {
      h.flightCap = capAt(course, h.support, h.x, h.slopeMin);
      startArc(h, ms, h.y, s.launch);
      h.coyoteFrom = NONE;
      h.carryX = 0;
      h.carryZ = 0;
      run.pressMs = NONE;
      ev.bounced = true;
      return;
   }

   // 12. checkpoints, forward only
   for (let k = run.checkpoint + 1; k < course.checkpoints.length; k++) {
      if (course.checkpoints[k] === h.support) {
         run.checkpoint = k;
         ev.checkpoint = k;
         break;
      }
   }

   // 13. the goal (with the boss on, his defeat is the finish instead)
   if (h.support === course.goal && run.boss === null) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

// ---------- Ashback (L5 solo, progression.ts ASHBACK) ----------

/** The pad's centre x (the arena's halves are split there). */
function padCx(course: Course): number {
   return course.supports[course.arena!.pad].cx;
}

/** Which half of the arena (0 = A, the entry side; 1 = B) a point is on. */
export function arenaSide(course: Course, x: number): number {
   const a = course.arena!;
   return (x - padCx(course)) * a.dir < 0 ? 0 : 1;
}

/** The foot spot (x) on a side, where Ashback is open. */
export function footX(course: Course, side: number): number {
   const a = course.arena!;
   return side === 0 ? a.footA : a.footB;
}

/** The ramp support on a side. */
export function rampOf(course: Course, side: number): number {
   const a = course.arena!;
   return side === 0 ? a.rampA : a.rampB;
}

/** The deck support on a side (where you wait). */
export function deckOfSide(course: Course, side: number): number {
   const a = course.arena!;
   return side === 0 ? a.entry : a.far;
}

/** Where Ashback is, and the tank and paint, for his state this ms (pure; the Scene draws the same). */
export function placeBoss(run: RoofRun): void {
   const b = run.boss!;
   const course = run.course;
   const a = course.arena!;
   const st = b.state;
   const k = stepProgress(st, ASHBACK);
   const mid = padCx(course);
   const near = footX(course, b.side);
   const far = footX(course, 1 - b.side);
   b.y = a.y;
   b.z = a.z;
   b.tankOn = false;
   b.paint = NONE;
   if (st.step === "vulnerable") {
      b.x = near;
      return;
   }
   if (st.step === "attack") {
      if (st.phase === 0) {
         // he kicked the tank from the far foot: it rolls across the pad to your side, he follows it
         b.tankOn = true;
         b.tankX = far + (near - far) * k;
         b.x = far + (near - far) * k * 0.85;
      } else if (st.phase === 1) {
         // grey paint on your ramp while he sprays it from its foot
         b.paint = rampOf(course, b.side);
         b.x = near;
      } else {
         // the curled ram across the pad
         b.x = far + (near - far) * k;
      }
      return;
   }
   if (st.step === "defeat" || st.step === "done") {
      // he flees off the far side of the pad and down the mountain
      const t = Math.min(1, Math.max(0, st.defeatMs) / ASHBACK.defeatMs);
      b.x = near;
      b.z = a.z - 9 * t;
      b.y = a.y - 6 * t * t;
      return;
   }
   // intro, telegraph, transition: on the pad's middle (a telegraph winds up there)
   b.x = mid;
}

/** Is the hero touching Ashback (or the tank) this ms? */
function bossContact(h: Hero, x: number, y: number, z: number, r: number): boolean {
   if (h.y > y + 1.6 || h.y + HERO.height < y) return false;
   const dx = h.x - x;
   const dz = h.z - z;
   return dx * dx + dz * dz <= r * r;
}

function bossMs(run: RoofRun): void {
   const b = run.boss!;
   const h = run.hero;
   const ev = run.events;
   const course = run.course;
   const ms = run.simMs;
   if (b.state.step === "done") return;
   if (b.wokeMs === NONE) {
      if (h.state === "play" && h.grounded && course.supports[h.support].arena) {
         b.wokeMs = ms;
         ev.bossWoke = true;
         placeBoss(run);
      }
      return;
   }
   const bev = stepBoss(b.state, ASHBACK, 1, b.ev);
   if (bev.telegraph) ev.bossTelegraph = true;
   if (bev.attack) {
      // he goes for the side you are on
      b.side = arenaSide(course, h.x);
      ev.bossAttack = true;
   }
   placeBoss(run);
   if (b.state.step === "defeat" || h.state !== "play") return;
   const st = b.state;
   if (st.step === "attack" && !hazardImmune(h, ms)) {
      const tank = st.phase === 0 && bossContact(h, b.tankX, b.y, b.z, 1.0);
      const ram = st.phase === 2 && bossContact(h, b.x, b.y, b.z, 1.0);
      if (tank || ram) {
         lose(run);
         return;
      }
   }
   if (st.step === "vulnerable" && h.curled && heroSpeed(h) >= ASHBACK_HIT_SPEED[st.phase] && bossContact(h, b.x, b.y, b.z, 1.2)) {
      const r = hitBoss(st, ASHBACK, 1, b.ev);
      if (r !== "ignored") {
         ev.bossHit = true;
         if (r === "phase") ev.bossPhase = true;
         if (r === "defeated") {
            ev.bossDefeated = true;
            run.finishMs = ms;
            run.ended = "win";
            ev.finished = true;
         }
      }
   }
}

function lose(run: RoofRun): void {
   const h = run.hero;
   h.state = "lost";
   h.timerMs = LOST_MS;
   h.vx = 0;
   h.vz = 0;
   h.carryX = 0;
   h.carryZ = 0;
   h.coyoteFrom = NONE;
   h.dashUntil = NONE;
   h.curled = false;
   h.rolled = false;
   if (h.grounded) {
      // struck on a roof: the hero drops out of view from where it stood
      startArc(h, run.simMs, h.y, 0);
   }
   run.hits += 1;
   comboBreak(run.combo);
   run.events.lost = true;
}

/** Back on the active checkpoint's centre, at rest, frozen for SPAWN_MS. */
function respawn(run: RoofRun): void {
   const h = run.hero;
   const index = run.course.checkpoints[run.checkpoint];
   const s = run.course.supports[index];
   h.x = s.cx;
   h.y = s.top;
   h.z = s.cz + (run.checkpoint === 0 ? START_DZ : 0);
   h.vx = 0;
   h.vz = 0;
   h.grounded = true;
   h.support = index;
   h.from = index;
   h.slopeMin = 0;
   h.curled = false;
   h.rolled = false;
   h.arcStart = run.simMs;
   h.arcY0 = s.top;
   h.arcV = 0;
   h.coyoteFrom = NONE;
   h.carryX = 0;
   h.carryZ = 0;
   h.lastTop = s.top;
   h.dashUntil = NONE;
   h.airJump = true;
   h.apexCap = s.top + H_JUMP;
   h.gripUntil = 0;
   h.state = "spawn";
   h.timerMs = SPAWN_MS;
   run.respawns += 1;
   run.events.respawned = true;
}

// ---------- the store hand-off (README "Scoring") ----------

/** HUD and hand-off stats. */
export const STAT = {
   orbs: "orbs",
   height: "height",
   checkpoint: "checkpoint",
   finishMs: "finishMs",
   falls: "falls",
   hero: "hero",
   power: "power",
   /** the roll speed (m/s x10) for the HUD speed meter */
   speed: "speed",
   /** the flow bonus (ms) so far: comes off the submitted time */
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   /** the boss bar: hp, phase index, open (1/0), flash (1/0), awake (1/0) */
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossAwake: "bossAwake",
   /** set before end("win") for the star screen */
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The run time a player sees and submits: play ms minus the coin bonus and the flow bonus, never below 0. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

/**
 * GameDefinition.finalScore: a win submits the finish ms minus the coin and flow bonus (the Scene
 * publishes finishMs, orbs and comboMs with setStat before end("win")); any other end keeps elapsedMs.
 */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
