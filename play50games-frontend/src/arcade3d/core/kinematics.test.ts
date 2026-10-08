import { describe, expect, it } from "vitest";
import { circleSegmentXZ, resolveCircleSegmentXZ, rotateSegmentXZ, stepPendulum, stepPendulum2D, stepRigidBody2D, substep, type SegmentContact } from "./kinematics";
const scratch = (): SegmentContact => ({ x: 0, z: 0, nx: 0, nz: 0, depth: 0, vx: 0, vz: 0 });
describe("kinematics", () => {
   it("never gains kinetic energy across 10,000 bounces", () => {
      for (const restitution of [0, 0.8, 1]) {
         const body = { x: 0.5, z: 0, vx: -3, vz: 2, radius: 0.5 }, hit = scratch();
         const wall = { a: { x: 0, z: -10 }, b: { x: 0, z: 10 } };
         let energy = body.vx ** 2 + body.vz ** 2;
         for (let i = 0; i < 10000; i++) {
            body.x = 0.49; body.vx = -Math.abs(body.vx);
            expect(circleSegmentXZ(body, wall, hit)).toBe(hit);
            resolveCircleSegmentXZ(body, hit, restitution, 0.001);
            const next = body.vx ** 2 + body.vz ** 2;
            expect(next).toBeLessThanOrEqual(energy + 1e-12); energy = next;
         }
      }
   });
   it("includes rotating contact velocity and endpoint contact", () => {
      const blade = { a: { x: 0, z: 0 }, b: { x: 2, z: 0 }, pivot: { x: 0, z: 0 }, omega: 2 };
      const body = { x: 1, z: -0.1, vx: 0, vz: 0, radius: 0.2 }, hit = scratch();
      circleSegmentXZ(body, blade, hit); expect(hit.vz).toBe(-2);
      resolveCircleSegmentXZ(body, hit, 1); expect(body.vz).toBe(-4);
      expect(circleSegmentXZ({ ...body, x: 2.1, z: 0 }, blade, hit)).toBe(hit);
      expect(circleSegmentXZ({ ...body, x: 3, z: 0 }, blade, hit)).toBeNull();
      rotateSegmentXZ(blade, Math.PI / 2); expect(blade.b.z).toBeCloseTo(-2);
   });
   it("substeps 30/60/144 Hz to the same rest point within 1 mm", () => {
      const run = (hz: number) => {
         const body = { x: 0, y: 3, angle: 0, vx: 1, vy: 0, omega: 0 };
         const forces = { thrust: 0, torque: 0, gravity: 9.81 };
         const step = (dt: number) => {
            stepRigidBody2D(body, dt, forces);
            if (body.y < 0) { body.y = 0; body.vy = 0; body.vx *= Math.exp(-20 * dt); }
         };
         for (let i = 0; i < hz * 4; i++) substep(1 / hz, 1 / 7200, step);
         return body;
      };
      const reference = run(30);
      for (const hz of [60, 144]) { const body = run(hz); expect(Math.hypot(body.x - reference.x, body.y - reference.y)).toBeLessThan(0.001); }
      let total = 0, largest = 0;
      expect(substep(0.035, 0.01, (dt) => { total += dt; largest = Math.max(largest, dt); })).toBe(4);
      expect(total).toBeCloseTo(0.035); expect(largest).toBeLessThanOrEqual(0.01);
      expect(() => substep(1, 0, () => {})).toThrow();
   });
   it("applies lander thrust and torque", () => {
      const body = { x: 0, y: 0, angle: Math.PI / 2, vx: 0, vy: 0, omega: 0 };
      stepRigidBody2D(body, 0.5, { thrust: 4, torque: 2, gravity: 10, mass: 2, inertia: 2 });
      expect(body.vx).toBeCloseTo(-1); expect(body.vy).toBeCloseTo(-5); expect(body.omega).toBe(0.5);
   });
   it("decays pendulum amplitude and responds to pivot acceleration on both axes", () => {
      const params = { length: 2, gravity: 9.81, damping: 0.8 }, state = { x: 0.2, v: 0 };
      for (let i = 0; i < 1200; i++) stepPendulum(state, 1 / 120, params);
      expect(Math.hypot(state.x, state.v / Math.sqrt(params.gravity / params.length))).toBeLessThan(0.004);
      const axes = { x: { x: 0, v: 0 }, z: { x: 0, v: 0 } };
      stepPendulum2D(axes, 0.1, params, { x: 1, z: -1 });
      expect(axes.x.x).toBeLessThan(0); expect(axes.z.x).toBeCloseTo(-axes.x.x);
   });
});
