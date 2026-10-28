// guide.ts: the beacons go to the next mailbox or door, or the post office; read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { hintCode, nextGoal, postHint, type Goal } from "./guide";
import { OFFICE, createRun, targetFor } from "./rules";

const fresh = (): Goal => ({ kind: 0, x: 0, z: 0, item: -1 });

describe("postman-3d guide", () => {
   it("points at the first item's mailbox or door, and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(9, LEVELS[id]);
         const before = JSON.stringify(run);
         const g = nextGoal(run, fresh());
         expect(JSON.stringify(run)).toBe(before);
         const item = run.items[0];
         expect(item.loaded).toBe(true);
         expect(g.kind).toBe(item.kind === "letter" ? 1 : 2);
         expect(g).toMatchObject(targetFor(run, item));
         run.over = "win";
         expect(nextGoal(run, fresh()).kind).toBe(0);
         expect(hintCode(run)).toBe(0);
      }
   });

   it("sends the postman back to the post office when the next item is not loaded", () => {
      const run = createRun(9, LEVELS[2]);
      run.items[0].loaded = false;
      expect(nextGoal(run, fresh())).toMatchObject({ kind: 3, x: OFFICE.x, z: OFFICE.z });
      const hint = postHint(run, hintCode(run), true, true);
      expect(hint.text).toMatch(/post office/);
      expect(hint.text).toMatch(/arrow/);
      expect(postHint(run, hintCode(run), false, false).text).not.toMatch(/arrow/);
   });

   it("names the house, colour and place, with the right button, and a key per stop", () => {
      const run = createRun(9, LEVELS[1]);
      const a = postHint(run, hintCode(run), false, true);
      expect(a.text).toMatch(/Letter for no\. \d+ \((red|blue|yellow)\): the mailbox, press E/);
      expect(postHint(run, hintCode(run), true, true).text).toMatch(/tap Post/);
      run.items[0].delivered = true;
      expect(postHint(run, hintCode(run), false, true).key).not.toBe(a.key);
   });

   it("says front door for a parcel", () => {
      const run = createRun(9, LEVELS[2]);
      const i = run.items.findIndex((x) => x.kind === "parcel");
      for (let k = 0; k < i; k++) run.items[k].delivered = true;
      run.items[i].loaded = true;
      expect(postHint(run, hintCode(run), false, true).text).toMatch(/^Parcel .*front door/);
   });
});
