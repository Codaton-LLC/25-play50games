import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { phoneOffset } from "./cameraViews";

it("frames portrait closer and reads the live camera yaw for movement", () => {
   const fitted: [number, number, number] = [10, 20, 30];
   expect(phoneOffset(fitted, 1.5)).toEqual(fitted);
   expect(Math.hypot(...phoneOffset(fitted, 0.46))).toBeCloseTo(6.8);
   const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
   expect(scene).toContain("yaw={cam.yaw}");
   expect(scene).toContain("now.moveY, yaw(), scratch.dir");
});
