// guide.ts: the beacon goes to a reachable fire or neighbour, sticks to it until done, then the exit.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { hintCode, nextTarget, targetHint, type Target } from "./guide";
import { createRun, doorClosed } from "./rules";

const fresh = (): Target => ({ kind: 0, index: -1, x: 0, z: 0 });

describe("firefighter guide", () => {
   it("never points behind a shut door and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         for (const seed of [2, 9, 31]) {
            const run = createRun(seed, LEVELS[id]);
            const before = JSON.stringify(run);
            const t = nextTarget(run, fresh());
            expect(JSON.stringify(run)).toBe(before);
            expect(t.kind === 1 || t.kind === 2).toBe(true);
            if (t.kind === 1) {
               const fire = run.fires[t.index];
               expect(fire.door || fire.room < 0 || !doorClosed(run, fire.room)).toBe(true);
            } else expect(!doorClosed(run, run.civilians[t.index].room)).toBe(true);
         }
      }
   });

   it("keeps its target until done, then picks another; the exit while someone follows", () => {
      const run = createRun(4, LEVELS[2]);
      const t = nextTarget(run, fresh());
      const first = { kind: t.kind, index: t.index };
      run.hero.x += 0.5;
      expect(nextTarget(run, t)).toMatchObject(first);
      if (first.kind === 1) run.fires[first.index].out = true;
      else run.civilians[first.index].saved = true;
      const next = nextTarget(run, t);
      expect(next.kind === first.kind && next.index === first.index).toBe(false);
      run.follower = 0;
      expect(nextTarget(run, t).kind).toBe(3);
      expect(targetHint(hintCode(run, t, false), false).tone).toBe("carry");
   });

   it("warns about low breath in smoke, and names the touch button", () => {
      const run = createRun(1, LEVELS[1]);
      run.hero.breath = 0.2;
      const t = nextTarget(run, fresh());
      expect(targetHint(hintCode(run, t, true), false).tone).toBe("warn");
      run.hero.x = t.x;
      run.hero.z = t.z;
      expect(targetHint(hintCode(run, t, false), true).text).toMatch(/hold Spray/);
   });
});
