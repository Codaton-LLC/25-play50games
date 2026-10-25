import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3, Box3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { hasModel } from "@/arcade3d/core/modelManifest";
import {
   ASSETS,
   BEACON_LIGHTS,
   BELL,
   FEET_3D,
   flattenLandingPadCone,
   HULL,
   HULL_SKIN,
   LANDING_PAD_GLB,
   MESH_HULL,
   PAD_DECK_FOOTPRINT,
   ROCKET_SCALE,
   SUPPORT,
} from "./assets";

describe("measured rocket fit", () => {
   it("pins measured data, fit, bell and support extremes", () => {
      expect(hasModel(ASSETS.rocket.url)).toBe(true);
      expect(ROCKET_SCALE).toBeCloseTo(1.1606436, 6);
      expect(SUPPORT).toEqual([[-0.64138, 0.0005], [0.66023, 0.00989]]);
      expect(HULL_SKIN).toBe(0.012);
      expect(MESH_HULL).toHaveLength(32);
      expect(Math.max(...HULL.map((p) => Math.hypot(p[0], p[1] - 1.1)))).toBeLessThanOrEqual(1.35);
      expect(BELL.y).toBeCloseTo(0.150884, 5);
      expect(FEET_3D).toHaveLength(4);
      expect(Math.max(...FEET_3D.map((p) => Math.abs(p.y)))).toBe(0);
      const span = SUPPORT[1][0] - SUPPORT[0][0];
      expect(span).toBeCloseTo(1.3016, 4);
      expect(span * Math.sin(Math.PI / 18) + (SUPPORT[1][1] - SUPPORT[0][1]) * Math.cos(Math.PI / 18)).toBeCloseTo(0.23528, 4);
   });
   it("covers every real mesh vertex, fits 2.2 metres, and validates support and radius", async () => {
      const { local, node } = await readCharacterGlb(ASSETS.rocket.url);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
      const mesh = new Mesh(geometry); mesh.position.fromArray(node);
      const root = new Group(); root.add(mesh);
      const parts = modelParts(root, ASSETS.rocket);
      const box = new Box3(), point = new Vector3();
      let radius = 0, supportMin = Infinity, supportMax = -Infinity, count = 0;
      let worstCross = Infinity, worstVertex = -1, worstEdge = -1;
      try {
         for (let i = 0; i < local.length; i += 3) {
            point.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix);
            box.expandByPoint(point); count++;
            radius = Math.max(radius, Math.hypot(point.x, point.y - 1.1));
            if (point.y < 0.02) { supportMin = Math.min(supportMin, point.x); supportMax = Math.max(supportMax, point.x); }
            for (let j = 0; j < HULL.length; j++) {
               const a = HULL[j], b = HULL[(j + 1) % HULL.length];
               const cross = (b[0] - a[0]) * (point.y - a[1]) - (b[1] - a[1]) * (point.x - a[0]);
               if (cross < worstCross) { worstCross = cross; worstVertex = i / 3; worstEdge = j; }
            }
         }
         expect(count).toBe(4877);
         expect(worstCross, `vertex ${worstVertex}, edge ${worstEdge}`).toBeGreaterThanOrEqual(-1e-6);
         expect(box.max.y - box.min.y).toBeCloseTo(2.20005, 3);
         expect(Math.abs(box.max.x - 0.75547)).toBeLessThan(0.001);
         expect(Math.abs(box.min.x + 0.75547)).toBeLessThan(0.001);
         expect(Math.abs(supportMin + 0.6414)).toBeLessThan(0.01);
         expect(Math.abs(supportMax - 0.6602)).toBeLessThan(0.01);
         expect(radius).toBeLessThanOrEqual(1.35);
      } finally { geometry.dispose(); }
   });
});

describe("measured landing pad fit", () => {
   it("pins measured data and the asset fit", () => {
      expect(hasModel(ASSETS.landingPad.url)).toBe(true);
      expect(LANDING_PAD_GLB.width).toBeCloseTo(1.8948084, 6);
      expect(LANDING_PAD_GLB.deckTop).toBeCloseTo(0.2786218, 6);
      expect(LANDING_PAD_GLB.height).toBeCloseTo(0.8244281, 6);
      expect(LANDING_PAD_GLB.depth).toBeCloseTo(1.9048288, 6);
      expect(ASSETS.landingPad.scale).toBeCloseTo(1.4356379, 6);
      expect(ASSETS.landingPad.stretch?.[0]).toBeCloseTo(0.3676121, 6);
      expect(ASSETS.landingPad.stretch?.[1]).toBe(1);
      expect(ASSETS.landingPad.stretch?.[2]).toBeCloseTo(0.7313565, 6);
      expect(ASSETS.landingPad.yOffset).toBe(-0.2);
   });
   it("draws the pad slab 1 x 0.4 x 2 with the deck top at +0.2 on the real mesh", async () => {
      // decode the real meshopt-decoded mesh and draw it through core modelParts (what <Model> draws)
      const { local, node } = await readCharacterGlb(ASSETS.landingPad.url);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
      flattenLandingPadCone(geometry, node[1]);
      const mesh = new Mesh(geometry);
      mesh.position.fromArray(node);
      const root = new Group();
      root.add(mesh);
      const parts = modelParts(root, ASSETS.landingPad);
      const box = new Box3(), point = new Vector3();
      const pos = geometry.getAttribute("position");
      let deck = -Infinity, count = 0;
      try {
         for (let i = 0; i < pos.count; i++) {
            const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
            const cx = px + node[0], cz = pz + node[2];
            point.set(px, py, pz).applyMatrix4(parts[0].matrix);
            box.expandByPoint(point);
            count++;
            if (Math.hypot(cx, cz) > 0.3) deck = Math.max(deck, point.y);
         }
         expect(count).toBe(4065);
         // slab footprint: exactly the old stand-in's 1 x 2 (the runtime group scale.x = planet width still applies)
         expect(box.max.x - box.min.x).toBeCloseTo(1, 5);
         expect(box.max.z - box.min.z).toBeCloseTo(2, 5);
         // slab base at -0.2 and deck top at +0.2 above the group origin (the physics surface)
         expect(box.min.y).toBeCloseTo(-0.2, 5);
         expect(deck).toBeCloseTo(0.2, 5);
         // the beacon cone is flattened down to deckTop so it does not poke above +0.2
         expect(box.max.y).toBeCloseTo(0.2, 5);
      } finally { geometry.dispose(); }
   });
   it("beacon geometry on the rim does not intersect the pad's top surface footprint", () => {
      // The beacon lights sit strictly on the rim of the pad, outside the touchdown footprint
      // where the rocket lands, keeping the landing surface clear.
      expect(BEACON_LIGHTS.length).toBeGreaterThan(0);
      for (const beacon of BEACON_LIGHTS) {
         const insideFootprint =
            beacon.x > PAD_DECK_FOOTPRINT.minX &&
            beacon.x < PAD_DECK_FOOTPRINT.maxX &&
            beacon.z > PAD_DECK_FOOTPRINT.minZ &&
            beacon.z < PAD_DECK_FOOTPRINT.maxZ;
         expect(insideFootprint).toBe(false);

         // Each beacon sits along the outer rim edges
         const onRim = Math.abs(beacon.x) >= 0.45 || Math.abs(beacon.z) >= 0.9;
         expect(onRim).toBe(true);

         // And sits at or above the landing deck surface
         expect(beacon.y).toBeGreaterThanOrEqual(PAD_DECK_FOOTPRINT.y);
      }
   });
});
