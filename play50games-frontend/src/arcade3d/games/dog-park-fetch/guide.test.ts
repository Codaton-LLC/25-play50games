// guide.ts: the goal follows the active throw (landing ring, toy, blanket); read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { HURRY_S, dogHint, hintCode, nextGoal, patienceLeft, type Goal } from "./guide";
import { BLANKET_R, createRun, frame, idleInput } from "./rules";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";

const fresh = (): Goal => ({ kind: 0, x: 0, z: 0 });

describe("dog-park-fetch guide", () => {
   it("has no goal before the first throw, then follows the throw and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(13, LEVELS[id]);
         expect(nextGoal(run, fresh()).kind).toBe(0);
         expect(hintCode(run)).toBe(0);
         const store = createArcadeStore();
         for (let n = 0; n < 200 && !run.active; n++) frame(run, idleInput(), 1 / 30, store);
         const th = run.active;
         expect(th).not.toBeNull();
         if (!th) continue;
         const before = JSON.stringify(run);
         const g = nextGoal(run, fresh());
         expect(JSON.stringify(run)).toBe(before);
         expect(g).toMatchObject({ kind: 3, x: th.lx, z: th.lz });
         th.state = "ground";
         expect(nextGoal(run, fresh()).kind).toBe(1);
         th.state = "carried";
         const c = nextGoal(run, fresh());
         expect(c).toMatchObject({ kind: 2, x: run.blanket.x, z: run.blanket.z });
         expect(BLANKET_R).toBeGreaterThan(0);
         run.over = "win";
         expect(nextGoal(run, fresh()).kind).toBe(0);
      }
   });

   it("says what to do in each state, with the right button", () => {
      const run = createRun(2, LEVELS[4]);
      const store = createArcadeStore();
      for (let n = 0; n < 200 && !run.active; n++) frame(run, idleInput(), 1 / 30, store);
      const th = run.active!;
      th.kind = "frisbee";
      th.state = "flying";
      expect(dogHint(run, hintCode(run), false).text).toMatch(/press Space/);
      expect(dogHint(run, hintCode(run), true).text).toMatch(/tap Jump/);
      th.kind = "ball";
      expect(dogHint(run, hintCode(run), false).text).toMatch(/lands in the ring/);
      th.state = "ground";
      th.landedAt = run.time;
      expect(patienceLeft(run)).toBeGreaterThan(HURRY_S);
      expect(dogHint(run, hintCode(run), false).text).toMatch(/Run to the toy/);
      th.landedAt = run.time - (run.level.patienceS - HURRY_S + 0.1);
      expect(dogHint(run, hintCode(run), false)).toMatchObject({ tone: "warn", sticky: true });
      th.state = "carried";
      expect(dogHint(run, hintCode(run), false).tone).toBe("carry");
      run.dog.stun = 0.4;
      expect(dogHint(run, hintCode(run), false).tone).toBe("warn");
   });

   it("never warns about patience on levels where the toy waits for ever", () => {
      const run = createRun(2, LEVELS[1]);
      const store = createArcadeStore();
      for (let n = 0; n < 200 && !run.active; n++) frame(run, idleInput(), 1 / 30, store);
      run.active!.state = "ground";
      run.time += 500;
      expect(patienceLeft(run)).toBe(Infinity);
      expect(dogHint(run, hintCode(run), false).tone).toBeUndefined();
   });
});
