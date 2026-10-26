import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { createRun, doorClosed, doorPoint, objectivesReachable, pointInside, reachWith, standable } from "./rules";

describe("smoke", () => {
   it("builds every level", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 8; seed++) {
            const run = createRun(seed + id * 100, LEVELS[id as LevelId]);
            if (!objectivesReachable(run)) {
               const gone = run.fires.map(() => false);
               const door = run.fires.findIndex((f) => f.door);
               gone[door] = true;
               const civ = run.civilians[run.civilians.length - 1];
               const at = doorPoint(civ.room);
               console.log(id, {
                  closedAfter: doorClosed(run, civ.room, gone),
                  doorStand: standable(run, at.x, at.z, 0.38, gone),
                  insideDoor: pointInside(run, at.x, at.z, 0.38, gone),
                  civStand: standable(run, civ.x, civ.z, 0.38, gone),
                  lane: [-1.2, -1.6, -2.2, -3, -4].map((x) => standable(run, x, civ.z, 0.38, gone)),
                  reach: reachWith(run, gone).civilians,
               });
            }
            expect(objectivesReachable(run)).toBe(true);
         }
      }
   });
});
