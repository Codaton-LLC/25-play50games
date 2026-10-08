import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createArcadeStore } from "../useArcadeStore";
import { createGrid, findPath, fixedFrames, followPath, freeGrid, nearestFree, randomFrames, simulateRun, steer } from "./botHarness";

const grid = createGrid({ cell: 0.5, halfX: 5, halfZ: 5 });
/** a wall at x = 0 from z -5 to 3 (0.8 thick): the way round is over its north end; the grid keeps a margin */
const inWall = (x: number, z: number) => Math.abs(x) < 0.4 && z < 3;
const free = freeGrid(grid, (x, z) => !(Math.abs(x) < 0.6 && z < 3.4));

describe("botHarness grid and path", () => {
   it("maps nodes to points and back", () => {
      expect([grid.nx, grid.nz, grid.size]).toEqual([21, 21, 441]);
      const n = grid.node(-2, 1.5);
      expect([grid.x(n), grid.z(n)]).toEqual([-2, 1.5]);
   });

   it("walks round the wall on free nodes without cutting a corner; no path into a walled pocket", () => {
      const p = findPath(grid, free, grid.node(-3, -3), grid.node(3, -3));
      expect(p.length).toBeGreaterThan(0);
      expect(p.every((n) => free[n] === 1)).toBe(true);
      expect(Math.max(...p.map((n) => grid.z(n)))).toBeGreaterThanOrEqual(3.5);
      for (let k = 1; k < p.length; k++) expect(Math.hypot(grid.x(p[k]) - grid.x(p[k - 1]), grid.z(p[k]) - grid.z(p[k - 1]))).toBeLessThanOrEqual(grid.cell * Math.SQRT2 + 1e-9);
      const boxed = freeGrid(grid, (x, z) => Math.max(Math.abs(x), Math.abs(z)) !== 2);
      expect(findPath(grid, boxed, grid.node(0, 0), grid.node(4, 4))).toEqual([]);
   });

   it("nearestFree snaps a blocked point to the closest free node; the follower reaches its goal", () => {
      expect(grid.x(nearestFree(grid, free, 0.1, -2))).toBe(1);
      const f = followPath(grid, free, -3, -3, 3, -3);
      const at = { x: -3, z: -3 };
      const dir = { dirX: 0, dirZ: 0 };
      for (let s = 0; s < 400 && Math.hypot(at.x - 3, at.z + 3) > 0.05; s++) {
         steer(grid, f, at.x, at.z, dir);
         at.x += dir.dirX * 0.05;
         at.z += dir.dirZ * 0.05;
         expect(inWall(at.x, at.z)).toBe(false);
      }
      expect(Math.hypot(at.x - 3, at.z + 3)).toBeLessThanOrEqual(0.05);
   });
});

describe("botHarness simulateRun", () => {
   it("steps exactly the played time: a timed run ends at the timer, a game's end() stops it", () => {
      let played = 0;
      const timed = simulateRun(createArcadeStore(), { durationMs: 5000, frame: randomFrames(3), step: (dt) => (played += dt) });
      expect(timed).toMatchObject({ phase: "over", endReason: "timeup", elapsedMs: 5000 });
      // the frame that hits the timer ends the run: the game does not step in it (phase "over")
      expect(played).toBeLessThanOrEqual(5 + 1e-9);
      expect(played).toBeGreaterThan(5 - 0.05);
      let last = 0;
      const won = simulateRun(createArcadeStore(), {
         frame: fixedFrames(1000 / 60),
         step: (_dt, time, store) => {
            last = time;
            if (time >= 2) store.getState().end("win");
         },
      });
      expect(won.endReason).toBe("win");
      expect(won.elapsedMs / 1000).toBe(last);
      expect(() => simulateRun(createArcadeStore(), { frame: fixedFrames(16), step: () => {}, maxFrames: 100 })).toThrow();
   });

   it("is imported by tests only, never by runtime code", () => {
      const root = path.resolve(__dirname, "../../..");
      const offenders: string[] = [];
      const walk = (dir: string) => {
         for (const name of readdirSync(dir)) {
            const file = path.join(dir, name);
            if (statSync(file).isDirectory()) walk(file);
            else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) && !file.includes(`${path.sep}testing${path.sep}`) && /testing\/botHarness/.test(readFileSync(file, "utf8"))) offenders.push(file);
         }
      };
      walk(root);
      expect(offenders).toEqual([]);
   });
});
