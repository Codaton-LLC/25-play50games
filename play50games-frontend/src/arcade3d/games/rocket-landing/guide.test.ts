// guide.ts: the first thing wrong with the approach.
import { describe, expect, it } from "vitest";
import { hintFor, type Flight } from "./guide";

const gates = { vy: 2, tilt: 10 };
const ok: Flight = { vx: 0, vy: -10, tilt: 0, fuel: 80, safe: false, hold: 0 };

describe("rocket-landing guide", () => {
   it("names the first problem, in order: fuel, speed, tilt, drift", () => {
      expect(hintFor({ ...ok, fuel: 0 }, gates).text).toMatch(/fuel/);
      expect(hintFor({ ...ok, vy: -30, tilt: 40 }, gates).text).toMatch(/Too fast/);
      expect(hintFor({ ...ok, tilt: 20 }, gates).text).toMatch(/Level/);
      expect(hintFor({ ...ok, vx: 25 }, gates).text).toMatch(/Drifting/);
      expect(hintFor(ok, gates).tone).toBe("info");
   });

   it("is ready when the check passes and quiet once landed or crashed", () => {
      expect(hintFor({ ...ok, safe: true }, gates).tone).toBe("ready");
      expect(hintFor({ ...ok, hold: 1 }, gates).text).toBeNull();
      expect(hintFor({ ...ok, hold: 2 }, gates).text).toBeNull();
   });
});
