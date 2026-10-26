// Temple Lantern Jump plays its own courses: a courtyard climb in groups of three (a lantern bounce pad on
// one side throws the hero a big step up to a balcony on the other side, then a hop to a middle balcony), where the
// lanterns are the only way up. Not a reskin of Rooftop Roll Climb, Flooded Ruins Escape or Lava Pillar Jump.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { courseFor as floodedCourse } from "../flooded-ruins-escape/rules";
import { courseFor as lavaCourse } from "../lava-pillar-jump/rules";
import { courseFor as rooftopCourse } from "../rooftop-roll-climb/rules";
import { LEVELS } from "./levels";
import { nodeRole } from "./temple";
import { H_BOUNCE, H_JUMP, PROPOSED_LEVEL_LIMITS, courseFor, createRun, minFinishMs, step, createStepInput } from "./rules";

describe("the courtyard climb", () => {
   it("goes lantern, landing, middle balcony in groups of three, the lanterns on alternating sides", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const steps = c.supports.length - 1;
         let lastSide = 0;
         for (let i = 1; i <= steps; i++) {
            const role = nodeRole(i, steps);
            const s = c.supports[i];
            if (role === "lantern") {
               expect(s.pad, `L${id} node ${i}`).toBe(true);
               expect(Math.abs(s.cx)).toBeGreaterThan(2.5);
               expect(Math.sign(s.cx)).not.toBe(lastSide);
               lastSide = Math.sign(s.cx);
               const next = c.supports[i + 1];
               // the landing is across the courtyard, a lantern's throw above
               expect(Math.sign(next.cx)).toBe(-Math.sign(s.cx));
               expect(next.top - s.top).toBeGreaterThan(H_JUMP);
               expect(next.top - s.top).toBeLessThan(H_BOUNCE - 0.8);
            } else {
               expect(s.pad).toBe(false);
            }
            if (role === "middle" && s.kind !== "goal") expect(s.cx).toBe(0);
         }
      }
   });

   it("the lanterns are the only way up: with the pads taken away no level can be finished", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const flat = { ...c, supports: c.supports.map((s) => ({ ...s, pad: false })) };
         expect(minFinishMs(c), `L${id} with lanterns`).toBeLessThan(Infinity);
         expect(minFinishMs(flat), `L${id} without lanterns`).toBe(Infinity);
      }
   });

   it("walking onto a lantern throws the hero up at once, past the height of any jump", () => {
      const run = createRun(1, 1);
      const lantern = run.course.supports.findIndex((s) => s.pad);
      const s = run.course.supports[lantern];
      run.hero.x = s.cx;
      run.hero.z = s.cz;
      run.hero.y = s.top;
      run.hero.lastTop = s.top;
      run.hero.support = lantern;
      run.hero.grounded = true;
      const input = createStepInput();
      let peak = s.top;
      for (let i = 0; i < 120; i++) {
         step(run, 20, input);
         peak = Math.max(peak, run.hero.y);
      }
      expect(peak - s.top).toBeGreaterThan(H_JUMP + 2);
   });

   it("the checkpoints are lit lanterns on the middle balconies, never on a lantern or a landing", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const index of c.checkpoints.slice(1)) {
            expect(c.supports[index].pad).toBe(false);
            expect(c.supports[index].cx).toBe(0);
            expect(c.supports[index].kind).toBe("checkpoint");
         }
      }
      expect(courseFor(1).checkpoints.length).toBeGreaterThan(1);
   });

   it("each level adds its hazard: swinging decks, paper floors, polished wood, bells, the hill wind", () => {
      const has = (id: 1 | 2 | 3 | 4 | 5) => {
         const c = courseFor(id);
         return { mover: c.supports.some((s) => s.mover), vanish: c.supports.some((s) => s.vanish), ice: c.supports.some((s) => s.slippery), bells: c.strikes.length > 0, wind: c.wind };
      };
      expect(has(1)).toEqual({ mover: false, vanish: false, ice: false, bells: false, wind: false });
      expect(has(2).mover).toBe(true);
      expect(has(3)).toMatchObject({ mover: true, vanish: true, ice: true });
      expect(has(4).bells).toBe(true);
      expect(has(5)).toMatchObject({ mover: true, vanish: true, ice: true, bells: true, wind: true });
      expect(LEVELS[5].durationMs).toBe(240_000);
   });
});

describe("is its own game", () => {
   it("its courses differ from the other three Menu 2 climbs on every level, and no limits row repeats theirs", () => {
      for (const id of LEVEL_IDS) {
         const mine = courseFor(id).supports.map((s) => `${s.cx}:${s.top}`).join();
         for (const other of [rooftopCourse(id), floodedCourse(id), lavaCourse(id)]) {
            expect(mine).not.toBe(other.supports.map((s) => `${s.cx}:${s.top}`).join());
         }
      }
      const limits = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(limits).size).toBe(5);
   });
});
