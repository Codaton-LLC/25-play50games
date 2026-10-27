// Sky Tower Jump rules: the course as data, the integer-ms clock and its cap, kinematic movement
// with closed-form jumps, moving platforms as functions of rules time, bounce pads, checkpoints,
// falls and respawns (dead time = the time penalty), orbs (a time bonus), the finish, and the
// lower bound behind the server limits. Pure and deterministic: no three.js, React, DOM,
// Math.random or Date.now. Scene.tsx passes the stick as inputToWorld(moveX, moveY, 0) plus the
// orbit camera's yaw (StepInput.yaw), and step() turns it camera-relative with core inputToWorld, so
// the yaw is part of the input every step reads; rules.test.ts and bot.ts drive it directly (yaw 0).
//
// Clock: whole ms, the fraction carried to the next step (as obstacle-race), stepped 1 ms at a time,
// so a jump arc depends only on the ms since take-off and is the same at 30, 60 or 144 fps.
// No allocation after createRun(): the hero and the events object are rewritten in place.
// README.md "Rules" and "Server limits" explain the design and the proof; rules.test.ts checks them.
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { inputToWorld } from "@/arcade3d/core/math";
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS, type SkyLevel } from "./levels";
import { buildTower, type TowerStrike } from "./tower";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { COMBO, COMBO_BASE_MS, SECRETS } from "./progression";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

/** "Nothing": no support, no coyote, no buffered press. */
export const NONE = -1;
/** the most rules ms one frame may advance (the core caps dt at 1/20 s anyway) */
export const MAX_STEP_MS = 50;
/** the hero's collision: a vertical cylinder, feet at y */
export const HERO = { radius: 0.32, height: 1.2 } as const;
/** top speed from the stick (m/s), and its acceleration (m/s²) on the ground and in the air */
export const V_RUN = 6.5;
export const ACCEL = { ground: 50, air: 32 } as const;
/** gravity (m/s²), jump and bounce-pad launch speeds (m/s) */
export const G = 30;
export const V_JUMP = 14;
export const V_BOUNCE = 22;
/** a jump still works this long after walking off an edge, and a press is kept this long */
export const COYOTE_MS = 100;
export const BUFFER_MS = 130;
/** the feet may stand this far past a platform's edge (landing and walking) */
export const FOOT = 0.15;
/** a fall this far below the last platform stood on is lost */
export const FALL_DEPTH = 7;
/** after a fall: frozen this long out of view, then this long on the checkpoint (the time penalty) */
export const LOST_MS = 900;
export const SPAWN_MS = 600;
/** bounce pad: a square of this half size around its platform's centre */
export const PAD_HALF = 0.8;
/** platform colliders are this deep under their top (the visuals' rock hangs lower, no collision) */
export const THICKNESS = 1.4;
/** orbs: pickup radius around the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 0.95, bonusMs: 400, centerY: 0.6 } as const;

/** apex heights and times of the two launches (m, ms) */
export const H_JUMP = (V_JUMP * V_JUMP) / (2 * G);
export const H_BOUNCE = (V_BOUNCE * V_BOUNCE) / (2 * G);
export const APEX_MS = (1000 * V_JUMP) / G;
export const BOUNCE_APEX_MS = (1000 * V_BOUNCE) / G;

// ---------- the course ----------

export type SupportKind = "start" | "island" | "bridge" | "moving" | "checkpoint" | "goal";

/** A moving platform: offset along `axis` = travel · (2 · smoothstep(triangle(ms / period + phase)) - 1). */
export interface Mover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

/** A platform: its top is a rectangle (centre ± half sizes at rest), THICKNESS deep. */
export interface Support {
   kind: SupportKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   bottom: number;
   mover: Mover | null;
   /** a bounce pad in the middle of the top (static platforms only) */
   pad: boolean;
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
   /** sideways gusts while airborne (Storm Heights, Infinite Tower) */
   wind: boolean;
   /** lightning on island rims; the centre of each island is outside the strike */
   strikes: TowerStrike[];
   /** the level's secrets (progression.ts SECRETS, same order): where each floats; no score */
   secrets: Vec3Like[];
}

export type { TowerStrike };

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

// The level 1 course "Training Sky" (README "The course"): 60 m up, about 120 m forward, three
// checkpoints, three bounce pads, four moving platforms, two plank bridges. Each row: kind, x, z
// (centre), top, width (x), depth (z), then a mover or a pad.
type Row = [SupportKind, number, number, number, number, number, (Mover | "pad")?];

const mover = (axis: "x" | "z", travel: number, periodMs: number, phase = 0): Mover => ({ axis, travel, periodMs, phase });

export const COURSE_ROWS: readonly Row[] = [
   ["start", 0, 0, 0, 7, 7],
   ["island", 0, -6.5, 1.8, 4, 4],
   ["island", 3.6, -10.8, 3.8, 4, 4],
   ["island", 0, -15.2, 5.8, 4, 3.6],
   ["moving", 0, -19.6, 7.6, 3.2, 3.2, mover("x", 2.2, 4000)],
   ["checkpoint", 0, -24.6, 9.4, 5, 5],
   ["island", -4.4, -28.6, 11.2, 4, 4, "pad"],
   ["island", -4.4, -33.8, 17.8, 4, 4],
   ["bridge", 0.6, -33.8, 17.8, 6, 1.6],
   ["island", 5.6, -33.8, 17.8, 4, 4],
   ["island", 5.6, -38.6, 19.8, 3.6, 3.6],
   ["moving", 2.2, -42.8, 21.6, 3.2, 3.2, mover("x", 1.8, 3600, 0.25)],
   ["checkpoint", -1, -47.2, 23.4, 5, 5],
   ["island", -5, -51.4, 25.4, 3.6, 3.6],
   ["island", -5, -55.8, 27.4, 3.6, 3.6, "pad"],
   ["island", -1.2, -60.4, 34, 4, 4],
   ["moving", 2.8, -64.8, 35.8, 3.2, 3.2, mover("x", 2, 3200, 0.5)],
   ["island", 5, -69.2, 37.6, 4, 4],
   ["bridge", 5, -74.2, 37.6, 1.6, 6],
   ["checkpoint", 5, -79.6, 37.6, 4.6, 4.6],
   ["island", 1.2, -83.8, 39.6, 3.6, 3.6],
   ["island", -3, -87.8, 41.6, 3.6, 3.6, "pad"],
   ["island", -3, -92.6, 48.2, 4, 4],
   ["moving", 0.8, -97, 50, 3.2, 3.2, mover("z", 1.4, 3600, 0.75)],
   ["island", 4.4, -101.6, 51.8, 4, 4],
   ["island", 2, -106, 53.8, 3.6, 3.6],
   ["island", -1.6, -110, 55.8, 3.6, 3.6],
   ["island", 0, -114.8, 57.8, 4, 4],
   ["goal", 0, -121.2, 60, 8, 7],
];

/** Orbs: on the jump arcs between these support pairs (midpoint, 1.2 m over the higher top), plus extras. */
const ORB_GAPS: ReadonlyArray<[number, number]> = [
   [1, 2], [3, 4], [4, 5], [6, 7], [9, 10], [10, 11], [12, 13], [14, 15], [16, 17], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28],
];
/** two orbs on each plank bridge (x, z offsets from the bridge centre, 0.9 m over the deck) */
const BRIDGE_ORBS: ReadonlyArray<[number, number, number]> = [
   [8, -1.6, 0], [8, 1.6, 0], [18, 0, -1.6], [18, 0, 1.6],
];

function finishCourse(supports: Support[], level: SkyLevel, orbs: Orb[], strikes: TowerStrike[], wind: boolean): Course {
   const checkpoints = [0];
   supports.forEach((s, i) => {
      if (s.kind === "checkpoint") checkpoints.push(i);
   });
   const goal = supports.findIndex((s) => s.kind === "goal");
   let maxCarry = 0;
   for (const s of supports) if (s.mover) maxCarry = Math.max(maxCarry, moverTopSpeed(s.mover));
   const course: Course = { supports, checkpoints, goal, orbs, durationMs: level.durationMs, maxCarry, strikes, wind, secrets: [] };
   course.secrets = secretSpots(course, level.id);
   return course;
}

/**
 * Where the level's secrets float (README "Stars, flow, secrets"):
 * - "pad-sky": straight over the first bounce pad, just under the bounce apex's chest height;
 * - "ledge": off the far side of the static island nearest the route's middle, 1.4 m past its edge;
 * - "gate": beside the last gap before the goal, 2.6 m to the side and 1.4 m over the goal's top.
 */
export function secretSpots(course: Course, level: LevelId): Vec3Like[] {
   const sup = course.supports;
   return SECRETS[level].map((spec) => {
      if (spec.id === "pad-sky") {
         const pad = sup.find((s) => s.pad) ?? sup[course.checkpoints[Math.min(1, course.checkpoints.length - 1)]];
         const lift = pad.pad ? H_BOUNCE : H_JUMP;
         return { x: pad.cx, y: pad.top + lift + ORB.centerY - 0.45, z: pad.cz };
      }
      if (spec.id === "ledge") {
         const mid = Math.floor(sup.length / 2);
         let k = mid;
         for (let d = 0; d < sup.length; d++) {
            const a = sup[mid + d];
            if (a && a.kind === "island" && !a.mover && !a.pad) {
               k = mid + d;
               break;
            }
            const b = sup[mid - d];
            if (b && b.kind === "island" && !b.mover && !b.pad) {
               k = mid - d;
               break;
            }
         }
         const s = sup[k];
         const next = sup[Math.min(sup.length - 1, k + 1)];
         const side = next.cx >= s.cx ? -1 : 1;
         return { x: s.cx + side * (s.hw + 1.4), y: s.top + 1.0, z: s.cz };
      }
      const g = sup[course.goal];
      const before = sup[Math.max(0, course.goal - 1)];
      const side = g.cx >= before.cx ? 1 : -1;
      return { x: (g.cx + before.cx) / 2 + side * 2.6, y: g.top + 1.4, z: (g.cz + g.hd + before.cz) / 2 };
   });
}

/** What the course can feed the flow meter: every orb once, the first landing on each platform but the start. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.orb },
         { count: course.supports.length - 1, base: COMBO_BASE_MS.island },
      ],
   };
}

/** Level 1, unchanged: the hand-built rows. Levels 2-5: buildTower. */
export function buildCourse(level: SkyLevel = LEVELS[1]): Course {
   if (level.tower) {
      const draft = buildTower(level);
      const supports: Support[] = draft.supports.map((s) => ({
         kind: s.kind,
         cx: s.cx,
         cz: s.cz,
         hw: s.hw,
         hd: s.hd,
         top: s.top,
         bottom: s.top - THICKNESS,
         mover: s.mover ? { ...s.mover } : null,
         pad: s.pad,
      }));
      return finishCourse(supports, level, draft.orbs, draft.strikes, draft.wind);
   }
   const supports: Support[] = COURSE_ROWS.map(([kind, cx, cz, top, w, d, extra]) => {
      const m = extra && extra !== "pad" ? { ...extra } : null;
      return { kind, cx, cz, hw: w / 2, hd: d / 2, top, bottom: top - THICKNESS, mover: m, pad: extra === "pad" };
   });
   const orbs: Orb[] = [];
   for (const [a, b] of ORB_GAPS) {
      const sa = supports[a];
      const sb = supports[b];
      orbs.push({ x: (sa.cx + sb.cx) / 2, y: Math.max(sa.top, sb.top) + 1.2, z: (sa.cz + sb.cz) / 2 });
   }
   for (const [i, dx, dz] of BRIDGE_ORBS) {
      const s = supports[i];
      orbs.push({ x: s.cx + dx, y: s.top + 0.9, z: s.cz + dz });
   }
   return finishCourse(supports, level, orbs, [], false);
}

/** A strike is live this ms (the same fraction on every device). */
export function strikeLive(st: TowerStrike, ms: number): boolean {
   const t = ms / st.periodMs + st.phase;
   const frac = t - Math.floor(t);
   return frac < st.duty;
}

/**
 * Sideways gust (m/s²) at rules ms. Peaks at WIND_PEAK, flips each period, polynomials only.
 * Applied in the air and then clamped to V_RUN, so a gust never outruns the proof's speed bound.
 */
export const WIND_PEAK = 3.5;
export const WIND_PERIOD_MS = 2800;

export function windAccelX(ms: number): number {
   const cyc = ms / WIND_PERIOD_MS;
   const t = cyc - Math.floor(cyc);
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   const s = tri * tri * (3 - 2 * tri);
   const sign = Math.floor(cyc) % 2 === 0 ? 1 : -1;
   return sign * WIND_PEAK * (2 * s - 1);
}

export const COURSE: Course = buildCourse(LEVELS[1]);

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

/**
 * The least time (ms) from one support to another: max(the vertical bound, the horizontal bound).
 * Infinity when no launch reaches. Ground time is taken as 0.
 */
export function edgeMinMs(course: Course, from: number, to: number, vRun = V_RUN): number {
   const a = course.supports[from];
   const b = course.supports[to];
   const vh = vRun + course.maxCarry;
   const flat = (1000 * standGap(a, b)) / vh;
   const dy = b.top - a.top;
   if (dy <= 0) return flat;
   let vertical = riseLandS(V_JUMP, dy);
   if (a.pad) vertical = Math.min(vertical, riseLandS(V_BOUNCE, dy));
   if (!Number.isFinite(vertical)) return Infinity;
   return Math.max(flat, 1000 * vertical);
}

/** Dijkstra over the supports with edgeMinMs: the least ms to stand on each one (Infinity = never). `vRun` is the horizontal cap (V_DASH to ask what a dash could save). */
export function minArrivalMs(course: Course, vRun = V_RUN): number[] {
   const n = course.supports.length;
   const best = new Array<number>(n).fill(Infinity);
   const done = new Array<boolean>(n).fill(false);
   best[course.checkpoints[0]] = 0;
   for (let round = 0; round < n; round++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || best[i] < best[u])) u = i;
      if (u < 0 || !Number.isFinite(best[u])) break;
      done[u] = true;
      for (let v = 0; v < n; v++) {
         if (done[v] || v === u) continue;
         const t = best[u] + edgeMinMs(course, u, v, vRun);
         if (t < best[v]) best[v] = t;
      }
   }
   return best;
}

/** The proven least finish ms of a course (README proof step 4). */
export function minFinishMs(course: Course, vRun = V_RUN): number {
   return minArrivalMs(course, vRun)[course.goal];
}

/** The least submitted duration: the least finish minus every orb's bonus and the most flow bonus (README proof steps 5-6). */
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
 * The least submitted duration with Riko's dashes: a dash is on for at most POWER_MS.dash + 1 ms at
 * V_DASH, so it saves at most (POWER_MS.dash + 1) (V_DASH - V_RUN) / V_RUN ms of the summed bound; a
 * run that finishes at T fired at most 1 + floor(T / cooldown) dashes. The least such T, less every
 * orb's bonus and the most flow bonus.
 */
export function dashFloorMs(course: Course): number {
   const F = minFinishMs(course);
   const perDash = ((POWER_MS.dash + 1) * (V_DASH - V_RUN)) / V_RUN;
   const cooldown = heroById("riko").cooldownMs;
   let T = 0;
   while (T + perDash * (1 + Math.floor(T / cooldown)) < F) T += 1;
   return T - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

/**
 * minDurationMs = the bound less about 4.5 %, rounded down to 100 ms, still inside 94-100 % of the bound.
 * Every level, level 1 included (the flow bonus moved level 1's bound, so its old 11 500 row went).
 * meta.ts publishes PROPOSED_LEVEL_LIMITS per level and arcade-games.json repeats it (registry.sync.test.ts).
 */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
   // never above what Riko's dashes can reach (README proof step 7; the test re-derives it)
   minDurationMs = Math.min(minDurationMs, Math.floor(dashFloorMs(course) / 100) * 100);
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
   /** the stick's velocity (m/s), eased towards V_RUN · stick */
   vx: number;
   vz: number;
   state: HeroState;
   grounded: boolean;
   /** the support stood on (index into course.supports), NONE in the air */
   support: number;
   /** the current arc in the air: y = arcY0 + arcV · t - G t² / 2, t = (ms - arcStart) / 1000 */
   arcStart: number;
   arcY0: number;
   arcV: number;
   /** the ms of the walk-off (coyote time runs from it), NONE otherwise */
   coyoteFrom: number;
   /** carry (m per ms) this ms on a mover; in the air the take-off's carry */
   carryX: number;
   carryZ: number;
   /** the top of the last support stood on (the fall line is FALL_DEPTH under it) */
   lastTop: number;
   /** ms left in "lost" or "spawn" */
   timerMs: number;
   /** dash is on through this rules ms (NONE = off); dashX/Z is a unit vector */
   dashUntil: number;
   dashX: number;
   dashZ: number;
   /** Nami's extra jump is still available this flight */
   airJump: boolean;
   /** feet may not go above this on the current flight (a double jump cannot add reach) */
   apexCap: number;
   /** Kiro / Zuno / Vexa: the power is on through this rules ms (NONE = off) */
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
}

/** One frame of input. Scene fills one object per run and passes it every step. */
export interface StepInput {
   /**
    * The stick at camera yaw 0: inputToWorld(moveX, moveY, 0), so up is -z. Length <= 1 (longer is
    * normalised). step() turns it by `yaw`.
    */
   moveX: number;
   moveZ: number;
   /**
    * The camera yaw the stick is relative to (rad, core fitView / menu2 orbit convention; the orbit
    * camera's viewYaw). step() maps (moveX, moveZ) with inputToWorld(moveX, moveZ, yaw), so "up" moves
    * away from the camera. 0 or omitted (bots, tests) = the stick is already world space. Turning
    * keeps the length, so the proof's speed bounds hold for any yaw.
    */
   yaw?: number;
   /** a jump press this frame (the core's jumpPressed: keyboard and touch alike), latched at the frame's first ms */
   jumpPressed: boolean;
   /**
    * The hero power (keyboard E/Enter and the touch Power button both set the core's actionPressed).
    * One press, latched at the frame's first ms. No separate touch timing.
    */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

/** What happened in one step. The same object every step, reset at its start. */
export interface StepEvents {
   jumped: boolean;
   bounced: boolean;
   landed: boolean;
   /** the support of the latest landing in this step, NONE without one (a pad launches at once, so the hero may already be in the air) */
   landedOn: number;
   /** a checkpoint (1..) activated in this step, NONE otherwise */
   checkpoint: number;
   /** orbs collected in this step: their indices in orbList[0..orbCount) */
   orbCount: number;
   orbList: number[];
   lost: boolean;
   respawned: boolean;
   finished: boolean;
   timeup: boolean;
   /** a hero power actually fired this step (a press on cooldown does not) */
   powered: boolean;
   /** flow bonus (ms) paid in this step, and whether a link was added */
   comboBonus: number;
   comboLinked: boolean;
   /** secrets found in this step: their indices in secretList[0..secretCount) */
   secretCount: number;
   secretList: number[];
}

export interface SkyRun {
   course: Course;
   level: LevelId;
   /** which Color Roll Hero this run plays (Riko unless createRun was given another) */
   heroId: HeroId;
   /** the seed: the course is fixed (a time leaderboard must be the same race for everyone); the Scene's decor uses it */
   seed: number;
   /** whole ms of play since "Go" */
   simMs: number;
   remainder: number;
   stepMs: number;
   hero: Hero;
   /** the first ms of the frame with the latest jump press (the buffer runs from it), NONE */
   pressMs: number;
   /** the ms a power press is applied, NONE if this frame had none. Cooldown is powerReadyAt. */
   actionMs: number;
   /** the power can fire again at this rules ms (0 = ready at the start) */
   powerReadyAt: number;
   /** the active checkpoint: 0 (the start) and up; respawns go to its support */
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
   /** the level's secrets found (progression.ts SECRETS order) */
   secrets: SecretTracker;
   /** falls and strikes taken (0 = the no-hit badge) */
   hits: number;
   /** the highest top stood on (HUD "height") */
   bestTop: number;
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
      checkpoint: NONE,
      orbCount: 0,
      orbList,
      lost: false,
      respawned: false,
      finished: false,
      timeup: false,
      powered: false,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.bounced = false;
   ev.landed = false;
   ev.landedOn = NONE;
   ev.checkpoint = NONE;
   ev.orbCount = 0;
   ev.lost = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
   ev.powered = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
}

const COURSES: Partial<Record<LevelId, Course>> = { 1: COURSE };

/** The level's course (built once per level). */
export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

/** Proposed server limits. Level 1 is the shipped row; 2-5 follow proposeLimits on that level's course. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1, courseFor(1)),
   2: proposeLimits(2, courseFor(2)),
   3: proposeLimits(3, courseFor(3)),
   4: proposeLimits(4, courseFor(4)),
   5: proposeLimits(5, courseFor(5)),
};

/** Level 1's row (the game's top-level meta.scoring). */
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
      airJump: true,
      apexCap: y + H_JUMP,
      shieldUntil: NONE,
      magnetUntil: NONE,
      phaseUntil: NONE,
   };
}

/**
 * A new run on the start platform: at rest, grounded (the countdown is the start freeze).
 * Allocates everything the run will ever use. `heroId` defaults to Riko; the Scene passes the
 * overlay's pick (pickedHero). The power is ready at the start and its cooldown resets each run.
 */
export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = "riko"): SkyRun {
   const course = courseFor(level);
   const start = course.supports[course.checkpoints[0]];
   return {
      course,
      level,
      heroId,
      seed,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      hero: freshHero(start.cx, start.top, start.cz + 1.5, course.checkpoints[0]),
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
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      bestTop: start.top,
      ended: null,
      events: createEvents(),
   };
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
   if (v >= V_BOUNCE - 1e-6) h.apexCap = y0 + H_BOUNCE;
   else if (v > 0) h.apexCap = y0 + (v * v) / (2 * G);
   else h.apexCap = keep;
}

/** Shield or phase is up: gusts and lightning do not touch the hero. */
function hazardImmune(h: Hero, ms: number): boolean {
   return ms <= h.shieldUntil || ms <= h.phaseUntil;
}

/**
 * Nami's second jump. The new apex is capped at the flight's existing apexCap, so it cannot
 * reach a platform a single jump (or the bounce that started the flight) could not already reach.
 */
function tryDoubleJump(run: SkyRun, ms: number): boolean {
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
   return true;
}

/** Fire the run's hero power if it is off cooldown. A press that cannot fire (Nami on the ground) does not start the cooldown. */
function tryPower(run: SkyRun, ms: number, mx: number, mz: number): void {
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

function lightningHit(run: SkyRun, ms: number): boolean {
   const strikes = run.course.strikes;
   if (strikes.length === 0) return false;
   const h = run.hero;
   if (!h.grounded || h.support === NONE || hazardImmune(h, ms)) return false;
   const s = run.course.supports[h.support];
   for (let i = 0; i < strikes.length; i++) {
      const st = strikes[i];
      if (st.support !== h.support || !strikeLive(st, ms)) continue;
      const dx = h.x - (supportX(s, ms) + st.ox);
      const dz = h.z - (supportZ(s, ms) + st.oz);
      if (dx * dx + dz * dz <= st.radius * st.radius) return true;
   }
   return false;
}

/** The whole ms to simulate for a frame of `dtMs` (clamped to MAX_STEP_MS), the fraction carried. */
export function advanceClock(run: SkyRun, dtMs: number): number {
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
 * cap ends with "timeup"; else the hero's state acts. A finish or a time-up ends the step, and every
 * later step does nothing. Returns run.events (the same object every step). Allocates nothing.
 */
export function step(run: SkyRun, dtMs: number, input: StepInput): StepEvents {
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

function tick(run: SkyRun, mx: number, mz: number): void {
   const h = run.hero;
   if (h.state === "lost") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      // keep falling out of view (looks only: nothing collides)
      h.y = arcY(h, run.simMs);
      if (h.timerMs <= 0) respawn(run);
      return;
   }
   if (h.state === "spawn") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      if (h.timerMs <= 0) h.state = "play";
      return;
   }
   playMs(run, mx, mz);
}

// collision scratch (module-level: step() never yields)
const SCRATCH_P: Vec3Like = { x: 0, y: 0, z: 0 };
const SCRATCH_BOX: AABB = { min: { x: 0, y: -1000, z: 0 }, max: { x: 0, y: 1000, z: 0 } };

function supportBox(s: Support, ms: number): AABB {
   const x = supportX(s, ms);
   const z = supportZ(s, ms);
   SCRATCH_BOX.min.x = x - s.hw;
   SCRATCH_BOX.max.x = x + s.hw;
   SCRATCH_BOX.min.z = z - s.hd;
   SCRATCH_BOX.max.z = z + s.hd;
   return SCRATCH_BOX;
}

function sideCollisions(course: Course, h: Hero, ms: number): void {
   const feet = h.y;
   const head = h.y + HERO.height;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!(feet < s.top - 1e-9 && head > s.bottom)) continue;
      SCRATCH_P.x = h.x;
      SCRATCH_P.y = 0;
      SCRATCH_P.z = h.z;
      resolveSphereAabb(SCRATCH_P, HERO.radius, supportBox(s, ms), SCRATCH_P);
      h.x = SCRATCH_P.x;
      h.z = SCRATCH_P.z;
   }
}

/** Is the hero's centre inside a support's box at a height that collides (the progress guard's fallback)? */
function insideSolid(course: Course, x: number, z: number, feet: number, ms: number): boolean {
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!(feet < s.top - 1e-9 && feet + HERO.height > s.bottom)) continue;
      if (Math.abs(x - supportX(s, ms)) < s.hw && Math.abs(z - supportZ(s, ms)) < s.hd) return true;
   }
   return false;
}

/** The highest support whose top the feet crossed downwards this ms with the centre over it. */
function landingSupport(course: Course, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   let best = NONE;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!(yOld >= s.top && s.top > yNew)) continue;
      if (best !== NONE && supports[best].top >= s.top) continue;
      if (onSupport(s, x, z, ms)) best = i;
   }
   return best;
}

/** A rising head that crosses a support's underside (centre under its box) stops rising. */
function headSupport(course: Course, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!(yOld + HERO.height <= s.bottom && s.bottom < yNew + HERO.height)) continue;
      if (Math.abs(x - supportX(s, ms)) < s.hw && Math.abs(z - supportZ(s, ms)) < s.hd) return i;
   }
   return NONE;
}

function supportUnder(course: Course, h: Hero, ms: number): number {
   if (h.support !== NONE && onSupport(course.supports[h.support], h.x, h.z, ms)) return h.support;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (Math.abs(s.top - h.y) < 1e-9 && onSupport(s, h.x, h.z, ms)) return i;
   }
   return NONE;
}

function playMs(run: SkyRun, mx: number, mz: number): void {
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

   // 2. jump: a buffered press, grounded or within coyote time
   if (run.pressMs !== NONE) {
      if (ms - run.pressMs > BUFFER_MS) {
         run.pressMs = NONE;
      } else if (h.grounded || (h.coyoteFrom !== NONE && ms - h.coyoteFrom <= COYOTE_MS)) {
         const y0 = h.grounded ? h.y : arcY(h, ms);
         startArc(h, ms, y0, V_JUMP);
         h.coyoteFrom = NONE;
         run.pressMs = NONE;
         ev.jumped = true;
      }
   }

   // 2b. hero power: the same action press on keyboard and touch, applied on one ms. A double jump
   // on the same ms as a ground jump would only replace that jump, so it waits for a later press.
   if (run.actionMs === ms) {
      run.actionMs = NONE;
      if (!(heroById(run.heroId).power === "doubleJump" && ev.jumped)) tryPower(run, ms, mx, mz);
   }

   // 3. ease the stick velocity towards V_RUN · stick, or snap to the dash. Wind is sideways, in the
   // air only, and the cap below keeps the step inside the proof (a dash uses V_DASH for that ms).
   const dashing = h.dashUntil >= ms;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else {
      const rate = (h.grounded ? ACCEL.ground : ACCEL.air) / 1000;
      let dvx = V_RUN * mx - h.vx;
      let dvz = V_RUN * mz - h.vz;
      const dv = Math.sqrt(dvx * dvx + dvz * dvz);
      if (dv > rate) {
         dvx *= rate / dv;
         dvz *= rate / dv;
      }
      h.vx += dvx;
      h.vz += dvz;
      if (!h.grounded && course.wind && !hazardImmune(h, ms)) h.vx += windAccelX(ms) / 1000;
   }
   const speedCap = dashing ? V_DASH : V_RUN;
   const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
   if (speed > speedCap) {
      h.vx *= speedCap / speed;
      h.vz *= speedCap / speed;
   }

   // 4. move by the stick velocity plus the carry
   h.x += h.vx / 1000 + cx;
   h.z += h.vz / 1000 + cz;

   // 5. vertical: walk-off, the arc (head bump, landing)
   if (h.grounded) {
      const s = supportUnder(course, h, ms);
      if (s === NONE) {
         startArc(h, ms, h.y, 0);
         h.coyoteFrom = ms;
      } else {
         h.support = s;
         h.airJump = true;
         h.apexCap = h.y + H_JUMP;
      }
   } else {
      const yOld = h.y;
      let yNew = arcY(h, ms);
      if (yNew > yOld) {
         const hit = headSupport(course, h.x, h.z, yOld, yNew, ms);
         if (hit !== NONE) {
            // bump: start falling from just under the support
            yNew = Math.min(yOld, course.supports[hit].bottom - HERO.height - 1e-6);
            startArc(h, ms, yNew, 0);
            h.coyoteFrom = NONE;
         }
      }
      h.y = yNew;
      if (yNew < yOld) {
         const s = landingSupport(course, h.x, h.z, yOld, yNew, ms);
         if (s !== NONE) {
            const top = course.supports[s].top;
            h.y = top;
            h.grounded = true;
            h.support = s;
            h.coyoteFrom = NONE;
            h.lastTop = top;
            h.airJump = true;
            h.apexCap = top + H_JUMP;
            if (top > run.bestTop) run.bestTop = top;
            ev.landed = true;
            ev.landedOn = s;
            // a first landing on a platform (the start excluded) is a flow link
            if (!run.visited[s] && s !== course.checkpoints[0]) {
               run.visited[s] = 1;
               ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.island);
               ev.comboLinked = true;
            }
         }
      }
   }

   // 6. side collisions
   sideCollisions(course, h, ms);

   // 7. progress guard: the non-carry step (stick + push-outs + wind) is at most the speed cap
   const maxMove = (h.dashUntil >= ms ? V_DASH : V_RUN) / 1000;
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

   // 8. orbs
   const orbs = course.orbs;
   const my = h.y + ORB.centerY;
   const reach = h.magnetUntil >= ms ? MAGNET_REACH : ORB.pickup;
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

   // 8b. secrets (no score): the same reach as an orb, the magnet's too
   const secrets = course.secrets;
   for (let i = 0; i < secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const o = secrets[i];
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= reach * reach && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }

   // 9. the fall line
   if (!h.grounded && h.y < h.lastTop - FALL_DEPTH) {
      lose(run);
      return;
   }
   if (!h.grounded) return;

   // 10. lightning on the rim (shield and phase ignore it)
   if (lightningHit(run, ms)) {
      lose(run);
      return;
   }

   // 11. a bounce pad under the feet launches at once (walking onto it too)
   const s = course.supports[h.support];
   if (s.pad && Math.abs(h.x - s.cx) <= PAD_HALF && Math.abs(h.z - s.cz) <= PAD_HALF) {
      startArc(h, ms, h.y, V_BOUNCE);
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

   // 13. the goal
   if (h.support === course.goal) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

function lose(run: SkyRun): void {
   const h = run.hero;
   h.state = "lost";
   h.timerMs = LOST_MS;
   h.vx = 0;
   h.vz = 0;
   h.carryX = 0;
   h.carryZ = 0;
   h.coyoteFrom = NONE;
   h.dashUntil = NONE;
   run.hits += 1;
   comboBreak(run.combo);
   run.events.lost = true;
}

/** Back on the active checkpoint's centre, at rest, frozen for SPAWN_MS. */
function respawn(run: SkyRun): void {
   const h = run.hero;
   const index = run.course.checkpoints[run.checkpoint];
   const s = run.course.supports[index];
   h.x = s.cx;
   h.y = s.top;
   h.z = s.cz + (run.checkpoint === 0 ? 1.5 : 0);
   h.vx = 0;
   h.vz = 0;
   h.grounded = true;
   h.support = index;
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
   /** the flow bonus (ms) so far: comes off the submitted time */
   comboMs: "comboMs",
   /** the HUD meter: chain length, multiplier x100, window left in tenths */
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   /** set before end("win") for the star screen: STAR_BIT mask, new-star mask, no-hit (1/0), secrets mask, new-secret count, XP gained */
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The run time a player sees and submits: play ms minus the orb bonus and the flow bonus, never below 0. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

/**
 * GameDefinition.finalScore: a win submits the finish ms minus the orb and flow bonus (the Scene
 * publishes finishMs, orbs and comboMs with setStat before end("win")); any other end keeps elapsedMs (unranked anyway).
 */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
