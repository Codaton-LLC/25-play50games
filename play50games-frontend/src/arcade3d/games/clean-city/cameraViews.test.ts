import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { offsetPitchDeg } from "@/arcade3d/core/camera/portraitFollow";
import { PHONE_LEAD, PHONE_LIFT, phoneOffset, cameraSolids } from "./cameraViews";
import { LEVELS } from "./levels";
import { MAPS } from "./rules";

it("keeps landscape fitted and follows portrait from behind, further back", () => {
   const fitted: [number, number, number] = [0, 30, 20];
   expect(phoneOffset(fitted, 1.5)).toEqual(fitted);
   // user 2026-11-17: "a bit farther, looking forward, not so much from above": the portrait
   // camera sits 10 m back and 35 degrees down, behind the hero on the fitted heading (litter ahead)
   // the rig offset is measured from the look-ahead point; the camera's place relative to the hero:
   const rig = phoneOffset(fitted, 0.46);
   const back = Math.hypot(fitted[0], fitted[2]);
   const phone: [number, number, number] = [rig[0] - fitted[0] / back * PHONE_LEAD, rig[1] + PHONE_LIFT, rig[2] - fitted[2] / back * PHONE_LEAD];
   expect(Math.hypot(...phone)).toBeCloseTo(10);
   expect(offsetPitchDeg(phone)).toBeCloseTo(35);
   expect(Math.atan2(phone[0], phone[2])).toBeCloseTo(Math.atan2(fitted[0], fitted[2]));
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

it("aims the portrait camera past the hero so the level ahead shows above it", () => {
   expect(PHONE_LEAD).toBeGreaterThan(0);
   const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
   expect(scene).toContain("useLeadFollow(");
});
