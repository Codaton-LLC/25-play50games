// Robot Collector rules: the warehouse map, seeded battery layouts, robot movement, pickups and
// scoring. Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Scene.tsx
// feeds it input and dt every frame; rules.test.ts drives it directly. Same seed = same layout.
//
// The scoring limits in meta.ts only hold because of the level design below (robot top speed,
// battery spacing, waves). README.md "Scoring" has the proof; rules.test.ts checks it.
// Generic helpers (seeded RNG, angles, collision, the server's limit check) come from core.
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
import { robotCollectorMeta } from "./meta";

// ---------- tuning ----------

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
 */
export const IDEAL_ROUTE = { min: 80, max: 95 } as const;

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

// ---------- layouts ----------

export interface Battery extends Vec3Like {
   /** 0..9, in collection-wave order */
   index: number;
   /** 0..4: batteries [2w, 2w + 1] form wave w */
   wave: number;
}

export interface Layout {
   seed: number;
   batteries: Battery[];
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** A spot where a battery may spawn: inside SPAWN_AREA and SPAWN_CLEARANCE away from every prop. */
export function isSpawnPoint(x: number, z: number): boolean {
   if (Math.abs(x) > SPAWN_AREA.halfX || Math.abs(z) > SPAWN_AREA.halfZ) return false;
   return OBSTACLES.every((box) => distanceToBoxXZ(x, z, box) >= SPAWN_CLEARANCE);
}

let spawnCache: Array<{ x: number; z: number }> | null = null;

/** Every grid spot a battery may use (computed once). */
export function spawnPoints(): ReadonlyArray<{ x: number; z: number }> {
   if (!spawnCache) {
      spawnCache = [];
      for (let x = -SPAWN_AREA.halfX; x <= SPAWN_AREA.halfX + 1e-9; x += SPAWN_STEP) {
         for (let z = -SPAWN_AREA.halfZ; z <= SPAWN_AREA.halfZ + 1e-9; z += SPAWN_STEP) {
            const px = Math.round(x * 100) / 100;
            const pz = Math.round(z * 100) / 100;
            if (isSpawnPoint(px, pz)) spawnCache.push({ x: px, z: pz });
         }
      }
   }
   return spawnCache;
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
export function isValidLayout(layout: Layout): boolean {
   const { batteries } = layout;
   if (batteries.length !== BATTERY_COUNT) return false;
   for (let i = 0; i < batteries.length; i++) {
      const b = batteries[i];
      if (b.index !== i || b.wave !== Math.floor(i / WAVE_SIZE) || b.y !== 0) return false;
      if (!isSpawnPoint(b.x, b.z)) return false;
      if (!fitsSpacing(b, b.wave, batteries.slice(0, i))) return false;
   }
   const ideal = shortestRoute(layout, 0);
   return ideal >= IDEAL_ROUTE.min && ideal <= IDEAL_ROUTE.max;
}

const battery = (index: number, x: number, z: number): Battery => ({
   index,
   wave: Math.floor(index / WAVE_SIZE),
   x,
   y: 0,
   z,
});

/** Hand-placed layout, used only if a seed cannot produce a valid one (tests keep it valid). */
export const FALLBACK_SPOTS: ReadonlyArray<[number, number]> = [
   [-2, -6.5], [-8.5, -2.5],
   [-2.5, 4.5], [7.5, -4.5],
   [-6.5, -4], [-1, -5.5],
   [-3, 3.5], [8, 6.5],
   [-2, -4.5], [4.5, -2.5],
];

function fallbackLayout(seed: number): Layout {
   return { seed, batteries: FALLBACK_SPOTS.map(([x, z], i) => battery(i, x, z)) };
}

const PICKS_PER_BATTERY = 80;
const LAYOUT_ATTEMPTS = 40;

/**
 * The 10 batteries for one run. Rejection sampling on the spawn grid: a layout that breaks a
 * spacing rule or the fairness limit is thrown away and the next one is drawn from the same seed.
 */
export function generateLayout(seed: number): Layout {
   const rng = createRng(seed);
   const points = spawnPoints();
   for (let attempt = 0; attempt < LAYOUT_ATTEMPTS; attempt++) {
      const batteries: Battery[] = [];
      for (let i = 0; i < BATTERY_COUNT; i++) {
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
      if (batteries.length === BATTERY_COUNT && isValidLayout(layout)) return layout;
   }
   return fallbackLayout(seed);
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
   for (let w = 0; w < WAVE_COUNT; w++) {
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

/** Lower bound on the route of every layout that passes isValidLayout (README "Scoring"). */
export const GUARANTEED_MIN_ROUTE =
   SPACING.fromStart -
   PICKUP_REACH +
   WAVE_COUNT * (WAVE_SIZE - 1) * (SPACING.inWave - 2 * PICKUP_REACH) +
   (WAVE_COUNT - 1) * (SPACING.betweenWaves - 2 * PICKUP_REACH);

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

/**
 * One movement step. `dirX/dirZ` is the wanted direction (length <= 1, analog). Mutates `robot`,
 * allocates nothing (safe inside useRunFrame).
 * Guarantee used by the scoring proof: the robot never moves more than ROBOT.maxSpeed * dt in one
 * step, whatever the input, collisions or wall pushes do.
 */
export function stepRobot(robot: RobotState, dirX: number, dirZ: number, dt: number): void {
   if (!(dt > 0)) return;
   const { maxSpeed, accel, brake, radius, turnRate } = ROBOT;

   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }

   // ease the velocity towards the wanted one (accelerating or braking)
   let dvx = dirX * maxSpeed - robot.vx;
   let dvz = dirZ * maxSpeed - robot.vz;
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

   // crates and barrels push the robot out; the walls keep it inside
   for (const box of OBSTACLES) resolveSphereAabb(robot, radius, box, robot);
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
   /** wave on the floor right now (WAVE_COUNT once everything is collected) */
   wave: number;
   collected: number;
   /** by battery index */
   taken: boolean[];
}

export function createProgress(): Progress {
   return { wave: 0, collected: 0, taken: new Array<boolean>(BATTERY_COUNT).fill(false) };
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
   if (progress.wave >= WAVE_COUNT) return 0;
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

export const isComplete = (progress: Progress) => progress.collected >= BATTERY_COUNT;

// ---------- scoring ----------

/** +10 per full second left. */
export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** 100 per battery; a win (all 10) adds the time bonus. */
export function runScore(collected: number, won: boolean, timeLeftMs: number): number {
   return collected * BATTERY_POINTS + (won ? timeBonus(timeLeftMs) : 0);
}

/** The server's check (core/limits.ts) with this game's limits from meta.ts. */
export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, robotCollectorMeta.scoring);
}

/**
 * Safety net only (core/limits.ts capScore with meta.ts limits): the proof in README.md shows real
 * runs never reach the cap, and rules.test.ts checks it stays a no-op.
 */
export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, robotCollectorMeta.scoring);
}
