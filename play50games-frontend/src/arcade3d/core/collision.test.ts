import { describe, expect, it } from "vitest";
import {
   aabbFromCenter,
   aabbOverlap,
   circlesOverlapXZ,
   clampToBounds,
   closestPointInAabb,
   distanceSq,
   distanceToBoxXZ,
   isOutOfBounds,
   pointInAabb,
   resolveSphereAabb,
   sphereAabbOverlap,
   spheresOverlap,
   type AABB,
} from "./collision";

const v = (x: number, y: number, z: number) => ({ x, y, z });
const box = (min: [number, number, number], max: [number, number, number]): AABB => ({ min: v(...min), max: v(...max) });

describe("AABB", () => {
   it("builds a box from centre and half size", () => {
      expect(aabbFromCenter(v(1, 2, 3), v(0.5, 1, 2))).toEqual(box([0.5, 1, 1], [1.5, 3, 5]));
   });

   it("writes into `out` without allocating a new box", () => {
      const out = box([0, 0, 0], [0, 0, 0]);
      const result = aabbFromCenter(v(0, 0, 0), v(1, 1, 1), out);
      expect(result).toBe(out);
      expect(out).toEqual(box([-1, -1, -1], [1, 1, 1]));
   });

   it("detects overlap, touching and separation on every axis", () => {
      const a = box([0, 0, 0], [1, 1, 1]);
      expect(aabbOverlap(a, box([0.5, 0.5, 0.5], [2, 2, 2]))).toBe(true);
      expect(aabbOverlap(a, box([1, 0, 0], [2, 1, 1]))).toBe(true);
      expect(aabbOverlap(a, box([1.01, 0, 0], [2, 1, 1]))).toBe(false);
      expect(aabbOverlap(a, box([0, 1.01, 0], [1, 2, 1]))).toBe(false);
      expect(aabbOverlap(a, box([0, 0, -2], [1, 1, -0.01]))).toBe(false);
      expect(aabbOverlap(a, box([-1, -1, -1], [3, 3, 3]))).toBe(true);
   });

   it("checks points", () => {
      const a = box([0, 0, 0], [1, 1, 1]);
      expect(pointInAabb(v(0.5, 0.5, 0.5), a)).toBe(true);
      expect(pointInAabb(v(1, 1, 1), a)).toBe(true);
      expect(pointInAabb(v(1.1, 0.5, 0.5), a)).toBe(false);
      expect(closestPointInAabb(v(2, -1, 0.5), a)).toEqual(v(1, 0, 0.5));
   });
});

describe("spheres", () => {
   it("measures squared distance", () => {
      expect(distanceSq(v(0, 0, 0), v(1, 2, 2))).toBe(9);
   });

   it("detects sphere/sphere overlap including touching", () => {
      expect(spheresOverlap(v(0, 0, 0), 1, v(1.5, 0, 0), 0.6)).toBe(true);
      expect(spheresOverlap(v(0, 0, 0), 1, v(2, 0, 0), 1)).toBe(true);
      expect(spheresOverlap(v(0, 0, 0), 1, v(2.01, 0, 0), 1)).toBe(false);
   });

   it("ignores height for circles on the ground", () => {
      expect(circlesOverlapXZ(v(0, 0, 0), 0.5, v(0.6, 10, 0), 0.5)).toBe(true);
      expect(spheresOverlap(v(0, 0, 0), 0.5, v(0.6, 10, 0), 0.5)).toBe(false);
      expect(circlesOverlapXZ(v(0, 0, 0), 0.5, v(0, 0, 1.2), 0.5)).toBe(false);
   });

   it("detects sphere/box overlap", () => {
      const a = box([0, 0, 0], [2, 2, 2]);
      expect(sphereAabbOverlap(v(1, 1, 1), 0.1, a)).toBe(true);
      expect(sphereAabbOverlap(v(2.5, 1, 1), 0.5, a)).toBe(true);
      expect(sphereAabbOverlap(v(2.6, 1, 1), 0.5, a)).toBe(false);
      // corner: distance to (2,2,2) is sqrt(3)*0.5 ~ 0.866
      expect(sphereAabbOverlap(v(2.5, 2.5, 2.5), 0.85, a)).toBe(false);
      expect(sphereAabbOverlap(v(2.5, 2.5, 2.5), 0.9, a)).toBe(true);
   });
});

describe("resolveSphereAabb", () => {
   const wall = box([0, 0, 0], [1, 2, 1]);

   it("leaves a sphere that does not touch the box alone", () => {
      expect(resolveSphereAabb(v(3, 1, 0.5), 0.5, wall)).toEqual(v(3, 1, 0.5));
   });

   it("pushes an overlapping sphere out along the contact normal", () => {
      const out = resolveSphereAabb(v(1.3, 1, 0.5), 0.5, wall);
      expect(out.x).toBeCloseTo(1.5);
      expect(out.y).toBe(1);
      expect(out.z).toBe(0.5);
      expect(sphereAabbOverlap(out, 0.49, wall)).toBe(false);
   });

   it("moves a centre inside the box out through the nearest face", () => {
      const out = resolveSphereAabb(v(0.9, 1, 0.5), 0.25, wall);
      expect(out).toEqual(v(1.25, 1, 0.5));
   });

   it("corrects in place when out is the centre", () => {
      const p = v(-0.2, 1, 0.5);
      const result = resolveSphereAabb(p, 0.5, wall, p);
      expect(result).toBe(p);
      expect(p.x).toBeCloseTo(-0.5);
   });
});

describe("bounds", () => {
   const arena = box([-5, 0, -5], [5, 10, 5]);

   it("clamps a point (with a margin) into the bounds", () => {
      expect(clampToBounds(v(7, -1, 0), arena)).toEqual(v(5, 0, 0));
      expect(clampToBounds(v(7, 5, -9), arena, 0.5)).toEqual(v(4.5, 5, -4.5));
      expect(clampToBounds(v(1, 2, 3), arena)).toEqual(v(1, 2, 3));
   });

   it("does not mutate the input unless out is the input", () => {
      const p = v(9, 1, 0);
      clampToBounds(p, arena);
      expect(p.x).toBe(9);
      clampToBounds(p, arena, 0, p);
      expect(p.x).toBe(5);
   });

   it("pins to the middle when the margin is wider than the bounds", () => {
      expect(clampToBounds(v(3, 3, 3), box([0, 0, 0], [1, 1, 1]), 2)).toEqual(v(0.5, 0.5, 0.5));
   });

   it("reports out-of-bounds points", () => {
      expect(isOutOfBounds(v(0, 1, 0), arena)).toBe(false);
      expect(isOutOfBounds(v(4.8, 1, 0), arena, 0.5)).toBe(true);
      expect(isOutOfBounds(v(0, -0.1, 0), arena)).toBe(true);
   });
});

describe("distanceToBoxXZ", () => {
   const crate = box([-1, 0, -1], [1, 2, 1]);

   it("is 0 inside and on the box, and ignores height", () => {
      expect(distanceToBoxXZ(0, 0, crate)).toBe(0);
      expect(distanceToBoxXZ(1, -1, crate)).toBe(0);
   });

   it("measures to the nearest face or corner on the ground", () => {
      expect(distanceToBoxXZ(3, 0.5, crate)).toBe(2);
      expect(distanceToBoxXZ(0, -4, crate)).toBe(3);
      expect(distanceToBoxXZ(4, 5, crate)).toBe(5);
   });
});
