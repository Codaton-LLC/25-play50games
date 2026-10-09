import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3, Box3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { ASSETS, BELL, FEET_3D, HULL, HULL_SKIN, MESH_HULL, ROCKET_SCALE, SUPPORT } from "./assets";

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
