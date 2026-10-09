import { describe, expect, it } from "vitest";
import { pickGhost, type AimRay } from "./aim";
import { PULL, createRun, pullValid } from "./rules";

// Camera 50 degrees above the hunter, looking at the ghost's face (y 1.06).
function rayTo(cam: { x: number; y: number; z: number }, x: number, y: number, z: number): AimRay {
   const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z, l = Math.hypot(dx, dy, dz);
   return { ox: cam.x, oy: cam.y, oz: cam.z, dx: dx / l, dy: dy / l, dz: dz / l };
}
function scene() {
   const run = createRun(7);
   for (const g of run.ghosts) g.mode = "caught";
   const g = run.ghosts[0];
   Object.assign(g, { room: 0, x: -8.1, z: -7, baseX: -8.1, baseZ: -7, mode: "stunned", kind: "normal", stun: 2 });
   Object.assign(run.hunter, { x: -7.4, z: -6.7, yaw: 0 });
   const cam = { x: -7.4, y: 1 + 9 * Math.sin(50 * Math.PI / 180), z: -6.7 + 9 * Math.cos(50 * Math.PI / 180) };
   return { run, g, cam };
}

describe("pointer aim over a ghost body", () => {
   it("picks the ghost under the pointer and that yaw is inside the pull cone at close range", () => {
      const { run, g, cam } = scene();
      const ray = rayTo(cam, g.x, 1.06, g.z);
      // The old y0.6 plane hit lands behind the ghost: more than the 12-degree cone off at 0.76 m.
      const t = (0.6 - ray.oy) / ray.dy, px = ray.ox + ray.dx * t, pz = ray.oz + ray.dz * t;
      const planeYaw = Math.atan2(px - run.hunter.x, pz - run.hunter.z), trueYaw = Math.atan2(g.x - run.hunter.x, g.z - run.hunter.z);
      expect(Math.abs(planeYaw - trueYaw)).toBeGreaterThan(PULL.angle);
      expect(pickGhost(ray, run.ghosts)).toBe(0);
      run.hunter.yaw = trueYaw;
      expect(pullValid(run, g)).toBe(true);
   });
   it("misses beside the sheet, above the head and for hidden/caught ghosts; big ghosts are wider", () => {
      const { run, g, cam } = scene();
      expect(pickGhost(rayTo(cam, g.x + 0.75, 0.8, g.z), run.ghosts)).toBe(-1);
      expect(pickGhost(rayTo(cam, g.x + 0.45, 0.8, g.z), run.ghosts)).toBe(0);
      expect(pickGhost(rayTo(cam, g.x, 2.6, g.z), run.ghosts)).toBe(-1); // floating ghost top ~1.9 m
      g.kind = "big";
      expect(pickGhost(rayTo(cam, g.x + 0.58, 0.8, g.z), run.ghosts)).toBe(0);
      g.kind = "normal"; g.mode = "hidden";
      expect(pickGhost(rayTo(cam, g.x, 0.8, g.z), run.ghosts)).toBe(-1);
      g.mode = "caught";
      expect(pickGhost(rayTo(cam, g.x, 0.8, g.z), run.ghosts)).toBe(-1);
   });
   it("prefers the nearest ghost along the ray", () => {
      const { run, g, cam } = scene();
      const far = run.ghosts[1];
      Object.assign(far, { x: g.x, z: g.z - 0.9, baseX: g.x, baseZ: g.z - 0.9, mode: "wandering", kind: "normal" });
      expect(pickGhost(rayTo(cam, g.x, 1.3, g.z), run.ghosts)).toBe(0);
      g.mode = "caught";
      expect(pickGhost(rayTo(cam, g.x, 1.3, g.z), run.ghosts)).toBe(1);
   });
});
