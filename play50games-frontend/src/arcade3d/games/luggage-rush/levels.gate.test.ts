// Gate pins (2026-10-25 review): each test kills a mutation the level suite let through.
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { PATHS, SEG, beltSpeed, createRun, intervalAt, placeBag, stepRun, type RunState } from "./rules";

const blank = () => ({ flip: [false, false, false, false] as [boolean, boolean, boolean, boolean] });

/** One bag of `flight` just before the end of `segment`, the given choices, one 0.1 s step at `time`. */
function cross(level: (typeof LEVELS)[1], segment: number, flight: number, choices: [number, number, number, number], time: number): RunState {
   const run = createRun(1, level);
   run.nextSpawn = 1e9;
   run.choices = choices;
   const i = placeBag(run, flight, false, false, segment, PATHS[segment].total - 0.05);
   expect(i).toBeGreaterThanOrEqual(0);
   stepRun(run, blank(), 0.1, time);
   return run;
}

/** Every bag the belt spawns up to `until` s (no flips; strikes are reset so the shift goes on), with its spawn time. */
function spawns(level: (typeof LEVELS)[1], until: number, seed: number) {
   const run = createRun(seed, level);
   const out: { t: number; flight: number; heavy: boolean; vip: boolean }[] = [];
   const seen = new Set<number>();
   for (let t = 0.02; t < until; t += 0.02) {
      stepRun(run, blank(), 0.02, t);
      run.strikes = 0;
      run.lost = false;
      for (const b of run.bags) {
         if (!b.alive || seen.has(b.born)) continue;
         seen.add(b.born);
         out.push({ t, flight: b.flight, heavy: b.heavy, vip: b.vip });
      }
   }
   return out;
}

describe("luggage-rush: the level's chute-open times route the bags", () => {
   it("D3 open early (level 3, 35 s): a bag turned into the closed hold strikes; on level 1 it still goes green", () => {
      expect(cross(LEVELS[3], SEG.toD3, 3, [1, 1, 1, 0], 35).strikes).toBe(1);
      const l1 = cross(LEVELS[1], SEG.toD3, 3, [1, 1, 1, 0], 35);
      expect(l1.strikes).toBe(0);
      expect(l1.bags.some((b) => b.alive && b.segment === SEG.chuteG)).toBe(true);
   });

   it("the hold opens at the level's D4 time (level 3, 60 s) and D4 then sends bags to the overflow", () => {
      const held = cross(LEVELS[3], SEG.toD3, 3, [1, 1, 1, 0], 60);
      expect(held.strikes).toBe(0);
      expect(held.bags.some((b) => b.alive && b.segment === SEG.hold)).toBe(true);
      const over = cross(LEVELS[3], SEG.hold, 3, [1, 1, 1, 1], 60);
      expect(over.bags.some((b) => b.alive && b.segment === SEG.overflow)).toBe(true);
      const l1 = cross(LEVELS[1], SEG.hold, 3, [1, 1, 1, 1], 60);
      expect(l1.bags.some((b) => b.alive && b.segment === SEG.overflow)).toBe(false);
   });

   it("the spawn ramp length is read from the level", () => {
      const level = { ...LEVELS[1], spawnRampS: 60 };
      expect(intervalAt(60, level)).toBeCloseTo(level.spawnEnd, 12);
      expect(intervalAt(60, LEVELS[1])).toBeGreaterThan(level.spawnEnd + 0.5);
      expect(intervalAt(30, level)).toBeCloseTo((level.spawnStart + level.spawnEnd) / 2, 12);
   });

   it("late spawns roll heavy against the level's heavyLate share", () => {
      const share = (heavyLate: number) => {
         const late = [0, 1, 2].flatMap((seed) => spawns({ ...LEVELS[1], heavyLate }, 110, seed)).filter((b) => b.t >= 50.5 && !b.vip);
         return late.filter((b) => b.heavy).length / late.length;
      };
      expect(share(0.95)).toBeGreaterThan(0.8);
      expect(share(LEVELS[1].heavyLate)).toBeLessThan(0.35);
   });

   it("yellow bags start at the level's D4 time", () => {
      const yellowBefore70 = (id: 1 | 3) => [0, 1, 2].flatMap((seed) => spawns(LEVELS[id], 69.5, seed)).filter((b) => b.flight === 3).length;
      expect(yellowBefore70(3)).toBeGreaterThan(0);
      expect(yellowBefore70(1)).toBe(0);
   });

   it("bags arrive on the level's spawn interval (level 5 ends at 0.75 s, level 1 at 0.9 s)", () => {
      const minLateGap = (id: 1 | 5) => {
         const t = spawns(LEVELS[id], 135, 2).map((b) => b.t).filter((x) => x >= 121);
         let gap = Infinity;
         for (let i = 1; i < t.length; i++) gap = Math.min(gap, t[i] - t[i - 1]);
         return gap;
      };
      expect(minLateGap(5)).toBeLessThan(0.8);
      expect(minLateGap(1)).toBeGreaterThan(0.85);
   });

   it("the belt steps up on the level's own beat (level 4 every 10 s)", () => {
      expect(beltSpeed(25, LEVELS[4])).toBeCloseTo(LEVELS[4].beltBase * 1.03 ** 2, 12);
      expect(beltSpeed(25, LEVELS[1])).toBeCloseTo(LEVELS[1].beltBase * 1.03, 12);
      expect(beltSpeed(175, LEVELS[4])).toBeCloseTo(LEVELS[4].beltBase * 1.03 ** 17, 12);
   });
});

