// occludedFanPoints (C1) and the <Flashlight blockers> clip: the drawn floor fan is exactly
// inViewCone and hasLineOfSightXZ, the box that contains the origin excluded.
import { describe, expect, it } from "vitest";
import { BufferAttribute, Group } from "three";
import { hasLineOfSightXZ, inViewCone, type Box } from "../ai/vision";
import { createRng } from "../math";
import { fanSegments, occludedFanPoints } from "./kitGeometry";
import { clipFan, fanGeometries, unclipFan } from "./Flashlight";

type P = { x: number; y: number; z: number };

const box = (x0: number, z0: number, x1: number, z1: number): Box => ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 2, z: z1 } });
const contains = (b: Box, p: P) => p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z;
const others = (blockers: Box[], o: P) => blockers.filter((b) => !contains(b, o));

function truth(o: P, yaw: number, half: number, range: number, blockers: Box[], p: P): boolean {
   return inViewCone(o, yaw, half, range, p) && hasLineOfSightXZ(o, p, others(blockers, o));
}

/** Independent oracle: how far hasLineOfSightXZ sees along a world direction, by bisection. */
function sightLength(o: P, angle: number, range: number, blockers: Box[]): number {
   const live = others(blockers, o);
   const at = (t: number) => ({ x: o.x + Math.sin(angle) * t, y: 0, z: o.z + Math.cos(angle) * t });
   if (hasLineOfSightXZ(o, at(range), live)) return range;
   let lo = 0;
   let hi = range;
   for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (hasLineOfSightXZ(o, at(mid), live)) lo = mid;
      else hi = mid;
   }
   return lo;
}

/** The fan's own frame -> world (a group at `o` with rotation.y = yaw). */
function toWorld(o: P, yaw: number, x: number, z: number): P {
   return { x: o.x + x * Math.cos(yaw) + z * Math.sin(yaw), y: 0, z: o.z - x * Math.sin(yaw) + z * Math.cos(yaw) };
}

/** Inside the triangle fan (apex, i, i + 1) drawn from `out`, edges included. */
function inFan(out: Float32Array, n: number, o: P, yaw: number, p: P): boolean {
   const dx = p.x - o.x;
   const dz = p.z - o.z;
   const x = dx * Math.cos(yaw) - dz * Math.sin(yaw);
   const z = dx * Math.sin(yaw) + dz * Math.cos(yaw);
   const eps = 1e-9;
   for (let i = 1; i <= n; i++) {
      const ax = out[i * 3], az = out[i * 3 + 2], bx = out[(i + 1) * 3], bz = out[(i + 1) * 3 + 2];
      const e1 = ax * z - az * x; // apex -> a
      const e2 = (bx - ax) * (z - az) - (bz - az) * (x - ax); // a -> b
      const e3 = -bx * (z - bz) + bz * (x - bx); // b -> apex
      const area = ax * bz - az * bx;
      if (Math.abs(area) < 1e-12) continue;
      const s = Math.sign(area);
      if (s * e1 >= -eps && s * e2 >= -eps && s * e3 >= -eps) return true;
   }
   return false;
}

function rayLength(out: Float32Array, i: number): number {
   return Math.hypot(out[(i + 1) * 3], out[(i + 1) * 3 + 2]);
}

describe("occludedFanPoints: the drawn floor fan is inViewCone and hasLineOfSightXZ", () => {
   it("20,000 random points in random scenes agree, except within one ray step of a shadow edge", () => {
      const rng = createRng(20261024);
      const n = 64;
      const out = new Float32Array((n + 2) * 3);
      let checked = 0;
      let tolerated = 0;
      let lit = 0;
      let shadowed = 0;
      let ownBox = 0;
      const wrong: string[] = [];
      for (let scene = 0; scene < 400; scene++) {
         const o = { x: rng() * 10 - 5, y: 0, z: rng() * 10 - 5 };
         const yaw = rng() * 2 * Math.PI - Math.PI;
         const half = 0.1 + rng() * (Math.PI / 2 - 0.1);
         const range = 2 + rng() * 8;
         const blockers: Box[] = [];
         if (rng() < 0.3) {
            // the guard stands in a bush
            blockers.push(box(o.x - 0.2 - rng(), o.z - 0.2 - rng(), o.x + 0.2 + rng(), o.z + 0.2 + rng()));
            ownBox++;
         }
         const count = Math.floor(rng() * 7);
         for (let b = 0; b < count; b++) {
            const cx = o.x + rng() * 16 - 8;
            const cz = o.z + rng() * 16 - 8;
            const hx = 0.2 + rng() * 1.8;
            const hz = 0.2 + rng() * 1.8;
            blockers.push(box(cx - hx, cz - hz, cx + hx, cz + hz));
         }
         occludedFanPoints(o, yaw, half, range, blockers, n, out);
         const step = (2 * half) / n;
         // every ray is the oracle's sight length
         for (let i = 0; i <= n; i++) {
            const expected = sightLength(o, yaw - half + step * i, range, blockers);
            expect(Math.abs(rayLength(out, i) - expected)).toBeLessThan(1e-5);
         }
         const sag = range * (1 - Math.cos(step / 2)) + 1e-6;
         for (let k = 0; k < 50; k++) {
            const angle = yaw + (rng() * 2 - 1) * half * 1.3;
            const d = Math.sqrt(rng()) * range * 1.15;
            const p = { x: o.x + Math.sin(angle) * d, y: 0, z: o.z + Math.cos(angle) * d };
            const want = truth(o, yaw, half, range, blockers, p);
            const got = inFan(out, n, o, yaw, p);
            checked++;
            if (want) lit++;
            else if (inViewCone(o, yaw, half, range, p)) shadowed++;
            if (want === got) continue;
            const turned = (da: number) => ({ x: o.x + Math.sin(angle + da) * d, y: 0, z: o.z + Math.cos(angle + da) * d });
            const nearEdge =
               truth(o, yaw, half, range, blockers, turned(step)) !== want || truth(o, yaw, half, range, blockers, turned(-step)) !== want;
            const nearArc = d >= range - sag && d <= range + 1e-6;
            const nearFace = blockers.some((b) => contains(box(b.min.x - 1e-4, b.min.z - 1e-4, b.max.x + 1e-4, b.max.z + 1e-4), p) && !contains(box(b.min.x + 1e-4, b.min.z + 1e-4, b.max.x - 1e-4, b.max.z - 1e-4), p));
            if (nearEdge || nearArc || nearFace) tolerated++;
            else wrong.push(`scene ${scene} p (${p.x}, ${p.z}) want ${want}`);
         }
      }
      expect(wrong).toEqual([]);
      expect(checked).toBe(20000);
      // a meaningful sample: lots lit, lots shadowed, few tolerated, many guards in their own box
      expect(lit).toBeGreaterThan(4000);
      expect(shadowed).toBeGreaterThan(1500);
      expect(tolerated).toBeLessThan(checked * 0.02);
      expect(ownBox).toBeGreaterThan(80);
   });

   it("skips the box that contains the origin (edges included), but not the next one", () => {
      const o = { x: 0, y: 0, z: 0 };
      const n = 8;
      const out = new Float32Array((n + 2) * 3);
      occludedFanPoints(o, 0, 0.4, 6, [box(-1, -1, 1, 1)], n, out);
      for (let i = 0; i <= n; i++) expect(rayLength(out, i)).toBeCloseTo(6, 5);
      // standing on the box's face still counts as inside it
      occludedFanPoints(o, 0, 0.4, 6, [box(-1, 0, 1, 2)], n, out);
      for (let i = 0; i <= n; i++) expect(rayLength(out, i)).toBeCloseTo(6, 5);
      // a second box ahead clips; the own box does not
      occludedFanPoints(o, 0, 0.4, 6, [box(-1, -1, 1, 1), box(-5, 3, 5, 4)], n, out);
      for (let i = 0; i <= n; i++) {
         const a = -0.4 + (0.8 * i) / n;
         expect(rayLength(out, i)).toBeCloseTo(3 / Math.cos(a), 5);
         expect(out[(i + 1) * 3 + 2]).toBeCloseTo(3, 5);
      }
      // and the logic agrees: through the own box, blocked by the far one
      expect(hasLineOfSightXZ(o, { x: 0, y: 0, z: 2.9 }, others([box(-1, -1, 1, 1)], o))).toBe(true);
   });

   it("a box fully behind the origin changes nothing", () => {
      const out = new Float32Array((10 + 2) * 3);
      occludedFanPoints({ x: 2, y: 0, z: 2 }, 0, Math.PI / 2, 5, [box(-10, -3, 10, 1.5)], 10, out);
      for (let i = 0; i <= 10; i++) expect(rayLength(out, i)).toBeCloseTo(5, 5);
   });

   it("a box straddling the cone's edge clips only the rays that hit it", () => {
      const o = { x: 0, y: 0, z: 0 };
      const n = 16;
      const half = 0.5;
      const out = new Float32Array((n + 2) * 3);
      const blockers = [box(1, 2, 4, 4)];
      occludedFanPoints(o, 0, half, 8, blockers, n, out);
      let hit = 0;
      for (let i = 0; i <= n; i++) {
         const a = -half + (2 * half * i) / n;
         const len = rayLength(out, i);
         expect(len).toBeCloseTo(sightLength(o, a, 8, blockers), 5);
         if (len < 8 - 1e-6) hit++;
      }
      expect(rayLength(out, n)).toBeCloseTo(2 / Math.cos(half), 5); // the +edge ray enters the near face
      expect(rayLength(out, 0)).toBeCloseTo(8, 5);
      expect(hit).toBeGreaterThan(0);
      expect(hit).toBeLessThan(n + 1);
   });

   it("clips at range: no blockers, a box beyond range, a box whose face is at range", () => {
      const o = { x: 1, y: 0, z: -1 };
      const out = new Float32Array((4 + 2) * 3);
      occludedFanPoints(o, Math.PI / 2, 0.3, 4, [], 4, out);
      for (let i = 0; i <= 4; i++) expect(rayLength(out, i)).toBeCloseTo(4, 5);
      occludedFanPoints(o, Math.PI / 2, 0.3, 4, [box(5.5, -10, 7, 10)], 4, out);
      for (let i = 0; i <= 4; i++) expect(rayLength(out, i)).toBeCloseTo(4, 5);
      // the centre ray (yaw exactly) ends on the face at x = 5 either way
      occludedFanPoints(o, Math.PI / 2, 0.3, 4, [box(5, -10, 7, 10)], 4, out);
      expect(rayLength(out, 2)).toBeCloseTo(4, 5);
      expect(out[1]).toBe(0);
      // a zero or negative range draws nothing
      occludedFanPoints(o, 0, 0.3, -1, [], 4, out);
      for (let i = 0; i <= 4; i++) expect(rayLength(out, i)).toBe(0);
   });

   it("closed slabs, as hasLineOfSightXZ: a ray along a box's edge or through its corner is stopped", () => {
      const o = { x: 0, y: 0, z: 0 };
      const n = 4;
      const out = new Float32Array((n + 2) * 3);
      // centre ray (yaw 0) runs exactly along x = 0, the box's min.x edge
      const edge = [box(0, 3, 1, 4)];
      expect(hasLineOfSightXZ(o, { x: 0, y: 0, z: 5 }, edge)).toBe(false);
      occludedFanPoints(o, 0, 0.2, 6, edge, n, out);
      expect(rayLength(out, 2)).toBe(3);
      // centre ray at yaw 0.3 touches only the box's (min.x, max.z) corner
      const yaw = 0.3;
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      let k = 2;
      while ((dx * k) / dx !== k || (dz * k) / dz !== k || hasLineOfSightXZ(o, { x: dx * (k + 1), y: 0, z: dz * (k + 1) }, [box(dx * k, dz * k - 1, dx * k + 1, dz * k)])) k++;
      const corner = [box(dx * k, dz * k - 1, dx * k + 1, dz * k)];
      occludedFanPoints(o, yaw, 0.2, 10, corner, n, out);
      expect(rayLength(out, 2)).toBeCloseTo(k, 6);
      expect(rayLength(out, 1)).toBeCloseTo(10, 5);
   });

   it("non-finite origins fail closed; a short `out` throws", () => {
      const out = new Float32Array(6 * 3);
      occludedFanPoints({ x: NaN, y: 0, z: 0 }, 0, 0.3, 5, [], 4, out);
      for (let i = 0; i <= 4; i++) expect(rayLength(out, i)).toBe(0);
      expect(() => occludedFanPoints({ x: 0, y: 0, z: 0 }, 0, 0.3, 5, [], 5, out)).toThrow(RangeError);
   });

   it("allocates nothing: writes only `out`, never its inputs, and returns `out`", () => {
      const n = fanSegments(0.5);
      const out = new Float32Array((n + 2) * 3 + 3).fill(7);
      const origin = Object.freeze({ x: 0.5, y: 0, z: -0.5 });
      const blockers = Object.freeze([box(-1, -1, 1, 1), box(-2, 2, 2, 3)].map((b) => Object.freeze({ min: Object.freeze(b.min), max: Object.freeze(b.max) })));
      let same = true;
      for (let i = 0; i < 20000; i++) same = occludedFanPoints(origin, i * 0.001, 0.5, 6, blockers, n, out) === out && same;
      expect(same).toBe(true);
      // the floats past the fan stay untouched
      expect(Array.from(out.subarray((n + 2) * 3))).toEqual([7, 7, 7]);
      expect(origin).toEqual({ x: 0.5, y: 0, z: -0.5 });
   });
});

describe("<Flashlight blockers>: the clip from the group's world matrix", () => {
   it("writes the occluded fan into both position buffers in place, with fixed bounds", () => {
      const range = 7;
      const height = 1.1;
      const half = Math.PI / 6;
      const geo = fanGeometries(half, range, height);
      const parent = new Group();
      parent.position.set(1, 0, -2);
      const g = new Group();
      g.position.set(2, 0, 1);
      g.rotation.y = 0.8;
      parent.add(g);
      g.updateWorldMatrix(true, false);
      const o = { x: 3, y: 0, z: -1 };
      const blockers = [box(2.5, -1.5, 3.5, -0.5), box(3, 1, 9, 3)];
      const beam = geo.beam.attributes.position as BufferAttribute;
      const floor = geo.floor.attributes.position as BufferAttribute;
      const beamArray = beam.array;
      const versions = [beam.version, floor.version];
      clipFan(geo, range, height, blockers, g.matrixWorld.elements);
      expect(beam.array).toBe(beamArray);
      expect(beam.version).toBeGreaterThan(versions[0]);
      expect(floor.version).toBeGreaterThan(versions[1]);
      expect(geo.beam.boundingSphere!.radius).toBe(range);
      expect(geo.floor.boundingSphere!.radius).toBe(range);
      // the apex stays at the lamp, the floor at its lift
      expect(beam.getY(0)).toBeCloseTo(height);
      expect(floor.getY(1)).toBeCloseTo(0.015);
      let clipped = 0;
      for (let i = 0; i <= geo.n; i++) {
         const a = -geo.half + (2 * geo.half * i) / geo.n;
         const want = sightLength(o, 0.8 + a, range, blockers);
         const p = toWorld(o, 0.8, floor.getX(i + 1), floor.getZ(i + 1));
         expect(Math.hypot(p.x - o.x, p.z - o.z)).toBeCloseTo(want, 4);
         expect(beam.getX(i + 1)).toBe(floor.getX(i + 1));
         expect(beam.getZ(i + 1)).toBe(floor.getZ(i + 1));
         if (want < range - 1e-6) clipped++;
      }
      expect(clipped).toBeGreaterThan(0);
      // the bounds never change again
      const sphere = geo.floor.boundingSphere;
      clipFan(geo, range, height, [], g.matrixWorld.elements);
      expect(geo.floor.boundingSphere).toBe(sphere);
      expect(sphere!.radius).toBe(range);
      // removing the blockers restores the open fan
      clipFan(geo, range, height, blockers, g.matrixWorld.elements);
      unclipFan(geo);
      for (let i = 0; i < geo.pts.length; i += 3) {
         expect(beam.getX(i / 3)).toBeCloseTo(geo.pts[i]);
         expect(beam.getZ(i / 3)).toBeCloseTo(geo.pts[i + 2]);
      }
      geo.beam.dispose();
      geo.floor.dispose();
   });
});
