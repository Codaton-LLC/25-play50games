// Cloud Hopper plays its own courses: a breathing helix of bounce clouds, drift chains, fade-after-land
// clouds and wind lanes. Not a reskin of Sky Tower Jump, Rooftop Roll Climb or Flooded Ruins Escape.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { H_BOUNCE, H_JUMP } from "./rules";
import { PROPOSED_LEVEL_LIMITS as SKY_LIMITS, courseFor as skyCourse } from "../sky-tower-jump/rules";
import { PROPOSED_LEVEL_LIMITS as ROOF_LIMITS, courseFor as roofCourse } from "../rooftop-roll-climb/rules";
import { PROPOSED_LEVEL_LIMITS as FLOOD_LIMITS, courseFor as floodCourse } from "../flooded-ruins-escape/rules";
import { LEVELS } from "./levels";
import { helixTurns } from "./clouds";
import { PROPOSED_LEVEL_LIMITS, courseFor, createRun, createStepInput, laneAccel, step, supportX, supportZ } from "./rules";

const sig = (supports: { cx: number; cz: number; top: number }[]) => supports.map((s) => `${s.cx},${s.cz},${s.top}`).join("|");

describe("the helix", () => {
   it("winds around the origin and turns further on the longer levels", () => {
      const turns = LEVEL_IDS.map((id) => helixTurns(LEVELS[id].spec, LEVELS[id].spec.surfaces));
      expect(turns[0]).toBeGreaterThan(0.9);
      expect(turns[4]).toBeGreaterThan(turns[0] + 0.8);
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const zs = c.supports.map((s) => s.cz);
         expect(Math.min(...zs)).toBeLessThan(0);
         expect(Math.max(...zs)).toBeGreaterThan(0);
         expect(c.supports[0].cz).toBeCloseTo(0, 5);
      }
   });

   it("a launch cannot skip a cloud: two steps from a bounce cloud clear the bounce apex, two normal steps clear the jump", () => {
      for (const id of LEVEL_IDS) {
         const s = courseFor(id).supports;
         for (let i = 0; i < s.length - 2; i++) {
            const dy = s[i + 2].top - s[i].top;
            if (s[i].pad) expect(dy, `L${id} bounce skip ${i}`).toBeGreaterThan(H_BOUNCE);
            else expect(dy, `L${id} jump skip ${i}`).toBeGreaterThan(H_JUMP);
         }
      }
   });

   it("drift chains share a phase and a tangent, fade clouds remember a landing, wind lanes push sideways", () => {
      const moving = courseFor(2);
      const drifted = moving.supports.filter((s) => s.mover);
      expect(drifted.length).toBeGreaterThanOrEqual(4);
      const phase = drifted[0].mover!;
      expect(phase.axis).toBe("tangent");
      expect(Math.hypot(phase.tx, phase.tz)).toBeCloseTo(1, 5);
      const mate = drifted.find((s) => s.mover!.phase === phase.phase && s !== drifted[0]);
      expect(mate).toBeTruthy();
      expect(supportX(drifted[0], 1000) - drifted[0].cx).not.toBe(0);

      const run = createRun(1, 4);
      const fade = run.course.supports.findIndex((s) => s.fadeMs > 0);
      expect(fade).toBeGreaterThan(0);
      run.hero.x = run.course.supports[fade].cx;
      run.hero.z = run.course.supports[fade].cz;
      run.hero.y = run.course.supports[fade].top;
      run.hero.lastTop = run.hero.y;
      run.hero.support = fade;
      run.hero.grounded = true;
      step(run, 20, createStepInput());
      expect(run.goneAt[fade]).toBeGreaterThan(0);
      const hold = run.goneAt[fade];
      run.hero.y = run.course.supports[fade].top;
      run.hero.grounded = true;
      run.hero.support = fade;
      for (let ms = 0; ms < hold + 80 && run.hero.grounded; ms += 20) step(run, 20, createStepInput());
      expect(run.hero.grounded).toBe(false);

      const wind = courseFor(3);
      expect(wind.lanes.length).toBeGreaterThan(2);
      const lane = wind.lanes[0];
      const push = laneAccel(wind, lane.x, (lane.y0 + lane.y1) / 2, lane.z);
      expect(Math.hypot(push.ax, push.az)).toBeGreaterThan(1);
      expect(laneAccel(wind, 80, 0, 80)).toEqual({ ax: 0, az: 0 });
   });
});

describe("courses and limits differ from the other Menu 2 jumpers", () => {
   it("every level's cloud positions differ from sky tower, rooftop and flooded ruins", () => {
      for (const id of LEVEL_IDS) {
         const mine = sig(courseFor(id).supports);
         expect(mine).not.toBe(sig(skyCourse(id).supports));
         expect(mine).not.toBe(sig(roofCourse(id).supports));
         expect(mine).not.toBe(sig(floodCourse(id).supports));
      }
   });

   it("every level's limits differ from those three games", () => {
      for (const id of LEVEL_IDS) {
         const mine = JSON.stringify(PROPOSED_LEVEL_LIMITS[id]);
         expect(mine).not.toBe(JSON.stringify(SKY_LIMITS[id]));
         expect(mine).not.toBe(JSON.stringify(ROOF_LIMITS[id]));
         expect(mine).not.toBe(JSON.stringify(FLOOD_LIMITS[id]));
      }
   });
});
