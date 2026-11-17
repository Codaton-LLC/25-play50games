// guide.ts: the beacon and the hint follow key -> its door -> next key -> exit, and never touch the run.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { keyName, lockedDoorInReach, nextObjective, objectiveHint, type Objective } from "./guide";
import { createRun } from "./rules";

const goal = (): Objective => ({ kind: "key", index: 0, x: 0, y: 0, z: 0 });

describe("haunted guide", () => {
   it("walks the keys and doors in order, then the exit, on every level", () => {
      for (const id of LEVEL_IDS) {
         for (const seed of [1, 7, 42]) {
            const run = createRun(seed, LEVELS[id]);
            const before = JSON.stringify(run);
            const o = nextObjective(run, goal());
            expect(JSON.stringify(run)).toBe(before);
            expect(o.kind).toBe("key");
            expect(o.index).toBe(0);
            for (let i = 0; i < run.keys.length; i++) {
               run.keys[i].collected = true;
               run.heldKeys[i] = true;
               const atDoor = nextObjective(run, goal());
               expect(atDoor.kind).toBe("door");
               expect(atDoor.index).toBe(i);
               const door = run.doors.find((d) => d.kind === "locked" && d.keyIndex === i)!;
               door.open = true;
               if (door.isExit) run.exitDoorOpen = true;
            }
            expect(nextObjective(run, goal()).kind).toBe("exit");
         }
      }
   });

   it("names the key in the hint and says what to press near it", () => {
      const run = createRun(3, LEVELS[1]);
      const o = nextObjective(run, goal());
      expect(objectiveHint(run, o, false).text).toContain(keyName(0));
      run.hero.x = o.x;
      run.hero.z = o.z;
      expect(objectiveHint(run, o, true).text).toMatch(/hold Use/);
      expect(objectiveHint(run, o, false).text).toMatch(/hold E/);
   });

   it("spots a locked door in reach without its key", () => {
      const run = createRun(5, LEVELS[1]);
      const door = run.doors.find((d) => d.kind === "locked")!;
      run.hero.x = door.x;
      run.hero.z = door.z;
      expect(lockedDoorInReach(run)).toBe(door.keyIndex);
      run.heldKeys[door.keyIndex] = true;
      expect(lockedDoorInReach(run)).toBe(-1);
   });
});
