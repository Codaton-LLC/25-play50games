import { expect, it } from "vitest";
import { nextView, normalizeViews } from "@/arcade3d/core/camera/views";
import { CAMERA_VIEWS, phoneOffset } from "./cameraViews";

it("offers only default and top without changing screen-space steering", () => {
   expect(normalizeViews(CAMERA_VIEWS)).toEqual(["default", "top"]);
   expect(nextView(CAMERA_VIEWS, "default")).toBe("top");
   expect(nextView(CAMERA_VIEWS, "top")).toBe("default");
});
it("brings the small climber closer on portrait screens", () => {
   const fitted: [number, number, number] = [3, 2, 12];
   expect(phoneOffset(fitted, 1.5)).toEqual(fitted);
   expect(Math.hypot(...phoneOffset(fitted, 0.46))).toBeCloseTo(2.6);
});
