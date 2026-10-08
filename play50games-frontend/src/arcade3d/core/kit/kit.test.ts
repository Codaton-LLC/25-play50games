// core/kit pure geometry and core/render TrajectoryDots helpers.
import { describe, expect, it } from "vitest";
import { createPath, advance, pointAt } from "../path";
import { inViewCone } from "../ai/vision";
import { beltData, fanPoints, fanSegments, fenceSpots } from "./kitGeometry";
import { dotOpacity, shownDots } from "../render/TrajectoryDots";

describe("beltData (Conveyor)", () => {
   const path = createPath([{ x: -2, y: 0.5, z: 0 }, { x: 2, y: 0.5, z: 0 }]);

   it("a strip `width` wide centred on the path, at its height + lift", () => {
      const d = beltData(path, 1, 0.5, 1, 0.02);
      expect(d.samples).toBe(9);
      // the two edges are 1 apart across the travel direction
      const z0 = d.positions[2];
      const z1 = d.positions[5];
      expect(Math.abs(z0 - z1)).toBeCloseTo(1);
      expect(d.positions[1]).toBeCloseTo(0.52);
      expect(d.positions[0]).toBeCloseTo(-2);
      expect(d.positions[(d.samples - 1) * 6]).toBeCloseTo(2);
      expect(d.index.length).toBe((d.samples - 1) * 6);
   });

   it("v = arc length / tile, so the texture scroll speed / tile matches riders advanced by speed", () => {
      const d = beltData(path, 1, 0.5, 0.5);
      expect(d.uvs[1]).toBe(0);
      expect(d.uvs[(d.samples - 1) * 4 + 1]).toBeCloseTo(4 / 0.5);
      // a rider advanced 1.5 m along the path sits where v = 1.5 / tile
      const rider = { path, s: 0, position: { x: 0, y: 0, z: 0 } };
      advance(rider, 1.5);
      const k = Math.round((rider.s / path.total) * (d.samples - 1));
      expect(d.positions[k * 6]).toBeCloseTo(rider.position.x);
      expect(d.uvs[k * 4 + 1]).toBeCloseTo(1.5 / 0.5);
   });

   it("faces up (counter-clockwise from above)", () => {
      const d = beltData(path, 1, 1, 1);
      const [a, b, c] = d.index;
      const ax = d.positions[a * 3], az = d.positions[a * 3 + 2];
      const bx = d.positions[b * 3], bz = d.positions[b * 3 + 2];
      const cx = d.positions[c * 3], cz = d.positions[c * 3 + 2];
      // y of (b - a) x (c - a) > 0 = the triangle's normal points up
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      expect(ny).toBeGreaterThan(0);
   });
});

describe("fenceSpots (Fence)", () => {
   it("posts every spacing m including both ends, rails between them", () => {
      const path = createPath([{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]);
      const { posts, rails } = fenceSpots(path, { spacing: 2, height: 1.2, rails: 2 });
      expect(posts.map((p) => p.x)).toEqual([0, 2, 4, 6, 8, 10]);
      expect(posts[0].y).toBeCloseTo(0.6);
      expect(posts[0].sy).toBe(1.2);
      expect(rails).toHaveLength(5 * 2);
      expect(rails[0].sz).toBeCloseTo(2);
      expect(rails[0].rotY).toBeCloseTo(Math.PI / 2); // z of the box along +x
      expect(rails[0].x).toBeCloseTo(1);
   });

   it("a closed path closes the ring without a doubled post", () => {
      const path = createPath([{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 4, y: 0, z: 4 }, { x: 0, y: 0, z: 4 }], { closed: true });
      const { posts, rails } = fenceSpots(path, { spacing: 2, rails: 1 });
      expect(posts).toHaveLength(8);
      expect(rails).toHaveLength(8);
   });
});

describe("fanPoints (Flashlight): the drawn fan is inViewCone", () => {
   const half = 0.5;
   const range = 6;
   it("the arc runs from -halfAngle to +halfAngle at `range`, facing +z at yaw 0", () => {
      const n = fanSegments(half);
      const pts = fanPoints(half, range, 1.3, n);
      expect(pts[1]).toBeCloseTo(1.3); // the apex at the lamp
      const origin = { x: 0, y: 0, z: 0 };
      for (let i = 1; i <= n + 1; i++) {
         const p = { x: pts[i * 3], y: 0, z: pts[i * 3 + 2] };
         expect(Math.hypot(p.x, p.z)).toBeCloseTo(range);
         // every arc point is on the cone's boundary: seen, and just beyond it is not
         expect(inViewCone(origin, 0, half + 1e-6, range + 1e-6, p)).toBe(true);
         expect(inViewCone(origin, 0, half, range, { x: p.x * 1.01, y: 0, z: p.z * 1.01 })).toBe(false);
      }
      // the first arc point is at -halfAngle: towards -x
      expect(pts[3]).toBeCloseTo(-Math.sin(half) * range);
      expect(inViewCone(origin, 0, half, range, { x: Math.sin(half + 0.02) * 3, y: 0, z: Math.cos(half + 0.02) * 3 })).toBe(false);
   });

   it("a group turned to yaw (rotation.y) lights what inViewCone with that yaw sees", () => {
      const yaw = 1.1;
      const n = fanSegments(half);
      const pts = fanPoints(half, range, 1, n);
      const origin = { x: 0, y: 0, z: 0 };
      for (let i = 1; i <= n + 1; i++) {
         const x = pts[i * 3] * 0.5;
         const z = pts[i * 3 + 2] * 0.5;
         // rotation.y = yaw: (x, z) -> (x cos + z sin, -x sin + z cos)
         const p = { x: x * Math.cos(yaw) + z * Math.sin(yaw), y: 0, z: -x * Math.sin(yaw) + z * Math.cos(yaw) };
         expect(inViewCone(origin, yaw, half + 1e-6, range, p)).toBe(true);
      }
   });

   it("enough segments for a smooth arc", () => {
      expect(fanSegments(0.05)).toBe(4);
      expect(fanSegments(Math.PI / 2)).toBe(30);
      expect(fanSegments(Math.PI)).toBe(48);
   });
});

describe("TrajectoryDots helpers", () => {
   it("fades from the first to the last dot", () => {
      expect(dotOpacity(0, 10, 0.9, 0.1)).toBeCloseTo(0.9);
      expect(dotOpacity(9, 10, 0.9, 0.1)).toBeCloseTo(0.1);
      expect(dotOpacity(0, 1, 0.9, 0.1)).toBe(0.9);
   });

   it("shows a fraction of the arc, at least one dot", () => {
      expect(shownDots(20, 1)).toBe(20);
      expect(shownDots(20, 0.5)).toBe(10);
      expect(shownDots(20, 0.01)).toBe(1);
      expect(shownDots(20, 0)).toBe(0);
      expect(shownDots(0, 1)).toBe(0);
      expect(shownDots(5, 3)).toBe(5);
   });
});

it("pointAt is the path helper the kit samples (sanity)", () => {
   expect(pointAt(createPath([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }]), 1).x).toBe(1);
});
