import { describe, expect, it } from "vitest";
import { createRun, FLOOR, PLAN, predictLanding, rateLanding, stepRun } from "./rules";
import { landingMarker, markerColor, shadowTop, VISUAL_EXTENSION } from "./dropGuide";

describe("drop guide", () => {
   it("uses four distinct rating colours", () => {
      expect([0, 1, 2, 3].map(markerColor)).toEqual(["#fbbf24", "#34d399", "#f8fafc", "#fb7185"]);
   });
   it("matches scoring prediction and actual drops over deterministic random states", () => {
      let seed = 42;
      const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
      const out = { x: 0, y: 0, z: 0 };
      const predicted = { x: 0, z: 0 };
      for (let i = 0; i < 1000; i++) {
         const run = createRun(i);
         run.planIndex = Math.floor(random() * PLAN.length);
         run.carried = PLAN[run.planIndex].kind;
         run.radius = 9.1 + random() * 0.5;
         run.angle = random() * 1.2 - 0.6;
         run.omega = random() * 1.8 - 0.9;
         run.vr = random() * 5 - 2.5;
         run.swing.x.x = random() * 0.3 - 0.15;
         run.swing.z.x = random() * 0.3 - 0.15;
         run.swing.x.v = random() - 0.5;
         run.swing.z.v = random() - 0.5;
         const idle = { rot: 0, radial: 0, pick: -1, actionPick: false, drop: false };
         stepRun(run, idle, 1 / 120);
         const step = PLAN[run.planIndex];
         const before = JSON.stringify(run);
         const rating = landingMarker(run, out);
         expect(rating).toBe(rateLanding(predictLanding(run, step, predicted), step.building === 2));
         expect(out).toEqual({ ...predicted, y: step.floor * FLOOR + 0.09 });
         expect(JSON.stringify(run)).toBe(before);
         // Less than one fixed step: tryDrop sees exactly the previewed physics state.
         stepRun(run, { ...idle, drop: true }, 1e-9);
         expect(run.dropRating).toBe(rating);
         expect(run.landX).toBe(out.x);
         expect(run.landZ).toBe(out.z);
      }
   });
   it("keeps the visual extension above the highest work surface", () => {
      expect(4.5 - VISUAL_EXTENSION - 0.75).toBeGreaterThan(3);
      const run = createRun(1);
      expect(shadowTop(run, { x: 0, z: 0 })).toBe(0);
   });
});
