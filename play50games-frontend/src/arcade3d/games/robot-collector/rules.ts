// Robot Collector rules: the warehouse map, seeded battery layouts, robot movement, pickups and
// scoring. Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Scene.tsx
// feeds it input and dt every frame; rules.test.ts drives it directly. Same seed = same layout.
//
// The scoring limits in meta.ts only hold because of the level design below (robot top speed,
// battery spacing, waves). README.md "Scoring" has the proof; rules.test.ts checks it.
// Generic helpers (seeded RNG, angles, collision, the server's limit check) come from core.
//
// Levels (levels.ts, README "Levels"): what used to be a constant of the one level is now an
// optional `level` argument that defaults to level 1, so level 1 (the live game) is exactly what
// it was. The Scene plays `createRun(seed, level)` with `stepRun`; the older pieces
// (generateLayout, stepRobot, collectTouched ...) stay exported with their level 1 behaviour.
import {
   circlesOverlapXZ,
   clampToBounds,
   distanceToBoxXZ,
   resolveSphereAabb,
   type AABB,
   type Vec3Like,
} from "@/arcade3d/core/collision";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng, turnTowards } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import {
   CART_LANES,
   CART_SIZE,
   EXTRA_PROPS,
   LEVELS,
   SLOW_FACTOR,
   SLOW_ZONES,
   STUN_GRACE_S,
   STUN_S,
   type CartLane,
   type RobotLevel,
} from "./levels";
import { robotCollectorMeta } from "./meta";

// ---------- tuning ----------

/** Level 1's clock and battery count (the other levels: levels.ts). */
export const DURATION_MS = 60_000;
export const BATTERY_COUNT = 10;
/** Batteries appear two at a time; the next pair lights up when both are collected. */
export const WAVE_SIZE = 2;
export const WAVE_COUNT = BATTERY_COUNT / WAVE_SIZE;
export const BATTERY_POINTS = 100;
/** Win bonus per full second left on the clock. */
export const TIME_BONUS_PER_SECOND = 10;

/** The floor is 24 x 16 units centred on the origin; the walls stand just outside it. */
export const ARENA = { halfX: 12, halfZ: 8 } as const;

/** Units, units/s, units/s². `maxSpeed` is the number the scoring proof rests on. */
export const ROBOT = { radius: 0.5, maxSpeed: 5, accel: 24, brake: 30, turnRate: 14 } as const;
export const ROBOT_START = { x: 0, z: 0 } as const;

export const BATTERY_RADIUS = 0.3;
/** Robot centre within this distance of a battery centre = collected (the two circles touch). */
export const PICKUP_REACH = ROBOT.radius + BATTERY_RADIUS;

/**
 * Minimum centre distances every layout keeps (checked by isValidLayout):
 * - fromStart: first-wave batteries from the robot's start;
 * - inWave: between the batteries of one wave;
 * - betweenWaves: from every battery of a wave to every battery of the next one.
 * The same on every level: the scoring proof's legs are not clipped by the pickup reach.
 */
export const SPACING = { fromStart: 4, inWave: 5, betweenWaves: 8 } as const;

/** Batteries spawn inside this box (keeps them off the wall trim)... */
export const SPAWN_AREA = { halfX: 10.5, halfZ: 6.5 } as const;
/** ...and at least this far from any crate or barrel, so the robot can always drive onto them. */
export const SPAWN_CLEARANCE = 1;
/** Candidate battery spots are on a grid of this step. */
const SPAWN_STEP = 0.5;

/**
 * Fairness band: a layout's ideal route (centre to centre, best order, ignoring obstacles) must
 * be this long, so no seed is much easier or harder than another (16-19 s of driving at top speed).
 * Level 1; a level with more waves scales it, see idealRoute().
 */
export const IDEAL_ROUTE = { min: 80, max: 95 } as const;
/** The same band per wave: IDEAL_ROUTE is 5 waves of it. */
export const IDEAL_ROUTE_PER_WAVE = { min: 16, max: 19 } as const;

// ---------- levels ----------

/** The level's battery count (2 per wave). */
export const batteryCount = (level: RobotLevel = LEVELS[1]): number => level.waves * WAVE_SIZE;

/** The fairness band of a level: IDEAL_ROUTE_PER_WAVE x its waves (level 1: exactly IDEAL_ROUTE). */
export const idealRoute = (level: RobotLevel = LEVELS[1]): { min: number; max: number } => ({
   min: IDEAL_ROUTE_PER_WAVE.min * level.waves,
   max: IDEAL_ROUTE_PER_WAVE.max * level.waves,
});

// ---------- the warehouse ----------

export type PropKind = "crate" | "barrel";

export interface Prop {
   kind: PropKind;
   x: number;
   z: number;
   /** crates only: 2 = a second crate stacked on top (looks only, same footprint) */
   stack?: 2;
}

export const CRATE_SIZE = 1.2;
export const BARREL_RADIUS = 0.45;

/** Static obstacles. Lanes between them are at least 2 robot widths wide. */
export const PROPS: readonly Prop[] = [
   // back-left corner stack
   { kind: "crate", x: -9.6, z: -5.4, stack: 2 },
   { kind: "crate", x: -8.4, z: -5.4 },
   { kind: "crate", x: -9.6, z: -4.2 },
   { kind: "barrel", x: -6.8, z: -6.2 },
   // back-right loading area
   { kind: "crate", x: 4.2, z: -5.6 },
   { kind: "crate", x: 5.4, z: -5.6, stack: 2 },
   { kind: "barrel", x: 9.8, z: -5.8 },
   { kind: "barrel", x: 10.6, z: -4.9 },
   // middle islands
   { kind: "crate", x: -4.2, z: -1.2 },
   { kind: "crate", x: -4.2, z: 0 },
   { kind: "barrel", x: 3.4, z: 1.6 },
   { kind: "crate", x: 6.6, z: 0.6, stack: 2 },
   { kind: "crate", x: 7.8, z: 0.6 },
   // front row
   { kind: "barrel", x: -9.4, z: 4.4 },
   { kind: "crate", x: -5.6, z: 5 },
   { kind: "crate", x: 0.6, z: 5.6, stack: 2 },
   { kind: "barrel", x: 1.9, z: 5.9 },
   { kind: "crate", x: 9.4, z: 5.2 },
];

/** Collision box of a prop. Barrels are cylinders but collide as squares (circle vs AABB). */
export function propBox(prop: Prop): AABB {
   const half = prop.kind === "crate" ? CRATE_SIZE / 2 : BARREL_RADIUS;
   // tall y range: the robot (y = 0) is always level with the box, so pushes are horizontal
   return {
      min: { x: prop.x - half, y: -10, z: prop.z - half },
      max: { x: prop.x + half, y: 10, z: prop.z + half },
   };
}

export const OBSTACLES: readonly AABB[] = PROPS.map(propBox);

/** The walls: the robot's centre stays `ROBOT.radius` inside this box. */
export const BOUNDS: AABB = {
   min: { x: -ARENA.halfX, y: -10, z: -ARENA.halfZ },
   max: { x: ARENA.halfX, y: 10, z: ARENA.halfZ },
};

/** What stands in a level's warehouse and where a battery may spawn (computed once per level). */
export interface World {
   props: readonly Prop[];
   obstacles: readonly AABB[];
   spawn: ReadonlyArray<{ x: number; z: number }>;
}

const worlds = new WeakMap<RobotLevel, World>();

/** PROPS plus the level's extra props (level 1: PROPS itself). */
export function worldOf(level: RobotLevel = LEVELS[1]): World {
   let world = worlds.get(level);
   if (!world) {
      const props = level.extraProps > 0 ? [...PROPS, ...EXTRA_PROPS.slice(0, level.extraProps)] : PROPS;
      const obstacles = level.extraProps > 0 ? props.map(propBox) : OBSTACLES;
      const spawn: Array<{ x: number; z: number }> = [];
      for (let x = -SPAWN_AREA.halfX; x <= SPAWN_AREA.halfX + 1e-9; x += SPAWN_STEP) {
         for (let z = -SPAWN_AREA.halfZ; z <= SPAWN_AREA.halfZ + 1e-9; z += SPAWN_STEP) {
            const px = Math.round(x * 100) / 100;
            const pz = Math.round(z * 100) / 100;
            if (fitsSpawn(px, pz, obstacles)) spawn.push({ x: px, z: pz });
         }
      }
      world = { props, obstacles, spawn };
      worlds.set(level, world);
   }
   return world;
}

// ---------- layouts ----------

export interface Battery extends Vec3Like {
   /** 0..N-1 (level 1: 0..9), in collection-wave order */
   index: number;
   /** batteries [2w, 2w + 1] form wave w */
   wave: number;
}

export interface Layout {
   seed: number;
   batteries: Battery[];
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

function fitsSpawn(x: number, z: number, obstacles: readonly AABB[]): boolean {
   if (Math.abs(x) > SPAWN_AREA.halfX || Math.abs(z) > SPAWN_AREA.halfZ) return false;
   return obstacles.every((box) => distanceToBoxXZ(x, z, box) >= SPAWN_CLEARANCE);
}

/** A spot where a battery may spawn: inside SPAWN_AREA and SPAWN_CLEARANCE away from every prop of the level. */
export function isSpawnPoint(x: number, z: number, level: RobotLevel = LEVELS[1]): boolean {
   return fitsSpawn(x, z, worldOf(level).obstacles);
}

/** Every grid spot a battery may use on the level (computed once). */
export function spawnPoints(level: RobotLevel = LEVELS[1]): ReadonlyArray<{ x: number; z: number }> {
   return worldOf(level).spawn;
}

/** Does `p` keep the spacing rules against the batteries placed before it? */
function fitsSpacing(p: { x: number; z: number }, wave: number, placed: Battery[]): boolean {
   if (wave === 0 && dist(p, ROBOT_START) < SPACING.fromStart) return false;
   for (const other of placed) {
      if (other.wave === wave && dist(p, other) < SPACING.inWave) return false;
      if (other.wave === wave - 1 && dist(p, other) < SPACING.betweenWaves) return false;
   }
   return true;
}

/** Checks everything the scoring proof and the fairness rule rely on. */
export function isValidLayout(layout: Layout, level: RobotLevel = LEVELS[1]): boolean {
   const { batteries } = layout;
   if (batteries.length !== batteryCount(level)) return false;
   for (let i = 0; i < batteries.length; i++) {
      const b = batteries[i];
      if (b.index !== i || b.wave !== Math.floor(i / WAVE_SIZE) || b.y !== 0) return false;
      if (!isSpawnPoint(b.x, b.z, level)) return false;
      if (!fitsSpacing(b, b.wave, batteries.slice(0, i))) return false;
   }
   const ideal = shortestRoute(layout, 0);
   const band = idealRoute(level);
   return ideal >= band.min && ideal <= band.max;
}

const battery = (index: number, x: number, z: number): Battery => ({
   index,
   wave: Math.floor(index / WAVE_SIZE),
   x,
   y: 0,
   z,
});

/** Hand-placed layout, used only if a seed cannot produce a valid one (tests keep it valid). Level 1's. */
export const FALLBACK_SPOTS: ReadonlyArray<[number, number]> = [
   [-2, -6.5], [-8.5, -2.5],
   [-2.5, 4.5], [7.5, -4.5],
   [-6.5, -4], [-1, -5.5],
   [-3, 3.5], [8, 6.5],
   [-2, -4.5], [4.5, -2.5],
];

function fallbackLayout(seed: number, level: RobotLevel): Layout {
   const spots = level.fallback ?? FALLBACK_SPOTS;
   return { seed, batteries: spots.map(([x, z], i) => battery(i, x, z)) };
}

const PICKS_PER_BATTERY = 80;
const LAYOUT_ATTEMPTS = 40;

/**
 * The batteries for one run (10 on level 1). Rejection sampling on the spawn grid: a layout that
 * breaks a spacing rule or the fairness limit is thrown away and the next one is drawn from the
 * same seed.
 */
export function generateLayout(seed: number, level: RobotLevel = LEVELS[1]): Layout {
   const rng = createRng(seed);
   const points = spawnPoints(level);
   const count = batteryCount(level);
   for (let attempt = 0; attempt < LAYOUT_ATTEMPTS; attempt++) {
      const batteries: Battery[] = [];
      for (let i = 0; i < count; i++) {
         const wave = Math.floor(i / WAVE_SIZE);
         for (let pick = 0; pick < PICKS_PER_BATTERY; pick++) {
            const p = points[Math.floor(rng() * points.length)];
            if (fitsSpacing(p, wave, batteries)) {
               batteries.push(battery(i, p.x, p.z));
               break;
            }
         }
         if (batteries.length !== i + 1) break;
      }
      const layout = { seed, batteries };
      if (batteries.length === count && isValidLayout(layout, level)) return layout;
   }
   return fallbackLayout(seed, level);
}

// ---------- routes (fairness + the scoring proof) ----------

/** Every order of the items, e.g. [[0, 1], [1, 0]] for a pair. */
function permutations(items: number[]): number[][] {
   if (items.length <= 1) return [items];
   return items.flatMap((item, i) =>
      permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
   );
}

/**
 * Shortest route from the start that collects every battery, wave by wave, ignoring obstacles.
 * With `reach` = 0 it is the ideal centre-to-centre route. With `reach` = PICKUP_REACH it is a
 * lower bound on ANY real route: the robot's centre only has to come within `reach` of each
 * battery, so each leg between two batteries is at least (centre distance - 2 * reach), and the
 * first leg at least (distance from start - reach). Obstacles only make real routes longer.
 */
export function shortestRoute(layout: Layout, reach: number): number {
   const legFromStart = (b: Battery) => Math.max(0, dist(ROBOT_START, b) - reach);
   const leg = (a: Battery, b: Battery) => Math.max(0, dist(a, b) - 2 * reach);

   // best[i] = shortest route that has finished the current wave with battery i collected last
   let best = new Map<number, number>();
   const waves = layout.batteries.length / WAVE_SIZE;
   for (let w = 0; w < waves; w++) {
      const wave = layout.batteries.filter((b) => b.wave === w);
      const next = new Map<number, number>();
      for (const order of permutations(wave.map((b) => b.index))) {
         const first = layout.batteries[order[0]];
         let inside = 0;
         for (let k = 1; k < order.length; k++) inside += leg(layout.batteries[order[k - 1]], layout.batteries[order[k]]);
         let arrive = Infinity;
         if (w === 0) arrive = legFromStart(first);
         else best.forEach((length, last) => (arrive = Math.min(arrive, length + leg(layout.batteries[last], first))));
         const last = order[order.length - 1];
         next.set(last, Math.min(next.get(last) ?? Infinity, arrive + inside));
      }
      best = next;
   }
   return Math.min(...best.values());
}

/** Spacing-only lower bound on the route of every layout that passes isValidLayout (45.8). */
export const GUARANTEED_MIN_ROUTE =
   SPACING.fromStart -
   PICKUP_REACH +
   WAVE_COUNT * (WAVE_SIZE - 1) * (SPACING.inWave - 2 * PICKUP_REACH) +
   (WAVE_COUNT - 1) * (SPACING.betweenWaves - 2 * PICKUP_REACH);

/**
 * The stronger bound the server limits rest on (README "Server limits"). Every leg of a valid
 * layout is longer than the pickup reach can shorten it (≥ 4 > 0.8 from the start, ≥ 5 and ≥ 8 >
 * 1.6 between batteries), so no leg is clipped at 0 and shortestRoute(layout, PICKUP_REACH) is
 * exactly the ideal route minus 0.8 + (batteries - 1) · 1.6 (level 1: 15.2). The fairness band
 * keeps the ideal route ≥ its min, so every real route is at least this long (level 1: 64.8
 * units; a level's: its band's min, see fairnessMinRoute). A constant only: no gameplay.
 */
export function fairnessMinRoute(level: RobotLevel = LEVELS[1]): number {
   return idealRoute(level).min - PICKUP_REACH - (batteryCount(level) - 1) * 2 * PICKUP_REACH;
}

/** Level 1's: 64.8 units. */
export const FAIRNESS_MIN_ROUTE = fairnessMinRoute(LEVELS[1]);

/**
 * Fastest elapsedMs at which a route of `routeLength` can be finished. The core clock counts every
 * moment the robot drives (useRunFrame's dt is the time the clock counted), so this is exact.
 */
export function fastestFinishMs(routeLength: number): number {
   return Math.max(0, (routeLength / ROBOT.maxSpeed) * 1000);
}

/** Lower bound on the elapsedMs of any win on this layout. */
export function minCompletionMs(layout: Layout): number {
   return fastestFinishMs(shortestRoute(layout, PICKUP_REACH));
}

// ---------- robot movement ----------

export interface RobotState extends Vec3Like {
   vx: number;
   vz: number;
   /** facing, radians around +y (0 = facing +z) */
   heading: number;
}

export function createRobot(): RobotState {
   return { x: ROBOT_START.x, y: 0, z: ROBOT_START.z, vx: 0, vz: 0, heading: Math.PI };
}

const NO_BOXES: readonly AABB[] = [];

/**
 * One movement step. `dirX/dirZ` is the wanted direction (length <= 1, analog). Mutates `robot`,
 * allocates nothing (safe inside useRunFrame).
 * Guarantee used by the scoring proof: the robot never moves more than ROBOT.maxSpeed * dt in one
 * step, whatever the input, collisions or wall pushes do.
 * Level hazards (stepRun) enter only through the trailing arguments and can only hold the robot
 * back: `speedScale` (<= 1) lowers the speed it steers to, `movers` (the carts) push it out like
 * props do, and every push happens before the speed guard below.
 */
export function stepRobot(
   robot: RobotState,
   dirX: number,
   dirZ: number,
   dt: number,
   obstacles: readonly AABB[] = OBSTACLES,
   speedScale = 1,
   movers: readonly AABB[] = NO_BOXES
): void {
   if (!(dt > 0)) return;
   const { maxSpeed, accel, brake, radius, turnRate } = ROBOT;

   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }

   // ease the velocity towards the wanted one (accelerating or braking)
   const top = maxSpeed * Math.min(1, speedScale);
   let dvx = dirX * top - robot.vx;
   let dvz = dirZ * top - robot.vz;
   const dv = Math.hypot(dvx, dvz);
   const maxDv = (len > 0.01 ? accel : brake) * dt;
   if (dv > maxDv) {
      dvx *= maxDv / dv;
      dvz *= maxDv / dv;
   }
   robot.vx += dvx;
   robot.vz += dvz;

   const fromX = robot.x;
   const fromZ = robot.z;
   robot.x += robot.vx * dt;
   robot.y = 0;
   robot.z += robot.vz * dt;

   // carts, then crates and barrels push the robot out; the walls keep it inside
   for (const box of movers) resolveSphereAabb(robot, radius, box, robot);
   for (const box of obstacles) resolveSphereAabb(robot, radius, box, robot);
   clampToBounds(robot, BOUNDS, radius, robot);

   // speed guard: whatever the pushes did, this step moves at most maxSpeed * dt
   const mx = robot.x - fromX;
   const mz = robot.z - fromZ;
   const moved = Math.hypot(mx, mz);
   const maxMove = maxSpeed * dt;
   if (moved > maxMove) {
      robot.x = fromX + (mx * maxMove) / moved;
      robot.z = fromZ + (mz * maxMove) / moved;
   }

   // velocity = what really happened: pushing into a wall stops, sliding along it keeps going
   robot.vx = (robot.x - fromX) / dt;
   robot.vz = (robot.z - fromZ) / dt;

   if (Math.hypot(robot.vx, robot.vz) > 0.3) {
      robot.heading = turnTowards(robot.heading, Math.atan2(robot.vx, robot.vz), 1 - Math.exp(-turnRate * dt));
   }
}

// ---------- pickups ----------

export interface Progress {
   /** wave on the floor right now (the wave count once everything is collected) */
   wave: number;
   collected: number;
   /** by battery index; its length is the level's battery count */
   taken: boolean[];
}

export function createProgress(total: number = BATTERY_COUNT): Progress {
   return { wave: 0, collected: 0, taken: new Array<boolean>(total).fill(false) };
}

/** A battery is on the floor (visible and collectable) when its wave is the current one. */
export function isActive(progress: Progress, b: Battery): boolean {
   return b.wave === progress.wave && !progress.taken[b.index];
}

/**
 * Collects every active battery the robot touches. Returns how many were collected this step.
 * When the last battery of a wave goes, the next wave becomes active (from the next step on).
 */
export function collectTouched(progress: Progress, layout: Layout, robot: Vec3Like): number {
   if (progress.wave >= progress.taken.length / WAVE_SIZE) return 0;
   const start = progress.wave * WAVE_SIZE;
   let got = 0;
   let left = 0;
   for (let i = start; i < start + WAVE_SIZE; i++) {
      const b = layout.batteries[i];
      if (progress.taken[i]) continue;
      if (circlesOverlapXZ(robot, ROBOT.radius, b, BATTERY_RADIUS)) {
         progress.taken[i] = true;
         progress.collected += 1;
         got += 1;
      } else {
         left += 1;
      }
   }
   if (left === 0) progress.wave += 1;
   return got;
}

export const isComplete = (progress: Progress) => progress.collected >= progress.taken.length;

// ---------- hazards and one run ----------

/** Where a cart is on its lane `time` seconds into the run (a pure function of the clock: it ping-pongs a -> b -> a). */
export function cartAt(lane: CartLane, speed: number, time: number, out: { x: number; z: number }): void {
   const length = Math.hypot(lane.bx - lane.ax, lane.bz - lane.az);
   const along = length > 0 ? (time * speed) / length + lane.phase : 0;
   const wrapped = ((along % 2) + 2) % 2;
   const k = wrapped <= 1 ? wrapped : 2 - wrapped;
   out.x = lane.ax + (lane.bx - lane.ax) * k;
   out.z = lane.az + (lane.bz - lane.az) * k;
}

export interface CartState {
   x: number;
   z: number;
}

/** Everything one run changes: the level's layout, the robot, the carts and the hazard timers. */
export interface Run {
   seed: number;
   level: RobotLevel;
   world: World;
   layout: Layout;
   robot: RobotState;
   progress: Progress;
   /** seconds of play so far: the carts' clock */
   time: number;
   /** the level's carts (x, z), moved by stepRun */
   carts: CartState[];
   /** the carts' collision boxes, moved with them */
   cartBoxes: AABB[];
   /** seconds of stun left (the robot cannot steer) and of safety after one */
   stun: number;
   grace: number;
   /** the robot is in a slow zone this step (looks) */
   slowed: boolean;
   /** how many times a cart has stunned the robot (the Scene plays a sound on a change) */
   hits: number;
}

function placeCarts(run: Run): void {
   const { level, time } = run;
   for (let i = 0; i < run.carts.length; i++) {
      const cart = run.carts[i];
      cartAt(CART_LANES[i], level.cartSpeed, time, cart);
      const box = run.cartBoxes[i];
      box.min.x = cart.x - CART_SIZE / 2;
      box.max.x = cart.x + CART_SIZE / 2;
      box.min.z = cart.z - CART_SIZE / 2;
      box.max.z = cart.z + CART_SIZE / 2;
   }
}

/** A run of `level` (default 1) for `seed`: a fresh layout, robot, progress and carts at time 0. */
export function createRun(seed: number, level: RobotLevel = LEVELS[1]): Run {
   const carts: CartState[] = [];
   const cartBoxes: AABB[] = [];
   for (let i = 0; i < level.carts; i++) {
      carts.push({ x: 0, z: 0 });
      cartBoxes.push({ min: { x: 0, y: -10, z: 0 }, max: { x: 0, y: 10, z: 0 } });
   }
   const layout = generateLayout(seed, level);
   const run: Run = {
      seed,
      level,
      world: worldOf(level),
      layout,
      robot: createRobot(),
      progress: createProgress(layout.batteries.length),
      time: 0,
      carts,
      cartBoxes,
      stun: 0,
      grace: 0,
      slowed: false,
      hits: 0,
   };
   placeCarts(run);
   return run;
}

function inSlowZone(run: Run): boolean {
   const { robot } = run;
   for (let i = 0; i < run.level.slowZones; i++) {
      const zone = SLOW_ZONES[i];
      if (Math.hypot(robot.x - zone.x, robot.z - zone.z) < zone.r) return true;
   }
   return false;
}

/** A cart is touching the robot (stepRobot has already pushed it out, so the gap is about 0). */
const CART_TOUCH_GAP = 0.06;
function touchesCart(run: Run): boolean {
   for (const box of run.cartBoxes) {
      if (distanceToBoxXZ(run.robot.x, run.robot.z, box) <= ROBOT.radius + CART_TOUCH_GAP) return true;
   }
   return false;
}

/**
 * One frame of one run: the carts move, the robot steers (not while stunned, and at SLOW_FACTOR of
 * its speed in a slow zone), a cart's touch stuns it, batteries are collected. Returns how many
 * were collected this step. Allocates nothing. Hazards depend on game time only, never on the
 * input device, so touch and keyboard get the same windows.
 */
export function stepRun(run: Run, dirX: number, dirZ: number, dt: number): number {
   if (!(dt > 0)) return 0;
   run.time += dt;
   placeCarts(run);

   if (run.stun > 0) {
      run.stun = Math.max(0, run.stun - dt);
      if (run.stun === 0) run.grace = STUN_GRACE_S;
      dirX = 0;
      dirZ = 0;
   } else if (run.grace > 0) {
      run.grace = Math.max(0, run.grace - dt);
   }

   run.slowed = inSlowZone(run);
   stepRobot(run.robot, dirX, dirZ, dt, run.world.obstacles, run.slowed ? SLOW_FACTOR : 1, run.cartBoxes);

   if (run.stun === 0 && run.grace === 0 && touchesCart(run)) {
      run.stun = STUN_S;
      run.hits += 1;
   }
   return collectTouched(run.progress, run.layout, run.robot);
}

// ---------- scoring ----------

/** +10 per full second left. */
export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** 100 per battery; a win (all of the level's batteries) adds the time bonus. */
export function runScore(collected: number, won: boolean, timeLeftMs: number): number {
   return collected * BATTERY_POINTS + (won ? timeBonus(timeLeftMs) : 0);
}

/**
 * The limits proposed for each level (README "Server limits and why they hold", one proof per
 * level; rules.test.ts proves them with the real store). Level 1 is the live game's meta.scoring.
 * Claude copies levels 2-5 into arcade-games.json `levels` at merge; meta.ts holds the same
 * numbers and the test checks they are equal. The ceiling of a level is the win at its earliest
 * possible finish: BATTERY_POINTS * batteries + TIME_BONUS_PER_SECOND * floor(clock - earliest),
 * earliest = fairnessMinRoute(level) / ROBOT.maxSpeed. base 600 and 120 pts/s everywhere: the
 * rate line is above the ceiling from minDurationMs on, so it never bites.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: robotCollectorMeta.scoring,
   /** L2: 12 batteries, 70 s. Earliest win 77.6 / 5 = 15.52 s: 1200 + 10 * 54 = 1740. */
   2: { kind: "points", maxScore: 1740, minDurationMs: 14900, maxDurationMs: 72500, base: 600, maxPointsPerSec: 120, unitLabel: "pts", display: "int" },
   /** L3: 14 batteries, 80 s. Earliest win 90.4 / 5 = 18.08 s: 1400 + 10 * 61 = 2010. */
   3: { kind: "points", maxScore: 2010, minDurationMs: 17400, maxDurationMs: 82500, base: 600, maxPointsPerSec: 120, unitLabel: "pts", display: "int" },
   /** L4: 16 batteries, 85 s. Earliest win 103.2 / 5 = 20.64 s: 1600 + 10 * 64 = 2240. */
   4: { kind: "points", maxScore: 2240, minDurationMs: 19900, maxDurationMs: 88000, base: 600, maxPointsPerSec: 120, unitLabel: "pts", display: "int" },
   /** L5: 18 batteries, 90 s. Earliest win 116.0 / 5 = 23.2 s: 1800 + 10 * 66 = 2460. */
   5: { kind: "points", maxScore: 2460, minDurationMs: 22300, maxDurationMs: 93000, base: 600, maxPointsPerSec: 120, unitLabel: "pts", display: "int" },
};

/** The server's check (core/limits.ts) with a level's limits (default: level 1's, meta.ts). */
export function withinServerLimits(score: number, durationMs: number, limits: ScoringRules = robotCollectorMeta.scoring): boolean {
   return fitsLimits(score, durationMs, limits);
}

/**
 * Safety net only (core/limits.ts capScore with the level's limits): the proof in README.md shows
 * real runs never reach the cap, and rules.test.ts checks it stays a no-op.
 */
export function capScore(score: number, durationMs: number, limits: ScoringRules = robotCollectorMeta.scoring): number {
   return capToLimits(score, durationMs, limits);
}
