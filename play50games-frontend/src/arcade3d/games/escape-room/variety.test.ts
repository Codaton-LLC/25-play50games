import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { createRun, isWalkable, DOOR_POSITION, START } from "./rules";

describe("named room layouts", () => {
   for (const id of [2, 3, 4, 5] as const) {
      it(`L${id}: replaces the old paired rows and keeps every search bay reachable`, () => {
         for (let seed = 0; seed < 30; seed++) {
            const run = createRun(seed, LEVELS[id]);
            expect(run.layout.stations.map((s) => s.z)).not.toEqual(
               Array.from({ length: run.stations.length }, (_, i) => [-3, -1, 1, 3][Math.floor(i / 2)]),
            );
            expect(isWalkable(run.layout, START.x, START.z)).toBe(true);
            expect(isWalkable(run.layout, DOOR_POSITION.x, DOOR_POSITION.z)).toBe(true);
            for (const station of run.layout.stations) {
               const lane = Math.sign(station.x) * 2.5;
               for (let n = 0; n <= 100; n++) {
                  const t = n / 100;
                  expect(isWalkable(run.layout, lane, START.z + (station.z - START.z) * t)).toBe(true);
                  expect(isWalkable(run.layout, lane + (station.x - lane) * t, station.z)).toBe(true);
               }
            }
         }
      });
   }
});
