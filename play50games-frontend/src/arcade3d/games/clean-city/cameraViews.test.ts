import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { phoneOffset, cameraSolids } from "./cameraViews";
import { LEVELS } from "./levels";
import { MAPS } from "./rules";

it("keeps landscape fitted and brings portrait closer", () => {
   const fitted: [number, number, number] = [0, 30, 20];
   expect(phoneOffset(fitted, 1.5)).toEqual(fitted);
   expect(Math.hypot(...phoneOffset(fitted, 0.46))).toBeCloseTo(4);
});
it("fills the camera solids from only the active map", () => {
   for (let map = 0; map < MAPS.length; map++) {
      const out = Array.from({ length: 256 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      expect(cameraSolids(map, out)).toBe(MAPS[map].obstacles.length + (map === 1 ? 4 : 0));
      MAPS[map].obstacles.forEach((p, i) => {
         expect(out[i].min.x).toBeLessThanOrEqual(p.x - p.halfX);
         expect(out[i].max.y).toBeGreaterThan(0);
      });
   }
});

it("maps movement with the drawn camera yaw each frame", () => {
   const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
   expect(scene).toContain("yaw={cam.yaw}");
   expect(scene).toContain("now.moveY, yaw(), scratch.dir");
});

it("includes level props and respects the scratch capacity", () => {
   const out = Array.from({ length: 256 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
   expect(cameraSolids(0, out, LEVELS[5], 1000)).toBe(MAPS[0].obstacles.length + 7);
   expect(cameraSolids(1, out.slice(0, 1), LEVELS[5])).toBe(1);
});
