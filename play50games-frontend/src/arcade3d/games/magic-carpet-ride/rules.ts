// Magic Carpet Ride rules. Pure and deterministic with a seed: no three.js, React, DOM, Math.random
// or Date. Scene.tsx calls step() + syncStore() from one useRunFrame.
//
// The carpet flies forward along a winding lane (core/path) at the level's speed. The stick steers
// it freely inside the lane's cross-section (6 m either side, 3.5 m up and down): it drifts with the
// stick and stays where it is left. Rings pay on a plane cross and chain into a combo; coins float
// in arcs between the rings; gems sit off the line; boost pickups speed it up for a moment; flying
// obstacles (gulls, balloons, rocks, bats, lanterns, hawks, a blimp) cost a life. At the end of the
// lane the run wins with the ring quota.
//
// Fairness by construction: the "racing line" (lineAt) runs through every ring and every coin arc.
// Obstacles live only in the gaps without a gem, and every position each one can ever reach keeps
// at least its radius + the carpet's + SAFE_MARGIN clear of that line, so a pilot who follows the
// coins is never hit; gems are a safe detour in their own gaps. Leaving the line among the flyers
// is the risk.
import type { Vec3Like as Vec3 } from "@/arcade3d/core/collision";
import { capScore as capToLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createPath, pointAt, tangentAt, type Path } from "@/arcade3d/core/path";
import type { ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import type { StoreApi } from "zustand/vanilla";
import type { CarpetLevel, ObstacleKind } from "./levels";

// ---------- tuning (the limit proof cites these) ----------

export const LIVES = 3;
export const RING_POINTS = 50;
/** Each ring further into an unbroken chain pays this much more, up to COMBO_MAX. */
export const COMBO_STEP = 25;
export const COMBO_MAX = 5;
export const COIN_POINTS = 10;
export const GEM_POINTS = 50;
/** Win only: reaching the end with the quota, each life left, and the full seconds left on the clock. */
export const FINISH_BONUS = 200;
export const LIFE_BONUS = 100;
export const TIME_BONUS_PER_SECOND = 5;

/** The lane's cross-section: |lat| <= CORR_X, |vert| <= CORR_Y (m). */
export const CORR_X = 6;
export const CORR_Y = 3.5;
/** Steering speeds (m/s) at full stick and how fast the drift follows the stick (1/s). */
export const LAT_SPEED = 8;
export const VERT_SPEED = 6;
export const STEER_RATE = 7;

export const CARPET_R = 0.55;
/** A ring pays when the carpet crosses its plane within this of the centre (the drawn ring is 3.4 m across). */
export const PASS_R = 1.4;
export const COIN_R = 0.95;
export const GEM_R = 1.05;
export const BOOST_R = 1.25;
export const BOOST_MUL = 1.6;
export const BOOST_S = 2.5;
export const MERCY = 1.3;
/** Obstacles keep at least this much air between their reach and the racing line (m). */
export const SAFE_MARGIN = 0.5;
/** Bank (rad) at full sideways drift, and pitch at full climb. */
export const BANK_MAX = 0.5;
export const PITCH_MAX = 0.22;

export interface ObstacleSpec {
   /** hit radius, m (the carpet's CARPET_R is added) */
   r: number;
   /** sideways and vertical swing either side of its base, m */
   aLat: number;
   aVert: number;
   /** one swing, s */
   period: number;
   /** the vertical swing runs at twice the rate (a figure of eight) */
   eight?: boolean;
}

export const OBSTACLE_SPEC: Record<ObstacleKind, ObstacleSpec> = {
   gull: { r: 0.85, aLat: 2.2, aVert: 0.4, period: 3.2 },
   balloon: { r: 1.0, aLat: 0.3, aVert: 1.2, period: 4 },
   rock: { r: 1.15, aLat: 1.4, aVert: 0.6, period: 5 },
   hotAir: { r: 1.9, aLat: 0.6, aVert: 1.0, period: 6 },
   bat: { r: 0.75, aLat: 1.8, aVert: 1.0, period: 2.4, eight: true },
   lantern: { r: 0.7, aLat: 0.3, aVert: 1.6, period: 5 },
   hawk: { r: 1.0, aLat: 2.4, aVert: 1.2, period: 2.8 },
   blimp: { r: 2.4, aLat: 1.5, aVert: 0.3, period: 8 },
};

/** The most a full ring chain pays: ring k (1-based) of an unbroken chain pays 50 + 25 x min(k - 1, 4). */
export function ringChainMax(rings: number): number {
   let sum = 0;
   for (let k = 1; k <= rings; k++) sum += RING_POINTS + COMBO_STEP * Math.min(k - 1, COMBO_MAX - 1);
   return sum;
}

/** Every object pays once: the objective ceiling (what any run can hold before the finish). */
export function objectiveCeiling(level: CarpetLevel): number {
   return ringChainMax(level.rings) + COIN_POINTS * level.coinsPerArc * (level.rings - 1) + GEM_POINTS * level.gems;
}

/** The finish's fixed part at its largest (the quota met, every life left). */
export const WIN_BONUS_MAX = FINISH_BONUS + LIFE_BONUS * LIVES;

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/**
 * README "Server limits and why they hold": base = Bobj; a win adds at most WIN_BONUS_MAX + 5 x
 * floor(D - t), largest at the earliest win M, so maxScore >= Bobj + 500 + 5 (D - M) and
 * pps >= (500 + 5 (D - M)) / M. M = 0.8 x the fastest bot win over 200 seeds at 30 / 60 / 144 Hz.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 1900, D 75 s, fastest bot win 38.55 s, M 30.84 s: peak 2620 */
   1: { ...PTS, maxScore: 2700, minDurationMs: 4000, maxDurationMs: 75_000, base: 1900, maxPointsPerSec: 25 },
   /** L2: Bobj 2550, D 85 s, fastest bot win 44.08 s, M 35.26 s: peak 3295 */
   2: { ...PTS, maxScore: 3400, minDurationMs: 4000, maxDurationMs: 85_000, base: 2550, maxPointsPerSec: 22 },
   /** L3: Bobj 3350, D 95 s, fastest bot win 50.17 s, M 40.13 s: peak 4120 */
   3: { ...PTS, maxScore: 4250, minDurationMs: 4000, maxDurationMs: 95_000, base: 3350, maxPointsPerSec: 20 },
   /** L4: Bobj 3820, D 100 s, fastest bot win 52.07 s, M 41.65 s: peak 4610 */
   4: { ...PTS, maxScore: 4750, minDurationMs: 4000, maxDurationMs: 100_000, base: 3820, maxPointsPerSec: 20 },
   /** L5: Bobj 4710, D 115 s, fastest bot win 61.50 s, M 49.20 s: peak 5535 */
   5: { ...PTS, maxScore: 5710, minDurationMs: 4000, maxDurationMs: 115_000, base: 4710, maxPointsPerSec: 18 },
};
/** The proof's earliest win per level (s): 0.8 x the fastest bot win over 200 seeds (README). */
export const PROOF_MIN_WIN_S: Record<LevelId, number> = { 1: 30.84, 2: 35.26, 3: 40.13, 4: 41.65, 5: 49.2 };

export function capScore(score: number, durationMs: number, limits: ScoringRules): number {
   return capToLimits(score, durationMs, limits);
}

// ---------- layout ----------

export interface Ring {
   s: number;
   lat: number;
   vert: number;
   x: number;
   y: number;
   z: number;
   /** the lane's tangent (the ring's normal), its right and its up */
   tx: number;
   ty: number;
   tz: number;
   rx: number;
   ry: number;
   rz: number;
   ux: number;
   uy: number;
   uz: number;
   taken: boolean;
   missed: boolean;
}

/** A coin, a gem or a boost: a pickup at a fixed point. */
export interface Pickup {
   s: number;
   lat: number;
   vert: number;
   x: number;
   y: number;
   z: number;
   taken: boolean;
   /** coins: which arc (gap) it belongs to */
   gap: number;
}

export interface Obstacle {
   kind: ObstacleKind;
   s: number;
   /** base offset in the lane; it swings about it (OBSTACLE_SPEC) */
   lat0: number;
   vert0: number;
   phase: number;
   /** live position (world) and offset, written by moveObstacles */
   lat: number;
   vert: number;
   x: number;
   y: number;
   z: number;
   /** the lane's heading there (rad), for the drawing */
   yaw: number;
}

export interface StepEvent {
   score: number;
   ring: number;
   coin: number;
   gem: number;
   boost: number;
   hit: number;
   missedRing: boolean;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
}

export interface Run {
   levelId: LevelId;
   level: CarpetLevel;
   seed: number;
   path: Path;
   /** distance along the lane, its offset in the cross-section and their drift velocities */
   s: number;
   lat: number;
   vert: number;
   vLat: number;
   vVert: number;
   boostT: number;
   mercy: number;
   carpet: Vec3;
   prev: Vec3;
   /** the lane's heading and climb at the carpet (rad), and the carpet's bank / pitch from the drift */
   yaw: number;
   climb: number;
   roll: number;
   pitch: number;
   rings: Ring[];
   coins: Pickup[];
   gems: Pickup[];
   boosts: Pickup[];
   obstacles: Obstacle[];
   /** the racing line's bump (vertical arc) per gap between rings */
   bumps: number[];
   ringsPassed: number;
   chain: number;
   bestChain: number;
   coinsTaken: number;
   gemsTaken: number;
   nextRing: number;
   lives: number;
   score: number;
   time: number;
   over: "win" | "lose" | null;
   /** the win score before the safety cap (tests: the cap is a no-op) */
   uncapped: number;
   synced: { rings: number; combo: number; gems: number; progress: number; boost: number; need: number };
   scratch: { p: Vec3; t: Vec3; r: Vec3; a: Vec3 };
}

export interface CarpetInput {
   moveX: number;
   moveY: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The lane's horizontal right vector at a tangent: the pilot's right as seen from the chase camera
 * behind the carpet (heading +z, right is -x: a character facing +z has its left at +x). So
 * moveX > 0 (D, the right arrow, the stick to the right) slides the carpet to the right of the screen.
 */
export function rightOf(t: Vec3, out: Vec3): Vec3 {
   const h = Math.hypot(t.x, t.z) || 1;
   out.x = -t.z / h;
   out.y = 0;
   out.z = t.x / h;
   return out;
}

/** World point at an along-lane distance and a cross-section offset (lat along the right, vert up). Writes `out`. */
export function poseAt(path: Path, s: number, lat: number, vert: number, scratch: Run["scratch"], out: Vec3): Vec3 {
   pointAt(path, s, scratch.p);
   tangentAt(path, s, scratch.t);
   rightOf(scratch.t, scratch.r);
   out.x = scratch.p.x + scratch.r.x * lat;
   out.y = scratch.p.y + vert;
   out.z = scratch.p.z + scratch.r.z * lat;
   return out;
}

function buildPath(rng: () => number, level: CarpetLevel): Path {
   const n = Math.max(12, Math.ceil(level.length / 60));
   const step = level.length / (n - 1);
   const points: Vec3[] = [];
   let x = 0;
   let y = 20;
   let z = 0;
   let heading = 0;
   for (let i = 0; i < n; i++) {
      points.push({ x, y, z });
      heading = clamp(heading + (rng() - 0.5) * 0.5, -0.8, 0.8);
      x += Math.sin(heading) * step;
      z += Math.cos(heading) * step;
      y = clamp(y + (rng() - 0.5) * 0.12 * step, 14, 28);
   }
   let path = createPath(points, { smooth: true, samples: 8 });
   const k = level.length / path.total;
   const o = points[0];
   path = createPath(
      points.map((p) => ({ x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k, z: o.z + (p.z - o.z) * k })),
      { smooth: true, samples: 8 }
   );
   return path;
}

/** The racing line's offset at s: through every ring, lat straight between rings, vert with that gap's arc. */
export function lineAt(run: Pick<Run, "rings" | "bumps" | "level">, s: number, out: { lat: number; vert: number }): { lat: number; vert: number } {
   const rings = run.rings;
   if (rings.length === 0 || s <= rings[0].s) {
      const r0 = rings[0];
      const u = r0 ? clamp(s / r0.s, 0, 1) : 0;
      out.lat = r0 ? r0.lat * u : 0;
      out.vert = r0 ? r0.vert * u : 0;
      return out;
   }
   const last = rings[rings.length - 1];
   if (s >= last.s) {
      out.lat = last.lat;
      out.vert = last.vert;
      return out;
   }
   let i = 0;
   while (i < rings.length - 2 && rings[i + 1].s <= s) i++;
   const a = rings[i];
   const b = rings[i + 1];
   const u = (s - a.s) / (b.s - a.s);
   out.lat = a.lat + (b.lat - a.lat) * u;
   out.vert = a.vert + (b.vert - a.vert) * u + run.bumps[i] * Math.sin(Math.PI * u);
   return out;
}

/** The gap (between ring i and i + 1) at s, or -1 outside them. */
export function gapAt(run: Pick<Run, "rings">, s: number): number {
   const rings = run.rings;
   if (rings.length < 2 || s <= rings[0].s || s >= rings[rings.length - 1].s) return -1;
   let i = 0;
   while (i < rings.length - 2 && rings[i + 1].s <= s) i++;
   return i;
}

/** Gaps with a gem (even gaps, from the second one) never hold an obstacle; obstacles take the odd gaps. */
export const isGemGap = (gap: number) => gap % 2 === 0;

/** Where an obstacle can be at all: the box of its swing in the cross-section. */
export function obstacleReach(o: Pick<Obstacle, "kind" | "lat0" | "vert0">): { minLat: number; maxLat: number; minVert: number; maxVert: number } {
   const spec = OBSTACLE_SPEC[o.kind];
   return { minLat: o.lat0 - spec.aLat, maxLat: o.lat0 + spec.aLat, minVert: o.vert0 - spec.aVert, maxVert: o.vert0 + spec.aVert };
}

const LINE = { lat: 0, vert: 0 };

/**
 * The smallest gap (m) between an obstacle's reach and the racing line, 3D, over the stretch of the
 * lane where they could meet (the cross-section distance from the box plus the along-lane distance).
 */
export function obstacleClearance(run: Pick<Run, "rings" | "bumps" | "level">, o: Pick<Obstacle, "kind" | "lat0" | "vert0" | "s">): number {
   const box = obstacleReach(o);
   let best = Infinity;
   for (let ds = -6; ds <= 6; ds += 0.25) {
      lineAt(run, o.s + ds, LINE);
      const dl = Math.max(0, box.minLat - LINE.lat, LINE.lat - box.maxLat);
      const dv = Math.max(0, box.minVert - LINE.vert, LINE.vert - box.maxVert);
      best = Math.min(best, Math.hypot(dl, dv, ds));
   }
   return best;
}

/** The air an obstacle of this kind needs between its reach and the line. */
export const clearanceFor = (kind: ObstacleKind) => OBSTACLE_SPEC[kind].r + CARPET_R + SAFE_MARGIN;

function fillRing(path: Path, ring: Ring, scratch: Run["scratch"]): void {
   poseAt(path, ring.s, ring.lat, ring.vert, scratch, ring);
   ring.tx = scratch.t.x;
   ring.ty = scratch.t.y;
   ring.tz = scratch.t.z;
   ring.rx = scratch.r.x;
   ring.ry = scratch.r.y;
   ring.rz = scratch.r.z;
   // the lane's up = right x tangent (right is the pilot's right, so (right, up, tangent) is left-handed)
   const ux = scratch.r.y * scratch.t.z - scratch.r.z * scratch.t.y;
   const uy = scratch.r.z * scratch.t.x - scratch.r.x * scratch.t.z;
   const uz = scratch.r.x * scratch.t.y - scratch.r.y * scratch.t.x;
   const len = Math.hypot(ux, uy, uz) || 1;
   ring.ux = ux / len;
   ring.uy = uy / len;
   ring.uz = uz / len;
}

function pickupAt(run: Run, s: number, lat: number, vert: number, gap: number): Pickup {
   const p: Pickup = { s, lat, vert, x: 0, y: 0, z: 0, taken: false, gap };
   poseAt(run.path, s, lat, vert, run.scratch, p);
   return p;
}

export function createRun(seed: number, level: CarpetLevel, levelId: LevelId): Run {
   const rng = createRng(seed);
   const scratch = { p: { x: 0, y: 0, z: 0 }, t: { x: 0, y: 0, z: 1 }, r: { x: 1, y: 0, z: 0 }, a: { x: 0, y: 0, z: 0 } };
   const path = buildPath(rng, level);
   const run: Run = {
      levelId,
      level,
      seed,
      path,
      s: 0,
      lat: 0,
      vert: 0,
      vLat: 0,
      vVert: 0,
      boostT: 0,
      mercy: 0,
      carpet: { x: 0, y: 0, z: 0 },
      prev: { x: 0, y: 0, z: 0 },
      yaw: 0,
      climb: 0,
      roll: 0,
      pitch: 0,
      rings: [],
      coins: [],
      gems: [],
      boosts: [],
      obstacles: [],
      bumps: [],
      ringsPassed: 0,
      chain: 0,
      bestChain: 0,
      coinsTaken: 0,
      gemsTaken: 0,
      nextRing: 0,
      lives: LIVES,
      score: 0,
      time: 0,
      over: null,
      uncapped: 0,
      synced: { rings: -1, combo: -1, gems: -1, progress: -1, boost: -1, need: -1 },
      scratch,
   };

   // rings: evenly along the lane, each off the lane's centre (an idle carpet passes none)
   const n = level.rings;
   const gapLen = level.length / (n + 1);
   for (let i = 0; i < n; i++) {
      let lat = 0;
      let vert = 0;
      for (let tries = 0; tries < 50; tries++) {
         lat = Math.round((rng() * 2 - 1) * 420) / 100;
         vert = Math.round((rng() * 2 - 1) * 220) / 100;
         if (Math.hypot(lat, vert) >= 2.2) break;
      }
      if (Math.hypot(lat, vert) < 2.2) lat = lat < 0 ? -3 : 3;
      const ring: Ring = { s: gapLen * (i + 1), lat, vert, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, taken: false, missed: false };
      fillRing(path, ring, scratch);
      run.rings.push(ring);
   }
   // each gap's arc, kept inside the lane
   for (let i = 0; i < n - 1; i++) {
      const mid = (run.rings[i].vert + run.rings[i + 1].vert) / 2;
      let bump = (rng() < 0.5 ? -1 : 1) * (0.8 + rng() * 1.0);
      if (Math.abs(mid + bump) > CORR_Y - 0.6) bump = -bump;
      run.bumps.push(Math.round(bump * 100) / 100);
   }

   // coins: an arc on the racing line in every gap
   for (let g = 0; g < n - 1; g++) {
      const a = run.rings[g].s;
      const b = run.rings[g + 1].s;
      for (let c = 0; c < level.coinsPerArc; c++) {
         const u = 0.22 + (0.56 * c) / Math.max(1, level.coinsPerArc - 1);
         const s = a + (b - a) * u;
         lineAt(run, s, LINE);
         run.coins.push(pickupAt(run, s, LINE.lat, LINE.vert, g));
      }
   }

   // gems: off the line in the gem gaps, towards the roomier side (a safe detour: no obstacle there)
   const gemGaps: number[] = [];
   for (let g = 0; g < n - 1; g++) if (isGemGap(g)) gemGaps.push(g);
   for (let i = gemGaps.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = gemGaps[i];
      gemGaps[i] = gemGaps[j];
      gemGaps[j] = t;
   }
   for (const g of gemGaps.slice(0, level.gems).sort((p, q) => p - q)) {
      const s = (run.rings[g].s + run.rings[g + 1].s) / 2;
      lineAt(run, s, LINE);
      const sideways = rng() < 0.6;
      let lat = LINE.lat;
      let vert = LINE.vert;
      if (sideways) lat += (LINE.lat > 0 ? -1 : 1) * 2.8;
      else vert += (LINE.vert > 0 ? -1 : 1) * 2.0;
      run.gems.push(pickupAt(run, s, clamp(lat, -CORR_X + 0.6, CORR_X - 0.6), clamp(vert, -CORR_Y + 0.5, CORR_Y - 0.5), g));
   }

   // boosts: on the line just past a ring, spread over the lane (never the last gap: the finish comes next)
   for (let b = 0; b < level.boosts; b++) {
      const g = Math.min(n - 3, Math.floor(((b + 0.5) * (n - 2)) / level.boosts));
      const s = run.rings[g].s + 6;
      lineAt(run, s, LINE);
      run.boosts.push(pickupAt(run, s, LINE.lat, LINE.vert, g));
   }

   // obstacles: in the obstacle gaps (not the first one), one or two each, every reach clear of the line
   const slots: Array<{ g: number; u: number }> = [];
   for (let g = 1; g < n - 1; g++) if (!isGemGap(g)) slots.push({ g, u: 0.42 }, { g, u: 0.78 });
   // the first copy of each gap first, so the obstacles spread over the lane
   slots.sort((p, q) => p.u - q.u || p.g - q.g);
   const take = slots.slice(0, level.obstacles);
   for (let k = 0; k < take.length; k++) {
      const { g, u } = take[k];
      const kind = level.kinds[Math.floor(rng() * level.kinds.length)];
      const spec = OBSTACLE_SPEC[kind];
      const s = run.rings[g].s + (run.rings[g + 1].s - run.rings[g].s) * u;
      lineAt(run, s, LINE);
      const need = clearanceFor(kind);
      const o: Obstacle = { kind, s, lat0: 0, vert0: 0, phase: rng() * Math.PI * 2, lat: 0, vert: 0, x: 0, y: 0, z: 0, yaw: 0 };
      // beside the line (the side with more lane left) or above / below it, close enough to matter
      const sideways = spec.aLat >= spec.aVert ? rng() < 0.8 : rng() < 0.3;
      const extra = rng() * 0.8;
      if (sideways) {
         const dir = LINE.lat > 0 ? -1 : 1;
         o.lat0 = LINE.lat + dir * (need + spec.aLat + extra);
         o.vert0 = LINE.vert + (rng() * 2 - 1) * 0.8;
      } else {
         const dir = LINE.vert > 0 ? -1 : 1;
         o.vert0 = LINE.vert + dir * (need + spec.aVert + extra);
         o.lat0 = LINE.lat + (rng() * 2 - 1) * 1.0;
      }
      // push it out until its whole reach clears the line over the stretch where they could meet
      for (let tries = 0; tries < 40 && obstacleClearance(run, o) < need; tries++) {
         if (sideways) o.lat0 += o.lat0 >= LINE.lat ? 0.25 : -0.25;
         else o.vert0 += o.vert0 >= LINE.vert ? 0.25 : -0.25;
      }
      run.obstacles.push(o);
   }
   run.obstacles.sort((p, q) => p.s - q.s);

   moveObstacles(run);
   writeCarpet(run);
   run.prev.x = run.carpet.x;
   run.prev.y = run.carpet.y;
   run.prev.z = run.carpet.z;
   return run;
}

// ---------- motion ----------

/** Where obstacle o is at run time t (its offset in the lane). Pure. */
export function obstacleOffset(o: Pick<Obstacle, "kind" | "lat0" | "vert0" | "phase">, t: number, out: { lat: number; vert: number }): { lat: number; vert: number } {
   const spec = OBSTACLE_SPEC[o.kind];
   const w = (Math.PI * 2) / spec.period;
   out.lat = o.lat0 + spec.aLat * Math.sin(w * t + o.phase);
   out.vert = o.vert0 + spec.aVert * Math.sin((spec.eight ? 2 : 1) * w * t + o.phase * 1.7);
   return out;
}

const OFF = { lat: 0, vert: 0 };

function moveObstacles(run: Run): void {
   for (const o of run.obstacles) {
      obstacleOffset(o, run.time, OFF);
      o.lat = OFF.lat;
      o.vert = OFF.vert;
      poseAt(run.path, o.s, o.lat, o.vert, run.scratch, o);
      o.yaw = Math.atan2(run.scratch.t.x, run.scratch.t.z);
   }
}

function writeCarpet(run: Run): void {
   const { scratch } = run;
   poseAt(run.path, run.s, run.lat, run.vert, scratch, run.carpet);
   const h = Math.hypot(scratch.t.x, scratch.t.z) || 1;
   run.yaw = Math.atan2(scratch.t.x, scratch.t.z);
   run.climb = Math.atan2(scratch.t.y, h);
}

function segmentDist(a: Vec3, b: Vec3, x: number, y: number, z: number): number {
   const dx = b.x - a.x;
   const dy = b.y - a.y;
   const dz = b.z - a.z;
   const l2 = dx * dx + dy * dy + dz * dz;
   const t = l2 > 0 ? clamp(((x - a.x) * dx + (y - a.y) * dy + (z - a.z) * dz) / l2, 0, 1) : 0;
   return Math.hypot(a.x + dx * t - x, a.y + dy * t - y, a.z + dz * t - z);
}

/** In-plane distance from the ring's centre where the segment crosses its plane going forward, else null. */
export function planeGap(a: Vec3, b: Vec3, ring: Ring): number | null {
   const da = (a.x - ring.x) * ring.tx + (a.y - ring.y) * ring.ty + (a.z - ring.z) * ring.tz;
   const db = (b.x - ring.x) * ring.tx + (b.y - ring.y) * ring.ty + (b.z - ring.z) * ring.tz;
   if (!(da < 0 && db >= 0)) return null;
   const u = da === db ? 1 : -da / (db - da);
   const dx = a.x + (b.x - a.x) * u - ring.x;
   const dy = a.y + (b.y - a.y) * u - ring.y;
   const dz = a.z + (b.z - a.z) * u - ring.z;
   const along = dx * ring.tx + dy * ring.ty + dz * ring.tz;
   return Math.hypot(dx - ring.tx * along, dy - ring.ty * along, dz - ring.tz * along);
}

export const createEvent = (): StepEvent => ({ score: 0, ring: -1, coin: -1, gem: -1, boost: -1, hit: -1, missedRing: false, lifeLost: false, won: false, lost: false });
const EVENT = createEvent();

/** Ring points for the k-th ring of an unbroken chain. */
export const ringValue = (chain: number) => RING_POINTS + COMBO_STEP * Math.min(Math.max(0, chain - 1), COMBO_MAX - 1);

/**
 * One frame of flight (dt = the run clock's play time). `timeLeftMs` is the shell clock (the win's
 * time bonus). Mutates `run`; returns a shared event (valid until the next call).
 */
export function step(run: Run, input: CarpetInput, dt: number, timeLeftMs: number): StepEvent {
   const ev = EVENT;
   ev.score = 0;
   ev.ring = ev.coin = ev.gem = ev.boost = ev.hit = -1;
   ev.missedRing = ev.lifeLost = ev.won = ev.lost = false;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;
   if (run.mercy > 0) run.mercy = Math.max(0, run.mercy - dt);
   if (run.boostT > 0) run.boostT = Math.max(0, run.boostT - dt);

   // steering: the drift eases towards the stick, the lane's walls stop it (up on the stick = up)
   const k = Math.min(1, STEER_RATE * dt);
   run.vLat += (clamp(input.moveX, -1, 1) * LAT_SPEED - run.vLat) * k;
   run.vVert += (clamp(-input.moveY, -1, 1) * VERT_SPEED - run.vVert) * k;
   run.lat += run.vLat * dt;
   run.vert += run.vVert * dt;
   if (run.lat > CORR_X || run.lat < -CORR_X) {
      run.lat = clamp(run.lat, -CORR_X, CORR_X);
      run.vLat = 0;
   }
   if (run.vert > CORR_Y || run.vert < -CORR_Y) {
      run.vert = clamp(run.vert, -CORR_Y, CORR_Y);
      run.vVert = 0;
   }
   // banked into the drift: a slide to the right dips the right edge (a positive roll about the heading)
   run.roll = BANK_MAX * clamp(run.vLat / LAT_SPEED, -1, 1);
   run.pitch = PITCH_MAX * clamp(run.vVert / VERT_SPEED, -1, 1);

   // forward
   run.prev.x = run.carpet.x;
   run.prev.y = run.carpet.y;
   run.prev.z = run.carpet.z;
   const speed = run.level.speed * (run.boostT > 0 ? BOOST_MUL : 1);
   run.s = Math.min(run.path.total, run.s + speed * dt);
   writeCarpet(run);
   moveObstacles(run);

   const a = run.prev;
   const b = run.carpet;
   const near = (s: number) => s > run.s - 30 && s < run.s + 30;

   // rings: a cross inside PASS_R pays and chains; one passed by breaks the chain
   for (let i = 0; i < run.rings.length; i++) {
      const ring = run.rings[i];
      if (ring.taken || ring.missed || !near(ring.s)) continue;
      const gap = planeGap(a, b, ring);
      if (gap !== null && gap <= PASS_R) {
         ring.taken = true;
         run.ringsPassed++;
         run.chain++;
         run.bestChain = Math.max(run.bestChain, run.chain);
         const pts = ringValue(run.chain);
         run.score += pts;
         ev.score += pts;
         ev.ring = i;
      } else if (run.s > ring.s + 0.5) {
         ring.missed = true;
         run.chain = 0;
         ev.missedRing = true;
      }
   }
   for (let i = 0; i < run.coins.length; i++) {
      const c = run.coins[i];
      if (c.taken || !near(c.s) || segmentDist(a, b, c.x, c.y, c.z) > COIN_R) continue;
      c.taken = true;
      run.coinsTaken++;
      run.score += COIN_POINTS;
      ev.score += COIN_POINTS;
      ev.coin = i;
   }
   for (let i = 0; i < run.gems.length; i++) {
      const g = run.gems[i];
      if (g.taken || !near(g.s) || segmentDist(a, b, g.x, g.y, g.z) > GEM_R) continue;
      g.taken = true;
      run.gemsTaken++;
      run.score += GEM_POINTS;
      ev.score += GEM_POINTS;
      ev.gem = i;
   }
   for (let i = 0; i < run.boosts.length; i++) {
      const p = run.boosts[i];
      if (p.taken || !near(p.s) || segmentDist(a, b, p.x, p.y, p.z) > BOOST_R) continue;
      p.taken = true;
      run.boostT = BOOST_S;
      ev.boost = i;
   }
   if (run.mercy <= 0) {
      for (let i = 0; i < run.obstacles.length; i++) {
         const o = run.obstacles[i];
         if (!near(o.s)) continue;
         if (segmentDist(a, b, o.x, o.y, o.z) > OBSTACLE_SPEC[o.kind].r + CARPET_R) continue;
         run.lives--;
         run.mercy = MERCY;
         run.chain = 0;
         ev.hit = i;
         ev.lifeLost = true;
         if (run.lives <= 0) {
            run.over = "lose";
            ev.lost = true;
            return ev;
         }
         break;
      }
   }

   run.nextRing = run.rings.findIndex((r) => !r.taken && !r.missed);

   // the end of the lane: the quota clears it
   if (run.s >= run.path.total - 1e-6) {
      if (run.ringsPassed >= run.level.ringQuota) {
         const raw = run.score + FINISH_BONUS + LIFE_BONUS * run.lives + TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
         run.uncapped = raw;
         // a no-op for every honest run (tests); only a forged clock could reach the cap
         const total = capScore(raw, Math.round(run.time * 1000), PROPOSED_LEVEL_LIMITS[run.levelId]);
         ev.score += total - run.score;
         run.score = total;
         run.over = "win";
         ev.won = true;
      } else {
         run.over = "lose";
         ev.lost = true;
      }
   }
   return ev;
}

/** How far along the lane (0..100). */
export const progressOf = (run: Run) => Math.round((run.s / run.path.total) * 100);

/** The store side of one frame, exactly as the Scene does it (and the bots in the tests). */
export function syncStore(run: Run, ev: StepEvent, store: StoreApi<ArcadeStore>): void {
   const s = store.getState();
   if (ev.score) s.addScore(ev.score);
   const progress = progressOf(run);
   const boost = run.boostT > 0 ? 1 : 0;
   if (run.synced.rings !== run.ringsPassed) s.setStat("rings", (run.synced.rings = run.ringsPassed));
   if (run.synced.combo !== run.chain) s.setStat("combo", (run.synced.combo = run.chain));
   if (run.synced.gems !== run.gemsTaken) s.setStat("gems", (run.synced.gems = run.gemsTaken));
   if (run.synced.progress !== progress) s.setStat("progress", (run.synced.progress = progress));
   if (run.synced.boost !== boost) s.setStat("boost", (run.synced.boost = boost));
   const need = Math.max(0, run.level.ringQuota - run.ringsPassed);
   if (run.synced.need !== need) s.setStat("need", (run.synced.need = need));
   if (ev.lifeLost && !ev.lost) s.loseLife();
   if (ev.won) s.end("win");
   else if (ev.lost) {
      if (ev.lifeLost) s.loseLife();
      else s.end("lose");
   }
}
