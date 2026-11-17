// guide.ts: the hint follows the run and never changes it.
import { describe, expect, it } from "vitest";
import { hintCode, hintFor, HURRY_S } from "./guide";
import { createRun } from "./rules";

describe("penguin-slide guide", () => {
   it("tells a fresh run to steer, hurries at the end and goes quiet when over", () => {
      const run = createRun(3);
      expect(hintCode(run)).toBe(1);
      expect(hintFor(1).text).toMatch(/fish/);
      run.remaining = HURRY_S;
      expect(hintCode(run)).toBe(4);
      expect(hintFor(4).tone).toBe("warn");
      run.end = "timeup";
      expect(hintCode(run)).toBe(0);
      expect(hintFor(0).text).toBeNull();
   });

   it("asks for a straight landing while in the air", () => {
      const run = createRun(3);
      run.airDuration = 0.6;
      run.yaw = 90;
      expect(hintCode(run)).toBe(3);
      run.yaw = 0;
      expect(hintCode(run)).toBe(2);
      expect(hintFor(3).tone).toBe("warn");
   });
});
