// guide.ts: one line for the open tasks.
import { describe, expect, it } from "vitest";
import { hintFor, type TaskStat } from "./guide";

const none: TaskStat = { platform: -1, passenger: false, held: false };

describe("train-station-rush guide", () => {
   it("is empty without a task and names the platform of the first open one", () => {
      expect(hintFor([none, none]).text).toBeNull();
      expect(hintFor([{ platform: 2, passenger: false, held: false }, none]).text).toMatch(/bag.*platform 3/);
      expect(hintFor([none, { platform: 0, passenger: true, held: false }]).text).toMatch(/passenger.*platform 1/);
   });

   it("prefers the task in hand and says carry", () => {
      const h = hintFor([{ platform: 1, passenger: false, held: false }, { platform: 3, passenger: false, held: true }]);
      expect(h.text).toMatch(/Carry the bag to platform 4/);
      expect(h.tone).toBe("carry");
      expect(hintFor([{ platform: 1, passenger: true, held: true }, none]).text).toMatch(/passenger to platform 2/);
   });
});
