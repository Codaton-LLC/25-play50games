// The orbit camera's pure parts (camera.ts) and the camera-relative stick: the pivot leads along the
// travel and never backwards, the intro ends exactly on the play pose, the shots stay over the tunnel,
// and the walls are the camera's collision boxes.
import { describe, expect, it } from "vitest";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { LEVEL_IDS } from "@/arcade3d/types";
import { WIND_ORBIT, courseSolids, introKeyframes, orbitPivot, orbitScale, playCamera } from "./camera";
import { courseFor, createRun, createStepInput, step } from "./rules";

const box = () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });

describe("the orbit camera", () => {
   it("the pivot sits over the hero's chest, leads at most 2.5 m forwards along the travel, never backwards", () => {
      const p = { x: 0, y: 0, z: 0 };
      orbitPivot(0, 0, 0, 0, -7, false, p);
      expect(p.z).toBeLessThan(0);
      expect(p.z).toBeGreaterThanOrEqual(-2.5);
      orbitPivot(0, 0, 0, 0, 9, false, p);
      expect(p.z).toBe(0);
      orbitPivot(0, 0, 0, 0, 0, true, p);
      expect(p.y).toBeGreaterThan(1.5);
   });

   it("the play pose is the orbit's start pose behind the hero (yaw 0), farther on a portrait phone", () => {
      const c = courseFor(1);
      const land = playCamera(c, 16 / 10);
      const port = playCamera(c, 390 / 844);
      expect(land.position[2]).toBeGreaterThan(c.start.z);
      expect(port.position[2] - c.start.z).toBeGreaterThan(land.position[2] - c.start.z);
      const p = orbitPivot(c.start.x, c.start.y, c.start.z, 0, 0, false, { x: 0, y: 0, z: 0 });
      const pos = orbitPosition(p.x, p.y, p.z, WIND_ORBIT.yaw ?? 0, WIND_ORBIT.pitch ?? 0, (WIND_ORBIT.distance ?? 7) * orbitScale(16 / 10), { x: 0, y: 0, z: 0 });
      expect(land.position[0]).toBeCloseTo(pos.x, 6);
      expect(land.position[1]).toBeCloseTo(pos.y, 6);
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: the intro flies from the exit back over the rooms (high over the walls), then to the start`, () => {
         const c = courseFor(id);
         const keys = introKeyframes(c);
         expect(keys.length).toBeGreaterThanOrEqual(3);
         expect(keys[0].lookAt[2]).toBeLessThan(keys[keys.length - 1].lookAt[2]);
         for (const k of keys.slice(1)) {
            const r = c.rooms.find((q) => k.lookAt[2] + 4 <= q.z0 && k.lookAt[2] + 4 >= q.z1);
            if (r) expect(k.position[1]).toBeGreaterThan(r.top + 4);
         }
      });
   }

   it("the walls near the camera are its collision boxes", () => {
      const run = createRun(1, 1);
      const out = Array.from({ length: 256 }, box);
      const n = courseSolids(run, 0, 4, 10, out);
      expect(n).toBeGreaterThan(4);
      expect(out.slice(0, n).some((b) => b.min.x >= 6.9)).toBe(true);
   });

   it("a turned camera turns the stick (camera-relative movement): yaw π walks the stick's up towards +z", () => {
      const run = createRun(1, 1);
      const i = createStepInput();
      i.moveZ = -1;
      i.yaw = Math.PI;
      const z0 = run.hero.z;
      for (let k = 0; k < 20; k++) step(run, 16, i);
      expect(run.hero.z).toBeGreaterThan(z0);
   });
});
