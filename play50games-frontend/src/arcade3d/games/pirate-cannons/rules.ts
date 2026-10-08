// Pirate Cannon Battle rules: the seeded waves (ships, wind, powder barrels, the chest), the fixed
// 120 Hz tick, the cannon's muzzle and its balls (core ballistics, closed form), ships on their lanes
// (core path), hits, barrel chains, the island, the harbour and the score. Pure and deterministic:
// no three.js, React, DOM, Math.random or Date.now. Scene.tsx feeds it the aim, fire presses and dt
// every frame; rules.test.ts drives it directly. Same seed = same run.
//
// Units: metres, seconds, radians; x right, z towards the camera (the sea is -z), y up, the water is
// y 0. README.md "Server limits and why they hold" proves the limits from the numbers below.
import { trajectoryPoints, type BallisticParams, type Projectile } from "@/arcade3d/core/ballistics";
import { spheresOverlap, type Vec3Like } from "@/arcade3d/core/collision";
import { createFixedStep, fixedStep, type FixedStepState } from "@/arcade3d/core/kinematics";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { advance, createPath, tangentAt, type Path, type RiderState } from "@/arcade3d/core/path";
import { EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { pirateCannonsMeta } from "./meta";

const DEG = Math.PI / 180;

// ---------- tuning ----------

export const DURATION_MS = 90_000;
export const LIVES = 3;
export const TICK = 1 / 120;

export const WORLD = { gravity: 9.8, muzzleSpeed: 28, ballRadius: 0.25 } as const;

/**
 * The cannon on the fort platform. The model tips about its axle (the wheel centre); the muzzle is
 * the measured point (EXPANSION_GLB_POINTS.cannonMuzzle) minus the axle, in metres at the default
 * 1.6 m fit, turned by (yaw, elevation - the GLB's own barrel angle).
 */
export const CANNON = {
   x: 0,
   z: 0,
   platformY: 2.2,
   reloadS: 1.2,
   /** the default fit: 1.6 m long */
   scale: 1.6 / EXPANSION_GLB_SIZE.cannon.depth,
   /** the wheel centre in GLB units (measured: wheels span y 0-0.79, z -0.59-0.65) */
   axleGlb: { y: 0.395, z: 0.03 },
   /** the barrel's own tilt in the GLB (rear y 0.78 at z -0.8, muzzle y 1.036 at z 0.949): 8.4° */
   barrelAngle: 8.4 * DEG,
} as const;
/** The axle's height (m): the platform plus the wheel centre. */
export const PIVOT_Y = CANNON.platformY + CANNON.axleGlb.y * CANNON.scale;
/** The muzzle relative to the axle, in the model's frame at the default fit (m; +z = the barrel). */
export const MUZZLE_ARM = {
   y: (EXPANSION_GLB_POINTS.cannonMuzzle.y - CANNON.axleGlb.y) * CANNON.scale,
   z: (EXPANSION_GLB_POINTS.cannonMuzzle.z - CANNON.axleGlb.z) * CANNON.scale,
} as const;

export type ShipType = "dinghy" | "sloop" | "galleon";
export interface ShipSpec {
   length: number;
   /** of the sloop's 6 m fit */
   scale: number;
   hp: number;
   speed: number;
   /** hit spheres: offsets along the heading, radius, centre height */
   spheres: readonly number[];
   r: number;
   y: number;
   /** zig-zag amplitude (m in z); the sloop's only from ZIG.sloopFromWave */
   zig: number;
}
export const SHIPS: Record<ShipType, ShipSpec> = {
   dinghy: { length: 3, scale: 0.5, hp: 1, speed: 4, spheres: [-0.7, 0.7], r: 0.7, y: 0.35, zig: 0 },
   sloop: { length: 6, scale: 1, hp: 2, speed: 2.8, spheres: [-1.9, 0, 1.9], r: 1.15, y: 0.55, zig: 1.5 },
   galleon: { length: 9, scale: 1.5, hp: 3, speed: 2, spheres: [-2.85, 0, 2.85], r: 1.7, y: 0.8, zig: 3 },
};
export const SHIP_TYPES: readonly ShipType[] = ["dinghy", "sloop", "galleon"];

/** Lanes (z) and the bonus for sinking a ship on each. */
export const LANES = [-25, -40, -55] as const;
export const LANE_BONUS = [0, 50, 100] as const;

export const SEA = {
   /** a ship spawns with its bow here (1 m outside SEA_BOX, in view within 0.5 s) */
   spawnBowX: -20,
   /** the harbour buoy line: a live ship whose centre crosses it costs a life */
   harbourX: 18,
   /** ships sail on past the buoys (opaque, no fade) to here, then are gone */
   endX: 30,
   /** same-lane gap (m, stern to bow): closer than this, a ship matches the speed of the ship ahead */
   gap: 4,
   maxAlive: 8,
} as const;

export const ZIG = { period: 16, sloopFromWave: 4, flatHalf: 6, ease: 4 } as const;

export interface WaveSpec {
   start: number;
   speed: number;
   span: number;
   /** max wind (m/s²) */
   wind: number;
   types: readonly ShipType[];
   /** lane indices (0 = 25 m, 1 = 40 m, 2 = 55 m) */
   lanes: readonly number[];
}
export const WAVES: readonly WaveSpec[] = [
   { start: 0, speed: 1.0, span: 16, wind: 1.0, types: ["sloop", "sloop", "dinghy"], lanes: [0, 0, 1] },
   { start: 20, speed: 1.1, span: 16, wind: 1.5, types: ["sloop", "sloop", "dinghy", "galleon"], lanes: [0, 1, 1, 2] },
   { start: 40, speed: 1.2, span: 16, wind: 2.0, types: ["sloop", "sloop", "dinghy", "dinghy", "galleon"], lanes: [0, 1, 1, 2, 2] },
   { start: 60, speed: 1.3, span: 16, wind: 2.5, types: ["galleon", "galleon", "sloop", "sloop", "dinghy", "dinghy"], lanes: [0, 0, 1, 1, 2, 2] },
   { start: 80, speed: 1.4, span: 8, wind: 3.0, types: ["galleon", "sloop", "dinghy", "dinghy"], lanes: [0, 1, 2, 2] },
];
export const SPAWN_JITTER = 1.5;
export const SHIP_COUNT = WAVES.reduce((n, w) => n + w.types.length, 0);

/**
 * Powder barrels: a pair per wave, `delay` after its start, the leader at `startX + pairGap` and the
 * trailer at `startX` on the same line, drifting +x together; a hit blasts ships within `radius` +
 * their sphere and sets off the other barrel of the pair (`pairGap` < `radius`: every pair chains).
 * The pair leaves together when its leader reaches `endX`, so one shot always takes both (README proof).
 */
export const BARREL = { delay: 2, startX: -18, pairGap: 4.5, endX: 18, speed: 0.6, r: 0.6, y: 0.2, radius: 6, chainDelay: 0.15, offset: [3, -3, 3] } as const;
/** The chest: once per run, spawned at a seeded time in [minS, maxS] on lane 40 or 55. */
export const CHEST = { minS: 30, maxS: 60, startX: -18, endX: 18, speed: 1.6, r: 0.6, y: 0.25 } as const;

/** The island: a mound and two palms (trunks as cylinders, crowns as spheres); a ball touching any is a miss. */
export const ISLAND = {
   x: -7,
   z: -33,
   r: 3.5,
   h: 0.9,
   palms: [
      { x: -8.2, z: -33.6 },
      { x: -5.6, z: -32.2 },
   ],
   trunkR: 0.3,
   trunkTop: 2.6,
   crownR: 1.3,
   crownY: 3.0,
} as const;

export const POINTS = { hit: 100, chainPerShip: 100, chainMax: 300, chest: 300, combo: 1.5, comboFrom: 3 } as const;

// ---------- the plan (the seeded part) ----------

export interface ShipPlan {
   type: ShipType;
   lane: number;
   wave: number;
   spawnAt: number;
}
export interface WavePlan {
   wind: { x: number; z: number };
   strength: number;
   /** wind direction, radians from +x towards -z (so 90° blows out to sea) */
   dir: number;
}
export interface Plan {
   seed: number;
   ships: ShipPlan[];
   waves: WavePlan[];
   /** two per wave: the leader (even index) then its trailer */
   barrels: Array<{ spawnAt: number; lane: number; z: number; x: number }>;
   chest: { spawnAt: number; lane: number };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
   const out = items.slice();
   for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
   }
   return out;
}

/** The run's seeded plan: each wave's ship order, lanes, spawn jitter and wind; the barrels and the chest. */
export function generatePlan(seed: number): Plan {
   const rng = createRng(seed);
   const ships: ShipPlan[] = [];
   const waves: WavePlan[] = [];
   const barrels: Plan["barrels"] = [];
   WAVES.forEach((w, wave) => {
      const types = shuffle(w.types, rng);
      const lanes = shuffle(w.lanes, rng);
      types.forEach((type, i) => {
         ships.push({ type, lane: lanes[i], wave, spawnAt: w.start + (i * w.span) / types.length + rng() * SPAWN_JITTER });
      });
      const dir = rng() * Math.PI * 2;
      const strength = w.wind * (0.5 + 0.5 * rng());
      waves.push({ dir, strength, wind: { x: Math.cos(dir) * strength, z: -Math.sin(dir) * strength } });
      const lane = Math.floor(rng() * LANES.length);
      const z = LANES[lane] + BARREL.offset[lane];
      barrels.push({ spawnAt: w.start + BARREL.delay, lane, z, x: BARREL.startX + BARREL.pairGap });
      barrels.push({ spawnAt: w.start + BARREL.delay, lane, z, x: BARREL.startX });
   });
   const chest = { spawnAt: CHEST.minS + rng() * (CHEST.maxS - CHEST.minS), lane: 1 + Math.floor(rng() * 2) };
   return { seed, ships, waves, barrels, chest };
}

// ---------- geometry ----------

/** The zig-zag's weight at x: 0 within ZIG.flatHalf of the island, eased back to 1 over ZIG.ease (island rule). */
export function zigWeight(x: number): number {
   const d = Math.abs(x - ISLAND.x) - ZIG.flatHalf;
   if (d <= 0) return 0;
   if (d >= ZIG.ease) return 1;
   const k = d / ZIG.ease;
   return k * k * (3 - 2 * k);
}

/** A ship's zig-zag amplitude (m). */
export function zigAmplitude(type: ShipType, wave: number): number {
   if (type === "galleon") return SHIPS.galleon.zig;
   if (type === "sloop" && wave + 1 >= ZIG.sloopFromWave) return SHIPS.sloop.zig;
   return 0;
}

/** The ship's course: from the spawn (bow at SEA.spawnBowX) to SEA.endX, zig-zagging around its lane (1 m polyline). */
export function shipPath(type: ShipType, lane: number, wave: number): Path {
   const half = SHIPS[type].length / 2;
   const x0 = SEA.spawnBowX - half;
   const z = LANES[lane];
   const amp = zigAmplitude(type, wave);
   if (amp === 0) return createPath([{ x: x0, y: 0, z }, { x: SEA.endX, y: 0, z }]);
   const points: Vec3Like[] = [];
   for (let x = x0; x < SEA.endX; x += 1) {
      // eased in over the first ZIG.ease m, so a ship enters the view heading straight in at full speed
      const k = Math.min(1, (x - x0) / ZIG.ease);
      points.push({ x, y: 0, z: z + amp * k * k * (3 - 2 * k) * zigWeight(x) * Math.sin(((x - x0) * 2 * Math.PI) / ZIG.period) });
   }
   points.push({ x: SEA.endX, y: 0, z });
   return createPath(points);
}

/** Where the muzzle is for an aim (yaw: + = right, elevation above level). */
export function muzzleAt(yaw: number, elevation: number, out: Vec3Like): Vec3Like {
   const tilt = elevation - CANNON.barrelAngle;
   // the arm in the yawed frame: forward f, up u
   const f = MUZZLE_ARM.z * Math.cos(tilt) - MUZZLE_ARM.y * Math.sin(tilt);
   const u = MUZZLE_ARM.z * Math.sin(tilt) + MUZZLE_ARM.y * Math.cos(tilt);
   out.x = CANNON.x + f * Math.sin(yaw);
   out.y = PIVOT_Y + u;
   out.z = CANNON.z - f * Math.cos(yaw);
   return out;
}

/** The launch state (muzzle and velocity) for an aim, written into `out`. */
export function launchState(yaw: number, elevation: number, out: Projectile): Projectile {
   muzzleAt(yaw, elevation, out);
   const s = WORLD.muzzleSpeed;
   out.vx = s * Math.sin(yaw) * Math.cos(elevation);
   out.vy = s * Math.sin(elevation);
   out.vz = -s * Math.cos(yaw) * Math.cos(elevation);
   return out;
}

/** Does a ball (centre, radius) touch the island's mound, a trunk or a crown? */
export function hitsIsland(x: number, y: number, z: number, r: number = WORLD.ballRadius): boolean {
   const d = Math.hypot(x - ISLAND.x, z - ISLAND.z);
   if (d > ISLAND.r + ISLAND.crownR + r) return false;
   if (d < ISLAND.r + r) {
      const k = Math.min(1, d / ISLAND.r);
      if (y - r < ISLAND.h * (1 - k * k)) return true;
   }
   for (const p of ISLAND.palms) {
      const h = Math.hypot(x - p.x, z - p.z);
      if (h < ISLAND.trunkR + r && y - r < ISLAND.trunkTop) return true;
      if (Math.hypot(h, y - ISLAND.crownY) < ISLAND.crownR + r) return true;
   }
   return false;
}

// ---------- the run ----------

export const SHIP_PENDING = 0;
export const SHIP_SAILING = 1;
export const SHIP_SUNK = 2;
export const SHIP_ARRIVED = 3;
export const SHIP_GONE = 4;

export interface Ship extends ShipPlan {
   index: number;
   spec: ShipSpec;
   state: number;
   hp: number;
   /** the base speed (type x the wave's factor) and this tick's (gap rule) */
   speed: number;
   current: number;
   rider: RiderState;
   /** heading (unit, xz) */
   hx: number;
   hz: number;
   /** when it sank or reached the harbour (rules time) */
   at: number;
}

export interface Ball {
   active: boolean;
   shot: number;
   launch: Projectile;
   params: BallisticParams & { wind: { x: number; z: number } };
   ticks: number;
   x: number;
   y: number;
   z: number;
}

export interface Shot {
   active: boolean;
   id: number;
   ballDone: boolean;
   damaged: number;
   /** ships this shot damaged (bit per ship index) */
   mask: number;
   bonus: number;
   barrel: boolean;
   chest: boolean;
   /** barrels still on their fuse */
   pending: number;
   x: number;
   y: number;
   z: number;
}

export const BARREL_PENDING = 0;
export const BARREL_FLOATING = 1;
export const BARREL_FUSE = 2;
export const BARREL_GONE = 3;

export interface Barrel {
   state: number;
   spawnAt: number;
   lane: number;
   x: number;
   z: number;
   /** the pair's leader x minus this barrel's (0 for the leader): the pair leaves when the leader reaches BARREL.endX */
   lag: number;
   fuseAt: number;
   shot: number;
}

export interface Chest {
   state: number;
   spawnAt: number;
   lane: number;
   x: number;
   z: number;
}

export interface HitEvent {
   ship: number;
   /** the rules tick of the hit */
   tick: number;
   sunk: boolean;
   x: number;
   y: number;
   z: number;
}
export interface PointEvent {
   x: number;
   y: number;
   z: number;
}
export interface ScoreEvent extends PointEvent {
   points: number;
   combo: boolean;
   chain: number;
   chest: boolean;
}

export interface Events {
   fired: number;
   hits: HitEvent[];
   hitCount: number;
   splashes: PointEvent[];
   splashCount: number;
   /** of the splashes, how many were the island (sand / leaf puffs), the rest water */
   islandFlags: boolean[];
   blasts: PointEvent[];
   blastCount: number;
   scores: ScoreEvent[];
   scoreCount: number;
   chestHit: boolean;
   harbour: number;
   /** a wave started this frame (its number 1-5), else 0 */
   wave: number;
}

export interface RunState {
   plan: Plan;
   time: number;
   ticks: number;
   clock: FixedStepState;
   tick: (step: number) => void;
   wave: number;
   wind: { x: number; z: number };
   aimYaw: number;
   aimEl: number;
   /** a fire is waiting for the reload, with the aim of its press (a later drag does not change it) */
   buffered: boolean;
   bufYaw: number;
   bufEl: number;
   reload: number;
   ships: Ship[];
   balls: Ball[];
   shots: Shot[];
   nextShot: number;
   barrels: Barrel[];
   chest: Chest;
   streak: number;
   score: number;
   harbour: number;
   events: Events;
   scratch: Float32Array;
   launch: Projectile;
}

const BALL_POOL = 4;
const SHOT_POOL = 8;
const EVENT_CAP = 16;

const points = (n: number): PointEvent[] => Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));

export function createRun(seed: number): RunState {
   const plan = generatePlan(seed);
   const ships: Ship[] = plan.ships.map((p, index) => {
      const spec = SHIPS[p.type];
      const path = shipPath(p.type, p.lane, p.wave);
      return {
         ...p,
         index,
         spec,
         state: SHIP_PENDING,
         hp: spec.hp,
         speed: spec.speed * WAVES[p.wave].speed,
         current: 0,
         rider: { path, s: 0, position: { x: path.points[0].x, y: 0, z: path.points[0].z }, overflow: 0 },
         hx: 1,
         hz: 0,
         at: 0,
      };
   });
   const run: RunState = {
      plan,
      time: 0,
      ticks: 0,
      clock: createFixedStep(TICK),
      tick: () => {},
      wave: 0,
      // the first wave's wind already shows during the countdown (the preview and the HUD)
      wind: { x: plan.waves[0].wind.x, z: plan.waves[0].wind.z },
      aimYaw: 0,
      aimEl: 0,
      buffered: false,
      bufYaw: 0,
      bufEl: 0,
      reload: 0,
      ships,
      balls: Array.from({ length: BALL_POOL }, () => ({
         active: false,
         shot: -1,
         launch: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
         params: { gravity: WORLD.gravity, wind: { x: 0, z: 0 } },
         ticks: 0,
         x: 0,
         y: 0,
         z: 0,
      })),
      shots: Array.from({ length: SHOT_POOL }, () => ({ active: false, id: 0, ballDone: false, damaged: 0, mask: 0, bonus: 0, barrel: false, chest: false, pending: 0, x: 0, y: 0, z: 0 })),
      nextShot: 1,
      barrels: plan.barrels.map((b, i) => ({ state: BARREL_PENDING, spawnAt: b.spawnAt, lane: b.lane, x: b.x, z: b.z, lag: i % 2 ? BARREL.pairGap : 0, fuseAt: 0, shot: -1 })),
      chest: { state: 0, spawnAt: plan.chest.spawnAt, lane: plan.chest.lane, x: CHEST.startX, z: LANES[plan.chest.lane] },
      streak: 0,
      score: 0,
      harbour: 0,
      events: {
         fired: 0,
         hits: Array.from({ length: EVENT_CAP }, () => ({ ship: 0, tick: 0, sunk: false, x: 0, y: 0, z: 0 })),
         hitCount: 0,
         splashes: points(EVENT_CAP),
         splashCount: 0,
         islandFlags: new Array<boolean>(EVENT_CAP).fill(false),
         blasts: points(EVENT_CAP),
         blastCount: 0,
         scores: Array.from({ length: EVENT_CAP }, () => ({ x: 0, y: 0, z: 0, points: 0, combo: false, chain: 0, chest: false })),
         scoreCount: 0,
         chestHit: false,
         harbour: 0,
         wave: 0,
      },
      scratch: new Float32Array(6),
      launch: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
   };
   run.tick = (step: number) => tick(run, step);
   return run;
}

/** The current wind as BallisticParams (for the preview). */
export function windParams(run: RunState, out: BallisticParams & { wind: { x: number; z: number } }): BallisticParams {
   out.gravity = WORLD.gravity;
   out.wind.x = run.wind.x;
   out.wind.z = run.wind.z;
   return out;
}

function resetEvents(ev: Events): void {
   ev.fired = 0;
   ev.hitCount = 0;
   ev.splashCount = 0;
   ev.blastCount = 0;
   ev.scoreCount = 0;
   ev.chestHit = false;
   ev.harbour = 0;
   ev.wave = 0;
}

/**
 * One frame: store the aim, buffer a fire with this frame's aim (one at a time: a press while one
 * waits is ignored, so the shot goes where the player released it), then run whole 1/120 s ticks
 * (the leftover carries).
 * `dt` is useRunFrame's (≤ 1/20 s, so ≤ 6 ticks: fixedStep's cap of 8 never drops one).
 */
export function advanceRun(run: RunState, dt: number, yaw: number, elevation: number, fire: boolean): void {
   resetEvents(run.events);
   run.aimYaw = yaw;
   run.aimEl = elevation;
   if (fire && !run.buffered) {
      run.buffered = true;
      run.bufYaw = yaw;
      run.bufEl = elevation;
   }
   fixedStep(run.clock, dt, run.tick);
}

/** The ship's hit sphere k centre (x, z on the water plane at its height). */
export function sphereCentre(ship: Ship, k: number, out: Vec3Like): Vec3Like {
   const o = ship.spec.spheres[k];
   out.x = ship.rider.position.x + ship.hx * o;
   out.y = ship.spec.y;
   out.z = ship.rider.position.z + ship.hz * o;
   return out;
}

const SPH = { x: 0, y: 0, z: 0 };
const BALL = { x: 0, y: 0, z: 0 };
const TAN = { x: 0, y: 0, z: 0 };
const OBJ = { x: 0, y: 0, z: 0 };

const sailing = (s: Ship) => s.state === SHIP_SAILING;
const bowX = (s: Ship) => s.rider.position.x + (s.hx * s.spec.length) / 2;
const sternX = (s: Ship) => s.rider.position.x - (s.hx * s.spec.length) / 2;

function aliveCount(run: RunState): number {
   let n = 0;
   for (const s of run.ships) if (sailing(s)) n++;
   return n;
}

/** Is the spawn of a ship on `lane` clear (no sailing ship's stern within the gap of the spawn bow)? */
function laneClear(run: RunState, lane: number): boolean {
   for (const s of run.ships) if (sailing(s) && s.lane === lane && sternX(s) < SEA.spawnBowX + SEA.gap) return false;
   return true;
}

function tick(run: RunState, step: number): void {
   run.ticks++;
   run.time = run.ticks * TICK;
   const t = run.time;
   const ev = run.events;

   // waves: the wind changes at each start
   while (run.wave < WAVES.length && t >= WAVES[run.wave].start) {
      const w = run.plan.waves[run.wave];
      run.wind.x = w.wind.x;
      run.wind.z = w.wind.z;
      run.wave++;
      ev.wave = run.wave;
   }

   stepShips(run, step);
   stepFloaters(run, step);

   // fire: a buffered shot goes off when the reload is over, with the aim of its press
   run.reload = Math.max(0, run.reload - step);
   if (run.buffered && run.reload <= 0) launchBall(run);

   for (const ball of run.balls) if (ball.active) stepBall(run, ball);

   // barrel fuses (chain blasts)
   for (const b of run.barrels) if (b.state === BARREL_FUSE && t >= b.fuseAt - 1e-9) blast(run, b, run.shots[b.shot]);

   resolveShots(run);
}

function stepShips(run: RunState, step: number): void {
   const t = run.time;
   const ev = run.events;
   let alive = aliveCount(run);
   for (const s of run.ships) {
      if (s.state === SHIP_PENDING && t >= s.spawnAt && alive < SEA.maxAlive && laneClear(run, s.lane)) {
         s.state = SHIP_SAILING;
         s.current = s.speed;
         alive++;
      }
   }
   // the gap rule reads the ship ahead's speed of the previous tick (deterministic, order-free)
   for (const s of run.ships) {
      if (s.state !== SHIP_SAILING && s.state !== SHIP_ARRIVED) continue;
      let speed = s.speed;
      if (s.state === SHIP_SAILING) {
         let ahead: Ship | null = null;
         for (const o of run.ships) {
            if (o === s || !sailing(o) || o.lane !== s.lane || o.rider.position.x <= s.rider.position.x) continue;
            if (!ahead || o.rider.position.x < ahead.rider.position.x) ahead = o;
         }
         // match the x speed of the ship ahead (a zig-zag course makes less headway than its speed)
         if (ahead && sternX(ahead) - bowX(s) < SEA.gap) speed = Math.min(speed, (ahead.current * ahead.hx) / Math.max(s.hx, 0.1));
      }
      s.current = speed;
   }
   for (const s of run.ships) {
      if (s.state !== SHIP_SAILING && s.state !== SHIP_ARRIVED) continue;
      advance(s.rider, s.current * step);
      tangentAt(s.rider.path, s.rider.s, TAN);
      const len = Math.hypot(TAN.x, TAN.z) || 1;
      s.hx = TAN.x / len;
      s.hz = TAN.z / len;
      if (s.state === SHIP_SAILING && s.rider.position.x >= SEA.harbourX) {
         s.state = SHIP_ARRIVED;
         s.at = t;
         run.harbour++;
         ev.harbour++;
      } else if (s.state === SHIP_ARRIVED && s.rider.s >= s.rider.path.total - 1e-6) s.state = SHIP_GONE;
   }
}

function stepFloaters(run: RunState, step: number): void {
   const t = run.time;
   for (const b of run.barrels) {
      if (b.state === BARREL_PENDING && t >= b.spawnAt) b.state = BARREL_FLOATING;
      if (b.state !== BARREL_FLOATING) continue;
      b.x += BARREL.speed * step;
      if (b.x + b.lag >= BARREL.endX) b.state = BARREL_GONE;
   }
   const c = run.chest;
   if (c.state === 0 && t >= c.spawnAt) c.state = 1;
   if (c.state === 1) {
      c.x += CHEST.speed * step;
      if (c.x >= CHEST.endX) c.state = 2;
   }
}

function launchBall(run: RunState): void {
   const ball = run.balls.find((b) => !b.active);
   const shot = run.shots.find((s) => !s.active);
   if (!ball || !shot) return;
   run.buffered = false;
   run.reload = CANNON.reloadS;
   shot.active = true;
   shot.id = run.nextShot++;
   shot.ballDone = false;
   shot.damaged = 0;
   shot.mask = 0;
   shot.bonus = 0;
   shot.barrel = false;
   shot.chest = false;
   shot.pending = 0;
   ball.active = true;
   ball.shot = run.shots.indexOf(shot);
   ball.ticks = 0;
   launchState(run.bufYaw, run.bufEl, ball.launch);
   ball.params.wind.x = run.wind.x;
   ball.params.wind.z = run.wind.z;
   ball.x = ball.launch.x;
   ball.y = ball.launch.y;
   ball.z = ball.launch.z;
   run.events.fired++;
}

/** The ball's position `t` s after launch (core's exact closed form; y 0 = it has met the water). */
export function ballAt(ball: Pick<Ball, "launch" | "params">, t: number, scratch: Float32Array, out: Vec3Like): Vec3Like {
   trajectoryPoints(ball.launch, ball.params, 2, t, scratch, 0);
   out.x = scratch[3];
   out.y = scratch[4];
   out.z = scratch[5];
   return out;
}

function pushPoint(list: PointEvent[], count: number, x: number, y: number, z: number): number {
   if (count >= list.length) return count;
   const p = list[count];
   p.x = x;
   p.y = y;
   p.z = z;
   return count + 1;
}

function damage(run: RunState, ship: Ship, shot: Shot, x: number, y: number, z: number): void {
   const bit = 1 << ship.index;
   if (shot.mask & bit) return;
   shot.mask |= bit;
   shot.damaged++;
   ship.hp--;
   const sunk = ship.hp <= 0;
   if (sunk) {
      ship.state = SHIP_SUNK;
      ship.at = run.time;
      shot.bonus += LANE_BONUS[ship.lane];
   }
   const ev = run.events;
   if (ev.hitCount < ev.hits.length) {
      const h = ev.hits[ev.hitCount++];
      h.ship = ship.index;
      h.tick = run.ticks;
      h.sunk = sunk;
      h.x = x;
      h.y = y;
      h.z = z;
   }
}

function stepBall(run: RunState, ball: Ball): void {
   ball.ticks++;
   ballAt(ball, ball.ticks * TICK, run.scratch, BALL);
   ball.x = BALL.x;
   ball.y = BALL.y;
   ball.z = BALL.z;
   const shot = run.shots[ball.shot];
   const r = WORLD.ballRadius;
   const ev = run.events;
   let stop = false;
   for (const s of run.ships) {
      if (!sailing(s)) continue;
      for (let k = 0; k < s.spec.spheres.length; k++) {
         if (!spheresOverlap(BALL, r, sphereCentre(s, k, SPH), s.spec.r)) continue;
         damage(run, s, shot, BALL.x, BALL.y, BALL.z);
         stop = true;
         break;
      }
      if (stop) break;
   }
   if (!stop) {
      for (const b of run.barrels) {
         if (b.state !== BARREL_FLOATING) continue;
         OBJ.x = b.x;
         OBJ.y = BARREL.y;
         OBJ.z = b.z;
         if (!spheresOverlap(BALL, r, OBJ, BARREL.r)) continue;
         blast(run, b, shot);
         stop = true;
         break;
      }
   }
   if (!stop && run.chest.state === 1) {
      OBJ.x = run.chest.x;
      OBJ.y = CHEST.y;
      OBJ.z = run.chest.z;
      if (spheresOverlap(BALL, r, OBJ, CHEST.r)) {
         run.chest.state = 2;
         shot.chest = true;
         ev.chestHit = true;
         stop = true;
      }
   }
   if (!stop && hitsIsland(BALL.x, BALL.y, BALL.z, r)) {
      if (ev.splashCount < ev.splashes.length) ev.islandFlags[ev.splashCount] = true;
      ev.splashCount = pushPoint(ev.splashes, ev.splashCount, BALL.x, BALL.y, BALL.z);
      stop = true;
   }
   if (!stop && BALL.y <= 0) {
      if (ev.splashCount < ev.splashes.length) ev.islandFlags[ev.splashCount] = false;
      ev.splashCount = pushPoint(ev.splashes, ev.splashCount, BALL.x, 0, BALL.z);
      stop = true;
   }
   if (!stop) return;
   ball.active = false;
   shot.ballDone = true;
   shot.x = BALL.x;
   shot.y = Math.max(BALL.y, 0.5);
   shot.z = BALL.z;
}

/** A barrel goes off: 1 HP to every ship within the radius (once per shot), nearby barrels on a fuse. */
function blast(run: RunState, b: Barrel, shot: Shot): void {
   if (b.state === BARREL_FUSE) shot.pending--;
   b.state = BARREL_GONE;
   shot.barrel = true;
   const ev = run.events;
   ev.blastCount = pushPoint(ev.blasts, ev.blastCount, b.x, BARREL.y, b.z);
   OBJ.x = b.x;
   OBJ.y = BARREL.y;
   OBJ.z = b.z;
   for (const s of run.ships) {
      if (!sailing(s)) continue;
      for (let k = 0; k < s.spec.spheres.length; k++) {
         sphereCentre(s, k, SPH);
         if (!spheresOverlap(OBJ, BARREL.radius, SPH, s.spec.r)) continue;
         damage(run, s, shot, SPH.x, SPH.y + s.spec.r * 0.5, SPH.z);
         break;
      }
   }
   for (const o of run.barrels) {
      if (o.state !== BARREL_FLOATING) continue;
      if (Math.hypot(o.x - b.x, o.z - b.z) > BARREL.radius) continue;
      o.state = BARREL_FUSE;
      o.fuseAt = run.time + BARREL.chainDelay;
      o.shot = run.shots.indexOf(shot);
      shot.pending++;
   }
}

/** Points of one resolved shot before the combo (README "Scoring"). */
export function shotBase(damaged: number, bonus: number, barrel: boolean, chest: boolean): number {
   const chain = barrel ? POINTS.chainPerShip * Math.min(POINTS.chainMax / POINTS.chainPerShip, Math.max(0, damaged - 1)) : 0;
   return POINTS.hit * damaged + bonus + chain + (chest ? POINTS.chest : 0);
}

/** Resolve every shot whose ball has stopped and whose chain is over, in fire order (shot id). */
function resolveShots(run: RunState): void {
   for (;;) {
      let next: Shot | null = null;
      for (const s of run.shots) if (s.active && s.ballDone && s.pending <= 0 && (!next || s.id < next.id)) next = s;
      if (!next) return;
      next.active = false;
      const scoring = next.damaged > 0 || next.chest;
      run.streak = scoring ? run.streak + 1 : 0;
      if (!scoring) continue;
      const combo = run.streak >= POINTS.comboFrom;
      const base = shotBase(next.damaged, next.bonus, next.barrel, next.chest);
      const pts = combo ? base * POINTS.combo : base;
      run.score += pts;
      const ev = run.events;
      if (ev.scoreCount < ev.scores.length) {
         const e = ev.scores[ev.scoreCount++];
         e.x = next.x;
         e.y = next.y;
         e.z = next.z;
         e.points = pts;
         e.combo = combo;
         e.chain = next.barrel ? base - POINTS.hit * next.damaged - next.bonus - (next.chest ? POINTS.chest : 0) : 0;
         e.chest = next.chest;
      }
   }
}

// ---------- the proof's numbers ----------

/** Value ceiling of one ship: every HP hit at the combo, plus its lane bonus. */
export const shipCeiling = (type: ShipType, lane: number) => POINTS.combo * (POINTS.hit * SHIPS[type].hp + LANE_BONUS[lane]);
/** Chain ceiling of one barrel pair (a pair always goes off in one shot), and the chest's. */
export const BARREL_CEILING = POINTS.combo * POINTS.chainMax;
export const CHEST_CEILING = POINTS.combo * POINTS.chest;

/**
 * The most points a run can hold at time t (s): every ship, barrel and chest spawned by t at its
 * ceiling, the most valuable first, spawns as early as the generator allows (no jitter, no waits).
 */
export function ceilingAt(t: number): number {
   let total = 0;
   for (const w of WAVES) {
      const n = w.types.length;
      let k = 0;
      for (let i = 0; i < n; i++) if (w.start + (i * w.span) / n <= t + 1e-9) k++;
      const hp = w.types.map((ty) => SHIPS[ty].hp).sort((a, b) => b - a);
      const bonus = w.lanes.map((l) => LANE_BONUS[l]).sort((a, b) => b - a);
      for (let i = 0; i < k; i++) total += POINTS.combo * (POINTS.hit * hp[i] + bonus[i]);
      // one pair per wave: both barrels go off in one shot (pairGap < radius, they leave together)
      if (w.start + BARREL.delay <= t + 1e-9) total += BARREL_CEILING;
   }
   if (CHEST.minS <= t + 1e-9) total += CHEST_CEILING;
   return total;
}

/** The ceiling of a whole run (seed-independent: the multisets are fixed). */
export const MAX_SCORE = ceilingAt(Infinity);

export const withinServerLimits = (score: number, durationMs: number) => fitsLimits(score, durationMs, pirateCannonsMeta.scoring);
export const capScore = (score: number, durationMs: number) => capToLimits(score, durationMs, pirateCannonsMeta.scoring);
