// Tests for Menu 2 "Color Roll Heroes" geometric code props:
// Verifies size constants, geometry factories, finite bounding boxes (within ±10%),
// triangle count budget (<2k), and draw call groups (<=3).
import { describe, expect, it } from "vitest";
import { Vector3, type BufferGeometry } from "three";
import {
   DOMINO_SIZE,
   buildDominoGeometry,
   getSharedDominoGeometry,
   Domino,
   FLIPPER_SIZE,
   buildFlipperGeometry,
   getSharedFlipperGeometry,
   Flipper,
   SWEEPER_BAR_SIZE,
   buildSweeperBarGeometry,
   getSharedSweeperBarGeometry,
   SweeperBar,
   RAIL_JUNCTION_SIZE,
   buildRailJunctionGeometry,
   getSharedRailJunctionGeometry,
   RailJunction,
   SPIKE_BLOCK_SIZE,
   buildSpikeBlockGeometry,
   getSharedSpikeBlockGeometry,
   SpikeBlock,
} from "./index";

interface PropSpec {
   name: string;
   factory: () => BufferGeometry;
   sharedGetter: () => BufferGeometry;
   component: unknown;
   expectedSize: { w: number; h: number; d: number };
   maxDrawCalls: number;
}

const PROP_SPECS: readonly PropSpec[] = [
   {
      name: "Domino",
      factory: buildDominoGeometry,
      sharedGetter: getSharedDominoGeometry,
      component: Domino,
      expectedSize: DOMINO_SIZE,
      maxDrawCalls: 3,
   },
   {
      name: "Flipper",
      factory: buildFlipperGeometry,
      sharedGetter: getSharedFlipperGeometry,
      component: Flipper,
      expectedSize: FLIPPER_SIZE,
      maxDrawCalls: 3,
   },
   {
      name: "SweeperBar",
      factory: buildSweeperBarGeometry,
      sharedGetter: getSharedSweeperBarGeometry,
      component: SweeperBar,
      expectedSize: SWEEPER_BAR_SIZE,
      maxDrawCalls: 3,
   },
   {
      name: "RailJunction",
      factory: buildRailJunctionGeometry,
      sharedGetter: getSharedRailJunctionGeometry,
      component: RailJunction,
      expectedSize: RAIL_JUNCTION_SIZE,
      maxDrawCalls: 3,
   },
   {
      name: "SpikeBlock",
      factory: buildSpikeBlockGeometry,
      sharedGetter: getSharedSpikeBlockGeometry,
      component: SpikeBlock,
      expectedSize: SPIKE_BLOCK_SIZE,
      maxDrawCalls: 3,
   },
];

describe("Menu 2 props: size constants", () => {
   it("Domino size matches 0.5 x 1.0 x 0.15 m specification", () => {
      expect(DOMINO_SIZE.w).toBe(0.5);
      expect(DOMINO_SIZE.h).toBe(1.0);
      expect(DOMINO_SIZE.d).toBe(0.15);
   });

   it("Flipper size matches 1.6 m length specification", () => {
      expect(FLIPPER_SIZE.w).toBe(1.6);
      expect(FLIPPER_SIZE.length).toBe(1.6);
      expect(FLIPPER_SIZE.h).toBeGreaterThan(0.2);
      expect(FLIPPER_SIZE.d).toBeGreaterThan(0.3);
   });

   it("SweeperBar size matches 3.0 m length and 0.6 m hub specification", () => {
      expect(SWEEPER_BAR_SIZE.w).toBe(3.0);
      expect(SWEEPER_BAR_SIZE.length).toBe(3.0);
      expect(SWEEPER_BAR_SIZE.hubDiameter).toBe(0.6);
      expect(SWEEPER_BAR_SIZE.d).toBe(0.6);
   });

   it("RailJunction size matches 4.0 m length and 0.12 m rail diameter specification", () => {
      expect(RAIL_JUNCTION_SIZE.w).toBe(4.0);
      expect(RAIL_JUNCTION_SIZE.length).toBe(4.0);
      expect(RAIL_JUNCTION_SIZE.railDiameter).toBe(0.12);
   });

   it("SpikeBlock size matches 1.0 m cube with 0.15 m spikes specification", () => {
      expect(SPIKE_BLOCK_SIZE.w).toBe(1.0);
      expect(SPIKE_BLOCK_SIZE.d).toBe(1.0);
      expect(SPIKE_BLOCK_SIZE.cubeSize).toBe(1.0);
      expect(SPIKE_BLOCK_SIZE.h).toBe(1.15);
      expect(SPIKE_BLOCK_SIZE.spikeHeight).toBe(0.15);
   });
});

describe("Menu 2 props: pure geometry builders without canvas", () => {
   for (const spec of PROP_SPECS) {
      describe(spec.name, () => {
         it("exports a valid React component", () => {
            expect(spec.component).toBeDefined();
            expect(typeof spec.component === "function" || typeof spec.component === "object").toBe(true);
         });

         it("produces finite, non-empty geometry with expected bounding box (±10%)", () => {
            const geom = spec.factory();
            expect(geom).toBeDefined();

            const pos = geom.getAttribute("position");
            expect(pos).toBeDefined();
            expect(pos.count).toBeGreaterThan(0);

            // Verify all position values are finite numbers
            for (let i = 0; i < pos.count; i++) {
               expect(Number.isFinite(pos.getX(i))).toBe(true);
               expect(Number.isFinite(pos.getY(i))).toBe(true);
               expect(Number.isFinite(pos.getZ(i))).toBe(true);
            }

            // Verify normals are generated and finite
            const norm = geom.getAttribute("normal");
            expect(norm).toBeDefined();
            for (let i = 0; i < norm.count; i++) {
               expect(Number.isFinite(norm.getX(i))).toBe(true);
               expect(Number.isFinite(norm.getY(i))).toBe(true);
               expect(Number.isFinite(norm.getZ(i))).toBe(true);
            }

            geom.computeBoundingBox();
            const box = geom.boundingBox;
            expect(box).toBeDefined();
            if (!box) throw new Error("Bounding box not computed");

            const size = new Vector3();
            box.getSize(size);

            expect(Number.isFinite(size.x)).toBe(true);
            expect(Number.isFinite(size.y)).toBe(true);
            expect(Number.isFinite(size.z)).toBe(true);

            // Width (X axis) within ±10%
            const relDiffX = Math.abs(size.x - spec.expectedSize.w) / spec.expectedSize.w;
            expect(relDiffX).toBeLessThanOrEqual(0.10);

            // Height (Y axis) within ±10%
            const relDiffY = Math.abs(size.y - spec.expectedSize.h) / spec.expectedSize.h;
            expect(relDiffY).toBeLessThanOrEqual(0.10);

            // Depth (Z axis) within ±10%
            const relDiffZ = Math.abs(size.z - spec.expectedSize.d) / spec.expectedSize.d;
            expect(relDiffZ).toBeLessThanOrEqual(0.10);

            geom.dispose();
         });

         it("stays within triangle budget (< 2k triangles)", () => {
            const geom = spec.factory();
            const pos = geom.getAttribute("position");
            const triangleCount = geom.index ? geom.index.count / 3 : pos.count / 3;

            expect(triangleCount).toBeGreaterThan(0);
            expect(triangleCount).toBeLessThan(2000);
            geom.dispose();
         });

         it(`stays within draw call budget (at most ${spec.maxDrawCalls} draw calls)`, () => {
            const geom = spec.factory();
            const groupsCount = geom.groups.length;
            // Either a single material (0 or 1 group) or multi-material groups <= maxDrawCalls
            expect(groupsCount).toBeLessThanOrEqual(spec.maxDrawCalls);
            geom.dispose();
         });

         it("shares cached geometry across invocations", () => {
            const shared1 = spec.sharedGetter();
            const shared2 = spec.sharedGetter();
            expect(shared1).toBe(shared2);
         });
      });
   }
});
