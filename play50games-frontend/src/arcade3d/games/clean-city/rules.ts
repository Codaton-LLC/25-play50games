// Clean the City rules: the three map configs, the reachable-spot caches, seeded litter layouts,
// runner movement, pickups, map changes, scoring and the constants of the scoring proof. Pure and
// deterministic: no three.js, React, DOM, Math.random or Date.now. Scene.tsx draws the seed
// (randomSeed), maps the stick with inputToWorld(moveX, moveY, 0) and calls step() once per
// useRunFrame; rules.test.ts drives it directly. Same seed + same inputs = same run.
//
// Clock: whole milliseconds, the fraction carried to the next step (as warehouse-rush), so simMs
// never runs ahead of the store's elapsedMs and lags it by less than 1 ms. No allocation after
// createRun(): the three layouts, the caches, the 20 litter slots and the events object are made
// there and rewritten in place, and step() returns the same events object every time.
// README.md is the design and holds the scoring proof.
import { circlesOverlapXZ, clampToBounds, distanceToBoxXZ, resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { MAX_FRAME_DT } from "@/arcade3d/core/frameLoop";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { rngNext, turnTowards, type RngState } from "@/arcade3d/core/math";
import { cleanCityMeta } from "./meta";

// ---------- tuning (README "Constants") ----------

/** One clock for the whole run: 240 s of play. */
export const DURATION_MS = 240_000;

/** Units, units/s, units/s², 1/s. `speed` is the number the scoring proof rests on (the speed guard). */
export const RUNNER = { radius: 0.5, speed: 5, accel: 24, brake: 30, turnRate: 14 } as const;
/** The start pad on every map, on the side nearest the camera, facing into the map (heading PI = -z). */
export const START_PAD = { x: 0, z: 12, heading: Math.PI } as const;

export const LITTER_RADIUS = 0.3;
/** Runner radius + litter radius: a piece is collected when the centres are within this. */
export const PICKUP_REACH = 0.8;
/** Between any two litter centres on the same map. */
export const PAIR_SPACING = 5.4;
/** From the start pad to every litter centre. */
export const START_SPACING = 4.0;
/** From a litter centre to every obstacle square (the floor boundary is not an obstacle). */
export const PROP_CLEARANCE = 1.0;
/** Floor 28 x 28 (|x|, |z| <= 14); the runner's centre and the litter stay in |x|, |z| <= 13.5. */
export const FLOOR_HALF = 14;
export const SPAWN_HALF = 13.5;
export const SPAWN_GRID = 0.5;
/** Obstacles leave corridors at least this wide, between each other and to the floor edge. */
export const MIN_CORRIDOR = 2.2;

export const ITEMS_PER_MAP = 20;
export const MAP_COUNT = 3;
/** Placement passes per map before FALLBACK_SPOTS (README "Placement"). */
export const MAX_PASSES = 40;

export const LITTER_POINTS = 50;
/** Win bonus: this many points per full second left on the clock. */
export const BONUS_PER_SECOND = 10;

/** Largest simulation step, ms: useRunFrame's dt is at most 1/20 s. Longer steps are clamped. */
export const MAX_STEP_MS = 50;
/** Cell size of the reachability flood fill (runner-centre cells). */
export const FLOOD_STEP = 0.25;

export const LITTER_KINDS = ["bottle", "paperBag", "tinCan", "banana"] as const;
export type LitterKind = (typeof LITTER_KINDS)[number];
export const PER_KIND = ITEMS_PER_MAP / LITTER_KINDS.length;

/** Per-map mix of the run seed: the three layouts come from three streams of one seed. */
export const MAP_SEED_MIX = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35] as const;
export const layoutSeedFor = (seed: number, map: number): number => ((seed >>> 0) ^ MAP_SEED_MIX[map]) >>> 0;

/** "Nothing": no slot collected, no map loaded. */
export const NONE = -1;

/**
 * Float slack for the spacing and reach edges (5.4 between grid spots is exact in decimal, not
 * always in floats). It cannot move a pickup: simMs is whole ms and the proof has seconds of room.
 */
const EDGE_EPS = 1e-9;

// ---------- the scoring proof (README "Server limits and why they hold") ----------

/** Proof step 3, one map: start pad to the first piece (4.0 - 0.8) + 19 legs of (5.4 - 1.6): 75.4. */
export const MAP_MIN_ROUTE = START_SPACING - PICKUP_REACH + (ITEMS_PER_MAP - 1) * (PAIR_SPACING - 2 * PICKUP_REACH);
/** Proof step 3, the run: three maps (the runner is put back on the pad, it never walks between maps): 226.2. */
export const GUARANTEED_MIN_ROUTE = MAP_COUNT * MAP_MIN_ROUTE;
/**
 * Proof step 4: 226.2 / 5 - a conservative 0.05 s safety margin (one MAX_FRAME_DT) = 45.19 s. Core
 * times every frame (useRunFrame's dt is counted in elapsedMs, core/README.md), so the margin is not
 * an untimed frame; it only makes the earliest win earlier than physics allows.
 */
export const FASTEST_FINISH_MS = Math.round((GUARANTEED_MIN_ROUTE / RUNNER.speed - MAX_FRAME_DT) * 1000);
/** The win at FASTEST_FINISH_MS: 3000 + 10 * 194 = 4940. */
export const BEST_SCORE = MAP_COUNT * ITEMS_PER_MAP * LITTER_POINTS + BONUS_PER_SECOND * Math.floor((DURATION_MS - FASTEST_FINISH_MS) / 1000);
/** Where a win's score (3000 + bonus) meets the rate cap 1000 + 100 t: 40.0 s. */
export const BREAK_EVEN_MS = 40_000;

// ---------- the maps (README "Obstacles per map") ----------

export type MapId = "park" | "city" | "beach";
export type ObstacleKind = "bench" | "tree" | "bin" | "building" | "lamp" | "palm" | "pole";

/** One obstacle: its centre and the half-extents of its collision square (the visual may be round). */
export interface Obstacle {
   kind: ObstacleKind;
   x: number;
   z: number;
   halfX: number;
   halfZ: number;
}

export interface MapConfig {
   id: MapId;
   /** ground tint for Scene */
   ground: string;
   obstacles: readonly Obstacle[];
}

/** Collision half-extents (README table): bench 2.4 x 0.8, tree 0.7, bin 0.7, building 3.2 x 3.2, lamp 0.3, palm 0.6, pole 0.25. */
export const HALF = {
   bench: { halfX: 1.2, halfZ: 0.4 },
   tree: { halfX: 0.7, halfZ: 0.7 },
   bin: { halfX: 0.7, halfZ: 0.7 },
   building: { halfX: 1.6, halfZ: 1.6 },
   lamp: { halfX: 0.3, halfZ: 0.3 },
   palm: { halfX: 0.6, halfZ: 0.6 },
   pole: { halfX: 0.25, halfZ: 0.25 },
} as const;

const at = (kind: ObstacleKind, x: number, z: number, turned = false): Obstacle => {
   const h = HALF[kind];
   return turned ? { kind, x, z, halfX: h.halfZ, halfZ: h.halfX } : { kind, x, z, ...h };
};

export const MAPS: readonly MapConfig[] = [
   {
      id: "park",
      ground: "#4d9a4a",
      obstacles: [
         at("bench", -6, 4),
         at("bench", 6, 4),
         at("bench", 0, -6),
         at("tree", -7, -7),
         at("tree", 7, -7),
         at("bin", 9, 10),
      ],
   },
   {
      id: "city",
      ground: "#8b929c",
      obstacles: [
         at("building", -7, -6),
         at("building", 7, -6),
         at("building", -7, 4),
         at("building", 7, 4),
         at("lamp", -3, -1),
         at("lamp", 3, -1),
         at("lamp", -3, 8),
         at("lamp", 3, 8),
         at("bin", 0, -10),
         at("bin", -11, -1),
      ],
   },
   {
      id: "beach",
      ground: "#e9d29a",
      obstacles: [
         at("palm", -8, -8),
         at("palm", 8, -8),
         at("palm", -9, 3),
         at("palm", 9, 3),
         at("pole", -4, -2),
         at("pole", 4, -2),
         at("pole", 0, 5),
         at("bin", 0, -11),
      ],
   },
];

/** A square on the ground, tall in y: the runner (y = 0) is always level with it, so pushes are horizontal. */
export function obstacleBox(o: Obstacle): AABB {
   return { min: { x: o.x - o.halfX, y: -10, z: o.z - o.halfZ }, max: { x: o.x + o.halfX, y: 10, z: o.z + o.halfZ } };
}

/** The floor: the runner's centre stays RUNNER.radius inside it (|x|, |z| <= 13.5). */
export const BOUNDS: AABB = { min: { x: -FLOOR_HALF, y: -10, z: -FLOOR_HALF }, max: { x: FLOOR_HALF, y: 10, z: FLOOR_HALF } };

// ---------- reachable-spot cache ----------

/** Spawn grid: 55 x 55 spots, x = (i - 27) * 0.5. */
export const SPOT_N = Math.round((2 * SPAWN_HALF) / SPAWN_GRID) + 1;
const SPOT_MID = (SPOT_N - 1) / 2;
export const spotX = (index: number): number => (Math.floor(index / SPOT_N) - SPOT_MID) * SPAWN_GRID;
export const spotZ = (index: number): number => ((index % SPOT_N) - SPOT_MID) * SPAWN_GRID;

/** Flood grid: 109 x 109 runner-centre cells over |x|, |z| <= 13.5. */
export const FLOOD_N = Math.round((2 * SPAWN_HALF) / FLOOD_STEP) + 1;
const FLOOD_MID = (FLOOD_N - 1) / 2;
const floodCoord = (k: number): number => (k - FLOOD_MID) * FLOOD_STEP;

export interface MapCache {
   map: number;
   /** the obstacle squares (stepRunner, the clearance check and the flood fill use these) */
   obstacles: AABB[];
   /** flood cell -> 1 when resolveSphereAabb and the wall clamp accept a runner centre there and it is connected to the start pad */
   reachable: Uint8Array;
   /** spawn spot indices that are 1.0 clear of every obstacle square and reachable (README "Placement" step 1) */
   spots: Int32Array;
}

/** Does stepRunner accept a runner centre here (touching an obstacle is allowed; the wall clamp is |x|, |z| <= 13.5)? */
export function acceptsCentre(obstacles: readonly AABB[], x: number, z: number): boolean {
   if (Math.abs(x) > SPAWN_HALF + EDGE_EPS || Math.abs(z) > SPAWN_HALF + EDGE_EPS) return false;
   for (let i = 0; i < obstacles.length; i++) {
      if (distanceToBoxXZ(x, z, obstacles[i]) < RUNNER.radius - EDGE_EPS) return false;
   }
   return true;
}

/** Clearance from a litter centre to the obstacle squares: at least PROP_CLEARANCE. */
export function isClear(obstacles: readonly AABB[], x: number, z: number): boolean {
   for (let i = 0; i < obstacles.length; i++) {
      if (distanceToBoxXZ(x, z, obstacles[i]) < PROP_CLEARANCE - EDGE_EPS) return false;
   }
   return true;
}

/** Flood fill (4 neighbours) over accepted runner-centre cells from the start pad. */
function floodFill(obstacles: readonly AABB[]): Uint8Array {
   const n = FLOOD_N * FLOOD_N;
   const ok = new Uint8Array(n);
   for (let i = 0; i < FLOOD_N; i++) {
      for (let j = 0; j < FLOOD_N; j++) if (acceptsCentre(obstacles, floodCoord(i), floodCoord(j))) ok[i * FLOOD_N + j] = 1;
   }
   const reached = new Uint8Array(n);
   const start = Math.round(START_PAD.x / FLOOD_STEP + FLOOD_MID) * FLOOD_N + Math.round(START_PAD.z / FLOOD_STEP + FLOOD_MID);
   if (!ok[start]) return reached;
   const queue = new Int32Array(n);
   let head = 0;
   let tail = 0;
   queue[tail++] = start;
   reached[start] = 1;
   while (head < tail) {
      const c = queue[head++];
      const i = Math.floor(c / FLOOD_N);
      const j = c % FLOOD_N;
      if (i > 0 && ok[c - FLOOD_N] && !reached[c - FLOOD_N]) (reached[c - FLOOD_N] = 1), (queue[tail++] = c - FLOOD_N);
      if (i < FLOOD_N - 1 && ok[c + FLOOD_N] && !reached[c + FLOOD_N]) (reached[c + FLOOD_N] = 1), (queue[tail++] = c + FLOOD_N);
      if (j > 0 && ok[c - 1] && !reached[c - 1]) (reached[c - 1] = 1), (queue[tail++] = c - 1);
      if (j < FLOOD_N - 1 && ok[c + 1] && !reached[c + 1]) (reached[c + 1] = 1), (queue[tail++] = c + 1);
   }
   return reached;
}

/** A litter spot is reachable when some reached runner-centre cell is within PICKUP_REACH of it. */
export function isReachable(cache: MapCache, x: number, z: number): boolean {
   const ci = Math.round(x / FLOOD_STEP + FLOOD_MID);
   const cj = Math.round(z / FLOOD_STEP + FLOOD_MID);
   const r = Math.ceil(PICKUP_REACH / FLOOD_STEP);
   for (let i = Math.max(0, ci - r); i <= Math.min(FLOOD_N - 1, ci + r); i++) {
      for (let j = Math.max(0, cj - r); j <= Math.min(FLOOD_N - 1, cj + r); j++) {
         if (!cache.reachable[i * FLOOD_N + j]) continue;
         if (Math.hypot(floodCoord(i) - x, floodCoord(j) - z) <= PICKUP_REACH + EDGE_EPS) return true;
      }
   }
   return false;
}

/** The cache of map `map`: obstacle squares, the flood fill and the clear, reachable spawn spots. `obstacles` is for tests. */
export function buildMapCache(map: number, obstacles: AABB[] = MAPS[map].obstacles.map(obstacleBox)): MapCache {
   const cache: MapCache = { map, obstacles, reachable: floodFill(obstacles), spots: new Int32Array(0) };
   const spots: number[] = [];
   for (let s = 0; s < SPOT_N * SPOT_N; s++) {
      const x = spotX(s);
      const z = spotZ(s);
      if (isClear(obstacles, x, z) && isReachable(cache, x, z)) spots.push(s);
   }
   cache.spots = Int32Array.from(spots);
   return cache;
}

// ---------- layouts ----------

export interface Layout {
   map: number;
   seed: number;
   /** litter centres and kinds (index into LITTER_KINDS), 20 each */
   x: number[];
   z: number[];
   kinds: number[];
   /** placement passes used (1..40), 0 when the fallback was taken */
   passes: number;
   fallback: boolean;
}

/**
 * Used only if all 40 passes fail (the 1000 x 3 test never takes it). Valid layouts in their own
 * right (rules.test.ts checks isValidLayout): the generator's layouts for seed 5155, frozen here.
 */
export const FALLBACK_SPOTS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
   [[3, 0], [-4.5, -11.5], [1, 7], [8.5, -9.5], [-7.5, 6], [12.5, 4.5], [3, -9.5], [-10.5, -4.5], [-5.5, 12], [-3.5, -4], [9.5, 12.5], [-13.5, 8], [-13.5, -11], [9.5, -3], [7, 7.5], [-3, 2], [-11.5, 2], [13, -12.5], [-11.5, 13.5], [13.5, -7]],
   [[12.5, -2], [-11.5, -12], [-6, -12], [5, 1], [6, 13.5], [-6.5, -1], [11, 8.5], [0, -2], [2.5, 6], [9.5, -13.5], [-8.5, 12], [-12, 1], [4, -9], [-4, 5], [-13.5, -6.5], [13, -9], [-12.5, 6.5], [13.5, 3.5], [-2.5, -7.5], [0.5, -13.5]],
   [[-10.5, 5.5], [2, -7.5], [-9.5, 0], [9.5, 0], [-12, 13], [-2, 5], [-11.5, -10.5], [-4.5, -6.5], [12.5, 8], [13, -5.5], [5, -13.5], [-6, -13], [5, 4], [11.5, 13.5], [5.5, 10], [12.5, -12], [1, -0.5], [-4.5, 11], [-13, -4.5], [7.5, -6]],
];

/** Kinds 0..3, five of each, in order (shuffled per layout). */
function fillKinds(out: number[]): void {
   for (let i = 0; i < ITEMS_PER_MAP; i++) out[i] = Math.floor(i / PER_KIND);
}

function shuffle(values: number[], rng: RngState): void {
   for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rngNext(rng) * (i + 1));
      const t = values[i];
      values[i] = values[j];
      values[j] = t;
   }
}

const tooClose = (ax: number, az: number, bx: number, bz: number, spacing: number): boolean =>
   (ax - bx) * (ax - bx) + (az - bz) * (az - bz) < spacing * spacing - EDGE_EPS;

/**
 * One placement pass (README "Placement"): the cached spots, minus those closer than 4.0 to the
 * start pad; pick one uniformly, drop every remaining spot closer than 5.4 to it, repeat 20 times.
 * Writes into `x`/`z` and returns false if the list ran out early.
 */
function placementPass(cache: MapCache, rng: RngState, list: Int32Array, x: number[], z: number[]): boolean {
   let len = 0;
   for (let k = 0; k < cache.spots.length; k++) {
      const s = cache.spots[k];
      if (!tooClose(spotX(s), spotZ(s), START_PAD.x, START_PAD.z, START_SPACING)) list[len++] = s;
   }
   for (let placed = 0; placed < ITEMS_PER_MAP; placed++) {
      if (len === 0) return false;
      const pick = list[Math.floor(rngNext(rng) * len)];
      const px = spotX(pick);
      const pz = spotZ(pick);
      x[placed] = px;
      z[placed] = pz;
      let keep = 0;
      for (let k = 0; k < len; k++) {
         const s = list[k];
         if (!tooClose(spotX(s), spotZ(s), px, pz, PAIR_SPACING)) list[keep++] = s;
      }
      len = keep;
   }
   return true;
}

/** The layout of map `map` for a run seed: up to 40 passes on one stream, then the kinds from the same stream. */
export function generateLayout(seed: number, map: number, cache: MapCache = buildMapCache(map)): Layout {
   const s = layoutSeedFor(seed, map);
   const rng: RngState = { s };
   const layout: Layout = {
      map,
      seed: seed >>> 0,
      x: new Array<number>(ITEMS_PER_MAP).fill(0),
      z: new Array<number>(ITEMS_PER_MAP).fill(0),
      kinds: new Array<number>(ITEMS_PER_MAP).fill(0),
      passes: 0,
      fallback: false,
   };
   const list = new Int32Array(cache.spots.length);
   let ok = false;
   for (let pass = 1; pass <= MAX_PASSES && !ok; pass++) {
      ok = placementPass(cache, rng, list, layout.x, layout.z);
      if (ok) layout.passes = pass;
   }
   if (!ok) {
      FALLBACK_SPOTS[map].forEach(([fx, fz], i) => {
         layout.x[i] = fx;
         layout.z[i] = fz;
      });
      layout.fallback = true;
   }
   fillKinds(layout.kinds);
   shuffle(layout.kinds, rng);
   return layout;
}

const onGrid = (v: number): boolean => Math.abs(v / SPAWN_GRID - Math.round(v / SPAWN_GRID)) < EDGE_EPS;

/** Everything fairness and the proof rely on (README "A layout must pass isValidLayout"). */
export function isValidLayout(layout: Layout, cache: MapCache): boolean {
   const { x, z, kinds } = layout;
   if (layout.map !== cache.map || x.length !== ITEMS_PER_MAP || z.length !== ITEMS_PER_MAP || kinds.length !== ITEMS_PER_MAP) return false;
   const perKind = [0, 0, 0, 0];
   for (let i = 0; i < ITEMS_PER_MAP; i++) {
      const k = kinds[i];
      if (!Number.isInteger(k) || k < 0 || k >= LITTER_KINDS.length) return false;
      perKind[k] += 1;
   }
   if (perKind.some((n) => n !== PER_KIND)) return false;
   for (let i = 0; i < ITEMS_PER_MAP; i++) {
      const xi = x[i];
      const zi = z[i];
      if (!Number.isFinite(xi) || !Number.isFinite(zi)) return false;
      if (Math.abs(xi) > SPAWN_HALF + EDGE_EPS || Math.abs(zi) > SPAWN_HALF + EDGE_EPS) return false;
      if (!onGrid(xi) || !onGrid(zi)) return false;
      if (!isClear(cache.obstacles, xi, zi)) return false;
      if (tooClose(xi, zi, START_PAD.x, START_PAD.z, START_SPACING)) return false;
      if (!isReachable(cache, xi, zi)) return false;
      for (let j = 0; j < i; j++) if (tooClose(xi, zi, x[j], z[j], PAIR_SPACING)) return false;
   }
   return true;
}

// ---------- runner movement ----------

export interface RunnerState extends Vec3Like {
   vx: number;
   vz: number;
   /** facing, radians around +y (0 = facing +z, the camera) */
   heading: number;
}

export function createRunner(): RunnerState {
   return { x: START_PAD.x, y: 0, z: START_PAD.z, vx: 0, vz: 0, heading: START_PAD.heading };
}

/**
 * One movement step (robot-collector's shape). `dirX/dirZ` is the wanted world direction (length
 * <= 1, analog; longer is normalised, so diagonals are not faster), `dt` in seconds. Obstacles push
 * the runner out, the floor keeps its centre in |x|, |z| <= 13.5, then the speed guard scales the
 * step back. Mutates `runner`, allocates nothing. Guarantee used by the scoring proof: one step
 * never moves more than 5 · dt, whatever the input, the pushes or the walls do.
 */
export function stepRunner(runner: RunnerState, dirX: number, dirZ: number, dt: number, obstacles: readonly AABB[]): void {
   if (!(dt > 0)) return;
   const { accel, brake, radius, turnRate, speed } = RUNNER;

   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }

   let dvx = dirX * speed - runner.vx;
   let dvz = dirZ * speed - runner.vz;
   const dv = Math.hypot(dvx, dvz);
   const maxDv = (len > 0.01 ? accel : brake) * dt;
   if (dv > maxDv) {
      dvx *= maxDv / dv;
      dvz *= maxDv / dv;
   }
   runner.vx += dvx;
   runner.vz += dvz;

   const fromX = runner.x;
   const fromZ = runner.z;
   runner.x += runner.vx * dt;
   runner.y = 0;
   runner.z += runner.vz * dt;

   for (let i = 0; i < obstacles.length; i++) resolveSphereAabb(runner, radius, obstacles[i], runner);
   clampToBounds(runner, BOUNDS, radius, runner);

   // speed guard: whatever the pushes did, this step moves at most speed * dt
   const mx = runner.x - fromX;
   const mz = runner.z - fromZ;
   const moved = Math.hypot(mx, mz);
   const maxMove = speed * dt;
   if (moved > maxMove) {
      runner.x = fromX + (mx * maxMove) / moved;
      runner.z = fromZ + (mz * maxMove) / moved;
   }

   // velocity = what really happened: walking into a bench stops, sliding along it keeps going
   runner.vx = (runner.x - fromX) / dt;
   runner.vz = (runner.z - fromZ) / dt;

   if (Math.hypot(runner.vx, runner.vz) > 0.3) {
      runner.heading = turnTowards(runner.heading, Math.atan2(runner.vx, runner.vz), 1 - Math.exp(-turnRate * dt));
   }
}

// ---------- scoring ----------

/** Win bonus: 10 per full second left. */
export function timeBonus(timeLeftMs: number): number {
   return BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** The final score (README "Scoring"): 50 per piece, plus the time bonus on a win only. */
export function runScore(collected: number, won: boolean, timeLeftMs: number): number {
   return LITTER_POINTS * collected + (won ? timeBonus(timeLeftMs) : 0);
}

/** The server's check (core/limits.ts) with this game's limits from meta.ts. */
export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, cleanCityMeta.scoring);
}

/** Safety net only (core/limits.ts): the proof shows reachable results never reach the cap. */
export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, cleanCityMeta.scoring);
}

// ---------- the run ----------

/** One of the 20 litter slots: moved onto the next layout on a map change, never replaced. */
export interface LitterSlot extends Vec3Like {
   x: number;
   /** always 0: litter lies on the ground (a Vec3Like for core's circle test) */
   y: number;
   z: number;
   /** index into LITTER_KINDS */
   kind: number;
   active: boolean;
}

/** One frame of input, already in world space (Scene: inputToWorld(moveX, moveY, 0)). */
export interface StepInput {
   /** wanted direction: moveX = world x, moveY = world z. Length <= 1 (longer is normalised); not finite counts as 0. */
   moveX: number;
   moveY: number;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveY: 0 };
}

/** What happened in one step. The same object every step (reset at the start of each step). */
export interface StepEvents {
   /** the slot collected this step, NONE without a pickup */
   collected: number;
   /** this step's pickup was the map's 20th */
   mapCleared: boolean;
   /** the map (0..2) whose layout was written into the slots this step, NONE otherwise */
   nextMap: number;
   /** "win" after map 3's 20th piece, "timeup" when the clock reaches DURATION_MS */
   ended: "win" | "timeup" | null;
}

export interface CleanRun {
   seed: number;
   /** per map: obstacle squares, flood fill, clear reachable spots */
   caches: MapCache[];
   /** per map: the seeded litter layout */
   layouts: Layout[];
   /** current map, 0..2 (stats.map = map + 1) */
   map: number;

   // clock
   /** simulation time, whole ms of play */
   simMs: number;
   /** fraction of a ms carried to the next step, [0, 1) */
   carry: number;
   /** whole ms of the latest step, 0..MAX_STEP_MS */
   stepMs: number;

   runner: RunnerState;
   /** the 20 slots of the current map */
   litter: LitterSlot[];
   /** pieces collected on the current map (stats.items) */
   items: number;
   /** pieces collected in the run */
   collected: number;
   /** 50 per piece; on a win runScore(60, true, DURATION_MS - wonAtMs) */
   score: number;
   /** simMs of the win, NONE before */
   wonAtMs: number;

   ended: "win" | "timeup" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   return { collected: NONE, mapCleared: false, nextMap: NONE, ended: null };
}

function resetEvents(ev: StepEvents): void {
   ev.collected = NONE;
   ev.mapCleared = false;
   ev.nextMap = NONE;
   ev.ended = null;
}

/** Writes map `map`'s layout into the 20 slots and parks the runner on the start pad at rest. */
function loadMap(run: CleanRun, map: number): void {
   const layout = run.layouts[map];
   run.map = map;
   run.items = 0;
   for (let i = 0; i < ITEMS_PER_MAP; i++) {
      const slot = run.litter[i];
      slot.x = layout.x[i];
      slot.z = layout.z[i];
      slot.kind = layout.kinds[i];
      slot.active = true;
   }
   const r = run.runner;
   r.x = START_PAD.x;
   r.y = 0;
   r.z = START_PAD.z;
   r.vx = 0;
   r.vz = 0;
   r.heading = START_PAD.heading;
}

/**
 * A new run on map 1's start pad: the three caches and the three layouts are built here (Scene
 * calls this once in its useState initializer). Allocates everything the run will ever use.
 */
export function createRun(seed: number): CleanRun {
   const s = seed >>> 0;
   const caches = MAPS.map((_m, map) => buildMapCache(map));
   const layouts = caches.map((cache, map) => generateLayout(s, map, cache));
   const run: CleanRun = {
      seed: s,
      caches,
      layouts,
      map: 0,
      simMs: 0,
      carry: 0,
      stepMs: 0,
      runner: createRunner(),
      litter: Array.from({ length: ITEMS_PER_MAP }, () => ({ x: 0, y: 0, z: 0, kind: 0, active: false })),
      items: 0,
      collected: 0,
      score: 0,
      wonAtMs: NONE,
      ended: null,
      events: createEvents(),
   };
   loadMap(run, 0);
   return run;
}

/**
 * Advances the integer clock by `dtMs` (clamped to MAX_STEP_MS) with the carried remainder, never
 * past DURATION_MS. Returns the whole-ms step.
 */
export function advanceClock(run: CleanRun, dtMs: number): number {
   if (!(dtMs > 0)) {
      run.stepMs = 0;
      return 0;
   }
   run.carry += Math.min(dtMs, MAX_STEP_MS);
   let stepMs = Math.floor(run.carry);
   run.carry -= stepMs;
   if (run.simMs + stepMs >= DURATION_MS) {
      stepMs = DURATION_MS - run.simMs;
      run.carry = 0;
   }
   run.stepMs = stepMs;
   run.simMs += stepMs;
   return stepMs;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/** Is the runner's circle touching the slot's (centres within PICKUP_REACH = 0.5 + 0.3)? Core's circle test. */
export function inReach(runner: Vec3Like, slot: LitterSlot): boolean {
   return circlesOverlapXZ(runner, RUNNER.radius, slot, LITTER_RADIUS);
}

/**
 * One simulation step: `dtMs` is useRunFrame's dt · 1000 (dt <= 0 or NaN does nothing). Order:
 * 1. the clock; the step that reaches DURATION_MS ends the run ("timeup") before anything else, as RunClock does;
 * 2. move;
 * 3. pickup: at most one piece per step (pieces are 5.4 apart, the reach is 0.8). The map's 20th
 *    piece writes the next layout into the same slots and parks the runner; nothing else is collected
 *    in that step. Map 3's 20th ends the run with "win" and adds the time bonus.
 * Returns run.events, the same object every step. Allocates nothing.
 */
export function step(run: CleanRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null || !(dtMs > 0)) return ev;

   const stepMs = advanceClock(run, dtMs);
   if (run.simMs >= DURATION_MS) {
      run.ended = "timeup";
      ev.ended = "timeup";
      return ev;
   }

   stepRunner(run.runner, finite(input.moveX), finite(input.moveY), stepMs / 1000, run.caches[run.map].obstacles);

   for (let i = 0; i < ITEMS_PER_MAP; i++) {
      const slot = run.litter[i];
      if (!slot.active || !inReach(run.runner, slot)) continue;
      slot.active = false;
      run.items += 1;
      run.collected += 1;
      run.score += LITTER_POINTS;
      ev.collected = i;
      if (run.items === ITEMS_PER_MAP) {
         ev.mapCleared = true;
         if (run.map === MAP_COUNT - 1) {
            run.ended = "win";
            run.wonAtMs = run.simMs;
            run.score = runScore(run.collected, true, DURATION_MS - run.simMs);
            ev.ended = "win";
         } else {
            loadMap(run, run.map + 1);
            ev.nextMap = run.map;
         }
      }
      break;
   }
   return ev;
}
