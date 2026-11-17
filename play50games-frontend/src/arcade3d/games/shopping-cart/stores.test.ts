// The five store floors (levels.ts STORES): every item slot, the start and the checkout stay
// reachable around each level's set pieces (and around the shut lane at closing time), nothing sits
// on a slot, the start, a pyramid or the finish, the floor machines stun like shoppers, the lane only
// shuts when the cart is clear, and level 1 is untouched. Bot clear rates per level: levels.test.ts.
import { describe, expect, it } from "vitest";
import { pointInAabb, type AABB } from "@/arcade3d/core/collision";
import { pointAt } from "@/arcade3d/core/path";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS, STORES } from "./levels";
import {
   CART,
   FINISH_ZONE,
   LANE_GATE,
   MOVER_RADIUS,
   PYRAMID_POSITIONS,
   SHELF_SLOTS,
   SOLID_OBSTACLES,
   START_POS,
   createRun,
   createShopperRoutes,
   inSpillAt,
   pieceBox,
   solidsFor,
   stepRun,
   type RunState,
} from "./rules";

const ARENA_IDS = [2, 3, 4, 5] as const;
const CELL = 0.25;
const NX = Math.round(32 / CELL);
const NZ = Math.round(24 / CELL);
/** The cart proxy's smaller half extent: it threads a gap lengthwise (the limit proof's inflation). */
const INFLATE = 0.45;

function boxDist(x: number, z: number, b: AABB): number {
   const dx = Math.max(b.min.x - x, 0, x - b.max.x);
   const dz = Math.max(b.min.z - z, 0, z - b.max.z);
   return Math.hypot(dx, dz);
}

/** Flood fill of cart-centre cells from the start over a level's solids (the shut lane when `shut`). */
function reach(id: LevelId, shut: boolean): { seen: Uint8Array; at: (x: number, z: number) => number } {
   const solids = [...solidsFor(LEVELS[id]), ...(shut ? [LANE_GATE] : [])];
   const at = (x: number, z: number) => Math.floor((z + 12) / CELL) * NX + Math.floor((x + 16) / CELL);
   const free = new Uint8Array(NX * NZ);
   for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const x = -16 + (ix + 0.5) * CELL;
      const z = -12 + (iz + 0.5) * CELL;
      if (x < -15.4 + INFLATE || x > 15.4 - INFLATE || z < -11.4 + INFLATE || z > 11.4 - INFLATE) continue;
      if (solids.some((b) => x > b.min.x - INFLATE && x < b.max.x + INFLATE && z > b.min.z - INFLATE && z < b.max.z + INFLATE)) continue;
      free[iz * NX + ix] = 1;
   }
   const seen = new Uint8Array(NX * NZ);
   const start = at(START_POS.x, START_POS.z);
   expect(free[start], `L${id} start cell`).toBe(1);
   const queue = [start];
   seen[start] = 1;
   while (queue.length) {
      const id0 = queue.pop()!;
      const ix = id0 % NX;
      const iz = (id0 / NX) | 0;
      for (const [jx, jz] of [[ix + 1, iz], [ix - 1, iz], [ix, iz + 1], [ix, iz - 1]]) {
         if (jx < 0 || jz < 0 || jx >= NX || jz >= NZ) continue;
         const n = jz * NX + jx;
         if (free[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
      }
   }
   return { seen, at };
}

function reachable(r: ReturnType<typeof reach>, test: (x: number, z: number) => boolean): boolean {
   for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      if (!r.seen[iz * NX + ix]) continue;
      if (test(-16 + (ix + 0.5) * CELL, -12 + (iz + 0.5) * CELL)) return true;
   }
   return false;
}

describe("shopping-cart stores: every level is playable", () => {
   for (const id of ARENA_IDS) it(`L${id}: every slot's reach disc, the start and the finish are reachable (with the lane shut too)`, () => {
      for (const shut of LEVELS[id].store.closeLaneAt > 0 ? [false, true] : [false]) {
         const r = reach(id, shut);
         for (const slot of SHELF_SLOTS) {
            expect(reachable(r, (x, z) => Math.hypot(x - slot.x, z - slot.z) <= CART.itemReach - 0.1), `L${id} slot ${slot.x},${slot.z} shut ${shut}`).toBe(true);
         }
         expect(reachable(r, (x, z) => pointInAabb({ x, y: 0, z }, FINISH_ZONE)), `L${id} finish shut ${shut}`).toBe(true);
      }
   });

   for (const id of ARENA_IDS) it(`L${id}: set pieces keep off the slots, the start, the pyramids, the finish, each other and the patrol routes`, () => {
      const boxes = LEVELS[id].store.pieces.map(pieceBox);
      const routes = Object.values(createShopperRoutes());
      for (const [i, b] of boxes.entries()) {
         for (const slot of SHELF_SLOTS) expect(boxDist(slot.x, slot.z, b), `slot ${slot.x},${slot.z}`).toBeGreaterThan(CART.itemReach);
         expect(boxDist(START_POS.x, START_POS.z, b)).toBeGreaterThan(2);
         for (const p of PYRAMID_POSITIONS) expect(boxDist(p.x, p.z, b)).toBeGreaterThan(1);
         expect(b.max.z).toBeLessThan(FINISH_ZONE.min.z);
         for (const solid of SOLID_OBSTACLES) expect(boxDist((solid.min.x + solid.max.x) / 2, (solid.min.z + solid.max.z) / 2, b)).toBeGreaterThan(0);
         for (const [j, c] of boxes.entries()) if (j !== i) expect(b.max.x <= c.min.x || c.max.x <= b.min.x || b.max.z <= c.min.z || c.max.z <= b.min.z).toBe(true);
         // shoppers and machines walk their routes without passing through a set piece
         for (const route of routes) for (let t = 0; t <= 1; t += 0.01) {
            const p = pointAt(route, t * route.total);
            expect(boxDist(p.x, p.z, b), `route at ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBeGreaterThan(0.4);
         }
         for (const m of LEVELS[id].store.movers) for (let k = 0; k + 1 < m.path.length; k++) for (let t = 0; t <= 1; t += 0.05) {
            const x = m.path[k][0] + (m.path[k + 1][0] - m.path[k][0]) * t;
            const z = m.path[k][1] + (m.path[k + 1][1] - m.path[k][1]) * t;
            expect(boxDist(x, z, b)).toBeGreaterThan(MOVER_RADIUS);
         }
      }
      for (const spill of LEVELS[id].store.spills) {
         expect(Math.hypot(spill.x - START_POS.x, spill.z - START_POS.z)).toBeGreaterThan(spill.radius + 1.5);
         for (const b of boxes) expect(boxDist(spill.x, spill.z, b)).toBeGreaterThan(0);
      }
   });

   it("each level 2-5 adds something new to the floor; level 1 has nothing", () => {
      expect(STORES[1]).toEqual({ theme: "mini", pieces: [], spills: [], movers: [], closeLaneAt: 0 });
      expect(STORES[2].pieces.some((p) => p.kind === "fruitStand")).toBe(true);
      expect(STORES[2].spills.every((s) => s.spawnS === 0)).toBe(true);
      expect(STORES[3].movers.map((m) => m.kind)).toEqual(["scrubber"]);
      expect(STORES[4].pieces.some((p) => p.kind === "bakery")).toBe(true);
      expect(STORES[4].movers.map((m) => m.kind)).toEqual(["pallet"]);
      expect(STORES[5].closeLaneAt).toBe(60);
      expect(STORES[5].movers).toHaveLength(2);
      expect(new Set(LEVEL_IDS.map((id) => STORES[id].theme)).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(LEVELS[id].store).toBe(STORES[id]);
         // a new solid only adds walls: every level keeps every level-1 solid
         expect(solidsFor(LEVELS[id]).slice(0, SOLID_OBSTACLES.length)).toEqual([...SOLID_OBSTACLES]);
      }
   });

   it("level 1 runs carry no store state (its serialized run is today's)", () => {
      const run = createRun(3, LEVELS[1]);
      expect("solids" in run || "movers" in run || "laneClosed" in run).toBe(false);
      expect(Object.keys(createRun(3))).toEqual(Object.keys(run));
   });
});

const IDLE = { moveX: 0, moveY: 0, ride: false };

describe("shopping-cart stores: the twists in the simulation", () => {
   it("a set piece stops the cart like a shelf", () => {
      const run = createRun(1, LEVELS[2]);
      const piece = pieceBox(LEVELS[2].store.pieces[0]);
      run.cart.x = (piece.min.x + piece.max.x) / 2;
      run.cart.z = piece.max.z + 1.4;
      for (let n = 0; n < 120; n++) stepRun(run, { moveX: 0, moveY: 1, ride: false }, 1 / 60, n / 60);
      expect(run.cart.z - CART.proxyHalfZ).toBeGreaterThanOrEqual(piece.max.z - 0.01);
   });

   it("the misters' wet floor is slick from the start on level 2 only", () => {
      const spill = LEVELS[2].store.spills[0];
      expect(inSpillAt(LEVELS[2], spill.x, spill.z, 0)).toBe(true);
      expect(inSpillAt(LEVELS[1], spill.x, spill.z, 0)).toBe(false);
   });

   it("a floor machine stuns the cart like a shopper, then gives a grace period", () => {
      for (const id of [3, 4, 5] as const) {
         const run: RunState = createRun(1, LEVELS[id]);
         const m = run.movers![0];
         run.cart.x = m.agent.x;
         run.cart.z = m.agent.z + 0.9;
         const ev = stepRun(run, IDLE, 1 / 60, 1);
         expect(ev.shopperBumped.length, `L${id}`).toBe(1);
         expect(run.cart.stunTimer).toBeGreaterThan(0.9);
         expect(m.graceTimer).toBeGreaterThan(1.4);
         expect(stepRun(run, IDLE, 1 / 60, 1 + 1 / 60).shopperBumped.length).toBe(0);
      }
   });

   it("closing time: the west lane shuts at 60 s, not before, and never on the cart", () => {
      const run = createRun(2, LEVELS[5]);
      run.cart.x = 12;
      run.cart.z = 8;
      stepRun(run, IDLE, 1 / 60, 59.9);
      expect(run.laneClosed).toBe(false);
      run.cart.x = -2.1;
      run.cart.z = 8.9;
      stepRun(run, IDLE, 1 / 60, 60.1);
      expect(run.laneClosed).toBe(false);
      run.cart.x = 12;
      run.cart.z = 8;
      stepRun(run, IDLE, 1 / 60, 60.2);
      expect(run.laneClosed).toBe(true);
      expect(run.solids).toContain(LANE_GATE);
      for (const id of [1, 2, 3, 4] as const) {
         const other = createRun(2, LEVELS[id]);
         stepRun(other, IDLE, 1 / 60, 100);
         expect(other.laneClosed ?? false).toBe(false);
      }
   });
});
