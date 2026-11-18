import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { offsetPitchDeg } from "@/arcade3d/core/camera/portraitFollow";
import { PHONE_LEAD, PHONE_LIFT, phoneOffset } from "./cameraViews";

it("frames portrait from behind and further back and reads live camera yaw for movement", () => {
   const fitted: [number, number, number] = [10, 20, 30];
   expect(phoneOffset(fitted, 1.5)).toEqual(fitted);
   // user 2026-11-17: "a bit farther, looking forward, not so much from above": the portrait
   // camera sits 11 m back and 45 degrees down, behind the hero on the fitted heading (zones ahead)
   // the rig offset is measured from the look-ahead point; the camera's place relative to the hero:
   const rig = phoneOffset(fitted, 0.46);
   const back = Math.hypot(fitted[0], fitted[2]);
   const phone: [number, number, number] = [rig[0] - fitted[0] / back * PHONE_LEAD, rig[1] + PHONE_LIFT, rig[2] - fitted[2] / back * PHONE_LEAD];
   expect(Math.hypot(...phone)).toBeCloseTo(11);
   expect(offsetPitchDeg(phone)).toBeCloseTo(45);
   expect(Math.atan2(phone[0], phone[2])).toBeCloseTo(Math.atan2(fitted[0], fitted[2]));
   const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
   expect(scene).toContain("yaw={cam.yaw}");
   expect(scene).toContain("now.moveY, yaw(), scratch.dir");
});

it("aims the portrait camera past the hero so the level ahead shows above it", () => {
   expect(PHONE_LEAD).toBeGreaterThan(0);
   const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
   expect(scene).toContain("useLeadFollow(");
});
