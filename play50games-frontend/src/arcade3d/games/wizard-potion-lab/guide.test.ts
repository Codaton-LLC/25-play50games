// guide.ts: the beacons go to the next ingredient, then to the cauldron; read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { hintCode, isHead, labHint, nextGoal, wantedType, type Goal } from "./guide";
import { TYPES, createRun, itemXZ, shelfFor } from "./rules";

const fresh = (): Goal => ({ kind: 0, x: 0, z: 0, type: null });

describe("wizard-potion-lab guide", () => {
   it("points at the shelf with the next ingredient, then at the cauldron, and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(7, LEVELS[id]);
         const before = JSON.stringify(run);
         const want = wantedType(run);
         expect(want).not.toBeNull();
         const g = nextGoal(run, fresh());
         expect(JSON.stringify(run)).toBe(before);
         const at = itemXZ(shelfFor(run, want!)!, run.time, { x: 0, z: 0 });
         expect(g).toMatchObject({ kind: 1, type: want, x: at.x, z: at.z });
         run.carried = want;
         expect(nextGoal(run, fresh())).toMatchObject({ kind: 2, x: 0, z: 0 });
         run.over = "win";
         expect(nextGoal(run, fresh()).kind).toBe(0);
         expect(hintCode(run)).toBe(0);
      }
   });

   it("sends a wrong ingredient back to its own shelf", () => {
      const run = createRun(7, LEVELS[1]);
      const wrong = run.shelves.map((s) => s.type).find((t) => !isHead(run, t));
      expect(wrong).toBeDefined();
      run.carried = wrong!;
      const g = nextGoal(run, fresh());
      expect(g.kind).toBe(3);
      expect(g.type).toBe(wrong);
      expect(labHint(run, hintCode(run), false).tone).toBe("warn");
   });

   it("says take, carry or put back with the right button, and a new key per step", () => {
      const run = createRun(7, LEVELS[1]);
      const take = labHint(run, hintCode(run), false);
      expect(take.text).toMatch(/Take the \w+ from the glowing shelf/);
      expect(take.text).toMatch(/press E/);
      expect(labHint(run, hintCode(run), true).text).toMatch(/tap Use/);
      run.carried = wantedType(run);
      const carry = labHint(run, hintCode(run), false);
      expect(carry).toMatchObject({ tone: "carry" });
      expect(carry.text).toMatch(/cauldron/);
      expect(carry.key).not.toBe(take.key);
      expect(TYPES).toContain(wantedType(run));
   });

   it("follows the head of the open recipes on the dual level", () => {
      const run = createRun(3, LEVELS[5]);
      const open = run.recipes.filter((r) => r.open);
      expect(open.length).toBe(2);
      expect(isHead(run, open[1].steps[0])).toBe(true);
   });
});
