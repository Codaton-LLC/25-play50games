import { describe, expect, it } from "vitest";
import { createRun, step, idleInput, cablePoint, targetSpeed, landingZone, maxScoreFor } from "./rules";
import { LEVELS } from "./levels";

describe("ride the line", () => {
   it("has the card's exact tuck and brake multipliers", () => {
      expect(targetSpeed(10, 1)).toBe(14);
      expect(targetSpeed(10, -1)).toBe(4);
      expect(targetSpeed(10, 0)).toBe(10);
   });
   it("sags below both anchors, and crossing lines meet", () => {
      const cfg = LEVELS[2];
      const a = cablePoint(cfg, 0, 0, 0), m = cablePoint(cfg, 0, 0, 0.5), b = cablePoint(cfg, 0, 0, 1);
      expect(m.y).toBeLessThan(Math.min(a.y, b.y));
      expect(m.x).toBeCloseTo(cablePoint(cfg, 0, 1, 0.5).x);
   });
   it("classifies the three mat zones and rejects undershoot / overshoot", () => {
      expect([3, 5, 7, 9, 12].map(landingZone)).toEqual(["short", "edge", "centre", "edge", "over"]);
   });
   it("stays frozen for invalid time and ignores inputs after the end", () => {
      const r = createRun(1);
      const before = JSON.stringify(r);
      step(r, Number.NaN, idleInput());
      step(r, -1, idleInput());
      expect(JSON.stringify(r)).toBe(before);
      r.ended = "win";
      step(r, 100, { ...idleInput(), jump: true });
      expect(r.ms).toBe(0);
   });
   it("retries from the deck and cannot farm a landing or pickup", () => {
      const r = createRun(1);
      for (let i = 0; i < 2000; i++) step(r, 16, { ...idleInput(), throttle: 1 });
      expect(r.hits).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(maxScoreFor(1));
      expect(r.section).toBe(0);
   });
});
