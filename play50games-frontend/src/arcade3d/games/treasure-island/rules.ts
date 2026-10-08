// Treasure Island rules: the seeded island (props, five hidden treasures, the find order of their
// types), the explorer's movement, the detector, digging, the tide, the seagull hint and the score.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now. Scene.tsx feeds it
// input, dt and the play time every frame; rules.test.ts drives it directly. Same seed = same island.
//
// Units: metres and seconds; x east, z south (+z = the dock), y up. The server limits in meta.ts
// rest on the numbers below (top speed, spacing, the fairness band, the dig time): README.md
// "Server limits and why they hold" has the proof, rules.test.ts checks it.
import { distanceToBoxXZ, resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng, turnTowards } from "@/arcade3d/core/math";
import { treasureIslandMeta } from "./meta";

// ---------- tuning ----------

export const DURATION_MS = 90_000;
export const TREASURE_COUNT = 5;

/** The island ellipse (semi-axes, m) and its bands as `rho` (1 = the full-tide shoreline). */
export const ISLAND = {
   rx: 14,
   rz: 11,
   /** grass inside this rho, beach outside (looks only: the same speed on both) */
   grass: 0.78,
   /** the sand is flat (height 0) inside this rho and slopes down to the water at rho 1 (looks) */
   sandFlat: 0.75,
   /** wading band beyond the shoreline: the explorer's centre stays within shore + this */
   shallows: 0.12,
} as const;

/** Robot-collector's movement model. `maxSpeed` is the number the scoring proof rests on. */
export const EXPLORER = {
   radius: 0.4,
   maxSpeed: 5,
   /** top speed in the shallows (60 %) */
   wadeSpeed: 3,
   accel: 24,
   brake: 30,
   turnRate: 14,
   startX: 0,
   startZ: 9.2,
} as const;

/** Strength s = clamp(1 - d / range); pulse period = slowPeriod - (slowPeriod - fastPeriod) * s. */
export const DETECTOR = { range: 12, slowPeriod: 1.2, fastPeriod: 0.15 } as const;

/** Hold this long (s, play time) with the feet planted; a treasure within `reach` of the centre is found. */
export const DIG = { holdS: 0.6, reach: 0.9 } as const;

/** shore(t) = 1 until startS, then linear to finalShore at endS (the walkable radius shrinks by 25 %). */
export const TIDE = { startS: 70, endS: 90, finalShore: 0.75 } as const;

/** The seagull circles over the detector's target `afterS` after the start or the last find. */
export const HINT = { afterS: 20, radius: 2, height: 4.5, lapS: 4 } as const;

/** Treasure spacing (m) and placement (rho), checked by isValidIsland. */
export const SPACING = { treasures: 6, fromStart: 7, fromProps: 1.5, maxRho: 0.72 } as const;

/**
 * Fairness band: the ideal route (start -> all five, centre to centre, best of the 120 orders)
 * must be this long, so no seed is much easier than another; the limit proof rests on `min`.
 */
export const IDEAL_ROUTE = { min: 38, max: 56 } as const;

export const POINTS = { find: 200, clean: 50, perSecond: 10 } as const;

// ---------- the island ----------

export type TreasureType = "coins" | "gem" | "chest";

export interface Circle {
   x: number;
   z: number;
   r: number;
}

export interface Palm {
   x: number;
   z: number;
   yaw: number;
   /** looks only: a size factor around 1 */
   size: number;
}

export interface Rock {
   x: number;
   z: number;
   /** the rock's length (m); its footprint is a circle of ROCK_FOOTPRINT x size */
   size: number;
   yaw: number;
}

export interface Island {
   seed: number;
   palms: Palm[];
   rocks: Rock[];
   /** the five treasure spots, by index */
   treasures: Array<{ x: number; z: number }>;
   /** the type of the k-th find (the order is the player's): the chest is the 4th or 5th */
   findTypes: TreasureType[];
   /** every round footprint: palm trunks, rocks and the umbrella pole */
   circles: readonly Circle[];
   /** every box footprint: the crate stack, the rowboat and the dock */
   boxes: readonly AABB[];
}

export const PALM_TRUNK = 0.3;
export const ROCK_FOOTPRINT = 0.42;
export const PALMS = { min: 8, max: 12, minRho: 0.15, maxRho: 0.8, apart: 2.2, fromStart: 3, fromRocks: 1.0, fromFixed: 1.2 } as const;
export const OUTCROPS = { minRho: 0.45, maxRho: 0.75, rocksMin: 3, rocksMax: 5, sizeMin: 0.6, sizeMax: 2.5, spread: 1.6, fromStart: 4 } as const;

const box = (cx: number, cz: number, hx: number, hz: number): AABB => ({
   min: { x: cx - hx, y: -10, z: cz - hz },
   max: { x: cx + hx, y: 10, z: cz + hz },
});

/** The fixed props (rules footprints, never the mesh). */
export const FIXED = {
   /** three 0.8 m crates (two side by side, one on top) as one box */
   crates: { x: -2.4, z: 9.0, hx: 0.85, hz: 0.45 },
   umbrella: { x: 7.5, z: 6.5, r: 0.15 },
   rowboat: { x: -9.5, z: 6.0, hx: 1.3, hz: 0.55 },
   /** the dock runs south from z 10.2 into the sea (decoration, not walkable) */
   dock: { hx: 0.9, fromZ: 10.2, toZ: 16 },
} as const;

export const FIXED_BOXES: readonly AABB[] = [
   box(FIXED.crates.x, FIXED.crates.z, FIXED.crates.hx, FIXED.crates.hz),
   box(FIXED.rowboat.x, FIXED.rowboat.z, FIXED.rowboat.hx, FIXED.rowboat.hz),
   box(0, (FIXED.dock.fromZ + FIXED.dock.toZ) / 2, FIXED.dock.hx, (FIXED.dock.toZ - FIXED.dock.fromZ) / 2),
];
export const UMBRELLA_CIRCLE: Circle = { x: FIXED.umbrella.x, z: FIXED.umbrella.z, r: FIXED.umbrella.r };

export const START = { x: EXPLORER.startX, z: EXPLORER.startZ } as const;

/**
 * Treasures stay in sight of the camera (it always looks north, from the dock's side, 50° down:
 * looks.ts): a palm crown (1.2 m round, 1.0-3.0 m up) or the umbrella's canopy (1.34 m round, 1.73-2.8 m
 * up) hides the ground north of it, from its own centre's z - `near` to z - `far` (height / tan 50°).
 * No treasure lies within the crown's radius + `margin` of that strip, so the dig is never behind one.
 */
export const SIGHT = { palm: { near: 0.8, far: 2.6, r: 1.2 }, umbrella: { near: 1.45, far: 2.35, r: 1.34 }, margin: 0.3 } as const;

/** Distance from p to the segment from (x, z - near) to (x, z - far). */
function toShadow(p: { x: number; z: number }, x: number, z: number, near: number, far: number): number {
   const sz = Math.min(z - near, Math.max(z - far, p.z));
   return Math.hypot(p.x - x, p.z - sz);
}

/** Is the ground at p hidden from the camera by a palm crown or the umbrella's canopy? */
export function behindCanopy(p: { x: number; z: number }, palms: readonly Palm[]): boolean {
   const { palm, umbrella, margin } = SIGHT;
   if (toShadow(p, FIXED.umbrella.x, FIXED.umbrella.z, umbrella.near, umbrella.far) < umbrella.r + margin) return true;
   return palms.some((q) => toShadow(p, q.x, q.z, palm.near * q.size, palm.far * q.size) < palm.r * q.size + margin);
}

/** Elliptic radius: 1 on the full-tide shoreline. */
export function rho(x: number, z: number): number {
   return Math.hypot(x / ISLAND.rx, z / ISLAND.rz);
}

/** The shoreline's rho at play time `t` (s). */
export function shoreAt(t: number): number {
   if (t <= TIDE.startS) return 1;
   const k = Math.min(1, (t - TIDE.startS) / (TIDE.endS - TIDE.startS));
   return 1 - (1 - TIDE.finalShore) * k;
}

/** How far the explorer's centre may go (rho) at a given shoreline. */
export const reachRho = (shore: number) => shore + ISLAND.shallows;

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Distance from a point to the nearest footprint edge (0 inside one). */
export function clearance(island: Pick<Island, "circles" | "boxes">, x: number, z: number): number {
   let best = Infinity;
   for (const c of island.circles) best = Math.min(best, Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r));
   for (const b of island.boxes) best = Math.min(best, distanceToBoxXZ(x, z, b));
   return best;
}

const ATTEMPTS = 40;
const TREASURE_PICKS = 400;
const PALM_PICKS = 60;

/** A point on the island at elliptic radius `r` and angle `a` (x = rx r cos a, z = rz r sin a). */
const onIsland = (r: number, a: number) => ({ x: ISLAND.rx * r * Math.cos(a), z: ISLAND.rz * r * Math.sin(a) });

function placeRocks(rng: () => number): Rock[] {
   const rocks: Rock[] = [];
   for (const side of [1, -1]) {
      // one outcrop east (side 1), one west, within ±60° of the axis
      let centre = onIsland(0, 0);
      for (let pick = 0; pick < 40; pick++) {
         const a = (side > 0 ? 0 : Math.PI) + (rng() * 2 - 1) * (Math.PI / 3);
         centre = onIsland(OUTCROPS.minRho + rng() * (OUTCROPS.maxRho - OUTCROPS.minRho), a);
         if (dist(centre, START) >= OUTCROPS.fromStart + OUTCROPS.spread + 1.5 && dist(centre, UMBRELLA_CIRCLE) > 4) break;
      }
      const count = OUTCROPS.rocksMin + Math.floor(rng() * (OUTCROPS.rocksMax - OUTCROPS.rocksMin + 1));
      for (let i = 0; i < count; i++) {
         // the biggest rock in the middle, smaller ones around it
         const size = i === 0 ? 1.6 + rng() * (OUTCROPS.sizeMax - 1.6) : OUTCROPS.sizeMin + rng() * 1.2;
         const a = rng() * Math.PI * 2;
         const r = i === 0 ? 0 : 0.7 + rng() * (OUTCROPS.spread - 0.7);
         rocks.push({ x: centre.x + Math.cos(a) * r, z: centre.z + Math.sin(a) * r, size, yaw: rng() * Math.PI * 2 });
      }
   }
   return rocks;
}

function placePalms(rng: () => number, rocks: Rock[]): Palm[] {
   const palms: Palm[] = [];
   const want = PALMS.min + Math.floor(rng() * (PALMS.max - PALMS.min + 1));
   const fixed = { circles: [UMBRELLA_CIRCLE], boxes: FIXED_BOXES };
   for (let i = 0; i < want; i++) {
      for (let pick = 0; pick < PALM_PICKS; pick++) {
         const p = onIsland(Math.sqrt(PALMS.minRho ** 2 + rng() * (PALMS.maxRho ** 2 - PALMS.minRho ** 2)), rng() * Math.PI * 2);
         if (dist(p, START) < PALMS.fromStart) continue;
         if (palms.some((o) => dist(o, p) < PALMS.apart)) continue;
         if (rocks.some((r) => dist(r, p) - ROCK_FOOTPRINT * r.size - PALM_TRUNK < PALMS.fromRocks)) continue;
         if (clearance(fixed, p.x, p.z) - PALM_TRUNK < PALMS.fromFixed) continue;
         palms.push({ x: p.x, z: p.z, yaw: rng() * Math.PI * 2, size: 0.9 + rng() * 0.25 });
         break;
      }
   }
   return palms;
}

/** The footprints of a set of palms and rocks plus the fixed props. */
export function footprints(palms: readonly Palm[], rocks: readonly Rock[]): Pick<Island, "circles" | "boxes"> {
   return {
      circles: [
         ...palms.map((p) => ({ x: p.x, z: p.z, r: PALM_TRUNK })),
         ...rocks.map((r) => ({ x: r.x, z: r.z, r: ROCK_FOOTPRINT * r.size })),
         UMBRELLA_CIRCLE,
      ],
      boxes: [...FIXED_BOXES],
   };
}

function fitsTreasure(p: { x: number; z: number }, placed: Array<{ x: number; z: number }>, prints: Pick<Island, "circles" | "boxes">, palms: readonly Palm[]): boolean {
   if (rho(p.x, p.z) > SPACING.maxRho) return false;
   if (behindCanopy(p, palms)) return false;
   if (dist(p, START) < SPACING.fromStart) return false;
   if (placed.some((o) => dist(o, p) < SPACING.treasures)) return false;
   return clearance(prints, p.x, p.z) >= SPACING.fromProps;
}

/** The find order's types: a seeded order of coins, coins, gem, gem with the chest 4th or 5th. */
function findOrder(rng: () => number): TreasureType[] {
   const rest: TreasureType[] = ["coins", "coins", "gem", "gem"];
   for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
   }
   rest.splice(rng() < 0.5 ? 3 : 4, 0, "chest");
   return rest;
}

/**
 * The island for one run. Rejection sampling: an attempt draws the rocks, the palms and the five
 * treasures; one that breaks a rule or the fairness band is thrown away and the next attempt is
 * drawn from the same seed. After ATTEMPTS failures the tested FALLBACK_ISLAND is used.
 */
export function generateIsland(seed: number): Island {
   const rng = createRng(seed);
   for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const island = drawIsland(seed, rng);
      if (island && isValidIsland(island)) return island;
   }
   return { ...FALLBACK_ISLAND, seed };
}

/** One attempt (null if a treasure found no spot). Exported for the acceptance-rate test. */
export function drawIsland(seed: number, rng: () => number): Island | null {
   const rocks = placeRocks(rng);
   const palms = placePalms(rng, rocks);
   const prints = footprints(palms, rocks);
   const treasures: Array<{ x: number; z: number }> = [];
   for (let i = 0; i < TREASURE_COUNT; i++) {
      for (let pick = 0; pick < TREASURE_PICKS; pick++) {
         const p = onIsland(SPACING.maxRho * Math.sqrt(rng()), rng() * Math.PI * 2);
         if (fitsTreasure(p, treasures, prints, palms)) {
            treasures.push({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 });
            break;
         }
      }
      if (treasures.length !== i + 1) return null;
   }
   return { seed, palms, rocks, treasures, findTypes: findOrder(rng), circles: prints.circles, boxes: prints.boxes };
}

// ---------- validity ----------

/** Flood-fill grid: 0.25 m cells over the whole clamp area. */
export const GRID = { cell: 0.25, halfX: 16, halfZ: 13 } as const;
const NX = Math.round((2 * GRID.halfX) / GRID.cell) + 1;
const NZ = Math.round((2 * GRID.halfZ) / GRID.cell) + 1;
const cellX = (i: number) => -GRID.halfX + i * GRID.cell;
const cellZ = (j: number) => -GRID.halfZ + j * GRID.cell;
const cellOf = (x: number, z: number) => Math.round((x + GRID.halfX) / GRID.cell) * NZ + Math.round((z + GRID.halfZ) / GRID.cell);

/**
 * The cells the explorer's centre can reach from the start at the final tide (it can only lose
 * ground earlier on): inside rho <= reachRho(finalShore), at least the explorer's radius from every
 * footprint. 1 = reachable.
 */
export function reachableCells(island: Pick<Island, "circles" | "boxes">): Uint8Array {
   const free = new Uint8Array(NX * NZ);
   const limit = reachRho(TIDE.finalShore);
   for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (rho(cellX(i), cellZ(j)) <= limit) free[i * NZ + j] = 1;
   const r = EXPLORER.radius;
   const block = (x0: number, x1: number, z0: number, z1: number, inside: (x: number, z: number) => boolean) => {
      const i0 = Math.max(0, Math.floor((x0 + GRID.halfX) / GRID.cell));
      const i1 = Math.min(NX - 1, Math.ceil((x1 + GRID.halfX) / GRID.cell));
      const j0 = Math.max(0, Math.floor((z0 + GRID.halfZ) / GRID.cell));
      const j1 = Math.min(NZ - 1, Math.ceil((z1 + GRID.halfZ) / GRID.cell));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (inside(cellX(i), cellZ(j))) free[i * NZ + j] = 0;
   };
   for (const c of island.circles) {
      const R = c.r + r;
      block(c.x - R, c.x + R, c.z - R, c.z + R, (x, z) => Math.hypot(x - c.x, z - c.z) < R);
   }
   for (const b of island.boxes) block(b.min.x - r, b.max.x + r, b.min.z - r, b.max.z + r, (x, z) => distanceToBoxXZ(x, z, b) < r);
   const seen = new Uint8Array(NX * NZ);
   const start = cellOf(START.x, START.z);
   if (!free[start]) return seen;
   const queue = new Int32Array(NX * NZ);
   let head = 0;
   let tail = 0;
   queue[tail++] = start;
   seen[start] = 1;
   while (head < tail) {
      const n = queue[head++];
      const i = Math.floor(n / NZ);
      const j = n % NZ;
      const visit = (ni: number, nj: number) => {
         if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) return;
         const m = ni * NZ + nj;
         if (free[m] && !seen[m]) {
            seen[m] = 1;
            queue[tail++] = m;
         }
      };
      visit(i + 1, j);
      visit(i - 1, j);
      visit(i, j + 1);
      visit(i, j - 1);
   }
   return seen;
}

/** Is the treasure's spot reachable (the explorer can stand on it) at the final tide? */
export function isReachable(seen: Uint8Array, p: { x: number; z: number }): boolean {
   return seen[cellOf(p.x, p.z)] === 1;
}

/** Every order of the indices (120 for five). */
function permutations(items: number[]): number[][] {
   if (items.length <= 1) return [items];
   return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}
const ORDERS = permutations([0, 1, 2, 3, 4]);

/**
 * Shortest route from the start through all five, over the 120 orders. `reach` = 0: the ideal
 * route, centre to centre. `reach` = DIG.reach: a lower bound on ANY real route, since the
 * explorer's centre only has to come within the reach of each spot (the start leg is at least its
 * centre distance - reach, every other leg at least its centre distance - 2 reach, never below 0).
 */
export function shortestRoute(treasures: ReadonlyArray<{ x: number; z: number }>, reach = 0): number {
   let best = Infinity;
   for (const order of ORDERS) {
      let length = Math.max(0, dist(START, treasures[order[0]]) - reach);
      for (let k = 1; k < order.length; k++) length += Math.max(0, dist(treasures[order[k - 1]], treasures[order[k]]) - 2 * reach);
      if (length < best) best = length;
   }
   return best;
}

/** Checks every rule the proof, the fairness band and the tide rely on. */
export function isValidIsland(island: Island): boolean {
   const { treasures, findTypes, palms, rocks } = island;
   if (treasures.length !== TREASURE_COUNT) return false;
   if (palms.length < PALMS.min || palms.length > PALMS.max) return false;
   const prints = footprints(palms, rocks);
   for (let i = 0; i < treasures.length; i++) {
      if (!fitsTreasure(treasures[i], treasures.slice(0, i), prints, palms)) return false;
   }
   const types = [...findTypes].sort().join();
   if (types !== "chest,coins,coins,gem,gem" || (findTypes[3] !== "chest" && findTypes[4] !== "chest")) return false;
   const seen = reachableCells(prints);
   if (!treasures.every((t) => isReachable(seen, t))) return false;
   const ideal = shortestRoute(treasures);
   return ideal >= IDEAL_ROUTE.min && ideal <= IDEAL_ROUTE.max;
}

/** A valid island (seed 7's), used only if a seed cannot produce one (tests keep it valid and unused). */
export const FALLBACK_ISLAND: Island = (() => {
   const palms: Palm[] = (
      [
         [-8.03, 0.39, 4.02, 1.05], [-4.76, 3.49, 3.26, 0.99], [-2.57, -7.47, 1.72, 1.09], [6.15, 5.43, 5.71, 1.14],
         [-2.86, 5.69, 1.18, 1.06], [-9.96, -1.85, 4.66, 0.91], [-2.15, 3.15, 3.32, 1.06], [-7.79, 3, 4.28, 1.02],
      ] as const
   ).map(([x, z, yaw, size]) => ({ x, z, yaw, size }));
   const rocks: Rock[] = (
      [
         [5.93, 2.17, 2.14, 0.31], [7.05, 2.15, 0.91, 4.32], [6.4, 2.98, 1.35, 4.43], [4.47, 2.66, 1.47, 2.91],
         [-7.79, 5.48, 1.71, 3.67], [-8.78, 5.03, 1.39, 2.55], [-8.76, 6.49, 1.63, 3.94], [-7.05, 5.42, 1.21, 0.31], [-8.56, 6.36, 0.92, 4.23],
      ] as const
   ).map(([x, z, size, yaw]) => ({ x, z, size, yaw }));
   const prints = footprints(palms, rocks);
   return {
      seed: 0,
      palms,
      rocks,
      treasures: [
         { x: -1.04, z: -0.88 },
         { x: -4.55, z: -6.4 },
         { x: 5.9, z: -4.28 },
         { x: 9.31, z: 2.34 },
         { x: -9.53, z: 1.74 },
      ],
      findTypes: ["gem", "gem", "coins", "coins", "chest"],
      circles: prints.circles,
      boxes: prints.boxes,
   };
})();

// ---------- the scoring proof (constants only: no gameplay) ----------

/**
 * Every real route is at least this long (m): the band's minimum ideal route minus the reach at
 * the start leg's far end and at both ends of the four other legs. No leg is clipped at 0, since
 * the start leg is >= SPACING.fromStart > reach and every other >= SPACING.treasures > 2 reach.
 */
export const MIN_ROUTE = IDEAL_ROUTE.min - DIG.reach - (TREASURE_COUNT - 1) * 2 * DIG.reach;

/** The earliest possible win (ms): MIN_ROUTE at top speed plus five digs with the feet planted. */
export const EARLIEST_WIN_MS = (MIN_ROUTE / EXPLORER.maxSpeed + TREASURE_COUNT * DIG.holdS) * 1000;

// ---------- the explorer ----------

export interface ExplorerState extends Vec3Like {
   vx: number;
   vz: number;
   /** facing, radians around +y (0 = facing +z, the dock; PI = north) */
   heading: number;
}

export function createExplorer(): ExplorerState {
   return { x: START.x, y: 0, z: START.z, vx: 0, vz: 0, heading: Math.PI };
}

/** Keeps the explorer's centre within the water's edge plus the shallows (radial, in rho). */
export function clampToShore(e: { x: number; z: number }, shore: number): void {
   const limit = reachRho(shore);
   const r = rho(e.x, e.z);
   if (r > limit) {
      e.x *= limit / r;
      e.z *= limit / r;
   }
}

function pushOutOfCircle(e: ExplorerState, c: Circle): void {
   const min = c.r + EXPLORER.radius;
   let dx = e.x - c.x;
   let dz = e.z - c.z;
   let d = Math.hypot(dx, dz);
   if (d >= min) return;
   if (d < 1e-9) {
      dx = 0;
      dz = 1;
      d = 1;
   }
   e.x = c.x + (dx / d) * min;
   e.z = c.z + (dz / d) * min;
}

function resolveProps(e: ExplorerState, island: Pick<Island, "circles" | "boxes">): void {
   for (const c of island.circles) pushOutOfCircle(e, c);
   for (const b of island.boxes) resolveSphereAabb(e, EXPLORER.radius, b, e);
   e.y = 0;
}

/**
 * One movement step. `dirX/dirZ` = the wanted direction (length <= 1, analog). Mutates `e`, allocates
 * nothing. Guarantee the proof uses: while the shoreline stands still (before TIDE.startS) a step
 * moves at most EXPLORER.maxSpeed * dt, whatever the input, the props or the clamp do. Later the
 * rising water may push the explorer inward on top of that (at most rx x the shore's rate), and a
 * prop it is pushed against pushes it back out (not player movement: no time is gained by it).
 */
export function stepExplorer(e: ExplorerState, island: Pick<Island, "circles" | "boxes">, dirX: number, dirZ: number, dt: number, shore: number): void {
   if (!(dt > 0)) return;
   const { maxSpeed, wadeSpeed, accel, brake, turnRate } = EXPLORER;
   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }
   const top = rho(e.x, e.z) > shore ? wadeSpeed : maxSpeed;
   let dvx = dirX * top - e.vx;
   let dvz = dirZ * top - e.vz;
   const dv = Math.hypot(dvx, dvz);
   const maxDv = (len > 0.01 ? accel : brake) * dt;
   if (dv > maxDv) {
      dvx *= maxDv / dv;
      dvz *= maxDv / dv;
   }
   e.vx += dvx;
   e.vz += dvz;

   const fromX = e.x;
   const fromZ = e.z;
   e.x += e.vx * dt;
   e.z += e.vz * dt;
   // props push out, the water's edge holds; twice, so a push near the edge settles
   for (let k = 0; k < 2; k++) {
      resolveProps(e, island);
      clampToShore(e, shore);
   }
   // speed guard: whatever the pushes did, this step moves at most maxSpeed * dt
   const mx = e.x - fromX;
   const mz = e.z - fromZ;
   const moved = Math.hypot(mx, mz);
   const maxMove = maxSpeed * dt;
   if (moved > maxMove) {
      e.x = fromX + (mx * maxMove) / moved;
      e.z = fromZ + (mz * maxMove) / moved;
   }
   // the rising tide (only then can `from` lie beyond the new edge), and once it rises the props
   // have the last word, so the water never leaves the explorer inside one (a squeeze between the
   // two keeps it out of the prop, a little beyond the reach). Before TIDE.startS (shore 1) neither
   // moves it, so the guard's bound holds.
   clampToShore(e, shore);
   if (shore < 1) resolveProps(e, island);
   e.vx = (e.x - fromX) / dt;
   e.vz = (e.z - fromZ) / dt;
   if (Math.hypot(e.vx, e.vz) > 0.3) e.heading = turnTowards(e.heading, Math.atan2(e.vx, e.vz), 1 - Math.exp(-turnRate * dt));
}

// ---------- detector ----------

/** Detector strength at distance d (1 on the spot, 0 from DETECTOR.range out). */
export function strengthAt(d: number): number {
   const s = 1 - d / DETECTOR.range;
   return s < 0 ? 0 : s > 1 ? 1 : s;
}

/** Pulse period (s) at strength s: 1.2 s cold -> 0.15 s on top of it. */
export function pulsePeriod(s: number): number {
   return DETECTOR.slowPeriod - (DETECTOR.slowPeriod - DETECTOR.fastPeriod) * s;
}

// ---------- a run ----------

export interface DetectorState {
   /** the nearest undug treasure (-1 when all are found) */
   target: number;
   distance: number;
   strength: number;
   /** 0..1 through the current pulse */
   pulse: number;
   /** within dig reach of the target */
   ready: boolean;
}

export interface DigState {
   active: boolean;
   /** play time held so far (s) */
   held: number;
}

export interface RunEvents {
   /** index of the treasure found this step, else -1 */
   found: number;
   foundClean: boolean;
   /** the type of that find */
   foundType: TreasureType | null;
   falseDig: boolean;
   beep: boolean;
   digStarted: boolean;
   /** the tide turned this step (TIDE.startS) */
   tide: boolean;
}

export interface RunState {
   explorer: ExplorerState;
   dug: boolean[];
   found: number;
   cleanFinds: number;
   /** no false dig since the last find (or the start) */
   clean: boolean;
   dig: DigState;
   detector: DetectorState;
   /** the treasure the seagull circles over (-1 = none), and when the hint clock started (s) */
   hint: { target: number; since: number };
   /** play time of the last step (s) */
   time: number;
   events: RunEvents;
}

export interface StepInput {
   dirX: number;
   dirZ: number;
   /** a dig button held (E / Enter / Space / touch Dig) */
   digHeld: boolean;
   /** a dig button newly pressed this frame */
   digPressed: boolean;
}

export function createRun(island: Island): RunState {
   const run: RunState = {
      explorer: createExplorer(),
      dug: new Array<boolean>(TREASURE_COUNT).fill(false),
      found: 0,
      cleanFinds: 0,
      clean: true,
      dig: { active: false, held: 0 },
      detector: { target: -1, distance: Infinity, strength: 0, pulse: 0, ready: false },
      hint: { target: -1, since: 0 },
      time: 0,
      events: { found: -1, foundClean: false, foundType: null, falseDig: false, beep: false, digStarted: false, tide: false },
   };
   updateDetector(run, island);
   return run;
}

/** The nearest undug treasure to the explorer's centre (ties: the lower index). */
export function updateDetector(run: RunState, island: Island): void {
   const det = run.detector;
   det.target = -1;
   det.distance = Infinity;
   for (let i = 0; i < TREASURE_COUNT; i++) {
      if (run.dug[i]) continue;
      const d = Math.hypot(island.treasures[i].x - run.explorer.x, island.treasures[i].z - run.explorer.z);
      if (d < det.distance) {
         det.distance = d;
         det.target = i;
      }
   }
   det.strength = det.target < 0 ? 0 : strengthAt(det.distance);
   det.ready = det.target >= 0 && det.distance <= DIG.reach;
}

/** The undug treasure within dig reach of the explorer's centre (lowest index), else -1. */
export function treasureInReach(run: RunState, island: Island): number {
   for (let i = 0; i < TREASURE_COUNT; i++) {
      if (run.dug[i]) continue;
      if (Math.hypot(island.treasures[i].x - run.explorer.x, island.treasures[i].z - run.explorer.z) <= DIG.reach) return i;
   }
   return -1;
}

export const isWon = (run: RunState) => run.found >= TREASURE_COUNT;

/**
 * One play step: dig (a press starts it, the feet are planted while it is held, it resolves after
 * DIG.holdS of play time), else move; then the detector, the hint and the tide. `time` = the run's
 * play time (s) after this step. Allocates nothing; the step's events are in run.events.
 */
export function stepRun(run: RunState, island: Island, input: StepInput, dt: number, time: number): void {
   const ev = run.events;
   ev.found = -1;
   ev.foundClean = false;
   ev.foundType = null;
   ev.falseDig = false;
   ev.beep = false;
   ev.digStarted = false;
   ev.tide = run.time < TIDE.startS && time >= TIDE.startS;
   run.time = time;
   if (!(dt > 0) || isWon(run)) return;
   const shore = shoreAt(time);
   const e = run.explorer;
   const dig = run.dig;

   if (!dig.active && input.digPressed) {
      dig.active = true;
      dig.held = 0;
      ev.digStarted = true;
   }
   // one dig per press: a release before DIG.holdS cancels it (a press and release in one frame too)
   if (dig.active && !input.digHeld) dig.active = false;

   if (dig.active) {
      // the feet are planted: no movement, only the rising water may push (never into a prop)
      e.vx = 0;
      e.vz = 0;
      clampToShore(e, shore);
      if (shore < 1) resolveProps(e, island);
      dig.held += dt;
      if (dig.held >= DIG.holdS) {
         dig.active = false;
         const i = treasureInReach(run, island);
         if (i >= 0) {
            ev.found = i;
            ev.foundClean = run.clean;
            ev.foundType = island.findTypes[run.found];
            run.dug[i] = true;
            run.found += 1;
            if (run.clean) run.cleanFinds += 1;
            run.clean = true;
            run.hint.target = -1;
            run.hint.since = time;
         } else {
            ev.falseDig = true;
            run.clean = false;
         }
      }
   } else {
      stepExplorer(e, island, input.dirX, input.dirZ, dt, shore);
   }

   updateDetector(run, island);
   const det = run.detector;
   det.pulse += dt / pulsePeriod(det.strength);
   if (det.pulse >= 1) {
      det.pulse -= Math.floor(det.pulse);
      ev.beep = det.strength > 0;
   }
   if (run.hint.target < 0 && det.target >= 0 && time - run.hint.since >= HINT.afterS) run.hint.target = det.target;
}

// ---------- scoring ----------

/** +10 per full second left. */
export function timeBonus(timeLeftMs: number): number {
   return POINTS.perSecond * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** 200 a treasure, +50 a clean one, and on a win +10 per full second left. */
export function runScore(found: number, cleanFinds: number, won: boolean, timeLeftMs: number): number {
   return POINTS.find * found + POINTS.clean * cleanFinds + (won ? timeBonus(timeLeftMs) : 0);
}

/** The server's check (core/limits.ts) with this game's limits from meta.ts. */
export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, treasureIslandMeta.scoring);
}

/** Safety net only: the README proof shows real runs never reach it; rules.test.ts keeps it a no-op. */
export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, treasureIslandMeta.scoring);
}
