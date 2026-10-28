// Lava Pillar Jump rules: the pillars as data, the integer-ms clock and its cap, kinematic movement
// with closed-form jumps, the lava tide that surges on the volcano's heartbeat, pillar tops that heat
// under the feet and crumble, geyser vents that fire on the beat, moving bridges, sinking and glassy
// shelves, rocks shaken loose by the beat, checkpoints, falls and respawns (dead time = the time
// penalty), embers (a time bonus), the flow meter, secrets, level 5's boss (Kalder, menu2/boss), the
// finish, and the lower bound behind the server limits. Pure and deterministic: no three.js, React,
// DOM, Math.random or Date.now. Scene.tsx passes the stick as inputToWorld(moveX, moveY, 0) plus the
// orbit camera's yaw (StepInput.yaw), and step() turns it camera-relative; it calls step() once per
// useRunFrame; the tests and bot.ts drive it directly (yaw 0).
//
// Clock: whole ms, the fraction carried to the next step (as obstacle-race), stepped 1 ms at a time,
// so a jump arc depends only on the ms since take-off and is the same at 30, 60 or 144 fps.
// No allocation after createRun(): the hero and the events object are rewritten in place.
// README.md "Rules" and "Server limits" explain the design and the proof; the tests check them.
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { inputToWorld } from "@/arcade3d/core/math";
import type { RunState } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossConfig, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS, type LavaLevel } from "./levels";
import { ZONES, buildPillars, type PillarArena, type PillarVent, type RockStrike } from "./pillars";
import { COMBO, COMBO_BASE_MS, KALDER, SECRETS } from "./progression";

// ---------- tuning (1 unit = 1 m, forward is -z, up is +y) ----------

/** "Nothing": no support, no coyote, no buffered press. */
export const NONE = -1;
/** the most rules ms one frame may advance (the core caps dt at 1/20 s anyway) */
export const MAX_STEP_MS = 50;
/** the hero's collision: a vertical cylinder, feet at y */
export const HERO = { radius: 0.32, height: 1.2 } as const;
/** top speed from the stick (m/s), and its acceleration (m/s²) on the ground and in the air */
export const V_RUN = 6.5;
export const ACCEL = { ground: 50, air: 32, ice: 36 } as const;
/** gravity (m/s²), jump and bounce-pad launch speeds (m/s) */
export const G = 30;
export const V_JUMP = 14;
export const V_BOUNCE = 22;
/** a geyser vent's launch: twice a jump's height (the card's "2 times higher") */
export const V_VENT = V_JUMP * Math.SQRT2;
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
/** After you land on a blinking pillar it stays solid this long. Checkpoints and the goal never blink. */
export const GRIP_MS = 1600;
/** A collapsing (sinking) pillar holds this long after you land, then drops into the lava. */
export const COLLAPSE_HOLD = 3600;
/** bounce pad: a square of this half size around its platform's centre (no pads in this cavern) */
export const PAD_HALF = 0.8;
/** a vent launches the hero standing in this square round its pillar's centre */
export const VENT_HALF = 1.0;
/** a vent stays open this long after each heartbeat */
export const VENT_OPEN_MS = 800;
/** platform colliders are this deep under their top (the visuals' rock hangs lower, no collision) */
export const THICKNESS = 1.4;
/** embers: pickup radius around the hero's middle, the time bonus each, the middle's height over the feet */
export const ORB = { pickup: 0.95, bonusMs: 400, centerY: 0.6 } as const;
/** the heartbeat surge: +height over riseMs, back over ebbMs, telegraphed telegraphMs ahead */
export const SURGE = { height: 1.2, riseMs: 1500, ebbMs: 1500, telegraphMs: 1000 } as const;
/** hot-foot: a top glows orange, then white, then crumbles (ms stood on); it cools to 0 over coolMs; a crumbled top re-forms after reformMs */
export const HEAT = { orangeMs: 1200, whiteMs: 2400, crumbleMs: 3000, coolMs: 4000, reformMs: 4000 } as const;
const COOL_PER_MS = HEAT.crumbleMs / HEAT.coolMs;
/** Kalder's lava: the slam surge (P1), the standing tide (P2), the heart surge (P3), m over the capped base */
export const BOSS_LAVA = { slam: 1.2, tear: 1.2, heart: 2.0 } as const;

/** apex heights and times of the launches (m, ms) */
export const H_JUMP = (V_JUMP * V_JUMP) / (2 * G);
export const H_BOUNCE = (V_BOUNCE * V_BOUNCE) / (2 * G);
export const H_VENT = (V_VENT * V_VENT) / (2 * G);
export const APEX_MS = (1000 * V_JUMP) / G;
export const BOUNCE_APEX_MS = (1000 * V_BOUNCE) / G;

// ---------- the course ----------

export type SupportKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

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
   /** a bounce pad in the middle of the top (unused in this cavern; the field stays for the launch) */
   pad: boolean;
   /** blinks out for `gone` of each cycle; null = always solid */
   vanish: { periodMs: number; gone: number; phase: number } | null;
   /** low ground traction (ACCEL.ice) */
   slippery: boolean;
   /** drops out after COLLAPSE_HOLD of standing on it */
   collapse: boolean;
   /** heats while stood on and crumbles at HEAT.crumbleMs */
   heat: boolean;
   heatRate: number;
   /** a geyser vent in the middle of the top */
   vent: PillarVent | null;
   /** a ring pillar of Kalder's arena (level 5) */
   ring: boolean;
   /** Kalder's hit zone for boss phase zone - 1; 0 = not a zone. Solid only in its phase */
   zone: number;
}

export interface Orb extends Vec3Like {
   x: number;
   y: number;
   z: number;
}

/** A secret's spot and what takes it (progression.ts SECRETS order). */
export interface SecretSpot extends Vec3Like {
   x: number;
   y: number;
   z: number;
   /** the power that must be up (a double jump's flight for Nami), or null (the spot itself is the gate) */
   need: "dash" | "phase" | "shield" | "magnet" | "doubleJump" | null;
   reach: number;
   /** the pillar it belongs to (for the drawing) */
   support: number;
}

export interface Arena extends PillarArena {
   boss: BossConfig;
}

export interface Course {
   supports: Support[];
   /** supports[0 .. route) are the route in order; level 5 appends the arena */
   route: number;
   /** support indices of the checkpoints in order; [0] is the start */
   checkpoints: number[];
   /** the goal shelf; level 5: the arena entry (the boss's defeat is the finish) */
   goal: number;
   orbs: Orb[];
   /** the run clock's cap (ms): "timeup" (unranked) */
   durationMs: number;
   /** the fastest any platform moves (m/s): the carry bound of the proof */
   maxCarry: number;
   /** sideways heat gusts while airborne */
   wind: boolean;
   /** rocks on pillar rims, shaken loose by the beat; the centre of each pillar is outside the strike */
   strikes: RockStrike[];
   /** lava height (m) at rules ms 0, its rise (m/s), and where the steady rise stops (Infinity = never) */
   lava0: number;
   lavaRate: number;
   lavaCap: number;
   /** the heartbeat (ms) */
   beatMs: number;
   secrets: SecretSpot[];
   arena: Arena | null;
}

export type { RockStrike };

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

/** True while a blinking pillar is absent. A pillar with no vanish cycle is always there. */
export function roofGone(s: Support, ms: number): boolean {
   const v = s.vanish;
   if (!v) return false;
   const t = ms / v.periodMs + v.phase;
   const frac = t - Math.floor(t);
   return frac < v.gone;
}

const smooth = (k: number) => k * k * (3 - 2 * k);

/** The surge's shape (0..1) `u` ms after a beat: up over riseMs, back over ebbMs. */
export function surgeShape(u: number, riseMs: number = SURGE.riseMs, ebbMs: number = SURGE.ebbMs): number {
   if (!(u >= 0)) return 0;
   if (u < riseMs) return smooth(u / riseMs);
   if (u < riseMs + ebbMs) return 1 - smooth((u - riseMs) / ebbMs);
   return 0;
}

/** The heartbeat number at `ms`: 0 before the first beat (at beatMs), then 1, 2, ... */
export function beatIndex(course: Course, ms: number): number {
   return ms < course.beatMs ? 0 : Math.floor(ms / course.beatMs);
}

/** ms since the latest beat (NaN before the first). */
export function sinceBeat(course: Course, ms: number): number {
   if (ms < course.beatMs) return Number.NaN;
   return ms - Math.floor(ms / course.beatMs) * course.beatMs;
}

/** The heartbeat surge (m) over the steady tide. */
export function beatSurge(course: Course, ms: number): number {
   const u = sinceBeat(course, ms);
   return Number.isNaN(u) ? 0 : SURGE.height * surgeShape(u);
}

/** The 1 s telegraph before each beat (0..1, 1 = the beat): the walls pulse red and a kick drum hits. Pure, for the Scene. */
export function surgeTelegraph(course: Course, ms: number): number {
   const P = course.beatMs;
   const t = ms - Math.floor(ms / P) * P;
   const from = P - SURGE.telegraphMs;
   return t >= from ? (t - from) / SURGE.telegraphMs : 0;
}

/** The steady tide (m): the start level plus the rise, held at the cap (level 5). */
export function lavaBase(course: Course, ms: number): number {
   return Math.min(course.lavaCap, course.lava0 + (course.lavaRate * Math.max(0, ms)) / 1000);
}

/** The lava surface (m) at rules ms on a course without a running boss: the steady tide plus the heartbeat surge. */
export function lavaY(course: Course, ms: number): number {
   return lavaBase(course, ms) + beatSurge(course, ms);
}

/** The run currently being stepped: absent() reads its dropped, crumbled and boss state (step never yields). */
let CUR: LavaRun | null = null;

/** Is support `index` gone at `ms` for the run being stepped (sunk, crumbled, or a boss zone out of its phase)? Blink is separate. */
function absent(index: number, ms: number): boolean {
   const r = CUR;
   if (r === null || index < 0) return false;
   const c = r.collapsed[index];
   if (c > 0 && ms >= c) return true;
   if (ms < r.crumbleUntil[index]) return true;
   const z = r.course.supports[index].zone;
   if (z > 0 && !zoneActive(r, index)) return true;
   return false;
}

/** A boss zone is solid in its own phase only, while the fight runs. */
export function zoneActive(run: LavaRun, index: number): boolean {
   const z = run.course.supports[index].zone;
   if (z === 0) return true;
   const b = run.boss;
   if (b === null || run.bossStartMs === NONE) return false;
   if (b.step === "defeat" || b.step === "done") return false;
   return z === b.phase + 1;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function nearestStatic(supports: Support[], route: number, at: number, used: Set<number>): number {
   let best = -1;
   for (let d = 0; d < route; d++) {
      for (const k of [at + d, at - d]) {
         if (k <= 0 || k >= route - 1 || used.has(k)) continue;
         const s = supports[k];
         if (s.kind !== "roof" || s.mover || s.vanish || s.collapse || s.vent || s.slippery) continue;
         best = k;
         break;
      }
      if (best >= 0) break;
   }
   if (best < 0) best = Math.max(1, Math.min(route - 2, at));
   used.add(best);
   return best;
}

/** Where the level's secrets sit and what takes them (progression.ts SECRETS, README "Secrets"). */
export function secretSpots(supports: Support[], route: number, level: LevelId, arena: PillarArena | null): SecretSpot[] {
   const used = new Set<number>();
   const side = (k: number) => {
      const s = supports[k];
      const next = supports[Math.min(route - 1, k + 1)];
      return next.cx >= s.cx ? -1 : 1;
   };
   return SECRETS[level].map((spec): SecretSpot => {
      if (spec.id === "chimney") {
         const k = nearestStatic(supports, route, Math.floor(route * 0.5), used);
         const s = supports[k];
         return { x: s.cx, y: s.top + 0.6, z: s.cz, need: "dash", reach: 1.2, support: k };
      }
      if (spec.id === "ghost") {
         const k = nearestStatic(supports, route, Math.floor(route * 0.3), used);
         const s = supports[k];
         return { x: round2(s.cx + side(k) * (s.hw + 1.0)), y: s.top + 0.8, z: s.cz, need: "phase", reach: 1.3, support: k };
      }
      if (spec.id === "trail") {
         const k = nearestStatic(supports, route, Math.floor(route * 0.7), used);
         const s = supports[k];
         return { x: round2(s.cx + side(k) * (s.hw + 3.0)), y: s.top - 0.6, z: s.cz, need: "magnet", reach: ORB.pickup, support: k };
      }
      if (spec.id === "overhang") {
         const k = nearestStatic(supports, route, Math.floor(route * 0.4), used);
         const a = supports[k];
         const b = supports[k + 1];
         return { x: round2((a.cx + b.cx) / 2), y: Math.max(a.top, b.top) + 2.0, z: round2((a.cz + b.cz) / 2), need: "doubleJump", reach: 1.2, support: k };
      }
      if (spec.id === "spray" || spec.id === "vent3") {
         let k = -1;
         for (let i = 1; i < route; i++) {
            const v = supports[i].vent;
            if (v && (spec.id === "vent3" ? v.every === 3 : v.every === 1)) {
               k = i;
               break;
            }
         }
         if (k < 0) k = nearestStatic(supports, route, Math.floor(route * 0.6), used);
         const s = supports[k];
         return spec.id === "spray"
            ? { x: s.cx, y: s.top + 2.2, z: s.cz, need: "shield", reach: 1.0, support: k }
            : { x: s.cx, y: s.top + 6.0, z: s.cz, need: null, reach: ORB.pickup, support: k };
      }
      // "core": over Kalder's head, on a slam geyser's line
      if (!arena) {
         const g = supports[route - 1];
         return { x: g.cx, y: g.top + 6.6, z: g.cz, need: null, reach: ORB.pickup, support: route - 1 };
      }
      return { x: arena.cx, y: arena.top + 6.6, z: arena.cz, need: null, reach: ORB.pickup, support: arena.zones[0] };
   });
}

function finishCourse(level: LavaLevel): Course {
   const draft = buildPillars(level);
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
      vanish: s.vanish ? { ...s.vanish } : null,
      slippery: s.slippery,
      collapse: s.collapse,
      heat: s.heat,
      heatRate: s.heatRate,
      vent: s.vent ? { ...s.vent } : null,
      ring: s.ring,
      zone: s.zone,
   }));
   const checkpoints = [0];
   supports.forEach((s, i) => {
      if (s.kind === "checkpoint") checkpoints.push(i);
   });
   const arena: Arena | null = draft.arena ? { ...draft.arena, boss: KALDER } : null;
   const goal = arena ? draft.route - 1 : supports.findIndex((s) => s.kind === "goal");
   let maxCarry = 0;
   for (const s of supports) if (s.mover) maxCarry = Math.max(maxCarry, moverTopSpeed(s.mover));
   const spec = level.spec;
   return {
      supports,
      route: draft.route,
      checkpoints,
      goal,
      orbs: draft.orbs,
      durationMs: level.durationMs,
      maxCarry,
      strikes: draft.strikes,
      wind: draft.wind,
      lava0: spec.lava0,
      lavaRate: spec.lavaRate,
      lavaCap: spec.lavaCap ?? Infinity,
      beatMs: spec.beatMs,
      secrets: secretSpots(supports, draft.route, level.id, draft.arena),
      arena,
   };
}

/** Every level: buildPillars. The course does not depend on the run seed. */
export function buildCourse(level: LavaLevel = LEVELS[1]): Course {
   return finishCourse(level);
}

/** A strike is live this ms (the same fraction on every device), from the first heartbeat on. */
export function strikeLive(st: RockStrike, ms: number): boolean {
   if (ms < st.fromMs) return false;
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
 * A vent pillar also launches at V_VENT (a fixed launch, like a bounce pad; taken as open at any ms,
 * which covers the beat and Kiro's off-beat ride). Infinity when no launch reaches. Ground time is 0.
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
   if (a.vent) vertical = Math.min(vertical, riseLandS(V_VENT, dy));
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

/**
 * The least ms from the fight's start to Kalder's defeat: the boss machine stepped 1 ms at a time with
 * a hit on the first ms of every vulnerable window (one hit per window; hitting any later only delays
 * every later window). The fight starts on the first landing on a ring pillar and is stepped from the
 * next ms on, exactly like rules.ts tick().
 */
export function bossMinMs(cfg: BossConfig): number {
   const s = createBoss(cfg);
   const ev = createBossEvents();
   for (let t = 1; t < 600_000; t++) {
      stepBoss(s, cfg, 1, ev);
      if (s.step === "vulnerable" && hitBoss(s, cfg, 1, ev) === "defeated") return t;
   }
   return Infinity;
}

/** The proven least finish ms of a course (README proof step 5): the goal, or (level 5) a ring pillar plus the least fight. */
export function minFinishMs(course: Course, vRun = V_RUN): number {
   const arrive = minArrivalMs(course, vRun);
   if (!course.arena) return arrive[course.goal];
   let first = Infinity;
   for (const k of course.arena.ring) first = Math.min(first, arrive[k]);
   return first + bossMinMs(course.arena.boss);
}

/** What the course can feed the flow meter: every ember once, the first landing on each support but the start. */
export function comboSpecOf(course: Course): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: course.orbs.length, base: COMBO_BASE_MS.ember },
         { count: course.supports.length - 1, base: COMBO_BASE_MS.pillar },
      ],
   };
}

/** The least submitted duration: the least finish minus every ember's bonus and the most flow bonus (README proof step 6). */
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
 * ember's bonus and the most flow bonus.
 */
export function dashFloorMs(course: Course): number {
   const F = minFinishMs(course);
   if (!Number.isFinite(F)) return Infinity;
   const perDash = ((POWER_MS.dash + 1) * (V_DASH - V_RUN)) / V_RUN;
   const cooldown = heroById("riko").cooldownMs;
   let T = 0;
   while (T + perDash * (1 + Math.floor(T / cooldown)) < F) T += 1;
   return T - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

/**
 * About 8 % under the bound, rounded down to 100 ms, never under 90 % of it, and never above Riko's
 * dashed floor (a dash shaves about 260 ms of the summed bound per cooldown).
 */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.92) / 100) * 100;
   if (minDurationMs < lb * 0.9) minDurationMs = Math.ceil((lb * 0.9) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb);
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
   /** a blinking pillar just landed on stays solid through this rules ms */
   gripUntil: number;
   /** a collapsing pillar drops at this rules ms (0 = not on one) */
   collapseHold: number;
   /** this flight came from a vent (the ball, the spark column) */
   ventFlight: boolean;
   /** thrown back by Kalder after a hit: the stick does not steer until the landing */
   shrug: boolean;
}

/** One frame of input. Scene fills one object per run and passes it every step. */
export interface StepInput {
   /** the stick at camera yaw 0: inputToWorld(moveX, moveY, 0), so up is -z. Length <= 1 (longer is normalised). step() turns it by `yaw`. */
   moveX: number;
   moveZ: number;
   /** a jump press this frame (the core's jumpPressed: keyboard and touch alike), latched at the frame's first ms */
   jumpPressed: boolean;
   /** The hero power (keyboard E/Enter and the touch Power button both set the core's actionPressed). */
   actionPressed: boolean;
   /**
    * The camera yaw the stick is relative to (rad, core fitView / menu2 orbit convention; the orbit
    * camera's viewYaw). step() maps (moveX, moveZ) with inputToWorld(moveX, moveZ, yaw), so "up" moves
    * away from the camera. 0 or omitted (bots, tests) = the stick is already world space. Turning
    * keeps the length, so the proof's speed bounds hold for any yaw.
    */
   yaw?: number;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

/** What happened in one step. The same object every step, reset at its start. */
export interface StepEvents {
   jumped: boolean;
   bounced: boolean;
   /** a vent launched the hero */
   vented: boolean;
   landed: boolean;
   /** the support of the latest landing in this step, NONE without one */
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
   /** the lava covered the checkpoint: the run ends "lose" (unranked) */
   lava: boolean;
   /** a hero power actually fired this step (a press on cooldown does not) */
   powered: boolean;
   /** a heated top crumbled this step (its support), NONE otherwise */
   crumbled: number;
   /** a beat telegraph began / a heartbeat surge began (Kalder's telegraph / slam on level 5) */
   telegraph: boolean;
   beat: boolean;
   /** flow bonus (ms) paid in this step, and whether a link was added */
   comboBonus: number;
   comboLinked: boolean;
   /** secrets found in this step: their indices in secretList[0..secretCount) */
   secretCount: number;
   secretList: number[];
   /** the fight began, a hit landed (and whether it changed the phase), Kalder fell */
   bossStarted: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
}

export interface LavaRun {
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
   /** the highest top stood on (HUD "height") */
   bestTop: number;
   /** 0 = the pillar is still there; otherwise the rules ms it sank */
   collapsed: Float64Array;
   /** heat (ms stood on, rate-weighted) as of heatMs, per support; heatOn = the one being heated now */
   heat: Float64Array;
   heatMs: Float64Array;
   heatOn: number;
   /** a crumbled top is gone until this rules ms */
   crumbleUntil: Float64Array;
   /** tops crumbled under the hero (0 = the "no crumbled pillar" bonus) */
   crumbles: number;
   /** the flow meter (menu2/combo): combo.bonusTotal ms come off the submitted time */
   combo: ComboState;
   /** 1 = landed on this support before (a first landing is a flow link) */
   visited: Uint8Array;
   /** the level's secrets found (progression.ts SECRETS order) */
   secrets: SecretTracker;
   /** falls, rock hits and lava falls (0 = the no-hit badge) */
   hits: number;
   /** Kalder (level 5): null elsewhere; the fight starts at bossStartMs (NONE before) */
   boss: BossState | null;
   bossEvents: BossEvents;
   bossStartMs: number;
   ended: "win" | "timeup" | "lose" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   const orbList = new Array<number>(32);
   for (let i = 0; i < orbList.length; i++) orbList[i] = 0;
   return {
      jumped: false,
      bounced: false,
      vented: false,
      landed: false,
      landedOn: NONE,
      checkpoint: NONE,
      orbCount: 0,
      orbList,
      lost: false,
      respawned: false,
      finished: false,
      timeup: false,
      lava: false,
      powered: false,
      crumbled: NONE,
      telegraph: false,
      beat: false,
      comboBonus: 0,
      comboLinked: false,
      secretCount: 0,
      secretList: [0, 0, 0],
      bossStarted: false,
      bossHit: false,
      bossPhase: false,
      bossDefeated: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.bounced = false;
   ev.vented = false;
   ev.landed = false;
   ev.landedOn = NONE;
   ev.checkpoint = NONE;
   ev.orbCount = 0;
   ev.lost = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
   ev.lava = false;
   ev.powered = false;
   ev.crumbled = NONE;
   ev.telegraph = false;
   ev.beat = false;
   ev.comboBonus = 0;
   ev.comboLinked = false;
   ev.secretCount = 0;
   ev.bossStarted = false;
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
      gripUntil: 0,
      collapseHold: 0,
      ventFlight: false,
      shrug: false,
   };
}

/**
 * A new run on the start platform: at rest, grounded (the countdown is the start freeze).
 * Allocates everything the run will ever use. `heroId` defaults to Riko; the Scene passes the
 * overlay's pick (pickedHero). The power is ready at the start and its cooldown resets each run.
 */
export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = "riko"): LavaRun {
   const course = courseFor(level);
   const start = course.supports[course.checkpoints[0]];
   const n = course.supports.length;
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
      bestTop: start.top,
      collapsed: new Float64Array(n),
      heat: new Float64Array(n),
      heatMs: new Float64Array(n),
      heatOn: NONE,
      crumbleUntil: new Float64Array(n),
      crumbles: 0,
      combo: createCombo(),
      visited: new Uint8Array(n),
      secrets: createSecretTracker(SECRETS[level]),
      hits: 0,
      boss: course.arena ? createBoss(course.arena.boss) : null,
      bossEvents: createBossEvents(),
      bossStartMs: NONE,
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
   h.ventFlight = false;
   if (v >= V_BOUNCE - 1e-6) h.apexCap = y0 + H_BOUNCE;
   else if (v > 0) h.apexCap = y0 + (v * v) / (2 * G);
   else h.apexCap = keep;
}

/** Shield or phase is up: gusts and rocks do not touch the hero. */
function hazardImmune(h: Hero, ms: number): boolean {
   return ms <= h.shieldUntil || ms <= h.phaseUntil;
}

/**
 * The lava surface (m) the run sees at `ms`: lavaY, or on level 5 once the fight runs, the capped tide
 * plus Kalder's surge (a slam bump in P1, a standing tide in P2, the big heart surge in P3).
 */
export function lavaAt(run: LavaRun, ms: number): number {
   const course = run.course;
   const b = run.boss;
   if (b === null || run.bossStartMs === NONE || !course.arena) return lavaY(course, ms);
   const base = lavaBase(course, ms);
   const cfg = course.arena.boss;
   if (b.step === "defeat" || b.step === "done" || b.step === "intro") return base;
   const atk = cfg.phases[b.phase].attacks[b.attack % cfg.phases[b.phase].attacks.length];
   const u = b.step === "attack" ? b.stepMs : b.step === "vulnerable" ? atk.attackMs + b.stepMs : -1;
   if (b.phase === 1) return base + BOSS_LAVA.tear * (b.step === "transition" ? smooth(Math.min(1, b.stepMs / cfg.transitionMs)) : 1);
   const amp = b.phase === 0 ? BOSS_LAVA.slam : BOSS_LAVA.heart;
   return base + amp * surgeShape(u, 900, 1500);
}

/** Is a vent on support `s` open at `ms`: on its beat (every `every`-th), on Kalder's slam (ring vents, P1 and P3), or any time under Kiro's shield. */
export function ventOpen(run: LavaRun, index: number, ms: number): boolean {
   const s = run.course.supports[index];
   const v = s.vent;
   if (!v) return false;
   if (ms <= run.hero.shieldUntil) return true;
   if (s.ring) {
      const b = run.boss;
      return b !== null && run.bossStartMs !== NONE && b.step === "attack" && b.phase !== 1;
   }
   const u = sinceBeat(run.course, ms);
   if (Number.isNaN(u) || u >= VENT_OPEN_MS) return false;
   return beatIndex(run.course, ms) % v.every === 0;
}

/** The heat (0 .. HEAT.crumbleMs) of support `i` at `ms`. */
export function heatAt(run: LavaRun, i: number, ms: number): number {
   if (i < 0) return 0;
   const dt = ms - run.heatMs[i];
   if (i === run.heatOn) return run.heat[i] + run.course.supports[i].heatRate * dt;
   return Math.max(0, run.heat[i] - COOL_PER_MS * dt);
}

function settleHeat(run: LavaRun, i: number, ms: number): void {
   if (i < 0) return;
   run.heat[i] = heatAt(run, i, ms);
   run.heatMs[i] = ms;
}

function setHeatOn(run: LavaRun, next: number, ms: number): void {
   if (next === run.heatOn) return;
   settleHeat(run, run.heatOn, ms);
   // settle the new one as it cooled so far (heatOn is not it yet)
   settleHeat(run, next, ms);
   run.heatOn = next;
}

/**
 * Nami's second jump. The new apex is capped at the flight's existing apexCap, so it cannot
 * reach a platform a single jump (or the launch that started the flight) could not already reach.
 */
function tryDoubleJump(run: LavaRun, ms: number): boolean {
   const h = run.hero;
   if (h.grounded || !h.airJump) return false;
   const y = h.y;
   const cap = h.apexCap;
   if (!(y < cap - 0.04)) return false;
   const v = Math.min(V_JUMP, Math.sqrt(Math.max(0, 2 * G * (cap - y))));
   if (!(v >= 1)) return false;
   const vent = h.ventFlight;
   startArc(h, ms, y, v);
   h.ventFlight = vent;
   h.apexCap = cap;
   h.airJump = false;
   return true;
}

/** Fire the run's hero power if it is off cooldown. A press that cannot fire (Nami on the ground) does not start the cooldown. */
function tryPower(run: LavaRun, ms: number, mx: number, mz: number): void {
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

function rockHit(run: LavaRun, ms: number): boolean {
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
export function advanceClock(run: LavaRun, dtMs: number): number {
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
 * cap ends with "timeup"; else the boss and the hero's state act. A finish, a lava loss or a time-up
 * ends the step, and every later step does nothing. Returns run.events (the same object every step).
 */
export function step(run: LavaRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;
   CUR = run;
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

function tick(run: LavaRun, mx: number, mz: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const ev = run.events;
   const course = run.course;
   comboTick(run.combo, COMBO, ms);
   // the heartbeat (level 5 after the fight starts: Kalder's slams instead)
   if (run.bossStartMs === NONE) {
      const P = course.beatMs;
      const t = ms - Math.floor(ms / P) * P;
      if (t === P - SURGE.telegraphMs) ev.telegraph = true;
      if (t === 0 && ms >= P) ev.beat = true;
   } else if (run.boss && course.arena) {
      const bev = stepBoss(run.boss, course.arena.boss, 1, run.bossEvents);
      if (bev.telegraph) ev.telegraph = true;
      if (bev.attack) ev.beat = true;
   }
   if (h.state === "lost") {
      run.pressMs = NONE;
      run.actionMs = NONE;
      h.timerMs -= 1;
      // keep falling out of view (looks only: nothing collides)
      h.y = arcY(h, ms);
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
      const gripped = i === h.support && ms <= h.gripUntil;
      if (absent(i, ms)) continue;
      if (!gripped && roofGone(s, ms)) continue;
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
      if (absent(i, ms) || roofGone(s, ms)) continue;
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
      if (absent(i, ms) || roofGone(s, ms)) continue;
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
      if (absent(i, ms) || roofGone(s, ms)) continue;
      if (!(yOld + HERO.height <= s.bottom && s.bottom < yNew + HERO.height)) continue;
      if (Math.abs(x - supportX(s, ms)) < s.hw && Math.abs(z - supportZ(s, ms)) < s.hd) return i;
   }
   return NONE;
}

function supportUnder(course: Course, h: Hero, ms: number): number {
   if (h.support !== NONE && !absent(h.support, ms)) {
      const current = course.supports[h.support];
      const gripped = ms <= h.gripUntil;
      if ((gripped || !roofGone(current, ms)) && onSupport(current, h.x, h.z, ms)) return h.support;
   }
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (absent(i, ms) || roofGone(s, ms)) continue;
      if (Math.abs(s.top - h.y) < 1e-9 && onSupport(s, h.x, h.z, ms)) return i;
   }
   return NONE;
}

/** Kalder throws the hero back after a hit: a jump's arc towards the nearest ring vent, at most V_RUN, no steering until the landing. */
function shrugOff(run: LavaRun, ms: number): void {
   const a = run.course.arena!;
   const h = run.hero;
   const sup = run.course.supports;
   let best = a.ring[1];
   let bestD = Infinity;
   for (let k = 1; k < a.ring.length; k++) {
      const s = sup[a.ring[k]];
      const d = Math.hypot(s.cx - h.x, s.cz - h.z);
      if (d < bestD) {
         bestD = d;
         best = a.ring[k];
      }
   }
   const t = sup[best];
   const dx = t.cx - h.x;
   const dz = t.cz - h.z;
   const dist = Math.max(1e-6, Math.hypot(dx, dz));
   const drop = h.y - t.top;
   const flight = (V_JUMP + Math.sqrt(V_JUMP * V_JUMP + 2 * G * Math.max(0, drop))) / G;
   const v = Math.min(V_RUN, dist / flight);
   setHeatOn(run, NONE, ms);
   startArc(h, ms, h.y, V_JUMP);
   h.vx = (dx / dist) * v;
   h.vz = (dz / dist) * v;
   h.carryX = 0;
   h.carryZ = 0;
   h.coyoteFrom = NONE;
   h.dashUntil = NONE;
   h.shrug = true;
   run.pressMs = NONE;
}

function playMs(run: LavaRun, mx: number, mz: number): void {
   const course = run.course;
   const h = run.hero;
   const ev = run.events;
   const ms = run.simMs;
   const x0 = h.x;
   const z0 = h.z;

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
   // Thrown back by Kalder, the hero keeps its throw (at most V_RUN) until it lands.
   const dashing = h.dashUntil >= ms;
   if (dashing) {
      h.vx = h.dashX * V_DASH;
      h.vz = h.dashZ * V_DASH;
   } else if (!(h.shrug && !h.grounded)) {
      const icy = h.grounded && h.support !== NONE && course.supports[h.support].slippery;
      const rate = (h.grounded ? (icy ? ACCEL.ice : ACCEL.ground) : ACCEL.air) / 1000;
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

   // 5. vertical: a collapsing pillar drops, then walk-off, the arc (head bump, landing)
   if (h.grounded && h.support !== NONE && h.collapseHold > 0 && ms >= h.collapseHold) {
      if (course.supports[h.support].collapse && run.collapsed[h.support] === 0) run.collapsed[h.support] = ms;
      h.collapseHold = 0;
   }
   if (h.grounded) {
      const s = supportUnder(course, h, ms);
      if (s === NONE) {
         startArc(h, ms, h.y, 0);
         h.coyoteFrom = ms;
         h.collapseHold = 0;
      } else {
         if (s !== h.support) h.collapseHold = course.supports[s].collapse && run.collapsed[s] === 0 ? ms + COLLAPSE_HOLD : 0;
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
            const vent = h.ventFlight;
            startArc(h, ms, yNew, 0);
            h.ventFlight = vent;
            h.coyoteFrom = NONE;
         }
      }
      h.y = yNew;
      if (yNew < yOld) {
         const s = landingSupport(course, h.x, h.z, yOld, yNew, ms);
         if (s !== NONE) {
            const sup = course.supports[s];
            const top = sup.top;
            h.y = top;
            h.grounded = true;
            h.support = s;
            h.coyoteFrom = NONE;
            h.lastTop = top;
            h.airJump = true;
            h.apexCap = top + H_JUMP;
            h.ventFlight = false;
            h.shrug = false;
            h.gripUntil = sup.vanish ? ms + GRIP_MS : 0;
            h.collapseHold = sup.collapse && run.collapsed[s] === 0 ? ms + COLLAPSE_HOLD : 0;
            if (top > run.bestTop) run.bestTop = top;
            ev.landed = true;
            ev.landedOn = s;
            // a first landing on a support (the start excluded) is a flow link
            if (!run.visited[s] && s !== course.checkpoints[0]) {
               run.visited[s] = 1;
               ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.pillar);
               ev.comboLinked = true;
            }
            // the fight starts on the first landing in the ring
            if (sup.ring && run.boss && run.bossStartMs === NONE) {
               run.bossStartMs = ms;
               ev.bossStarted = true;
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

   // 8. embers
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
         ev.comboBonus += comboHit(run.combo, COMBO, ms, COMBO_BASE_MS.ember);
         ev.comboLinked = true;
      }
   }

   // 8b. secrets (no score): each behind its own gate (progression.ts SECRETS)
   const secrets = course.secrets;
   for (let i = 0; i < secrets.length; i++) {
      if (run.secrets.found[i]) continue;
      const o = secrets[i];
      let r = o.reach;
      if (o.need === "magnet") r = magnet ? MAGNET_REACH : ORB.pickup;
      else if (o.need === "dash" && h.dashUntil < ms) continue;
      else if (o.need === "phase" && h.phaseUntil < ms) continue;
      else if (o.need === "shield" && h.shieldUntil < ms) continue;
      else if (o.need === "doubleJump" && (h.grounded || h.airJump)) continue;
      const ox = o.x - h.x;
      const oy = o.y - my;
      const oz = o.z - h.z;
      if (ox * ox + oy * oy + oz * oz <= r * r && collectSecret(run.secrets, i)) {
         if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount++] = i;
      }
   }

   // 9. heat: the top under the feet heats, every other one cools; a white-hot top crumbles
   const heating = h.grounded && h.support !== NONE && course.supports[h.support].heat ? h.support : NONE;
   setHeatOn(run, heating, ms);
   if (heating !== NONE && heatAt(run, heating, ms) >= HEAT.crumbleMs) {
      run.crumbleUntil[heating] = ms + HEAT.reformMs;
      run.heat[heating] = 0;
      run.heatMs[heating] = ms;
      run.heatOn = NONE;
      run.crumbles += 1;
      ev.crumbled = heating;
   }

   // 10. lava, then the fall line. A flooded checkpoint ends the run; a dry one is a respawn.
   if (lavaAt(run, ms) >= h.y - 1e-4) {
      hitLava(run);
      return;
   }
   if (!h.grounded && h.y < h.lastTop - FALL_DEPTH) {
      lose(run);
      return;
   }
   if (!h.grounded) return;

   // 11. a falling rock on the rim (shield and phase ignore it)
   if (rockHit(run, ms)) {
      lose(run);
      return;
   }

   // 12. Kalder: standing on the zone of his phase while he is open is a hit
   const boss = run.boss;
   const s = course.supports[h.support];
   if (boss && course.arena && s.zone > 0 && boss.step === "vulnerable" && s.zone === boss.phase + 1) {
      const res = hitBoss(boss, course.arena.boss, 1, run.bossEvents);
      if (res !== "ignored") {
         ev.bossHit = true;
         if (res === "phase") ev.bossPhase = true;
         if (res === "defeated") {
            ev.bossDefeated = true;
            run.finishMs = ms;
            run.ended = "win";
            ev.finished = true;
            return;
         }
         shrugOff(run, ms);
         return;
      }
   }

   // 13. a vent under the feet launches when it is open (walking onto it too)
   if (s.vent && Math.abs(h.x - s.cx) <= VENT_HALF && Math.abs(h.z - s.cz) <= VENT_HALF && ventOpen(run, h.support, ms)) {
      setHeatOn(run, NONE, ms);
      startArc(h, ms, h.y, V_VENT);
      h.ventFlight = true;
      h.coyoteFrom = NONE;
      h.carryX = 0;
      h.carryZ = 0;
      run.pressMs = NONE;
      ev.vented = true;
      return;
   }

   // 14. checkpoints, forward only
   for (let k = run.checkpoint + 1; k < course.checkpoints.length; k++) {
      if (course.checkpoints[k] === h.support) {
         run.checkpoint = k;
         ev.checkpoint = k;
         break;
      }
   }

   // 15. the goal (level 5 ends on Kalder's defeat instead)
   if (!course.arena && h.support === course.goal) {
      run.finishMs = ms;
      run.ended = "win";
      ev.finished = true;
   }
}

function lose(run: LavaRun): void {
   const h = run.hero;
   setHeatOn(run, NONE, run.simMs);
   h.state = "lost";
   h.timerMs = LOST_MS;
   h.vx = 0;
   h.vz = 0;
   h.carryX = 0;
   h.carryZ = 0;
   h.coyoteFrom = NONE;
   h.dashUntil = NONE;
   h.collapseHold = 0;
   h.shrug = false;
   run.hits += 1;
   comboBreak(run.combo);
   run.events.lost = true;
}

/** Feet in the lava. The active checkpoint is still above it: a fall. It is not: the run is over. */
function hitLava(run: LavaRun): void {
   const y = lavaAt(run, run.simMs);
   const cp = run.course.supports[run.course.checkpoints[run.checkpoint]];
   if (cp.top <= y + 0.02) {
      lose(run);
      run.ended = "lose";
      run.events.lava = true;
      return;
   }
   lose(run);
}

/** Back on the active checkpoint's centre, at rest, frozen for SPAWN_MS. */
function respawn(run: LavaRun): void {
   const h = run.hero;
   const index = run.course.checkpoints[run.checkpoint];
   const s = run.course.supports[index];
   if (s.top <= lavaAt(run, run.simMs) + 0.02) {
      run.ended = "lose";
      run.events.lava = true;
      run.events.lost = true;
      h.state = "lost";
      return;
   }
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
   h.gripUntil = 0;
   h.collapseHold = 0;
   h.ventFlight = false;
   h.shrug = false;
   h.state = "spawn";
   h.timerMs = SPAWN_MS;
   run.respawns += 1;
   run.events.respawned = true;
}

// ---------- solid boxes (for a camera-collision pass, menu2/camera) ----------

export interface SolidBox {
   minX: number;
   minY: number;
   minZ: number;
   maxX: number;
   maxY: number;
   maxZ: number;
}

/**
 * The solid pillar tops at rules ms `ms` as plain AABBs (a collider is THICKNESS deep under its top;
 * the drawn basalt hangs lower, so `depth` can extend the box down to the lava for the camera).
 * Movers at their place, blinking / sunk / crumbled pillars and inactive boss zones left out (for
 * the run `run`, or every static pillar without one). Pure; reuses `out`'s boxes.
 */
export function solidBoxes(course: Course, ms: number, out: SolidBox[] = [], run: LavaRun | null = null, depth = THICKNESS): SolidBox[] {
   let n = 0;
   const prev = CUR;
   CUR = run;
   for (let i = 0; i < course.supports.length; i++) {
      const s = course.supports[i];
      if (run ? absent(i, ms) : s.zone > 0) continue;
      if (roofGone(s, ms)) continue;
      const x = supportX(s, ms);
      const z = supportZ(s, ms);
      const b = out[n] ?? (out[n] = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 });
      b.minX = x - s.hw;
      b.maxX = x + s.hw;
      b.minZ = z - s.hd;
      b.maxZ = z + s.hd;
      b.maxY = s.top;
      b.minY = s.top - depth;
      n++;
   }
   CUR = prev;
   out.length = n;
   return out;
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
   /** Kalder: 1 once the fight runs, hp, phase index, 1 while open, 1 while the hit flash is on */
   bossOn: "bossOn",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   /** tops crumbled under the hero this run */
   crumbles: "crumbles",
   /** set before end("win") for the star screen: STAR_BIT mask, new-star mask, no-hit (1/0), secrets mask, new-secret count, XP gained */
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The run time a player sees and submits: play ms minus the ember bonus and the flow bonus, never below 0. */
export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

/**
 * GameDefinition.finalScore: a win submits the finish ms minus the ember and flow bonus (the Scene
 * publishes finishMs, orbs and comboMs with setStat before end("win")); any other end keeps elapsedMs (unranked anyway).
 */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** Zone lifts (m over the ring top), for the drawing. */
export { ZONES };
