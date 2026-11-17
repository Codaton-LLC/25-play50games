import { expect, it } from "vitest";
import { nextView, normalizeViews } from "@/arcade3d/core/camera/views";
import { offsetPitchDeg } from "@/arcade3d/core/camera/portraitFollow";
import { CAMERA_VIEWS, PHONE_LEAD, PHONE_LIFT, phoneOffset } from "./cameraViews";

it("offers only default and top without changing screen-space steering", () => {
   expect(normalizeViews(CAMERA_VIEWS)).toEqual(["default", "top"]);
   expect(nextView(CAMERA_VIEWS, "default")).toBe("top");
   expect(nextView(CAMERA_VIEWS, "top")).toBe("default");
});
it("follows the climber on portrait from further back, nearly level", () => {
   const fitted: [number, number, number] = [3, 2, 12];
   expect(phoneOffset(fitted, 1.5)).toEqual(fitted);
   // user 2026-11-17: "a bit farther, looking forward, not so much from above": the portrait
   // camera sits 4.5 m back and 12 degrees down, behind the hero on the fitted heading (platforms above)
   // the rig offset is measured from the look-ahead point; the camera's place relative to the hero:
   const rig = phoneOffset(fitted, 0.46);
   const back = Math.hypot(fitted[0], fitted[2]);
   const phone: [number, number, number] = [rig[0] - fitted[0] / back * PHONE_LEAD, rig[1] + PHONE_LIFT, rig[2] - fitted[2] / back * PHONE_LEAD];
   expect(Math.hypot(...phone)).toBeCloseTo(4.5);
   expect(offsetPitchDeg(phone)).toBeCloseTo(12);
   expect(Math.atan2(phone[0], phone[2])).toBeCloseTo(Math.atan2(fitted[0], fitted[2]));
});

it("aims the portrait camera above the climber so the next platforms show", () => {
   expect(PHONE_LIFT).toBeGreaterThan(0);
});
