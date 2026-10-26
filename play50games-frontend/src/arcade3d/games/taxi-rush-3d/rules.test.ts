import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   CALM_POINTS,
   CLOSE_POINTS,
   CLOSE_R,
   DROP_POINTS,
   DWELL_S,
   PAD_R,
   RADIUS,
   STRIKE,
   TIME_POINTS,
   activePad,
   carsClearBuildings,
   createRun,
   idleInput,
   padsReachable,
   step,
   type Run,
} from "./rules";

function hold(run: Run, seconds: number, timeLeft: number) {
   const n = Math.max(1, Math.round(seconds * 60));
   let ev = step(run, idleInput(), 1 / 60, timeLeft);
   for (let i = 1; i < n; i++) ev = step(run, idleInput(), 1 / 60, timeLeft);
   return ev;
}

describe("taxi layout", () => {
   it("is the same run for the same seed, and every fare is on a reachable centreline", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 200; seed++) {
            const a = createRun(seed, LEVELS[id]);
            const b = createRun(seed, LEVELS[id]);
            expect(a.pads.map((pad) => [pad.x, pad.z])).toEqual(b.pads.map((pad) => [pad.x, pad.z]));
            expect(a.fares).toEqual(b.fares);
            expect(padsReachable(a)).toBe(true);
            expect(carsClearBuildings(a)).toBe(true);
            expect(a.fares.length).toBe(LEVELS[id].rides);
            expect(a.lights.length).toBe(LEVELS[id].lights);
            expect(a.cars.length).toBe(LEVELS[id].traffic);
         }
      }
   });
});

describe("taxi pads, patience and lights", () => {
   it("completes a stop after 0.50 s under 0.5 m/s, and the same window on a full stick", () => {
      const run = createRun(3, LEVELS[1]);
      const pad = activePad(run)!;
      run.x = pad.x;
      run.z = pad.z;
      run.speed = 0.4;
      const early = hold(run, DWELL_S - 1 / 60, 100_000);
      expect(early.pickup).toBe(false);
      const done = step(run, idleInput(), 1 / 30, 100_000);
      expect(done.pickup).toBe(true);
      const touch = createRun(3, LEVELS[1]);
      const key = createRun(3, LEVELS[1]);
      const stick = { moveX: 0.4, moveY: -1 };
      for (let i = 0; i < 90; i++) {
         step(touch, stick, 1 / 60, 100_000);
         step(key, stick, 1 / 60, 100_000);
      }
      expect(touch.x).toBeCloseTo(key.x, 6);
      expect(touch.z).toBeCloseTo(key.z, 6);
      expect(touch.score).toBe(key.score);
      expect(touch.speed).toBeCloseTo(key.speed, 6);
   });

   it("scores a drop-off, the close bonus and the calm bonus, and skips a bonus that was missed", () => {
      const run = createRun(4, LEVELS[1]);
      const timeLeft = 90_000;
      const pickup = activePad(run)!;
      run.x = pickup.x;
      run.z = pickup.z;
      run.speed = 0;
      run.dwell = DWELL_S - 1 / 120;
      expect(step(run, idleInput(), 1 / 60, timeLeft).pickup).toBe(true);
      const drop = activePad(run)!;
      run.x = drop.x + 1.8;
      run.z = drop.z;
      run.speed = 0;
      run.patience = 0.4;
      run.dwell = DWELL_S - 1 / 120;
      expect(Math.hypot(1.8, 0)).toBeGreaterThan(CLOSE_R);
      expect(Math.hypot(1.8, 0)).toBeLessThan(PAD_R);
      const wide = step(run, idleInput(), 1 / 60, timeLeft);
      expect(wide.drop).toBe(true);
      expect(wide.close).toBe(false);
      expect(wide.calm).toBe(false);
      expect(wide.score).toBe(DROP_POINTS);
      const next = activePad(run)!;
      run.x = next.x;
      run.z = next.z;
      run.speed = 0;
      run.dwell = DWELL_S - 1 / 120;
      step(run, idleInput(), 1 / 60, timeLeft);
      const dest = activePad(run)!;
      run.x = dest.x;
      run.z = dest.z;
      run.speed = 0;
      run.patience = 0.8;
      run.dwell = DWELL_S - 1 / 120;
      const close = step(run, idleInput(), 1 / 60, timeLeft);
      expect(close.score).toBe(DROP_POINTS + CLOSE_POINTS + CALM_POINTS);
   });

   it("adds the time bonus only on the winning drop-off", () => {
      const run = createRun(5, LEVELS[1]);
      const timeLeft = 85_000;
      for (let i = 0; i < LEVELS[1].rides; i++) {
         const pad = activePad(run)!;
         run.x = pad.x;
         run.z = pad.z;
         run.speed = 0;
         run.patience = 1;
         run.dwell = DWELL_S - 1 / 120;
         const ev = step(run, idleInput(), 1 / 60, timeLeft);
         if (i < LEVELS[1].rides - 1) expect(ev.won).toBe(false);
         if (ev.pickup) i--;
      }
      expect(run.over).toBe("win");
      expect(run.dropoffs).toBe(3);
      expect(run.fares.length).toBe(3);
      expect(activePad(run)).toBeNull();
      const bonus = TIME_POINTS * Math.floor(timeLeft / 1000);
      expect(run.score).toBe(3 * (DROP_POINTS + CLOSE_POINTS + CALM_POINTS) + bonus);
      const after = run.fares.length;
      step(run, idleInput(), 1 / 60, timeLeft);
      expect(run.fares.length).toBe(after);
      expect(run.dropoffs).toBe(3);
   });

   it("spends patience once per fare and does not open a fare past the quota", () => {
      const run = createRun(6, LEVELS[1]);
      run.patience = 0.00001;
      const ev = step(run, idleInput(), 1 / 60, 100_000);
      expect(ev.miss).toBe(true);
      expect(ev.lives).toBe(1);
      expect(run.misses).toBe(1);
      expect(run.fare).toBe(1);
      expect(run.patience).toBeGreaterThan(0.9);
      hold(run, 1, 100_000);
      expect(run.misses).toBe(1);
      expect(run.livesLost).toBe(1);
      run.fare = run.fares.length - 1;
      run.phase = 0;
      run.patience = 0.00001;
      run.over = null;
      step(run, idleInput(), 1 / 60, 100_000);
      expect(run.phase).toBe(2);
      expect(run.fares.length).toBe(LEVELS[1].rides);
      expect(activePad(run)).toBeNull();
   });

   it("a red light 1 ms before the line is still green, and 1 ms after spends a life", () => {
      let host: { id: LevelId; seed: number; light: number; coord: number } | null = null;
      for (const id of LEVEL_IDS) {
         if (host) break;
         for (let seed = 1; seed <= 20 && !host; seed++) {
            const probe = createRun(seed, LEVELS[id]);
            const line = probe.stops.find((item) => item.ns && item.into === 1 && item.coord > 8 && item.coord < probe.depth - 8 && item.span0 > 4);
            if (line) host = { id, seed, light: line.light, coord: line.coord };
         }
      }
      if (!host) throw new Error("no interior stop line");
      const h = 1 / 120;
      const speed = 5;
      const coast = speed - 0.4 * h;
      const frac = 0.03 / (coast * h);
      const cross = (phase: number) => {
         const sample = createRun(host.seed, LEVELS[host.id]);
         for (const car of sample.cars) {
            car.pin = true;
            car.x = -30;
            car.z = -30;
         }
         const line = sample.stops.find((item) => item.ns && item.into === 1 && item.light === host.light && item.coord === host.coord)!;
         sample.x = (line.span0 + line.span1) / 2;
         sample.z = line.coord - 0.03;
         sample.yaw = 0;
         sample.speed = speed;
         sample.lock = 0;
         sample.time = phase - frac * h - line.light * 1.7;
         return step(sample, idleInput(), h, 100_000);
      };
      expect(cross(3.999).lives).toBe(0);
      const red = cross(4.001);
      expect(red.red).toBe(true);
      expect(red.lives).toBe(1);
   });

   it("a strike above 3 m/s spends a life and a slower hit only nudges", () => {
      const fast = createRun(1, LEVELS[1]);
      for (const car of fast.cars) {
         car.pin = true;
         car.x = -40;
         car.z = -40;
      }
      fast.x = 5.05;
      fast.z = 13;
      fast.yaw = Math.PI / 2;
      fast.speed = 5;
      fast.lock = 0;
      let spent = 0;
      for (let i = 0; i < 8 && spent === 0; i++) spent += step(fast, idleInput(), 1 / 60, 100_000).lives;
      expect(spent).toBe(1);
      expect(fast.speed).toBeLessThan(0);
      expect(fast.x).toBeLessThan(6.4 - RADIUS + 0.05);

      const slow = createRun(1, LEVELS[1]);
      for (const car of slow.cars) {
         car.pin = true;
         car.x = -40;
         car.z = -40;
      }
      slow.x = 5.05;
      slow.z = 13;
      slow.yaw = Math.PI / 2;
      slow.speed = 2;
      slow.lock = 0;
      for (let i = 0; i < 8; i++) step(slow, idleInput(), 1 / 60, 100_000);
      expect(slow.livesLost).toBe(0);
      expect(slow.x).toBeLessThan(6.4);

      const crash = createRun(1, LEVELS[1]);
      for (const car of crash.cars) {
         car.pin = true;
         car.x = -40;
         car.z = -40;
      }
      crash.cars[0].x = 12;
      crash.cars[0].z = 3;
      crash.cars[0].hx = 0.7;
      crash.cars[0].hz = 0.7;
      crash.x = 10;
      crash.z = 3;
      crash.yaw = Math.PI / 2;
      crash.speed = 6;
      crash.lock = 0;
      let lives = 0;
      for (let i = 0; i < 6 && lives === 0; i++) lives += step(crash, idleInput(), 1 / 30, 100_000).lives;
      expect(lives).toBe(1);
      expect(Math.abs(crash.speed)).toBeLessThan(STRIKE);
   });

   it("30 Hz and 60 Hz steering matches, and 144 Hz stays on the same road", () => {
      const coast = (hz: number) => {
         const run = createRun(8, LEVELS[1]);
         const input = { moveX: 0.25, moveY: -1 };
         for (let i = 0; i < hz; i++) step(run, input, 1 / hz, 120_000);
         return run;
      };
      const a = coast(30);
      const b = coast(60);
      const c = coast(144);
      expect(a.x).toBeCloseTo(b.x, 4);
      expect(a.z).toBeCloseTo(b.z, 4);
      expect(a.yaw).toBeCloseTo(b.yaw, 4);
      expect(a.speed).toBeCloseTo(b.speed, 4);
      expect(Math.hypot(a.x - c.x, a.z - c.z)).toBeLessThan(0.05);
   });
});
