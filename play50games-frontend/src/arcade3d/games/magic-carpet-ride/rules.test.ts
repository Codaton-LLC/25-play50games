import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { setEyeRotation } from "@/arcade3d/core/view";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { CAM_BACK, CAM_PITCH, CAM_UP, FOV, LOW_DECOR, decorClearance, decorSpots } from "./looks";
import {
   BOOST_MUL,
   BOOST_S,
   CARPET_R,
   COIN_POINTS,
   CORR_X,
   CORR_Y,
   FINISH_BONUS,
   GEM_POINTS,
   LIFE_BONUS,
   LIVES,
   OBSTACLE_SPEC,
   PASS_R,
   PROPOSED_LEVEL_LIMITS,
   TIME_BONUS_PER_SECOND,
   clearanceFor,
   createRun,
   gapAt,
   isGemGap,
   lineAt,
   objectiveCeiling,
   obstacleClearance,
   obstacleOffset,
   obstacleReach,
   planeGap,
   poseAt,
   ringChainMax,
   ringValue,
   step,
   syncStore,
   type Ring,
   type Run,
} from "./rules";

const flatRing = (): Ring => ({ s: 0, lat: 0, vert: 0, x: 0, y: 10, z: 0, tx: 0, ty: 0, tz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, taken: false, missed: false });
const P = (x: number, y: number, z: number) => ({ x, y, z });
const LINE = { lat: 0, vert: 0 };

/** Fly `seconds` at 60 Hz with a fixed stick. */
function fly(run: Run, moveX: number, moveY: number, seconds: number, timeLeftMs = 60_000) {
   const evs = [];
   for (let t = 0; t < seconds - 1e-9 && !run.over; t += 1 / 60) evs.push({ ...step(run, { moveX, moveY }, 1 / 60, timeLeftMs) });
   return evs;
}

describe("magic carpet layout", () => {
   it("is the same run for the same seed: rings off centre, coins on the racing line, gems alone in their gaps", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(objectiveCeiling(level)).toBe(PROPOSED_LEVEL_LIMITS[id].base);
         for (let seed = 1; seed <= 200; seed++) {
            const a = createRun(seed, level, id);
            const b = createRun(seed, level, id);
            expect(a.path.total).toBeCloseTo(level.length, 1);
            expect(a.rings.map((r) => [r.x, r.y, r.z])).toEqual(b.rings.map((r) => [r.x, r.y, r.z]));
            expect(a.obstacles.map((o) => [o.s, o.lat0, o.vert0])).toEqual(b.obstacles.map((o) => [o.s, o.lat0, o.vert0]));
            expect(a.rings).toHaveLength(level.rings);
            expect(a.coins).toHaveLength(level.coinsPerArc * (level.rings - 1));
            expect(a.gems).toHaveLength(level.gems);
            expect(a.boosts).toHaveLength(level.boosts);
            expect(a.obstacles).toHaveLength(level.obstacles);
            for (const r of a.rings) {
               // an idle carpet (the lane's centre) never passes a ring
               expect(Math.hypot(r.lat, r.vert)).toBeGreaterThanOrEqual(2.2 - 1e-9);
               expect(Math.abs(r.lat)).toBeLessThanOrEqual(CORR_X);
               expect(Math.abs(r.vert)).toBeLessThanOrEqual(CORR_Y);
            }
            for (const c of a.coins) {
               lineAt(a, c.s, LINE);
               expect(c.lat).toBeCloseTo(LINE.lat, 9);
               expect(c.vert).toBeCloseTo(LINE.vert, 9);
               expect(Math.abs(c.vert)).toBeLessThanOrEqual(CORR_Y);
            }
            for (const g of a.gems) {
               expect(isGemGap(g.gap)).toBe(true);
               expect(Math.abs(g.lat)).toBeLessThanOrEqual(CORR_X);
               expect(Math.abs(g.vert)).toBeLessThanOrEqual(CORR_Y);
            }
            for (const o of a.obstacles) {
               const gap = gapAt(a, o.s);
               expect(gap).toBeGreaterThanOrEqual(1);
               expect(isGemGap(gap)).toBe(false);
               expect(level.kinds).toContain(o.kind);
            }
         }
      }
   }, 120_000);

   it("every reach of every obstacle keeps its radius + the carpet's + the margin clear of the racing line", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, LEVELS[id], id);
            for (const o of run.obstacles) expect(obstacleClearance(run, o)).toBeGreaterThanOrEqual(clearanceFor(o.kind) - 1e-9);
         }
      }
   }, 120_000);

   it("an obstacle's swing stays inside its reach box", () => {
      const run = createRun(7, LEVELS[5], 5);
      for (const o of run.obstacles) {
         const box = obstacleReach(o);
         for (let t = 0; t < 20; t += 0.37) {
            obstacleOffset(o, t, LINE);
            expect(LINE.lat).toBeGreaterThanOrEqual(box.minLat - 1e-9);
            expect(LINE.lat).toBeLessThanOrEqual(box.maxLat + 1e-9);
            expect(LINE.vert).toBeGreaterThanOrEqual(box.minVert - 1e-9);
            expect(LINE.vert).toBeLessThanOrEqual(box.maxVert + 1e-9);
         }
      }
      expect(OBSTACLE_SPEC.blimp.r).toBeGreaterThan(OBSTACLE_SPEC.gull.r);
   });

   it("the dressing that reaches the lane's height keeps clear of the lane", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 6; seed++) {
            const run = createRun(seed, LEVELS[id], id);
            const spots = decorSpots(run, LEVELS[id].biome);
            for (const [kind, list] of Object.entries(spots)) {
               if (LOW_DECOR.has(kind as never) || kind === "palace") continue;
               for (const spot of list) expect(decorClearance(run, spot) - Math.hypot(spot.sx ?? 1, spot.sz ?? 1) / 2).toBeGreaterThanOrEqual(CORR_X + 1.5 - 1e-6);
            }
         }
      }
   }, 60_000);
});

describe("magic carpet scoring", () => {
   it("a ring chain pays 50, 75, 100, 125, then 150 per ring; the ceiling counts every object once", () => {
      expect([1, 2, 3, 4, 5, 6, 9].map(ringValue)).toEqual([50, 75, 100, 125, 150, 150, 150]);
      expect(ringChainMax(3)).toBe(225);
      expect(ringChainMax(10)).toBe(50 + 75 + 100 + 125 + 150 * 6);
      const level = LEVELS[1];
      expect(objectiveCeiling(level)).toBe(ringChainMax(level.rings) + COIN_POINTS * level.coinsPerArc * (level.rings - 1) + GEM_POINTS * level.gems);
   });

   it("a ring pays at 1.39 m from its centre and not at 1.41 m; only a forward cross counts", () => {
      const ring = flatRing();
      expect(planeGap(P(1.39, 10, -1), P(1.39, 10, 1), ring)).toBeLessThanOrEqual(PASS_R);
      expect(planeGap(P(1.41, 10, -1), P(1.41, 10, 1), ring)!).toBeGreaterThan(PASS_R);
      expect(planeGap(P(0, 10, 1), P(0, 10, -1), ring)).toBeNull();
   });

   it("following the racing line passes every ring in one chain and every coin", () => {
      const run = createRun(3, LEVELS[1], 1);
      // a perfect line pilot: put the carpet on the line every frame (the rules allow any offset)
      while (!run.over) {
         lineAt(run, run.s + LEVELS[1].speed / 60, LINE);
         run.lat = LINE.lat;
         run.vert = LINE.vert;
         step(run, { moveX: 0, moveY: 0 }, 1 / 60, 40_000);
      }
      expect(run.over).toBe("win");
      expect(run.ringsPassed).toBe(LEVELS[1].rings);
      expect(run.bestChain).toBe(LEVELS[1].rings);
      expect(run.coinsTaken).toBe(run.coins.length);
      expect(run.lives).toBe(LIVES);
      const objects = ringChainMax(LEVELS[1].rings) + COIN_POINTS * run.coins.length + GEM_POINTS * run.gemsTaken;
      expect(run.score).toBe(objects + FINISH_BONUS + LIFE_BONUS * LIVES + TIME_BONUS_PER_SECOND * 40);
   });

   it("missing a ring breaks the chain; a finish short of the quota loses without the bonus", () => {
      const run = createRun(5, LEVELS[1], 1);
      fly(run, 0, 0, 120);
      expect(run.ringsPassed).toBe(0);
      expect(run.rings.every((r) => r.missed)).toBe(true);
      expect(run.over).toBe("lose");
      expect(run.score).toBe(COIN_POINTS * run.coinsTaken + GEM_POINTS * run.gemsTaken);
   });

   it("an obstacle costs a life, breaks the chain and grants a mercy; the third hit ends the run", () => {
      const run = createRun(11, LEVELS[5], 5);
      const o = run.obstacles[0];
      run.chain = 4;
      // park the carpet just before the obstacle, on it
      run.s = o.s - 0.3;
      run.time = 0;
      obstacleOffset(o, 1 / 60, LINE);
      run.lat = LINE.lat;
      run.vert = LINE.vert;
      run.mercy = 0;
      const ev = step(run, { moveX: 0, moveY: 0 }, 1 / 60, 60_000);
      expect(ev.lifeLost).toBe(true);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.chain).toBe(0);
      expect(run.mercy).toBeGreaterThan(1);
      // inside the mercy the same obstacle does nothing
      run.s = o.s - 0.2;
      expect(step(run, { moveX: 0, moveY: 0 }, 1 / 60, 60_000).lifeLost).toBe(false);
      expect(CARPET_R).toBeGreaterThan(0);
   });
});

describe("magic carpet flight", () => {
   it("steers freely: the drift follows the stick, stays where it is left, stops at the lane's walls; up is up", () => {
      const run = createRun(1, LEVELS[1], 1);
      fly(run, 1, 0, 0.5);
      const lat = run.lat;
      expect(lat).toBeGreaterThan(1.5);
      fly(run, 0, 0, 0.8);
      // eases to a stop and keeps the offset
      expect(Math.abs(run.vLat)).toBeLessThan(0.05);
      expect(run.lat).toBeGreaterThan(lat);
      fly(run, 1, 0, 3);
      expect(run.lat).toBe(CORR_X);
      fly(run, 0, -1, 2);
      expect(run.vert).toBe(CORR_Y);
      fly(run, -1, 1, 4);
      expect(run.lat).toBe(-CORR_X);
      expect(run.vert).toBe(-CORR_Y);
      // the bank leans into the drift: a slide right dips the right edge (a positive roll)
      fly(run, 1, 0, 0.2);
      expect(run.roll).toBeGreaterThan(0);
   });

   it("a boost flies BOOST_MUL x faster for BOOST_S", () => {
      const run = createRun(2, LEVELS[1], 1);
      const b = run.boosts[0];
      run.s = b.s - 0.5;
      run.lat = b.lat;
      run.vert = b.vert;
      step(run, { moveX: 0, moveY: 0 }, 1 / 60, 60_000);
      expect(run.boostT).toBeCloseTo(BOOST_S, 9);
      const s0 = run.s;
      step(run, { moveX: 0, moveY: 0 }, 0.1, 60_000);
      expect(run.s - s0).toBeCloseTo(LEVELS[1].speed * BOOST_MUL * 0.1, 6);
      fly(run, 0, 0, BOOST_S);
      const s1 = run.s;
      step(run, { moveX: 0, moveY: 0 }, 0.1, 60_000);
      expect(run.s - s1).toBeCloseTo(LEVELS[1].speed * 0.1, 6);
   });

   it("syncStore makes exactly the Scene's store calls: score, stats, a life, the end", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 75_000, lives: LIVES, resultDelayMs: 0 });
      store.getState().markReady();
      store.getState().start();
      store.getState().tick(3100);
      const run = createRun(3, LEVELS[1], 1);
      while (!run.over) {
         lineAt(run, run.s + LEVELS[1].speed / 60, LINE);
         run.lat = LINE.lat;
         run.vert = LINE.vert;
         syncStore(run, step(run, { moveX: 0, moveY: 0 }, 1 / 60, 40_000), store);
      }
      const s = store.getState();
      expect(s.phase).toBe("over");
      expect(s.endReason).toBe("win");
      expect(s.score).toBe(run.score);
      expect(s.stats.rings).toBe(run.ringsPassed);
      expect(s.stats.progress).toBe(100);
      expect(s.stats.need).toBe(0);
   });
});

describe("magic carpet controls as seen on screen", () => {
   /** The carpet's screen position (NDC x, y) from the Scene's chase camera placed for lane offset (lat0, vert0) at s0. */
   function screen(run: Run, s0: number, lat0: number, vert0: number): { x: number; y: number } {
      const cam = new PerspectiveCamera(FOV, 16 / 10, 0.1, 500);
      const at = { x: 0, y: 0, z: 0 };
      const ahead = { x: 0, y: 0, z: 0 };
      poseAt(run.path, s0 - CAM_BACK, lat0, vert0 + CAM_UP, run.scratch, at);
      poseAt(run.path, s0 + 10, lat0, vert0, run.scratch, ahead);
      cam.position.set(at.x, at.y, at.z);
      setEyeRotation(cam.rotation, Math.atan2(ahead.x - at.x, ahead.z - at.z), CAM_PITCH);
      cam.updateMatrixWorld(true);
      const p = new Vector3(run.carpet.x, run.carpet.y, run.carpet.z).project(cam);
      return { x: p.x, y: p.y };
   }

   it("right (D, the right arrow, the stick right) moves the carpet screen-right, left moves it screen-left; up flies up", () => {
      for (const id of LEVEL_IDS) {
         for (const [moveX, moveY, dx, dy] of [
            [1, 0, 1, 0],
            [-1, 0, -1, 0],
            [0, -1, 0, 1],
            [0, 1, 0, -1],
         ] as const) {
            // the same flight twice from the same seed: straight on, and with the stick held for 0.3 s;
            // both seen from a camera at the lane's centre behind the carpet, so only the carpet's move shows
            const run = createRun(4, LEVELS[id], id);
            fly(run, 0, 0, 0.5);
            fly(run, moveX, moveY, 0.3);
            const ref = createRun(4, LEVELS[id], id);
            fly(ref, 0, 0, 0.8);
            expect(run.s).toBeCloseTo(ref.s, 6);
            const moved = screen(run, run.s, 0, 0);
            const still = screen(ref, ref.s, 0, 0);
            if (dx) expect(Math.sign(moved.x - still.x), `L${id} moveX ${moveX}`).toBe(dx);
            if (dy) expect(Math.sign(moved.y - still.y), `L${id} moveY ${moveY}`).toBe(dy);
         }
      }
   });
});
