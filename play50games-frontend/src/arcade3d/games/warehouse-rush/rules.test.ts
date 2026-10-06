import { describe, expect, it } from "vitest";
import { distanceToBoxXZ, resolveSphereAabb } from "@/arcade3d/core/collision";
import { FRAME_PRIORITY, MAX_FRAME_DT, advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng, rngNext } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { warehouseRushMeta } from "./meta";
import {
   ARENA,
   BOUNDS,
   BOX_SEED_MIX,
   COLOURS,
   COLOUR_COUNT,
   CORNER_COUNT,
   CYCLE_MIN_MS,
   DROP_MS,
   DURATION_MS,
   FIRST_DELIVERY_MIN_MS,
   MAX_STEP_MS,
   MIN_LEG,
   NONE,
   ORDER_SEED_MIX,
   PALLETS_PER_ROW,
   PALLET_COUNT,
   PALLET_HALF,
   PALLET_HEIGHT,
   PALLET_SLOTS,
   PICK_GAP,
   PICK_MS,
   POINTS,
   RACK,
   RACKS,
   REFILL_MS,
   ROBOT,
   ROBOT_START,
   SCORE_BOUND,
   SLOTS_PER_ROW,
   WALL,
   ZONE,
   ZONES,
   advanceClock,
   boxSeedFor,
   capScore,
   cornerSignX,
   cornerSignZ,
   createRobot,
   createRun,
   createStepInput,
   generateLayout,
   inReach,
   isValidLayout,
   maxDeliveriesBy,
   occupiedPallets,
   orderSeedFor,
   palletBounds,
   palletInReach,
   reachToZone,
   scoreAfter,
   scoreBoundAt,
   startToReach,
   step,
   stepRobot,
   withinServerLimits,
   zoneAt,
   zoneCornerOf,
   type Layout,
   type StepEvents,
   type StepInput,
   type WarehouseRun,
} from "./rules";

// ---------- shared helpers ----------

const IDLE: StepInput = { moveX: 0, moveY: 0, actionPressed: false };
const PRESS: StepInput = { moveX: 0, moveY: 0, actionPressed: true };

/** Side pallets only (slots 0, 2, 3, 5): pallet i stands beside corner i, and zone i has colour i. */
const SIDE: Layout = { seed: 0, zoneColours: [0, 1, 2, 3], slots: [0, 2, 3, 5] };
const sideLayout = (): Layout => ({ seed: 0, zoneColours: [...SIDE.zoneColours], slots: [...SIDE.slots] });

/** A run on `layout` whose boxes and order the test sets by hand (the run is a plain object). */
function runWith(boxes: number[], order: number, layout: Layout = sideLayout()): WarehouseRun {
   const run = createRun(1, { layout });
   boxes.forEach((box, i) => (run.pallets[i].box = box));
   run.order = order;
   return run;
}

function place(run: WarehouseRun, x: number, z: number): void {
   run.robot.x = x;
   run.robot.z = z;
   run.robot.vx = 0;
   run.robot.vz = 0;
}

/** Steps 10 ms at a time without input until the lock is over (a broken lock fails, never hangs). */
function waitLock(run: WarehouseRun): void {
   for (let k = 0; run.lockMs > 0 && k < 1000; k++) step(run, 10, IDLE);
   expect(run.lockMs).toBe(0);
}

/** Loop guard for the tests' own loops: a broken rule fails the test instead of hanging it. */
const MAX_LOOP = 100_000;

/** A spot in reach of SIDE pallet i (0.7 out from its outer edge, towards its corner). */
const reachSpot = (i: number): [number, number] => [cornerSignX(i) * (3 + PALLET_HALF + 0.7), cornerSignZ(i) * 3.4];
/** A spot inside zone `corner`. */
const zoneSpot = (corner: number): [number, number] => [cornerSignX(corner) * 8, cornerSignZ(corner) * 4];

/** The order draw of README "Orders", restated: the k-th occupied pallet, k = floor(r · occupied). */
function expectedOrder(boxes: readonly number[], orderState: number): number {
   const occupied = boxes.filter((b) => b !== NONE);
   const r = rngNext({ s: orderState });
   return occupied[Math.floor(r * occupied.length)];
}

const boxesOf = (run: WarehouseRun) => run.pallets.map((p) => p.box);

/** The next `n` colours of a box stream state (without advancing it). */
function boxStream(state: number, n: number): number[] {
   const s = { s: state };
   return Array.from({ length: n }, () => Math.floor(rngNext(s) * COLOUR_COUNT));
}

// ---------- frame patterns (ms per step) ----------

interface Pattern {
   name: string;
   make: (seed: number) => () => number;
}
const fixed = (ms: number) => () => ms;
const FPS_144: Pattern = { name: "144 fps", make: () => fixed(1000 / 144) };
const FPS_60: Pattern = { name: "60 fps", make: () => fixed(1000 / 60) };
const FPS_30: Pattern = { name: "30 fps", make: () => fixed(1000 / 30) };
const RANDOM_1_50: Pattern = {
   name: "random 1-50 ms",
   make: (seed) => {
      const rng = createRng(seed ^ 0x5bd1e995);
      return () => 1 + rng() * 49;
   },
};
const PATTERNS = [FPS_144, FPS_60, FPS_30, RANDOM_1_50];

// ---------- a 0.1 m grid for the robot's centre (test helper, not game code) ----------

const CELL = 0.1;
const NX = Math.round((2 * ARENA.halfX) / CELL) + 1;
const NZ = Math.round((2 * ARENA.halfZ) / CELL) + 1;
const N = NX * NZ;
const HALF_I = (NX - 1) / 2;
const HALF_J = (NZ - 1) / 2;
/** exact tenths, so the node on x = 6.5 is 6.5 */
const nodeX = (i: number) => (i - HALF_I) / 10;
const nodeZ = (j: number) => (j - HALF_J) / 10;
const NODE_STEPS: ReadonlyArray<readonly [number, number, number]> = [
   [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
   [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
/** 16 directions (the 8 plus knight moves): grid paths within 3 % of the straight-line shortest path. */
const FINE_STEPS: ReadonlyArray<readonly [number, number, number]> = [
   ...NODE_STEPS,
   ...[[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].map(([di, dj]) => [di, dj, Math.hypot(di, dj)] as const),
];

/** Where the robot's centre may be (touching allowed), `margin` farther from racks and pallets. */
function freeMask(slots: readonly number[], margin: number): Uint8Array {
   const boxes = [...RACKS, ...slots.map(palletBounds)];
   const free = new Uint8Array(N);
   const limitX = ARENA.halfX - ROBOT.radius + 1e-9;
   const limitZ = ARENA.halfZ - ROBOT.radius + 1e-9;
   for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NZ; j++) {
         const x = nodeX(i);
         const z = nodeZ(j);
         if (Math.abs(x) > limitX || Math.abs(z) > limitZ) continue;
         if (boxes.every((b) => distanceToBoxXZ(x, z, b) >= ROBOT.radius + margin - 1e-9)) free[i * NZ + j] = 1;
      }
   }
   return free;
}

/** A binary min-heap of (key, node) in typed arrays. */
class Heap {
   keys: Float64Array;
   vals: Int32Array;
   size = 0;
   constructor(capacity: number) {
      this.keys = new Float64Array(capacity);
      this.vals = new Int32Array(capacity);
   }
   push(key: number, val: number): void {
      let i = this.size++;
      while (i > 0) {
         const parent = (i - 1) >> 1;
         if (this.keys[parent] <= key) break;
         this.keys[i] = this.keys[parent];
         this.vals[i] = this.vals[parent];
         i = parent;
      }
      this.keys[i] = key;
      this.vals[i] = val;
   }
   /** removes the smallest; returns its node, its key in `this.top` */
   top = 0;
   pop(): number {
      const val = this.vals[0];
      this.top = this.keys[0];
      const key = this.keys[--this.size];
      const last = this.vals[this.size];
      let i = 0;
      for (;;) {
         let child = 2 * i + 1;
         if (child >= this.size) break;
         if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child += 1;
         if (this.keys[child] >= key) break;
         this.keys[i] = this.keys[child];
         this.vals[i] = this.vals[child];
         i = child;
      }
      this.keys[i] = key;
      this.vals[i] = last;
      return val;
   }
}

/**
 * May the grid path go from node (i, j) by (di, dj)? A free target and no cut corners: every node of
 * the box the move spans must be free (for a knight move, the 2 x 3 nodes around it).
 */
function canStep(free: Uint8Array, i: number, j: number, di: number, dj: number): boolean {
   const ni = i + di;
   const nj = j + dj;
   if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) return false;
   for (let a = Math.min(i, ni); a <= Math.max(i, ni); a++) {
      for (let b = Math.min(j, nj); b <= Math.max(j, nj); b++) if (free[a * NZ + b] !== 1) return false;
   }
   return true;
}

/** Dijkstra from every free goal node: grid path length (m) to the nearest goal, Infinity = unreachable. */
function distanceField(free: Uint8Array, isGoal: (x: number, z: number) => boolean, moves = NODE_STEPS): Float64Array {
   const dist = new Float64Array(N).fill(Infinity);
   const heap = new Heap(N * 9);
   for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NZ; j++) {
         const n = i * NZ + j;
         if (free[n] && isGoal(nodeX(i), nodeZ(j))) {
            dist[n] = 0;
            heap.push(0, n);
         }
      }
   }
   while (heap.size > 0) {
      const n = heap.pop();
      const d = heap.top;
      if (d > dist[n]) continue;
      const i = (n / NZ) | 0;
      const j = n % NZ;
      for (const [di, dj, w] of moves) {
         if (!canStep(free, i, j, di, dj)) continue;
         const m = (i + di) * NZ + (j + dj);
         const nd = d + w * CELL;
         if (nd < dist[m]) {
            dist[m] = nd;
            heap.push(nd, m);
         }
      }
   }
   return dist;
}

const insideZone = (corner: number, inset: number) => (x: number, z: number) =>
   zoneAt(x, z) === corner && Math.abs(x) >= ZONE.innerX + inset && Math.abs(z) >= ZONE.innerZ + inset;

/** The 9 pallet sets: every pair of the 3 slots in the back row with every pair in the front row. */
const PALLET_SETS: number[][] = [];
for (let skipBack = 0; skipBack < 3; skipBack++) {
   for (let skipFront = 0; skipFront < 3; skipFront++) {
      const slots: number[] = [];
      for (let k = 0; k < 3; k++) if (k !== skipBack) slots.push(k);
      for (let k = 0; k < 3; k++) if (k !== skipFront) slots.push(3 + k);
      PALLET_SETS.push(slots);
   }
}

// ---------- bots ----------

/** Path fields for one pallet set (the zone permutation never changes the geometry). */
interface Fields {
   free: Uint8Array;
   /** grid distance to the inside of each zone corner */
   zone: Float64Array[];
   /** grid distance to the reach of each pallet (index order) */
   reach: Float64Array[];
   /** shortest leg from pallet p's reach into zone c: leg[p][c] */
   leg: number[][];
}

/** The bots keep 0.05 m off racks and pallets and aim 0.05 m inside the reach and 0.15 m inside a zone. */
const BOT_MARGIN = 0.05;
const BOT_REACH = PICK_GAP - 0.05;
const BOT_ZONE_INSET = 0.15;
const LOOKAHEAD_NODES = 5;
const FIELDS = new Map<string, Fields>();

function fieldsFor(slots: readonly number[]): Fields {
   const key = slots.join(",");
   const cached = FIELDS.get(key);
   if (cached) return cached;
   const free = freeMask(slots, BOT_MARGIN);
   const zone = [0, 1, 2, 3].map((c) => distanceField(free, insideZone(c, BOT_ZONE_INSET)));
   const reach = slots.map((slot) => {
      const b = palletBounds(slot);
      return distanceField(free, (x, z) => distanceToBoxXZ(x, z, b) <= BOT_REACH);
   });
   const leg = reach.map((r) =>
      zone.map((zf) => {
         let best = Infinity;
         for (let n = 0; n < N; n++) if (r[n] === 0 && zf[n] < best) best = zf[n];
         return best;
      })
   );
   const fields = { free, zone, reach, leg };
   FIELDS.set(key, fields);
   return fields;
}

/** The free node nearest to a point (the robot may touch a rack, closer than the bots' margin). */
function nearestFree(free: Uint8Array, x: number, z: number): number {
   const ci = Math.round(x * 10 + HALF_I);
   const cj = Math.round(z * 10 + HALF_J);
   if (ci >= 0 && cj >= 0 && ci < NX && cj < NZ && free[ci * NZ + cj]) return ci * NZ + cj;
   let best = -1;
   let bestD = Infinity;
   for (let i = ci - 5; i <= ci + 5; i++) {
      for (let j = cj - 5; j <= cj + 5; j++) {
         if (i < 0 || j < 0 || i >= NX || j >= NZ || !free[i * NZ + j]) continue;
         const d = Math.hypot(nodeX(i) - x, nodeZ(j) - z);
         if (d < bestD) {
            bestD = d;
            best = i * NZ + j;
         }
      }
   }
   return best;
}

/** Follows the field downhill for a few nodes from `n` (the point the bot steers at). */
function lookahead(free: Uint8Array, field: Float64Array, n: number): number {
   for (let k = 0; k < LOOKAHEAD_NODES && field[n] > 0; k++) {
      const i = (n / NZ) | 0;
      const j = n % NZ;
      let best = n;
      for (const [di, dj] of NODE_STEPS) {
         if (!canStep(free, i, j, di, dj)) continue;
         const m = (i + di) * NZ + (j + dj);
         if (field[m] < field[best]) best = m;
      }
      if (best === n) break;
      n = best;
   }
   return n;
}

interface Bot {
   next(run: WarehouseRun, dtMs: number): StepInput;
   /** frames in which the bot, empty-handed and free to act, found no box of the order colour */
   stuck: number;
}

type ZoneChoice = "order" | "nearest" | "wrong";

/**
 * Plays like a perfect player: no reaction time; empty-handed, it drives to the order box with the
 * fastest pick-and-carry route (grid paths, top speed, the pick lock); carrying, it drives into the
 * order's zone ("order"), the nearest zone whatever its colour ("nearest") or the nearest wrong zone
 * ("wrong"). It presses Action when this step will end in reach or in the zone.
 */
function pathBot(zoneChoice: ZoneChoice = "order"): Bot {
   const input = createStepInput();
   let target = NONE;
   const bot: Bot = {
      stuck: 0,
      next(run, dtMs) {
         input.moveX = 0;
         input.moveY = 0;
         input.actionPressed = false;
         if (run.lockMs > 0) {
            target = NONE;
            return input;
         }
         const f = fieldsFor(run.layout.slots);
         const r = run.robot;
         const n = nearestFree(f.free, r.x, r.z);
         const dt = Math.min(dtMs, MAX_STEP_MS) / 1000;
         const px = r.x + r.vx * dt;
         const pz = r.z + r.vz * dt;
         let field: Float64Array;
         let aimX: number;
         let aimZ: number;
         if (run.carrying === NONE) {
            const corner = zoneCornerOf(run.layout, run.order);
            let best = NONE;
            let bestCost = Infinity;
            let currentCost = Infinity;
            for (let i = 0; i < run.pallets.length; i++) {
               if (run.pallets[i].box !== run.order) continue;
               const cost = f.reach[i][n] / ROBOT.speed + f.leg[i][corner] / ROBOT.carrySpeed;
               if (i === target) currentCost = cost;
               if (cost < bestCost) {
                  bestCost = cost;
                  best = i;
               }
            }
            if (best === NONE) {
               bot.stuck += 1;
               return input;
            }
            // keep the chosen box unless another one is clearly faster
            if (currentCost === Infinity || bestCost < currentCost - 0.1) target = best;
            const p = run.pallets[target];
            if (inReach(r.x, r.z, p.bounds) || inReach(px, pz, p.bounds)) input.actionPressed = true;
            field = f.reach[target];
            aimX = p.x;
            aimZ = p.z;
         } else {
            target = NONE;
            let corner = zoneCornerOf(run.layout, run.order);
            if (zoneChoice !== "order") {
               let bestD = Infinity;
               for (let c = 0; c < CORNER_COUNT; c++) {
                  if (zoneChoice === "wrong" && run.layout.zoneColours[c] === run.order) continue;
                  if (f.zone[c][n] < bestD) {
                     bestD = f.zone[c][n];
                     corner = c;
                  }
               }
            }
            if (zoneAt(r.x, r.z) === corner || zoneAt(px, pz) === corner) input.actionPressed = true;
            field = f.zone[corner];
            aimX = cornerSignX(corner) * 8.25;
            aimZ = cornerSignZ(corner) * 4.25;
         }
         if (n >= 0 && field[n] > 0) {
            const m = lookahead(f.free, field, n);
            aimX = nodeX((m / NZ) | 0);
            aimZ = nodeZ(m % NZ);
         }
         const dx = aimX - r.x;
         const dz = aimZ - r.z;
         const len = Math.hypot(dx, dz);
         if (len > 1e-6) {
            input.moveX = dx / len;
            input.moveY = dz / len;
         }
         return input;
      },
   };
   return bot;
}

/** Random driving: a new direction now and then (sometimes longer than 1), Action with `pressChance`. */
function randomBot(seed: number, pressChance: number): Bot {
   const rng = createRng(seed);
   const input = createStepInput();
   let angle = rng() * Math.PI * 2;
   let length = 1;
   return {
      stuck: 0,
      next() {
         if (rng() < 0.05) {
            angle = rng() * Math.PI * 2;
            length = rng() < 0.2 ? 0 : 0.3 + rng() * 1.2;
         }
         input.moveX = Math.cos(angle) * length;
         input.moveY = Math.sin(angle) * length;
         input.actionPressed = rng() < pressChance;
         return input;
      },
   };
}

const idleBot = (): Bot => ({ stuck: 0, next: () => IDLE });

// ---------- a whole run, with every invariant checked at every step ----------

interface PlayResult {
   run: WarehouseRun;
   /** simMs of every delivery (right or wrong) */
   deliveries: number[];
   /** colours of the refills, in landing order */
   refillColours: number[];
   /** README invariants or proof bounds broken (should stay empty) */
   problems: string[];
   maxPending: number;
   minOccupiedAtDraw: number;
   steps: number;
}

function play(run: WarehouseRun, bot: Bot, nextDt: () => number, beforeStep?: (run: WarehouseRun, ev: StepEvents) => void): PlayResult {
   const deliveries: number[] = [];
   const refillColours: number[] = [];
   const problems: string[] = [];
   const before = [0, 0, 0, 0];
   const fail = (what: string) => {
      if (problems.length < 10) problems.push(`seed ${run.seed} at ${run.simMs} ms: ${what}`);
   };
   let maxPending = 0;
   let minOccupiedAtDraw = Infinity;
   let steps = 0;
   const events = run.events;
   while (run.ended === null && steps < 200_000) {
      beforeStep?.(run, events);
      const dtMs = nextDt();
      const input = bot.next(run, dtMs);
      for (let i = 0; i < PALLET_COUNT; i++) before[i] = run.pallets[i].box;
      const ev = step(run, dtMs, input);
      steps += 1;
      if (ev !== events) fail("step returned another events object");

      const occupied = occupiedPallets(run);
      const carried = run.carrying === NONE ? 0 : 1;
      if (occupied + carried + run.refillCount !== PALLET_COUNT) fail(`boxes ${occupied} + ${carried} + pending ${run.refillCount} != 4`);
      maxPending = Math.max(maxPending, run.refillCount);
      if (run.refillCount > 2) fail(`${run.refillCount} refills pending`);
      if (run.carrying !== NONE && run.carrying !== run.order) fail("carries a box that is not the order colour");
      if (run.carrying !== run.order && !run.pallets.some((p) => p.box === run.order)) fail("no box of the order colour");
      for (let i = 0; i < PALLET_COUNT; i++) {
         if (ev.refilled & (1 << i)) {
            if (before[i] !== NONE) fail(`refill on occupied pallet ${i}`);
            refillColours.push(run.pallets[i].box);
         }
      }
      if (ev.newOrder) {
         minOccupiedAtDraw = Math.min(minOccupiedAtDraw, occupied);
         if (occupied < 2) fail(`order drawn with ${occupied} occupied pallets`);
      }
      if (ev.delivered || ev.wrong) {
         if (!ev.newOrder) fail("delivery without a new order");
         const last = deliveries[deliveries.length - 1];
         if (last === undefined ? run.simMs < FIRST_DELIVERY_MIN_MS : run.simMs - last < CYCLE_MIN_MS) {
            fail(`delivery ${deliveries.length + 1} too early (${last ?? "start"} -> ${run.simMs})`);
         }
         deliveries.push(run.simMs);
      }
      const s = run.score;
      if (s < 0 || s % 10 !== 0) fail(`score ${s}`);
      if (s > scoreBoundAt(run.simMs) || s * 1000 > 50 * run.simMs || s > 3000) fail(`score ${s} over the bound`);
      if (run.movedMs + run.lockedMs > run.simMs) fail("moving + lock time > play time");
   }
   return { run, deliveries, refillColours, problems, maxPending, minOccupiedAtDraw, steps };
}

// ---------- tests ----------

describe("warehouse-rush constants (golden)", () => {
   it("pins every number of README 'Constants'", () => {
      expect(DURATION_MS).toBe(60_000);
      expect(ARENA).toEqual({ halfX: 10, halfZ: 6 });
      expect(WALL).toEqual({ thickness: 0.4, height: 0.9 });
      expect(ROBOT).toEqual({ radius: 0.5, speed: 6, carrySpeed: 5, accel: 30, brake: 36, turnRate: 14 });
      expect(ROBOT_START).toEqual({ x: 0, z: 0, heading: 0 });
      expect(COLOUR_COUNT).toBe(4);
      expect(COLOURS).toEqual([
         { name: "RED", hex: "#ef4444", zone: "A" },
         { name: "BLUE", hex: "#3b82f6", zone: "B" },
         { name: "YELLOW", hex: "#facc15", zone: "C" },
         { name: "GREEN", hex: "#22c55e", zone: "D" },
      ]);
      expect(ZONE).toEqual({ size: 3.5, innerX: 6.5, innerZ: 2.5 });
      expect(CORNER_COUNT).toBe(4);
      expect(ZONES.map((b) => [b.min.x, b.max.x, b.min.z, b.max.z])).toEqual([
         [-10, -6.5, -6, -2.5],
         [6.5, 10, -6, -2.5],
         [-10, -6.5, 2.5, 6],
         [6.5, 10, 2.5, 6],
      ]);
      for (const b of ZONES) {
         expect(b.max.x - b.min.x).toBe(ZONE.size);
         expect(b.max.z - b.min.z).toBe(ZONE.size);
      }
      expect(RACK).toEqual({ innerX: 1, outerX: 4.6, halfZ: 0.45, height: 1.1 });
      // centres (±2.8, 0), footprint 3.6 x 0.9, and the 2.0 gap between them
      expect(RACKS.map((b) => [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2])).toEqual([
         [-2.8, 0],
         [2.8, 0],
      ]);
      for (const b of RACKS) {
         expect(b.max.x - b.min.x).toBeCloseTo(3.6, 12);
         expect(b.max.z - b.min.z).toBeCloseTo(0.9, 12);
      }
      expect(RACKS[1].min.x - RACKS[0].max.x).toBe(2);
      expect(PALLET_SLOTS).toEqual([
         { x: -3, z: -3.4 },
         { x: 0, z: -3.4 },
         { x: 3, z: -3.4 },
         { x: -3, z: 3.4 },
         { x: 0, z: 3.4 },
         { x: 3, z: 3.4 },
      ]);
      expect([SLOTS_PER_ROW, PALLETS_PER_ROW, PALLET_COUNT, PALLET_HALF, PALLET_HEIGHT]).toEqual([3, 2, 4, 0.6, 0.18]);
      expect([PICK_GAP, PICK_MS, DROP_MS, REFILL_MS, MAX_STEP_MS]).toEqual([0.8, 250, 250, 1500, 50]);
      expect(POINTS).toEqual({ right: 50, wrong: -20 });
      expect([BOX_SEED_MIX, ORDER_SEED_MIX, NONE]).toEqual([0x9e3779b9, 0x85ebca6b, -1]);
      expect([BOUNDS.min.x, BOUNDS.max.x, BOUNDS.min.z, BOUNDS.max.z]).toEqual([-10, 10, -6, 6]);
      expect(createRobot()).toEqual({ x: 0, y: 0, z: 0, vx: 0, vz: 0, heading: 0 });
   });

   it("pins the proof's derived numbers and recomputes them from the tuning numbers", () => {
      expect(MIN_LEG).toBeCloseTo(2.1, 9);
      expect(CYCLE_MIN_MS).toBeCloseTo(1270, 6);
      expect(Math.abs(FIRST_DELIVERY_MIN_MS - 1151.3)).toBeLessThan(0.1);
      expect(SCORE_BOUND).toBe(2350);

      // README proof step 4: a side pallet's edge (3.6) plus the reach (4.4) against the zone (6.5)
      const minLeg = ZONE.innerX - (PALLET_SLOTS[2].x + PALLET_HALF) - PICK_GAP;
      expect(MIN_LEG).toBeCloseTo(minLeg, 12);
      // step 5: drop lock, empty drive, pick lock, carry
      expect(CYCLE_MIN_MS).toBeCloseTo(DROP_MS + (minLeg / ROBOT.speed) * 1000 + PICK_MS + (minLeg / ROBOT.carrySpeed) * 1000, 9);
      // step 6: from (0, 0) to a side pallet's near corner (2.4, 2.8) minus the reach, or 2.0 to a middle one
      const toSide = Math.hypot(PALLET_SLOTS[5].x - PALLET_HALF, PALLET_SLOTS[5].z - PALLET_HALF) - PICK_GAP;
      const toMiddle = PALLET_SLOTS[4].z - PALLET_HALF - PICK_GAP;
      expect(toSide).toBeCloseTo(2.887818, 6);
      expect(toMiddle).toBeCloseTo(2, 12);
      const viaSide = (toSide / ROBOT.speed) * 1000 + PICK_MS + (minLeg / ROBOT.carrySpeed) * 1000;
      const viaMiddle = (toMiddle / ROBOT.speed) * 1000 + PICK_MS + ((ZONE.innerX - PALLET_HALF - PICK_GAP) / ROBOT.carrySpeed) * 1000;
      expect(viaSide).toBeCloseTo(1151.303, 3);
      expect(viaMiddle).toBeCloseTo(1603.333, 3);
      expect(FIRST_DELIVERY_MIN_MS).toBeCloseTo(Math.min(viaSide, viaMiddle), 9);
      // step 7
      expect(SCORE_BOUND).toBe(POINTS.right * (1 + Math.floor((DURATION_MS - FIRST_DELIVERY_MIN_MS) / CYCLE_MIN_MS)));

      expect(PALLET_SLOTS.map((_s, slot) => startToReach(slot))).toEqual([toSide, toMiddle, toSide, toSide, toMiddle, toSide].map((v) => expect.closeTo(v, 9)));
      // every pallet-zone pair: exactly MIN_LEG only for a side pallet and the corner beside it
      for (let slot = 0; slot < PALLET_SLOTS.length; slot++) {
         for (let corner = 0; corner < CORNER_COUNT; corner++) {
            const { x, z } = PALLET_SLOTS[slot];
            const beside = x !== 0 && Math.sign(x) === cornerSignX(corner) && Math.sign(z) === cornerSignZ(corner);
            if (beside) expect(reachToZone(slot, corner)).toBeCloseTo(MIN_LEG, 12);
            else expect(reachToZone(slot, corner)).toBeGreaterThan(MIN_LEG + 1);
         }
      }
   });

   it("the earliest possible score against the cap (README table), and 4 deliveries at most by 5 s", () => {
      const earliest = (k: number) => FIRST_DELIVERY_MIN_MS + (k - 1) * CYCLE_MIN_MS;
      const table: Array<[number, number]> = [[1, 1151.3], [2, 2421.3], [4, 4961.3], [5, 6231.3], [10, 12581.3], [20, 25281.3], [40, 50681.3], [47, 59571.3]];
      for (const [k, ms] of table) {
         expect(Math.abs(earliest(k) - ms)).toBeLessThan(0.1);
         expect(maxDeliveriesBy(earliest(k))).toBe(k);
         expect(maxDeliveriesBy(earliest(k) - 0.01)).toBe(k - 1);
         expect(scoreBoundAt(earliest(k))).toBe(50 * k);
      }
      expect(earliest(48)).toBeGreaterThan(DURATION_MS);
      expect(maxDeliveriesBy(DURATION_MS)).toBe(47);
      expect(maxDeliveriesBy(5000)).toBe(4);
      expect(scoreBoundAt(5000)).toBe(200);
      expect([maxDeliveriesBy(0), maxDeliveriesBy(-5), maxDeliveriesBy(NaN)]).toEqual([0, 0, 0]);
      // the bound is under 50 points/s at every whole ms of play (and under the server cap)
      for (let ms = 0; ms <= 75_000; ms++) {
         const bound = scoreBoundAt(ms);
         if (bound * 1000 > 50 * ms || bound > 3000) throw new Error(`bound ${bound} at ${ms} ms`);
      }
      // the steepest moment is the first possible delivery: 43.4 points/s
      expect((50 / FIRST_DELIVERY_MIN_MS) * 1000).toBeCloseTo(43.43, 2);
   });

   it("the scoring limits equal meta.ts, and the server check rounds like GameShell", () => {
      expect(warehouseRushMeta.scoring).toEqual({
         kind: "points",
         maxScore: 3000,
         minDurationMs: 5000,
         maxDurationMs: 75000,
         base: 0,
         maxPointsPerSec: 50,
         unitLabel: "pts",
         display: "int",
      });
      expect(withinServerLimits(SCORE_BOUND, DURATION_MS)).toBe(true);
      expect(withinServerLimits(3000, DURATION_MS)).toBe(true);
      expect(withinServerLimits(3001, 75_000)).toBe(false);
      expect(withinServerLimits(250, 5_000)).toBe(true);
      expect(withinServerLimits(251, 5_000)).toBe(false);
      expect(withinServerLimits(0, 4_999)).toBe(false);
      expect(withinServerLimits(-10, DURATION_MS)).toBe(false);
      expect(capScore(5000, DURATION_MS)).toBe(3000);
      expect(capScore(300, 5_000)).toBe(250);
      expect(capScore(SCORE_BOUND, DURATION_MS)).toBe(SCORE_BOUND);
      // GameShell submits Math.round(elapsedMs): 1999.4 ms is 1999, where 100 points is 0.05 too many
      expect(capScore(100, 1_999.4)).toBe(99);
   });
});

describe("warehouse-rush layouts", () => {
   it("are deterministic per seed, always valid, and 20,000 seeds reach all 216", () => {
      const seen = new Set<string>();
      const sets = new Set<string>();
      let invalid = 0;
      for (let seed = 0; seed < 20_000; seed++) {
         const layout = generateLayout(seed);
         if (!isValidLayout(layout) || layout.seed !== seed) invalid += 1;
         seen.add(`${layout.zoneColours.join("")}/${layout.slots.join("")}`);
         sets.add(layout.slots.join(","));
      }
      expect(invalid).toBe(0);
      expect(seen.size).toBe(216);
      expect([...sets].sort()).toEqual(PALLET_SETS.map((s) => s.join(",")).sort());
      expect(generateLayout(42)).toEqual(generateLayout(42));
      expect(createRun(42).layout).toEqual(generateLayout(42));
      // Scene's seeds are uint32; a seed is taken as uint32 like createRng does
      for (const seed of [2 ** 32 - 1, 123456789, 3141592653]) expect(isValidLayout(generateLayout(seed))).toBe(true);
      expect(generateLayout(2 ** 32 + 5).zoneColours).toEqual(generateLayout(5).zoneColours);
   });

   it("golden draws for three seeds: zone colours by corner, pallet slots, the first 12 box colours, the first order", () => {
      const golden = [1, 42, 3141592653].map((seed) => {
         const run = createRun(seed);
         return {
            seed,
            zoneColours: run.layout.zoneColours,
            slots: run.layout.slots,
            boxes: [...boxesOf(run), ...boxStream(run.rng.boxes.s, 8)],
            order: run.order,
         };
      });
      expect(golden).toEqual(GOLDEN_RUNS);
   });

   it("isValidLayout rejects a repeated colour, 3 pallets in a row, a pallet off the slot grid and a wrong order", () => {
      const good = (): Layout => ({ seed: 0, zoneColours: [2, 0, 3, 1], slots: [0, 1, 3, 5] });
      expect(isValidLayout(good())).toBe(true);
      const bad: Array<[string, (l: Layout) => void]> = [
         ["repeated colour", (l) => (l.zoneColours[3] = 2)],
         ["colour out of range", (l) => (l.zoneColours[0] = 4)],
         ["3 colours", (l) => l.zoneColours.pop()],
         ["3 pallets in the back row", (l) => (l.slots = [0, 1, 2, 4])],
         ["3 pallets in the front row", (l) => (l.slots = [0, 3, 4, 5])],
         ["off the slot grid (index 6)", (l) => (l.slots[3] = 6)],
         ["off the slot grid (index 1.5)", (l) => (l.slots[1] = 1.5)],
         ["off the slot grid (index -1)", (l) => (l.slots = [-1, 1, 3, 5])],
         ["a repeated slot", (l) => (l.slots = [0, 0, 3, 5])],
         ["not in index order", (l) => (l.slots = [1, 0, 3, 5])],
         ["5 pallets", (l) => l.slots.push(4)],
      ];
      for (const [what, breakIt] of bad) {
         const layout = good();
         breakIt(layout);
         expect(isValidLayout(layout), what).toBe(false);
      }
   });

   it("one connected free region holds every reach and every zone, in all 9 pallet sets (so in all 216 layouts)", () => {
      for (const slots of PALLET_SETS) {
         const free = freeMask(slots, 0);
         const seen = new Uint8Array(N);
         const start = Math.round(ROBOT_START.x * 10 + HALF_I) * NZ + Math.round(ROBOT_START.z * 10 + HALF_J);
         expect(free[start]).toBe(1);
         const queue = [start];
         seen[start] = 1;
         while (queue.length) {
            const n = queue.pop()!;
            const i = (n / NZ) | 0;
            const j = n % NZ;
            for (const [di, dj] of NODE_STEPS.slice(0, 4)) {
               const ni = i + di;
               const nj = j + dj;
               if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
               const m = ni * NZ + nj;
               if (!free[m] || seen[m]) continue;
               seen[m] = 1;
               queue.push(m);
            }
         }
         let freeNodes = 0;
         let unreached = 0;
         const reachNodes = slots.map(() => 0);
         const zoneNodes = [0, 0, 0, 0];
         for (let i = 0; i < NX; i++) {
            for (let j = 0; j < NZ; j++) {
               const n = i * NZ + j;
               if (!free[n]) continue;
               freeNodes += 1;
               if (!seen[n]) unreached += 1;
               slots.forEach((slot, p) => {
                  if (inReach(nodeX(i), nodeZ(j), palletBounds(slot))) reachNodes[p] += 1;
               });
               const corner = zoneAt(nodeX(i), nodeZ(j));
               if (corner !== NONE) zoneNodes[corner] += 1;
            }
         }
         // nothing is cut off: every free spot (so every reach and every zone) is reached from the start
         expect(unreached, slots.join(",")).toBe(0);
         expect(freeNodes).toBeGreaterThan(10_000);
         for (const count of reachNodes) expect(count).toBeGreaterThan(100);
         // the 3 x 3 square of zone centres: 31 x 31 nodes
         expect(zoneNodes).toEqual([961, 961, 961, 961]);
      }
   });

   it("the mean shortest pallet-to-zone leg is in the band 6.3-6.8 for all 9 pallet sets", () => {
      const means: number[] = [];
      let shortest = Infinity;
      let longest = 0;
      for (const slots of PALLET_SETS) {
         const free = freeMask(slots, 0);
         const zones = [0, 1, 2, 3].map((c) => distanceField(free, insideZone(c, 0), FINE_STEPS));
         let sum = 0;
         for (const slot of slots) {
            const b = palletBounds(slot);
            for (let c = 0; c < CORNER_COUNT; c++) {
               let leg = Infinity;
               for (let i = 0; i < NX; i++) {
                  for (let j = 0; j < NZ; j++) {
                     const n = i * NZ + j;
                     if (free[n] && zones[c][n] < leg && inReach(nodeX(i), nodeZ(j), b)) leg = zones[c][n];
                  }
               }
               expect(leg).toBeGreaterThanOrEqual(MIN_LEG - 1e-9);
               shortest = Math.min(shortest, leg);
               longest = Math.max(longest, leg);
               sum += leg;
            }
         }
         means.push(sum / 16);
      }
      for (const mean of means) {
         expect(mean).toBeGreaterThanOrEqual(6.3);
         expect(mean).toBeLessThanOrEqual(6.8);
      }
      expect(shortest).toBeCloseTo(MIN_LEG, 6);
      expect(longest).toBeLessThan(10.5);
      // 6.50-6.51 on this 16-direction grid (design prototype: 6.55-6.56): every set about as hard
      expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.05);
   });

   it("reaches never overlap, and every zone is at least MIN_LEG from every reach", () => {
      // footprints in a row are 1.8 apart edge to edge, two reaches need 1.6
      for (let a = 0; a < PALLET_SLOTS.length; a++) {
         for (let b = a + 1; b < PALLET_SLOTS.length; b++) {
            const A = palletBounds(a);
            const B = palletBounds(b);
            const gap = Math.hypot(Math.max(0, B.min.x - A.max.x, A.min.x - B.max.x), Math.max(0, B.min.z - A.max.z, A.min.z - B.max.z));
            expect(gap).toBeGreaterThan(2 * PICK_GAP + 0.1);
         }
      }
      // on the grid: no spot is in two reaches, and no reach spot is closer than MIN_LEG to a zone
      let closest = Infinity;
      let doubleReach = 0;
      let reachInZone = 0;
      let reachSpots = 0;
      const slotBoxes = PALLET_SLOTS.map((_s, slot) => palletBounds(slot));
      for (let i = 0; i < NX; i++) {
         for (let j = 0; j < NZ; j++) {
            const x = nodeX(i);
            const z = nodeZ(j);
            let reaches = 0;
            for (const box of slotBoxes) {
               if (!inReach(x, z, box)) continue;
               reaches += 1;
               for (const zone of ZONES) closest = Math.min(closest, distanceToBoxXZ(x, z, zone));
            }
            if (reaches > 1) doubleReach += 1;
            if (reaches > 0 && zoneAt(x, z) !== NONE) reachInZone += 1;
            if (reaches > 0) reachSpots += 1;
         }
      }
      expect([doubleReach, reachInZone]).toEqual([0, 0]);
      expect(reachSpots).toBeGreaterThan(1000);
      expect(closest).toBeGreaterThanOrEqual(MIN_LEG - 1e-9);
      expect(closest).toBeCloseTo(MIN_LEG, 9);
   });
});

describe("warehouse-rush streams", () => {
   it("the layout and the box colours never depend on the player; refills take the box stream in order", () => {
      for (const seed of [3, 77, 2024, 3141592653]) {
         const idle = play(createRun(seed), idleBot(), fixed(1000 / 60));
         const bot = play(createRun(seed), pathBot(), fixed(1000 / 60));
         expect(bot.run.layout).toEqual(idle.run.layout);
         expect(bot.deliveries.length).toBeGreaterThan(10);
         expect(idle.deliveries).toEqual([]);
         const fresh = createRun(seed);
         // the 4 starting boxes, then one draw per landed refill
         expect(boxStream(boxSeedFor(seed), 4)).toEqual(boxesOf(fresh));
         const stream = boxStream(boxSeedFor(seed), 4 + bot.refillColours.length).slice(4);
         expect(bot.refillColours).toEqual(stream);
         expect(idle.run.rng.boxes.s).toBe(fresh.rng.boxes.s);
         expect(bot.problems).toEqual([]);
      }
   });

   it("changing the order stream's seed changes the orders but no layout or box colour", () => {
      let differentOrders = 0;
      for (let seed = 10; seed < 30; seed++) {
         const a = play(createRun(seed), pathBot(), fixed(1000 / 60));
         const b = play(createRun(seed, { orderSeed: orderSeedFor(seed) + 1 }), pathBot(), fixed(1000 / 60));
         expect(b.run.layout).toEqual(a.run.layout);
         expect(boxesOf(createRun(seed, { orderSeed: 99 }))).toEqual(boxesOf(createRun(seed)));
         const stream = boxStream(boxSeedFor(seed), 4 + Math.max(a.refillColours.length, b.refillColours.length)).slice(4);
         expect(a.refillColours).toEqual(stream.slice(0, a.refillColours.length));
         expect(b.refillColours).toEqual(stream.slice(0, b.refillColours.length));
         if (createRun(seed).order !== createRun(seed, { orderSeed: orderSeedFor(seed) + 1 }).order || a.deliveries.join() !== b.deliveries.join()) differentOrders += 1;
      }
      expect(differentOrders).toBeGreaterThan(15);
      expect(orderSeedFor(5)).toBe((5 ^ 0x85ebca6b) >>> 0);
      expect(boxSeedFor(5)).toBe((5 ^ 0x9e3779b9) >>> 0);
   });

   it("an order is the k-th occupied pallet in index order, k = floor(r · occupied)", () => {
      const rng = createRng(4242);
      const order = 0;
      let checked = 0;
      for (let trial = 0; trial < 300; trial++) {
         // a random occupancy of pallets 1..3 (pallet 0's zone takes the delivery), at least one box
         const boxes = [NONE, ...[1, 2, 3].map(() => (rng() < 0.3 ? NONE : Math.floor(rng() * COLOUR_COUNT)))];
         if (boxes.every((b) => b === NONE)) continue;
         const run = runWith(boxes, order);
         run.rng.orders.s = Math.floor(rng() * 2 ** 32);
         run.carrying = order;
         const want = expectedOrder(boxes, run.rng.orders.s);
         place(run, ...zoneSpot(0));
         const ev = step(run, 1, PRESS);
         expect(ev.delivered).toBe(true);
         expect(ev.newOrder).toBe(true);
         expect(run.order).toBe(want);
         expect(run.orders).toBe(2);
         checked += 1;
      }
      expect(checked).toBeGreaterThan(250);
      // the first order is drawn the same way, from the 4 starting boxes
      for (let seed = 0; seed < 50; seed++) {
         const run = createRun(seed);
         expect(run.order).toBe(expectedOrder(boxesOf(run), orderSeedFor(seed)));
         expect(run.orders).toBe(1);
      }
   });
});

describe("warehouse-rush movement", () => {
   const open = () => createRun(5).obstacles;

   it("top speed is exactly 6 empty-handed and 5 carrying; diagonals are not faster", () => {
      for (const [carrying, top] of [[false, 6], [true, 5]] as const) {
         // x = -5.5 is open floor from z = -5 to +5 in every layout
         const robot = createRobot();
         robot.x = -5.5;
         robot.z = -4.5;
         for (let i = 0; i < 30; i++) stepRobot(robot, 0, 1, 1 / 60, carrying, open());
         expect(Math.hypot(robot.vx, robot.vz)).toBeCloseTo(top, 9);
         const diag = createRobot();
         diag.x = -9;
         diag.z = -5;
         for (let i = 0; i < 30; i++) stepRobot(diag, 1, 1, 1 / 60, carrying, open());
         expect(Math.hypot(diag.vx, diag.vz)).toBeCloseTo(top, 9);
         expect(diag.vx).toBeCloseTo(diag.vz, 9);
      }
   });

   it("the stick is analog: half a stick is half the top speed, empty-handed and carrying", () => {
      for (const [carrying, top] of [[false, ROBOT.speed], [true, ROBOT.carrySpeed]] as const) {
         const robot = createRobot();
         robot.x = -5.5;
         robot.z = -4.5;
         for (let i = 0; i < 30; i++) stepRobot(robot, 0, 0.5, 1 / 60, carrying, open());
         expect(robot.vz).toBeCloseTo(top / 2, 9);
         expect(robot.vx).toBe(0);
      }
   });

   it("an input longer than 1 is normalised: a diagonal into a wall slides at 6 · √½, not at 6", () => {
      // on open floor the speed guard would cap an unnormalised (1, 1) at 6 anyway; along the wall it shows
      const robot = createRobot();
      robot.x = 9.5;
      robot.z = -5;
      for (let i = 0; i < 120; i++) stepRobot(robot, 1, 1, 1 / 60, false, open());
      expect(robot.x).toBeCloseTo(ARENA.halfX - ROBOT.radius, 9);
      expect(robot.vz).toBeCloseTo(ROBOT.speed * Math.SQRT1_2, 4);
   });

   it("accelerates from rest at 30 u/s² and brakes to a stop at 36 u/s²", () => {
      const robot = createRobot();
      robot.x = -5.5;
      robot.z = -4.5;
      stepRobot(robot, 0, 1, 1 / 60, false, open());
      expect(Math.hypot(robot.vx, robot.vz)).toBeCloseTo(ROBOT.accel / 60, 9);
      for (let i = 0; i < 20; i++) stepRobot(robot, 0, 1, 1 / 60, false, open());
      expect(robot.vz).toBeCloseTo(6, 9);
      stepRobot(robot, 0, 0, 1 / 60, false, open());
      expect(robot.vz).toBeCloseTo(6 - ROBOT.brake / 60, 9);
      for (let i = 0; i < 10; i++) stepRobot(robot, 0, 0, 1 / 60, false, open());
      expect(Math.hypot(robot.vx, robot.vz)).toBe(0);
   });

   it("is stopped by racks, pallets and walls, and slides along them", () => {
      const obstacles = createRun(1, { layout: { seed: 0, zoneColours: [0, 1, 2, 3], slots: [1, 2, 3, 4] } }).obstacles;
      // the left rack's outer end at x = -4.6
      const robot = createRobot();
      robot.x = -5.5;
      robot.z = 0;
      for (let i = 0; i < 60; i++) stepRobot(robot, 1, 0, 1 / 60, false, obstacles);
      expect(robot.x).toBeCloseTo(-RACK.outerX - ROBOT.radius, 9);
      expect(robot.vx).toBeCloseTo(0, 9);
      // pushing diagonally into it slides along its end
      const z0 = robot.z;
      for (let i = 0; i < 10; i++) stepRobot(robot, 1, 1, 1 / 60, false, obstacles);
      expect(robot.z).toBeGreaterThan(z0 + 0.2);
      expect(robot.x).toBeCloseTo(-RACK.outerX - ROBOT.radius, 9);
      // the middle pallet of the back row (slot 1) from the rack gap
      const r2 = createRobot();
      for (let i = 0; i < 90; i++) stepRobot(r2, 0, -1, 1 / 60, false, obstacles);
      expect(r2.z).toBeCloseTo(-3.4 + PALLET_HALF + ROBOT.radius, 9);
      // the side wall
      const r3 = createRobot();
      r3.x = 7;
      r3.z = 1;
      for (let i = 0; i < 60; i++) stepRobot(r3, 1, 0, 1 / 60, true, obstacles);
      expect(r3.x).toBeCloseTo(ARENA.halfX - ROBOT.radius, 9);
      expect(r3.vx).toBeCloseTo(0, 9);
   });

   it("20,000 random steps never move faster than the cap, never enter a rack or a pallet, never leave the floor", () => {
      const rng = createRng(99);
      let worst = 0;
      let closest = Infinity;
      let farthestOut = -Infinity;
      for (const slots of PALLET_SETS) {
         const obstacles = createRun(1, { layout: { seed: 0, zoneColours: [0, 1, 2, 3], slots } }).obstacles;
         const robot = createRobot();
         let angle = 0;
         let len = 1;
         let carrying = false;
         for (let k = 0; k < 2_300; k++) {
            if (rng() < 0.08) {
               angle = rng() * Math.PI * 2;
               len = rng() * 1.6;
            }
            if (rng() < 0.02) carrying = !carrying;
            const dt = rng() < 0.1 ? MAX_STEP_MS / 1000 : (1 + rng() * 49) / 1000;
            const fromX = robot.x;
            const fromZ = robot.z;
            stepRobot(robot, Math.cos(angle) * len, Math.sin(angle) * len, dt, carrying, obstacles);
            const cap = carrying ? ROBOT.carrySpeed : ROBOT.speed;
            worst = Math.max(worst, Math.hypot(robot.x - fromX, robot.z - fromZ) / (cap * dt));
            for (const box of obstacles) closest = Math.min(closest, distanceToBoxXZ(robot.x, robot.z, box));
            farthestOut = Math.max(farthestOut, Math.abs(robot.x) - (ARENA.halfX - ROBOT.radius), Math.abs(robot.z) - (ARENA.halfZ - ROBOT.radius));
         }
      }
      expect(worst).toBeLessThanOrEqual(1 + 1e-9);
      expect(worst).toBeGreaterThan(0.99);
      expect(closest).toBeGreaterThan(ROBOT.radius - 0.05);
      expect(farthestOut).toBeLessThanOrEqual(1e-9);
   });

   it("the speed guard is needed: a full-speed corner graze is pushed past top · dt, and the guard trims it to exactly top · dt", () => {
      const obstacles = createRun(1, { layout: sideLayout() }).obstacles;
      // empty-handed past pallet slot 5's corner, carrying past the left rack's corner (found by a probe)
      for (const [carrying, top, x, z, vx, vz] of [
         [false, ROBOT.speed, 2.0691796626324663, 4.375492030981725, 5.979354020272189, 0.49731830878704475],
         [true, ROBOT.carrySpeed, -0.6367959303605898, 0.793715156146596, -4.775571167229557, 1.4811887208339538],
      ] as const) {
         const dt = MAX_STEP_MS / 1000;
         // the move plus the pushes alone (what stepRobot does before its guard) overshoot by more than 3 %
         const p = { x: x + vx * dt, y: 0, z: z + vz * dt };
         for (const box of obstacles) resolveSphereAabb(p, ROBOT.radius, box, p);
         expect(Math.hypot(p.x - x, p.z - z)).toBeGreaterThan(top * dt * 1.03);
         const robot = createRobot();
         Object.assign(robot, { x, z, vx, vz });
         stepRobot(robot, vx / top, vz / top, dt, carrying, obstacles);
         expect(Math.hypot(robot.x - x, robot.z - z)).toBeCloseTo(top * dt, 12);
      }
   });

   it("dt <= 0 does nothing; the robot turns to face where it goes", () => {
      const robot = createRobot();
      for (const dt of [0, -1, NaN]) stepRobot(robot, 1, 0, dt, false, open());
      expect(robot).toEqual(createRobot());
      const run = createRun(3);
      const before = JSON.stringify(run);
      for (const dt of [0, -16, NaN]) step(run, dt, { moveX: 1, moveY: 0, actionPressed: true });
      expect(JSON.stringify(run)).toBe(before);
      // heading 0 faces +z (the camera); driving +x turns it to PI / 2
      robot.x = -9;
      robot.z = -5;
      for (let i = 0; i < 60; i++) stepRobot(robot, 1, 0, 1 / 60, false, open());
      expect(robot.heading).toBeCloseTo(Math.PI / 2, 3);
   });

   it("a stopped robot keeps its heading (it turns only while faster than 0.3 u/s)", () => {
      const robot = createRobot();
      robot.x = -9;
      robot.z = -5;
      for (let i = 0; i < 60; i++) stepRobot(robot, 1, 0, 1 / 60, false, open());
      for (let i = 0; i < 60; i++) stepRobot(robot, 0, 0, 1 / 60, false, open());
      expect(Math.hypot(robot.vx, robot.vz)).toBe(0);
      expect(robot.heading).toBeCloseTo(Math.PI / 2, 3);
   });

   it("step maps the input as world x / z and ignores input that is not finite", () => {
      const run = createRun(8);
      place(run, -5.5, -4);
      for (let i = 0; i < 30; i++) step(run, 1000 / 60, { moveX: 0, moveY: 1, actionPressed: false });
      expect(run.robot.x).toBeCloseTo(-5.5, 9);
      expect(run.robot.vz).toBeCloseTo(6, 6);
      const still = createRun(8);
      for (let i = 0; i < 10; i++) step(still, 16, { moveX: NaN, moveY: Infinity, actionPressed: false });
      expect([still.robot.x, still.robot.z]).toEqual([0, 0]);
      expect(still.simMs).toBe(160);
   });
});

describe("warehouse-rush Action", () => {
   it("picks only in reach: exactly 0.8 from the pallet edge picks, 0.81 does nothing", () => {
      // SIDE pallet 3 at (3, 3.4): edges x 2.4..3.6, z 2.8..4.0
      for (const [x, z, picks] of [
         [3.6 + 0.8, 3.4, true],
         [3.6 + 0.81, 3.4, false],
         [3, 4 + 0.8, true],
         [3, 4 + 0.81, false],
         [2.4 - 0.8, 3, true],
         [2.4 - 0.81, 3, false],
         [3.6 + 0.8 * Math.SQRT1_2 - 1e-12, 4 + 0.8 * Math.SQRT1_2 - 1e-12, true],
         [3.6 + 0.81 * Math.SQRT1_2, 4 + 0.81 * Math.SQRT1_2, false],
      ] as const) {
         const run = runWith([1, 2, 0, 3], 3);
         place(run, x, z);
         const ev = step(run, 1, PRESS);
         expect(ev.picked, `${x}, ${z}`).toBe(picks ? 3 : NONE);
         expect(run.carrying).toBe(picks ? 3 : NONE);
         expect(run.lockMs).toBe(picks ? PICK_MS : 0);
         expect(run.pallets[3].box).toBe(picks ? NONE : 3);
      }
   });

   it("a pick empties the pallet and locks; another colour is refused with no lock and no score", () => {
      const run = runWith([1, 2, 0, 3], 3);
      place(run, ...reachSpot(0));
      // pallet 0 holds 1 (not the order): refused
      let ev = step(run, 5, PRESS);
      expect([ev.picked, ev.refused, run.refusals, run.lockMs, run.carrying, run.score]).toEqual([NONE, 0, 1, 0, NONE, 0]);
      expect(run.pallets[0].box).toBe(1);
      // no press: nothing
      ev = step(run, 5, IDLE);
      expect([ev.picked, ev.refused, run.refusals]).toEqual([NONE, NONE, 1]);
      // an empty pallet in reach: nothing
      run.pallets[0].box = NONE;
      ev = step(run, 5, PRESS);
      expect([ev.picked, ev.refused, run.refusals]).toEqual([NONE, NONE, 1]);
      // the order box
      place(run, ...reachSpot(3));
      ev = step(run, 5, PRESS);
      expect([ev.picked, ev.refused, run.picks, run.carrying, run.lockMs, run.score]).toEqual([3, NONE, 1, 3, PICK_MS, 0]);
      expect(run.pallets[3]).toMatchObject({ box: NONE, emptiedAt: run.simMs });
      expect([run.robot.vx, run.robot.vz]).toEqual([0, 0]);
      expect(ev.newOrder).toBe(false);
   });

   it("delivers only with the centre inside a zone: x = 6.5 delivers, x = 6.49 does nothing", () => {
      for (const [x, z, delivers] of [
         [6.5, 4, true],
         [6.49, 4, false],
         [8, 2.5, true],
         [8, 2.49, false],
         [-6.5, -2.5, true],
         [-6.49, -2.5, false],
         [9.5, 5.5, true],
      ] as const) {
         const run = runWith([NONE, 1, 2, 0], 3);
         run.carrying = 3;
         place(run, x, z);
         const ev = step(run, 1, PRESS);
         expect(ev.delivered || ev.wrong, `${x}, ${z}`).toBe(delivers);
         expect(run.carrying).toBe(delivers ? NONE : 3);
         expect(run.lockMs).toBe(delivers ? DROP_MS : 0);
         expect(ev.zone).toBe(delivers ? zoneAt(x, z) : NONE);
      }
      expect([zoneAt(-8, -4), zoneAt(8, -4), zoneAt(-8, 4), zoneAt(8, 4), zoneAt(0, 0), zoneAt(8, 0)]).toEqual([0, 1, 2, 3, NONE, NONE]);
   });

   it("the reach and zone edges are exact (MIN_LEG assumes them): 1e-6 past an edge does nothing", () => {
      const b = palletBounds(5); // (3, 3.4): x 2.4..3.6, z 2.8..4.0
      expect(inReach(3.6 + PICK_GAP, 3.4, b)).toBe(true);
      expect(inReach(3.6 + PICK_GAP + 1e-6, 3.4, b)).toBe(false);
      expect(inReach(3, 4 + PICK_GAP, b)).toBe(true);
      expect(inReach(3, 4 + PICK_GAP + 1e-6, b)).toBe(false);
      expect(zoneAt(ZONE.innerX, 4)).toBe(3);
      expect(zoneAt(ZONE.innerX - 1e-6, 4)).toBe(NONE);
      expect(zoneAt(8, ZONE.innerZ)).toBe(3);
      expect(zoneAt(8, ZONE.innerZ - 1e-6)).toBe(NONE);
      expect(zoneAt(-ZONE.innerX, -4)).toBe(0);
      expect(zoneAt(-ZONE.innerX + 1e-6, -4)).toBe(NONE);
   });

   it("right zone +50, wrong zone -20, never below 0; Delivered counts right ones only", () => {
      const deliver = (run: WarehouseRun, corner: number) => {
         run.carrying = run.order;
         place(run, ...zoneSpot(corner));
         const ev = { ...step(run, 1, PRESS) };
         waitLock(run);
         return ev;
      };
      const run = runWith([0, 1, 2, 3], 2);
      // zone 2 holds colour 2 (SIDE): right
      let ev = deliver(run, zoneCornerOf(run.layout, run.order));
      expect([ev.delivered, ev.wrong, ev.delta, run.score, run.delivered, run.wrong, run.drops]).toEqual([true, false, 50, 50, 1, 0, 1]);
      // wrong zones: 50 -> 30 -> 10 -> 0 (the floor cut the penalty to -10) -> 0
      const wrongCorner = () => (zoneCornerOf(run.layout, run.order) + 1) % 4;
      const deltas = [-20, -20, -10, 0];
      const scores = [30, 10, 0, 0];
      deltas.forEach((delta, k) => {
         ev = deliver(run, wrongCorner());
         expect([ev.delivered, ev.wrong, ev.delta, run.score, run.lastDelta]).toEqual([false, true, delta, scores[k], delta]);
      });
      expect([run.delivered, run.wrong, run.drops]).toEqual([1, 4, 5]);
      ev = deliver(run, zoneCornerOf(run.layout, run.order));
      expect([ev.delta, run.score, run.delivered]).toEqual([50, 50, 2]);
      // README examples: 14 right, then 2 wrong = 660; 2 wrong first, then 14 right = 700
      let s = 0;
      for (let k = 0; k < 14; k++) s = scoreAfter(s, true);
      s = scoreAfter(scoreAfter(s, false), false);
      expect(s).toBe(660);
      s = scoreAfter(scoreAfter(0, false), false);
      for (let k = 0; k < 14; k++) s = scoreAfter(s, true);
      expect(s).toBe(700);
      expect([scoreAfter(10, false), scoreAfter(0, false), scoreAfter(20, false), scoreAfter(0, true)]).toEqual([0, 0, 0, 50]);
   });

   it("every delivery, right or wrong, draws the next order in the same step and schedules a refill", () => {
      for (const right of [true, false]) {
         const run = runWith([NONE, 1, 2, 3], 0);
         run.carrying = 0;
         const want = expectedOrder([NONE, 1, 2, 3], run.rng.orders.s);
         place(run, ...zoneSpot(right ? 0 : 1));
         const ev = step(run, 7, PRESS);
         expect([ev.delivered, ev.wrong, ev.newOrder, run.order, run.orders]).toEqual([right, !right, true, want, 2]);
         expect([run.refillCount, run.refillDue[run.refillHead]]).toEqual([1, run.simMs + REFILL_MS]);
      }
   });

   it("presses during a lock are dropped; the step that ends the lock does not move, the next one does", () => {
      const hold: StepInput = { moveX: 1, moveY: 0, actionPressed: true };
      for (const dtMs of [50, 16, 1000 / 60, 7]) {
         const run = runWith([1, 2, 0, 3], 3);
         place(run, ...reachSpot(3));
         step(run, 1, PRESS);
         expect(run.carrying).toBe(3);
         // teleport into the zone: pressing (and steering) during the lock does nothing
         place(run, ...zoneSpot(3));
         const lockedFrom = run.lockedMs;
         let steps = 0;
         while (run.lockMs > 0 && steps < MAX_LOOP) {
            const ev = step(run, dtMs, hold);
            steps += 1;
            expect(ev.delivered || ev.wrong).toBe(false);
            expect([run.robot.x, run.robot.z, run.robot.vx]).toEqual([...zoneSpot(3), 0]);
         }
         const locked = run.lockedMs - lockedFrom;
         expect(locked).toBeGreaterThanOrEqual(PICK_MS);
         expect(locked).toBeLessThan(PICK_MS + Math.ceil(dtMs));
         expect(steps).toBeGreaterThanOrEqual(Math.ceil(PICK_MS / MAX_STEP_MS));
         // the next step moves and acts: the box goes into zone 3 (from rest: the lock left no speed)
         expect([run.robot.vx, run.robot.vz]).toEqual([0, 0]);
         const ev = step(run, dtMs, hold);
         expect(run.robot.x).toBeGreaterThan(zoneSpot(3)[0]);
         expect(ev.delivered).toBe(true);
      }
   });

   it("a lock stops the robot: a moving robot entering a lock step has no velocity after it", () => {
      const run = createRun(4);
      place(run, -5.5, -4);
      for (let i = 0; i < 20; i++) step(run, 16, { moveX: 0, moveY: 1, actionPressed: false });
      expect(run.robot.vz).toBeCloseTo(ROBOT.speed, 9);
      const { x, z } = run.robot;
      run.lockMs = 100;
      step(run, 16, { moveX: 0, moveY: 1, actionPressed: true });
      expect([run.robot.x, run.robot.z, run.robot.vx, run.robot.vz, run.lockMs]).toEqual([x, z, 0, 0, 84]);
   });

   it("a pick and a drop while moving stop the robot in that same step; lastZone is the drop's corner", () => {
      // drive into SIDE pallet 3's reach from the +x side, pressing every frame
      const run = runWith([1, 2, 0, 3], 3);
      place(run, 6, 3.4);
      let ev = step(run, 16, { moveX: -1, moveY: 0, actionPressed: false });
      for (let k = 0; k < 100 && run.carrying === NONE; k++) ev = step(run, 16, { moveX: -1, moveY: 0, actionPressed: true });
      expect(ev.picked).toBe(3);
      expect([run.robot.vx, run.robot.vz]).toEqual([0, 0]);
      expect(run.lastZone).toBe(NONE);
      // wait out the lock, then drive into zone 3 pressing every frame
      waitLock(run);
      for (let k = 0; k < 200 && run.carrying !== NONE; k++) ev = step(run, 16, { moveX: 1, moveY: 0, actionPressed: true });
      expect(ev.delivered).toBe(true);
      expect([run.robot.vx, run.robot.vz]).toEqual([0, 0]);
      expect(ev.zone).toBe(3);
      expect(run.lastZone).toBe(3);
   });

   it("a carrying robot in reach of a pallet does nothing, and at most one pallet is ever in reach", () => {
      const run = runWith([3, 3, 3, 3], 3);
      run.carrying = 3;
      place(run, ...reachSpot(2));
      const ev = step(run, 5, PRESS);
      expect([ev.picked, ev.refused, ev.delivered, ev.wrong, run.lockMs, run.carrying]).toEqual([NONE, NONE, false, false, 0, 3]);
      expect([run.picks, run.refusals, run.drops, boxesOf(run)]).toEqual([0, 0, 0, [3, 3, 3, 3]]);
      // all 6 slots: every spot is in the reach of one pallet at most (palletInReach finds that one)
      const all = createRun(1, { layout: { seed: 0, zoneColours: [0, 1, 2, 3], slots: [0, 1, 3, 4] } });
      let found = 0;
      let missed = 0;
      for (let i = 0; i <= 400; i++) {
         for (let j = 0; j <= 240; j++) {
            const x = -10 + i * 0.05;
            const z = -6 + j * 0.05;
            let hit = NONE;
            let hits = 0;
            all.pallets.forEach((p, k) => {
               if (inReach(x, z, p.bounds)) {
                  hits += 1;
                  hit = k;
               }
            });
            if (hits > 1) throw new Error(`${hits} reaches at ${x}, ${z}`);
            if (palletInReach(all.pallets, x, z) !== hit) missed += 1;
            if (hits === 1) found += 1;
         }
      }
      expect(missed).toBe(0);
      expect(found).toBeGreaterThan(1000);
   });
});

describe("warehouse-rush refills", () => {
   /** One delivery at simMs t: pallet 3's box is picked and delivered into zone 3. */
   function deliverOnce(dtMs: number): WarehouseRun {
      const run = runWith([1, 2, 0, 3], 3);
      place(run, ...reachSpot(3));
      step(run, dtMs, PRESS);
      waitLock(run);
      place(run, ...zoneSpot(3));
      step(run, dtMs, PRESS);
      expect(run.drops).toBe(1);
      return run;
   }

   it("lands on the first step with simMs >= delivery + 1500, not one step earlier, at any frame rate", () => {
      for (const dtMs of [1, 7, 1000 / 144, 1000 / 60, 1000 / 30, 50]) {
         const run = deliverOnce(dtMs);
         const due = run.simMs + REFILL_MS;
         const colour = boxStream(run.rng.boxes.s, 1)[0];
         let landedAt = -1;
         let prevSimMs = run.simMs;
         while (landedAt < 0 && run.ended === null) {
            prevSimMs = run.simMs;
            const ev = step(run, dtMs, IDLE);
            if (ev.refilled) {
               landedAt = run.simMs;
               expect(ev.refilled).toBe(1 << 3);
            } else {
               expect(run.pallets[3].box).toBe(NONE);
            }
         }
         expect(landedAt).toBeGreaterThanOrEqual(due);
         expect(prevSimMs).toBeLessThan(due);
         expect(run.ended).toBe(null);
         expect(run.pallets[3].box).toBe(colour);
         expect(run.refillCount).toBe(0);
      }
   });

   it("goes to the pallet empty longest (ties: the lower index), before that step's move and action", () => {
      // pallets 1 and 3 empty, 1 emptied earlier: the refill goes to 1
      const run = runWith([0, NONE, 2, NONE], 2);
      run.pallets[1].emptiedAt = 100;
      run.pallets[3].emptiedAt = 900;
      run.refillDue[0] = 50;
      run.refillCount = 1;
      run.simMs = 49;
      let ev = step(run, 1, IDLE);
      expect(ev.refilled).toBe(1 << 1);
      // ties: the lower index
      const tie = runWith([0, NONE, 2, NONE], 2);
      tie.pallets[1].emptiedAt = 500;
      tie.pallets[3].emptiedAt = 500;
      tie.refillDue[0] = 1;
      tie.refillCount = 1;
      ev = step(tie, 1, IDLE);
      expect(ev.refilled).toBe(1 << 1);
      const later = runWith([0, NONE, 2, NONE], 2);
      later.pallets[1].emptiedAt = 900;
      later.pallets[3].emptiedAt = 100;
      later.refillDue[0] = 1;
      later.refillCount = 1;
      expect(step(later, 1, IDLE).refilled).toBe(1 << 3);

      // before the action: the robot waits in reach of the empty pallet and presses on the landing step
      for (let trial = 0; trial < 8; trial++) {
         const r = runWith([0, NONE, 2, 3], 1);
         r.rng.boxes.s = 1000 + trial;
         const colour = boxStream(r.rng.boxes.s, 1)[0];
         r.order = colour;
         r.refillDue[0] = 20;
         r.refillCount = 1;
         r.simMs = 10;
         place(r, ...reachSpot(1));
         expect(step(r, 5, PRESS).picked).toBe(NONE);
         const landing = step(r, 5, PRESS);
         expect(landing.refilled).toBe(1 << 1);
         expect(landing.picked).toBe(1);
         expect(r.carrying).toBe(colour);
      }
   });

   it("a refill due during a pick lock lands on time (step 2 runs before the lock)", () => {
      // in play the pick lock often overlaps delivery + 1500 ms; the refill must not wait for the lock
      const run = runWith([NONE, 1, 2, 3], 3);
      run.refillDue[0] = 30;
      run.refillCount = 1;
      place(run, ...reachSpot(3));
      expect(step(run, 10, PRESS).picked).toBe(3);
      expect(run.lockMs).toBe(PICK_MS);
      let landedAt = -1;
      for (let k = 0; run.lockMs > 0 && k < 100; k++) {
         const ev = step(run, 10, IDLE);
         if (ev.refilled) landedAt = run.simMs;
      }
      expect(run.lockMs).toBe(0);
      // pallet 0 has been empty since 0, pallet 3 since the pick at 10: it lands on pallet 0 at 30 ms
      expect(landedAt).toBe(30);
      expect(run.pallets[0].box).not.toBe(NONE);
      expect(run.pallets[3].box).toBe(NONE);
   });

   it("two pending refills land in due order with the next two colours of the box stream", () => {
      const run = runWith([NONE, NONE, 2, 3], 2);
      run.pallets[0].emptiedAt = 10;
      run.pallets[1].emptiedAt = 20;
      run.refillDue[0] = 1600;
      run.refillDue[1] = 2900;
      run.refillCount = 2;
      const colours = boxStream(run.rng.boxes.s, 2);
      const landed: Array<[number, number]> = [];
      while (run.refillCount > 0 && run.ended === null) {
         const ev = step(run, 16, IDLE);
         for (let i = 0; i < 4; i++) if (ev.refilled & (1 << i)) landed.push([i, run.simMs]);
      }
      expect(landed.map(([i]) => i)).toEqual([0, 1]);
      expect(landed[0][1]).toBeGreaterThanOrEqual(1600);
      expect(landed[0][1]).toBeLessThan(1616);
      expect(landed[1][1]).toBeGreaterThanOrEqual(2900);
      expect(boxesOf(run).slice(0, 2)).toEqual(colours);
   });
});

describe("warehouse-rush invariants under random play", () => {
   it("2000 runs (bots, random and mashing input; 144 / 60 / 30 fps and random 1-50 ms steps) keep every README invariant", () => {
      const problems: string[] = [];
      let deliveries = 0;
      let wrong = 0;
      let maxPending = 0;
      let minOccupied = Infinity;
      let stuck = 0;
      let fastestCycle = Infinity;
      let earliestFirst = Infinity;
      for (let seed = 0; seed < 2000; seed++) {
         const pattern = PATTERNS[seed % 4];
         const kind = Math.floor(seed / 4) % 5;
         const bot = kind === 0 ? pathBot() : kind === 1 ? pathBot("nearest") : kind === 2 ? pathBot("wrong") : randomBot(seed, kind === 3 ? 1 : 0.2);
         const result = play(createRun(seed), bot, pattern.make(seed));
         problems.push(...result.problems);
         deliveries += result.deliveries.length;
         wrong += result.run.wrong;
         stuck += bot.stuck;
         maxPending = Math.max(maxPending, result.maxPending);
         minOccupied = Math.min(minOccupied, result.minOccupiedAtDraw);
         const d = result.deliveries;
         if (d.length) earliestFirst = Math.min(earliestFirst, d[0]);
         for (let k = 1; k < d.length; k++) fastestCycle = Math.min(fastestCycle, d[k] - d[k - 1]);
         const { run } = result;
         if (run.simMs !== DURATION_MS || run.ended !== "timeup") problems.push(`seed ${seed}: ended ${run.ended} at ${run.simMs}`);
         if (!withinServerLimits(run.score, DURATION_MS) || capScore(run.score, DURATION_MS) !== run.score) problems.push(`seed ${seed}: final ${run.score}`);
         if (run.drops !== run.delivered + run.wrong || run.drops !== d.length || run.orders !== run.drops + 1) problems.push(`seed ${seed}: counters`);
         if (kind === 2 && run.score !== 0) problems.push(`seed ${seed}: the wrong-zone bot scored ${run.score}`);
      }
      expect(problems).toEqual([]);
      expect(stuck).toBe(0);
      // the checks really ran: many deliveries, many wrong ones, refills overlapping
      expect(deliveries).toBeGreaterThan(15_000);
      expect(wrong).toBeGreaterThan(5_000);
      // the README bounds are reached, not just respected: 2 refills pending, 2 occupied pallets at a draw
      expect(maxPending).toBe(2);
      expect(minOccupied).toBe(2);
      expect(fastestCycle).toBeGreaterThanOrEqual(CYCLE_MIN_MS);
      expect(earliestFirst).toBeGreaterThanOrEqual(FIRST_DELIVERY_MIN_MS);
   }, 120_000);
});

describe("warehouse-rush scoring limit proof (README.md)", () => {
   it("the real store, driven like ShellStage: no untimed step, moving + lock time <= elapsedMs, the Scene's publishing matches the rules", () => {
      expect(FRAME_PRIORITY.clock).toBeLessThan(FRAME_PRIORITY.simulation);
      const store = createArcadeStore();
      store.getState().configure({ durationMs: DURATION_MS });
      store.getState().markReady();
      const rng = createRng(2026);
      let carried = 0;
      let pausedFrames = 0;
      for (const [i, ending] of (["timeup", "restart", "timeup", "timeup", "restart", "timeup"] as const).entries()) {
         const { phase } = store.getState();
         if (phase === "ready" || phase === "over") store.getState().start();
         // GameShell remounts the Scene (new runId): a new seed, and the mount publish
         const run = createRun(7000 + i);
         const bot = pathBot(i % 3 === 2 ? "nearest" : "order");
         const s0 = store.getState();
         s0.setStat("order", run.order);
         s0.setStat("carry", 0);
         const cache = { score: 0, delivered: 0, order: run.order, carry: 0, drops: 0, delta: 0 };
         const publish = () => {
            const s = store.getState();
            if (run.score !== cache.score) s.setScore((cache.score = run.score));
            if (run.delivered !== cache.delivered) s.setStat("delivered", (cache.delivered = run.delivered));
            if (run.order !== cache.order) s.setStat("order", (cache.order = run.order));
            const carry = run.carrying === NONE ? 0 : 1;
            if (carry !== cache.carry) s.setStat("carry", (cache.carry = carry));
            if (run.drops !== cache.drops) s.setStat("drops", (cache.drops = run.drops));
            if (run.lastDelta !== cache.delta) s.setStat("delta", (cache.delta = run.lastDelta));
         };
         const stopAtMs = 8_000 + rng() * 40_000;
         let untimed = 0;
         let worstAhead = -Infinity;
         let worstBehind = -Infinity;
         let first = true;
         let lastDelivery = -1;
         const problems: string[] = [];
         while (store.getState().phase !== "over") {
            const roll = rng();
            if (roll < 0.01) store.getState().pause();
            else if (roll < 0.03) store.getState().resume();
            const before = store.getState().elapsedMs;
            if (store.getState().phase === "countdown") expect(store.getState().stats.order).toBe(run.order);
            advanceRunClock(store, rng() < 0.1 ? 0.05 + rng() * 0.25 : 0.004 + rng() * 0.03);
            const dt = playedFrameDt(store.getState());
            if (store.getState().phase === "paused") pausedFrames += 1;
            if (dt === 0) continue;
            if (dt * 1000 > store.getState().elapsedMs - before + 1e-9) untimed += 1;
            if (first && dt < MAX_FRAME_DT - 1e-9) carried += 1;
            first = false;
            // Scene: useRunFrame -> bot / input -> step -> publish
            const dtMs = dt * 1000;
            const ev = step(run, dtMs, bot.next(run, dtMs));
            publish();
            const e = store.getState().elapsedMs;
            worstAhead = Math.max(worstAhead, run.simMs - e);
            worstBehind = Math.max(worstBehind, e - run.simMs);
            const score = store.getState().score;
            if (run.movedMs + run.lockedMs > e + 1e-6) problems.push(`moved + locked > elapsed at ${e}`);
            if (score * 1000 > 50 * e || score > 3000 || capScore(score, e) !== score) problems.push(`score ${score} at ${e}`);
            if (ev.delivered || ev.wrong) {
               if (lastDelivery >= 0 && run.simMs - lastDelivery < CYCLE_MIN_MS) problems.push(`cycle ${run.simMs - lastDelivery}`);
               lastDelivery = run.simMs;
            }
            if (ending === "restart" && e >= stopAtMs) break;
         }
         const s = store.getState();
         expect(problems).toEqual([]);
         expect(untimed).toBe(0);
         // the integer clock never runs ahead of elapsedMs and lags it by less than 1 ms
         expect(worstAhead).toBeLessThanOrEqual(1e-6);
         expect(worstBehind).toBeLessThan(1);
         expect(s.score).toBe(run.score);
         expect(s.stats.delivered ?? 0).toBe(run.delivered);
         expect(s.stats.order).toBe(run.order);
         expect(s.stats.drops ?? 0).toBe(run.drops);
         expect(run.drops).toBeGreaterThan(1);
         if (ending === "timeup") {
            expect(run.drops).toBeGreaterThan(10);
            // the store's clock ends the run: the rules never saw the time-up frame
            expect(s.endReason).toBe("timeup");
            expect(s.elapsedMs).toBe(DURATION_MS);
            expect(run.ended).toBe(null);
            expect(run.simMs).toBeLessThan(DURATION_MS);
            expect(run.simMs).toBeGreaterThan(DURATION_MS - 300);
            expect(withinServerLimits(s.score, s.elapsedMs)).toBe(true);
            expect(capScore(s.score, s.elapsedMs)).toBe(s.score);
         } else {
            store.getState().restart();
         }
      }
      // the random frames really ended countdowns mid-frame and paused runs
      expect(carried).toBeGreaterThan(0);
      expect(pausedFrames).toBeGreaterThan(0);
   }, 60_000);

   /**
    * README "Test plan", worst-case drill: after each delivery the run is rewritten so that the order's
    * box is on the side pallet beside the zone the robot just dropped into, and that zone is the order's.
    * A straight-line bot drives at full speed between them.
    */
   function drill(nextDt: () => number) {
      const run = createRun(11, { layout: sideLayout() });
      let corner = 3;
      let rewrite = true;
      const input = createStepInput();
      const deliveries: number[] = [];
      for (let guard = 0; run.ended === null && guard < MAX_LOOP; guard++) {
         if (rewrite && run.carrying === NONE) {
            const colour = run.order;
            const z = run.layout.zoneColours;
            const at = z.indexOf(colour);
            z[at] = z[corner];
            z[corner] = colour;
            run.pallets[corner].box = colour;
            rewrite = false;
         }
         const dtMs = nextDt();
         const r = run.robot;
         const dt = Math.min(dtMs, MAX_STEP_MS) / 1000;
         const sx = cornerSignX(corner);
         const sz = cornerSignZ(corner);
         const pallet = run.pallets[corner];
         input.actionPressed = false;
         if (run.carrying === NONE) {
            // straight at the pallet's near corner from the start, straight back along x from the zone
            const aimX = sx * (3 - PALLET_HALF);
            const aimZ = Math.abs(r.x) > 4 ? r.z : sz * (3.4 - PALLET_HALF);
            const len = Math.hypot(aimX - r.x, aimZ - r.z) || 1;
            input.moveX = (aimX - r.x) / len;
            input.moveY = (aimZ - r.z) / len;
            if (inReach(r.x, r.z, pallet.bounds) || inReach(r.x + r.vx * dt, r.z + r.vz * dt, pallet.bounds)) input.actionPressed = true;
         } else {
            // straight along x into the zone (with a little z first if the pick was below its edge)
            const aimX = sx * 9;
            const aimZ = sz * Math.min(Math.max(Math.abs(r.z), ZONE.innerZ + 0.3), 5.4);
            const len = Math.hypot(aimX - r.x, aimZ - r.z) || 1;
            input.moveX = (aimX - r.x) / len;
            input.moveY = (aimZ - r.z) / len;
            if (zoneAt(r.x, r.z) === corner || zoneAt(r.x + r.vx * dt, r.z + r.vz * dt) === corner) input.actionPressed = true;
         }
         const ev = step(run, dtMs, input);
         if (ev.delivered || ev.wrong) {
            deliveries.push(run.simMs);
            corner = ev.zone;
            rewrite = true;
         }
      }
      return { run, deliveries };
   }

   it("worst-case drill: the order box always beside the zone, full speed: cycles >= 1270 ms, score <= 2350", () => {
      for (const pattern of PATTERNS) {
         const { run, deliveries } = drill(pattern.make(1));
         const cycles = deliveries.slice(1).map((t, k) => t - deliveries[k]);
         expect(run.wrong).toBe(0);
         expect(deliveries[0]).toBeGreaterThanOrEqual(FIRST_DELIVERY_MIN_MS);
         expect(Math.min(...cycles)).toBeGreaterThanOrEqual(CYCLE_MIN_MS);
         expect(run.score).toBeLessThanOrEqual(SCORE_BOUND);
         expect(withinServerLimits(run.score, DURATION_MS)).toBe(true);
         // the drill really is close to the bound: about 1.45 s per cycle, about 2000 points
         expect(Math.min(...cycles)).toBeLessThan(1520);
         // the first trip picks on the start's side of the pallet, so it is well above its (loose) bound
         expect(deliveries[0]).toBeLessThan(2000);
         expect(run.score).toBeGreaterThan(1900);
      }
   });

   it("the step that reaches 60 s ends the run first: no move, no drop, no refill (like RunClock)", () => {
      const run = runWith([NONE, 1, 2, 0], 3);
      run.carrying = 3;
      run.score = 100;
      place(run, ...zoneSpot(3));
      run.simMs = DURATION_MS - 10;
      run.refillDue[0] = DURATION_MS - 5;
      run.refillCount = 1;
      const ev = step(run, 16, { moveX: 1, moveY: 0, actionPressed: true });
      expect(ev.ended).toBe("timeup");
      expect([ev.delivered, ev.wrong, ev.refilled]).toEqual([false, false, 0]);
      expect([run.simMs, run.carry, run.stepMs, run.score, run.carrying, run.refillCount]).toEqual([DURATION_MS, 0, 10, 100, 3, 1]);
      expect([run.robot.x, run.robot.z]).toEqual(zoneSpot(3));
      // one step earlier the same press delivers
      const early = runWith([NONE, 1, 2, 0], 3);
      early.carrying = 3;
      place(early, ...zoneSpot(3));
      early.simMs = DURATION_MS - 17;
      expect(step(early, 16, PRESS).delivered).toBe(true);
      expect(early.ended).toBe(null);
   });

   it("an idle robot times out with 0 at exactly 60000 ms", () => {
      const result = play(createRun(1), idleBot(), fixed(1000 / 60));
      expect(result.run).toMatchObject({ score: 0, simMs: DURATION_MS, ended: "timeup", drops: 0, picks: 0, orders: 1 });
      expect(withinServerLimits(0, DURATION_MS)).toBe(true);
      // after the end, steps change nothing (they only clear the events object)
      const { events: _events, ...after } = result.run;
      const ev = step(result.run, 16, PRESS);
      expect(ev).toEqual({ picked: NONE, refused: NONE, delivered: false, wrong: false, zone: NONE, delta: 0, newOrder: false, refilled: 0, ended: null });
      const { events: _again, ...now } = result.run;
      expect(JSON.stringify(now)).toBe(JSON.stringify(after));
   });
});

describe("warehouse-rush fairness", () => {
   it("a perfect-play bot finishes every order on 1000 seeds; its delivery counts stay in the README band", () => {
      const counts: number[] = [];
      let stuck = 0;
      let wrong = 0;
      const problems: string[] = [];
      for (let seed = 0; seed < 1000; seed++) {
         const bot = pathBot();
         const result = play(createRun(seed), bot, fixed(1000 / 60));
         problems.push(...result.problems);
         stuck += bot.stuck;
         wrong += result.run.wrong;
         counts.push(result.run.delivered);
      }
      expect(problems).toEqual([]);
      expect(stuck).toBe(0);
      expect(wrong).toBe(0);
      const sorted = [...counts].sort((a, b) => a - b);
      const median = sorted[500];
      const p1 = sorted[Math.floor(0.01 * 999)];
      const p99 = sorted[Math.ceil(0.99 * 999)];
      expect(median).toBeGreaterThanOrEqual(PERFECT_MEDIAN - 1);
      expect(median).toBeLessThanOrEqual(PERFECT_MEDIAN + 1);
      expect(p1).toBeGreaterThanOrEqual(median - 3);
      expect(p99).toBeLessThanOrEqual(median + 3);
      expect(sorted[0]).toBeGreaterThanOrEqual(median - 5);
      expect(sorted[999]).toBeLessThanOrEqual(median + 5);
   }, 120_000);
});

describe("warehouse-rush frame-rate independence", () => {
   it("the integer clock never runs ahead of the dts and lags them by less than 1 ms; 60 s ends exactly", () => {
      for (const pattern of PATTERNS) {
         const run = createRun(2);
         const next = pattern.make(5);
         let sum = 0;
         for (let guard = 0; run.ended === null && guard < MAX_LOOP; guard++) {
            const dt = next();
            const before = run.simMs;
            step(run, dt, IDLE);
            sum += Math.min(dt, MAX_STEP_MS);
            if (run.ended) break;
            expect(Number.isInteger(run.simMs)).toBe(true);
            expect(run.simMs).toBeLessThanOrEqual(sum + 1e-6);
            expect(run.simMs).toBeGreaterThan(sum - 1);
            expect(run.stepMs).toBe(run.simMs - before);
         }
         expect(run.simMs).toBe(DURATION_MS);
         expect(sum).toBeGreaterThan(DURATION_MS - 51);
      }
      // a step longer than 50 ms counts 50 (useRunFrame never hands more)
      const run = createRun(2);
      expect(advanceClock(run, 300)).toBe(MAX_STEP_MS);
      expect(advanceClock(run, 0.4)).toBe(0);
      expect(advanceClock(run, 0.7)).toBe(1);
      expect(run.carry).toBeCloseTo(0.1, 9);
   });

   it("the robot moves only for whole ms of play: a sub-ms frame that adds no ms never moves it", () => {
      const run = createRun(8);
      place(run, -5.5, -4);
      const go: StepInput = { moveX: 0, moveY: 1, actionPressed: false };
      let still = 0;
      for (let i = 0; i < 400; i++) {
         const z0 = run.robot.z;
         step(run, 0.4, go);
         if (run.stepMs === 0) {
            still += 1;
            expect(run.robot.z).toBe(z0);
         } else {
            expect(run.robot.z - z0).toBeLessThanOrEqual((ROBOT.speed * run.stepMs) / 1000 + 1e-12);
         }
      }
      expect(still).toBeGreaterThan(200);
      expect(run.simMs).toBe(160);
      expect(run.movedMs).toBe(160);
   });

   it("the same seed gives the same layout, boxes and first order at every frame rate; driving 1 s goes as far", () => {
      const ends: number[] = [];
      for (const pattern of PATTERNS) {
         const idle = play(createRun(31), idleBot(), pattern.make(2));
         expect(idle.run.layout).toEqual(generateLayout(31));
         expect(boxesOf(idle.run)).toEqual(boxesOf(createRun(31)));
         expect(idle.run.order).toBe(createRun(31).order);
         const run = createRun(31);
         place(run, -5.5, -4.5);
         const next = pattern.make(3);
         for (let guard = 0; run.simMs < 1000 && guard < MAX_LOOP; guard++) step(run, Math.min(next(), 1000 - run.simMs), { moveX: 0, moveY: 1, actionPressed: false });
         expect(run.simMs).toBe(1000);
         expect(run.robot.vz).toBeCloseTo(6, 6);
         ends.push(run.robot.z);
      }
      // 1 s from rest: 0.6 m while accelerating, then 4.8 m at top speed
      for (const z of ends) expect(z - -4.5).toBeCloseTo(5.4, 0);
      expect(Math.max(...ends) - Math.min(...ends)).toBeLessThan(0.15);
   });

   it("the perfect bot delivers about the same at 144 / 60 / 30 fps and random steps", () => {
      let totalDiff = 0;
      let runs = 0;
      for (let seed = 500; seed < 520; seed++) {
         const at60 = play(createRun(seed), pathBot(), fixed(1000 / 60)).run.delivered;
         for (const pattern of [FPS_144, FPS_30, RANDOM_1_50]) {
            const result = play(createRun(seed), pathBot(), pattern.make(seed));
            expect(result.problems).toEqual([]);
            const diff = result.run.delivered - at60;
            expect(Math.abs(diff), `seed ${seed} ${pattern.name}`).toBeLessThanOrEqual(2);
            totalDiff += Math.abs(diff);
            runs += 1;
         }
      }
      expect(totalDiff / runs).toBeLessThanOrEqual(1);
   }, 60_000);

   it("no allocation proxies: step reuses the events object and never replaces the run's pools", () => {
      const run = createRun(9);
      const refs = [run.events, run.pallets, run.obstacles, run.refillDue, run.robot, run.layout, run.rng, ...run.pallets];
      const result = play(run, pathBot(), fixed(1000 / 60));
      expect(result.deliveries.length).toBeGreaterThan(10);
      const after = [run.events, run.pallets, run.obstacles, run.refillDue, run.robot, run.layout, run.rng, ...run.pallets];
      refs.forEach((ref, k) => expect(after[k]).toBe(ref));
      expect([run.pallets.length, run.obstacles.length, run.refillDue.length]).toEqual([PALLET_COUNT, 2 + PALLET_COUNT, PALLET_COUNT]);
   });
});

// ---------- golden values (from the first run of these rules; a change here is a design change) ----------

const GOLDEN_RUNS = [
   { seed: 1, zoneColours: [3, 1, 0, 2], slots: [0, 1, 3, 4], boxes: [0, 1, 3, 2, 3, 2, 3, 2, 1, 1, 2, 2], order: 3 },
   { seed: 42, zoneColours: [0, 3, 1, 2], slots: [0, 1, 4, 5], boxes: [1, 3, 2, 2, 2, 3, 2, 2, 2, 2, 2, 3], order: 2 },
   { seed: 3141592653, zoneColours: [3, 0, 2, 1], slots: [1, 2, 3, 5], boxes: [1, 0, 0, 0, 3, 2, 1, 3, 2, 3, 2, 2], order: 0 },
];
const PERFECT_MEDIAN = 18;
