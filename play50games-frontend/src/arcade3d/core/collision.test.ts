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
   sweptAabbXZ,
   type AABB,
   type SweepHit,
} from "./collision";
import { createRng } from "./math";

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

describe("sweptAabbXZ", () => {
   const wall = box([2, 0, -1], [3, 5, 1]);
   const unit = (x: number, z: number) => box([x - 0.5, 0, z - 0.5], [x + 0.5, 1, z + 0.5]);
   /** x/z overlap (touching counts) after moving `a` by `delta * t` */
   const overlapAt = (a: AABB, d: { x: number; z: number }, b: AABB, t: number) =>
      a.min.x + d.x * t <= b.max.x && a.max.x + d.x * t >= b.min.x && a.min.z + d.z * t <= b.max.z && a.max.z + d.z * t >= b.min.z;

   it("returns the time of impact and the face it hit", () => {
      const hit: SweepHit = { time: -1, normalX: 9, normalZ: 9 };
      // the box's right face (x 0.5) reaches the wall (x 2) after 1.5 of 3 units
      expect(sweptAabbXZ(unit(0, 0), { x: 3, z: 0 }, wall, hit)).toBeCloseTo(0.5, 12);
      expect(hit).toEqual({ time: 0.5, normalX: -1, normalZ: 0 });
      // from the other side, along -x
      expect(sweptAabbXZ(unit(5, 0), { x: -4, z: 0 }, wall, hit)).toBeCloseTo(0.375, 12);
      expect(hit).toMatchObject({ normalX: 1, normalZ: 0 });
      // along z into the wall's far face
      expect(sweptAabbXZ(unit(2.5, 3), { x: 0, z: -2 }, wall, hit)).toBeCloseTo(0.75, 12);
      expect(hit).toMatchObject({ normalX: 0, normalZ: 1 });
   });

   it("misses: too short, moving away, passing beside, parallel and apart", () => {
      expect(sweptAabbXZ(unit(0, 0), { x: 1, z: 0 }, wall)).toBeNull();
      expect(sweptAabbXZ(unit(0, 0), { x: -5, z: 0 }, wall)).toBeNull();
      expect(sweptAabbXZ(unit(0, 3), { x: 6, z: 0 }, wall)).toBeNull();
      expect(sweptAabbXZ(unit(0, 0), { x: 0, z: 10 }, wall)).toBeNull();
      expect(sweptAabbXZ(unit(0, 0), { x: 0, z: 0 }, wall)).toBeNull();
      // diagonal past the corner
      expect(sweptAabbXZ(unit(0, 3), { x: 4, z: -0.5 }, wall)).toBeNull();
   });

   it("touching counts: at the end of the step, along a face, and at the start (time 0)", () => {
      expect(sweptAabbXZ(unit(0, 0), { x: 1.5, z: 0 }, wall)).toBeCloseTo(1, 12);
      // sliding along the wall's z face, edges touching the whole time
      expect(sweptAabbXZ(unit(2.5, 1.5), { x: 3, z: 0 }, wall)).toBe(0);
      const hit: SweepHit = { time: -1, normalX: 9, normalZ: 9 };
      expect(sweptAabbXZ(unit(2.5, 0), { x: 0, z: 0 }, wall, hit)).toBe(0);
      expect(hit).toEqual({ time: 0, normalX: 0, normalZ: 0 });
      // overlapping at the start but moving out still hits at 0
      expect(sweptAabbXZ(unit(2.2, 0), { x: -3, z: 0 }, wall)).toBe(0);
   });

   it("does not tunnel through a thin box, and ignores height", () => {
      const thin = box([0.99, 50, -3], [1.01, 51, 3]);
      expect(sweptAabbXZ(box([-0.1, 0, -0.1], [0.1, 1, 0.1]), { x: 40, z: 0 }, thin)).toBeCloseTo(0.89 / 40, 12);
   });

   it("two moving boxes: relative motion gives the time for both", () => {
      // a car (2 long) driving +x at 10 m/s, a pigeon hopping -z at 3 m/s, over a 0.5 s step
      const car = box([-6, 0, -0.5], [-4, 1, 0.5]);
      const pigeon = box([-0.3, 0, 0.7], [0.3, 1, 1.3]);
      const carMove = { x: 5, z: 0 };
      const pigeonMove = { x: 0, z: -1.5 };
      const t = sweptAabbXZ(pigeon, { x: pigeonMove.x - carMove.x, z: pigeonMove.z - carMove.z }, car);
      expect(t).not.toBeNull();
      // at that moment both boxes, each moved by its own share, touch
      const at = (b: AABB, d: { x: number; z: number }, k: number) =>
         box([b.min.x + d.x * k, b.min.y, b.min.z + d.z * k], [b.max.x + d.x * k, b.max.y, b.max.z + d.z * k]);
      expect(overlapAt(at(pigeon, pigeonMove, t! + 1e-9), { x: 0, z: 0 }, at(car, carMove, t! + 1e-9), 0)).toBe(true);
      expect(overlapAt(at(pigeon, pigeonMove, t! - 1e-6), { x: 0, z: 0 }, at(car, carMove, t! - 1e-6), 0)).toBe(false);
   });

   it("agrees with dense sampling for random boxes and moves (no allocation, `out` untouched on a miss)", () => {
      const rng = createRng(4242);
      const r = (lo: number, hi: number) => lo + (hi - lo) * rng();
      const hit: SweepHit = { time: 0, normalX: 0, normalZ: 0 };
      let hits = 0;
      for (let n = 0; n < 2000; n++) {
         const cx = r(-4, 4);
         const cz = r(-4, 4);
         const a = box([cx - r(0.05, 1), 0, cz - r(0.05, 1)], [cx + r(0.05, 1), 1, cz + r(0.05, 1)]);
         const b = box([r(-1, 0), 0, r(-1, 0)], [r(0, 1), 1, r(0, 1)]);
         const d = { x: rng() < 0.15 ? 0 : r(-8, 8), z: rng() < 0.15 ? 0 : r(-8, 8) };
         hit.time = -7;
         const t = sweptAabbXZ(a, d, b, hit);
         let first: number | null = null;
         for (let i = 0; i <= 4000; i++) {
            if (overlapAt(a, d, b, i / 4000)) {
               first = i / 4000;
               break;
            }
         }
         if (t === null) {
            expect(first).toBeNull();
            expect(hit.time).toBe(-7);
            continue;
         }
         hits += 1;
         expect(t).toBeGreaterThanOrEqual(0);
         expect(t).toBeLessThanOrEqual(1);
         expect(hit.time).toBe(t);
         expect(overlapAt(a, d, b, Math.min(1, t + 1e-9))).toBe(true);
         if (t > 0) expect(overlapAt(a, d, b, t - 1e-6)).toBe(false);
         // sampling can only find it later (it may miss a contact shorter than a sample)
         if (first !== null) expect(first).toBeGreaterThanOrEqual(t - 1e-9);
      }
      expect(hits).toBeGreaterThan(200);
   });
});
