import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { stepPendulum2D } from "@/arcade3d/core/kinematics";
import { createPath } from "@/arcade3d/core/path";
import { deliveryDroneMeta } from "./meta";
import { BATTERY, CITY, DRONE, ROUTE, WINCH, createRun, generateCity, isValidCity, stepRun, stepWinch, deliveryPoints, predictDrop, releaseParcel, roofAt } from "./rules";

const idle = { dirX: 0, dirZ: 0, drop: false };
function advance(run: ReturnType<typeof createRun>, seconds: number, input = idle) {
   for (let t = 0; t < seconds - 1e-9; t += 0.05) stepRun(run, input, Math.min(0.05, seconds - t));
}

describe("Delivery Drone deterministic city", () => {
   it("pins the approved cadence and finite limits", () => {
      expect([CITY.pitch, CITY.half, DRONE.speed, DRONE.accel, DRONE.drag]).toEqual([7.5, 30, 9, 10, 10 / 9]);
      expect([ROUTE.count, ROUTE.loading, ROUTE.ceiling, BATTERY.recharge, WINCH.length]).toEqual([12, 4, 180, 12, 2]);
   });
   it("has twelve unique reachable ordinary roofs in three bands over 1,000 seeds", () => {
      for (let seed = 0; seed < 1000; seed++) {
         const city = generateCity(seed);
         expect(isValidCity(city)).toBe(true);
         expect(new Set(city.targets).size).toBe(12);
         expect(city.buildings.filter((b) => b.tower)).toHaveLength(8);
         for (let n = 0; n < 12; n++) {
            const b = city.buildings[city.targets[n]];
            const d = Math.hypot(b.x, b.z);
            expect(b.tower).toBe(false);
            expect(d).toBeGreaterThanOrEqual([10, 18, 25][Math.floor(n / 4)]);
            expect(d).toBeLessThanOrEqual([18, 25, 35][Math.floor(n / 4)]);
         }
      }
   }, 60000);
   it("replays the same seed and controls", () => {
      const a = createRun(34), b = createRun(34);
      advance(a, 10, { dirX: 0.7, dirZ: -0.3, drop: true });
      advance(b, 10, { dirX: 0.7, dirZ: -0.3, drop: true });
      expect(a.drone).toEqual(b.drone);
      expect(a.city).toEqual(b.city);
      expect(a.battery).toBe(b.battery);
   });
   it("rejects duplicated pads, wrong bands and target towers", () => {
      const city = generateCity(42);
      const target = city.targets[0];
      city.targets[1] = target; expect(isValidCity(city)).toBe(false);
      const next = generateCity(42); next.buildings[next.targets[0]].tower = true;
      expect(isValidCity(next)).toBe(false);
      const last = generateCity(42); [last.targets[0], last.targets[8]] = [last.targets[8], last.targets[0]];
      expect(isValidCity(last)).toBe(false);
   });
   it("stops rejection at 32 candidates and uses the fixed validated fallback", () => {
      let attempts = 0;
      const fallback = generateCity(1, () => { attempts++; return false; });
      expect(attempts).toBe(32); expect(fallback.fallback).toBe(true); expect(isValidCity(fallback)).toBe(true);
      expect(fallback).toEqual(generateCity(900, () => false));
   });
   it("rejects a depot wind zone and an unsafe pigeon loop", () => {
      const wind = generateCity(4); wind.winds[0].x = wind.winds[0].z = 0;
      expect(isValidCity(wind)).toBe(false);
      const bird = generateCity(4); bird.birds[0] = createPath([{ x: 0, y: 4, z: 0 }, { x: 3, y: 4, z: 0 }], { closed: true });
      expect(isValidCity(bird)).toBe(false);
   });
});

describe("loading, flight and score", () => {
   it("pickup assigns ordinary parcels through eight deliveries and fragile parcels thereafter", () => {
      for (const completed of [0, 7, 8, 9, 11]) {
         const run = createRun(40); run.completed = completed;
         run.fragile = completed < 8; // Opposite value proves pickup assigns the flag.
         advance(run, 4);
         expect(run.attached).toBe(true);
         expect(run.fragile).toBe(completed >= 8);
      }
   });
   it("steady pickup runs damp the same unforced swing more than normal runs", () => {
      const normal = createRun(40, false), steady = createRun(40, true);
      for (const run of [normal, steady]) {
         advance(run, 4);
         run.swing.x.x = 0.2; run.swing.z.x = -0.15;
      }
      let normalPeak = 0, steadyPeak = 0;
      for (let n = 0; n < 180; n++) {
         stepRun(normal, idle, 1 / 60); stepRun(steady, idle, 1 / 60);
         if (n >= 120) {
            normalPeak = Math.max(normalPeak, Math.hypot(normal.swing.x.x, normal.swing.z.x));
            steadyPeak = Math.max(steadyPeak, Math.hypot(steady.swing.x.x, steady.swing.z.x));
         }
      }
      expect(normal.attached && steady.attached).toBe(true);
      expect(normalPeak).toBeGreaterThan(0.01);
      expect(steadyPeak).toBeLessThan(normalPeak * 0.6);
   });
   it("requires four continuous seconds and awards nothing for loading", () => {
      const run = createRun(1);
      advance(run, 3.99);
      expect(run.attached).toBe(false);
      advance(run, 0.01);
      expect(run.attached).toBe(true);
      expect(run.pickupAt).toBeCloseTo(4, 8);
      expect(run.score).toBe(0);
      expect(run.battery).toBeCloseTo(96, 7);
   });
   it("resets loading on movement, caps diagonal speed and world bounds", () => {
      const run = createRun(9);
      advance(run, 2);
      advance(run, 1, { dirX: 1, dirZ: 1, drop: false });
      expect(run.loading).toBe(0);
      advance(run, 25, { dirX: 1, dirZ: 1, drop: false });
      expect(Math.hypot(run.drone.vx, run.drone.vz)).toBeLessThanOrEqual(9 + 1e-8);
      expect(Math.abs(run.drone.x)).toBeLessThanOrEqual(29.5);
      expect(Math.abs(run.drone.z)).toBeLessThanOrEqual(29.5);
   });
   it("grades ordinary, fragile and express boundaries", () => {
      expect(deliveryPoints(100, false, 10)).toBe(300);
      expect(deliveryPoints(0, false, 10.001)).toBe(150);
      expect(deliveryPoints(39, true, 1)).toBe(0);
      expect(deliveryPoints(40, true, 10)).toBe(240);
   });
   it("drops with actual two-axis cable velocity and shares preview with impact", () => {
      const run = createRun(12);
      advance(run, 4);
      const b = run.city.buildings[run.city.targets[0]];
      run.drone.x = b.x; run.drone.z = b.z; run.drone.y = b.height + 3;
      run.drone.vx = 0.4; run.drone.vz = -0.2;
      run.swing.x.x = 0.1; run.swing.z.x = -0.1;
      run.swing.x.v = 0.2; run.swing.z.v = 0.3;
      predictDrop(run, run.preview);
      const predicted = { ...run.preview };
      releaseParcel(run);
      expect(run.fall.vx).toBeCloseTo(0.8);
      expect(run.fall.vz).toBeCloseTo(0.4);
      expect(run.impact).toEqual(predicted);
      advance(run, predicted.time + 0.01);
      expect(run.completed).toBe(1);
      expect(run.score).toBeGreaterThanOrEqual(150);
      const score = run.score;
      advance(run, 1, { ...idle, drop: true });
      expect(run.score).toBe(score);
   });
   it("expires idle at exactly 100 seconds without resurrection", () => {
      const run = createRun(0);
      advance(run, 100);
      expect(run.reason).toBe("lose");
      expect(run.time).toBeCloseTo(100, 7);
      expect(run.score).toBe(0);
      const snapshot = [run.time, run.battery, run.drone.x];
      advance(run, 5, { dirX: 1, dirZ: 0, drop: true });
      expect([run.time, run.battery, run.drone.x]).toEqual(snapshot);
   });
   it("matches the exact still-air acceleration curve before obstacles", () => {
      const run = createRun(2);
      advance(run, 0.5, { dirX: 1, dirZ: 0, drop: false });
      expect(run.drone.vx).toBeCloseTo(9 * (1 - Math.exp(-0.5 / 0.9)), 7);
      expect(run.drone.x).toBeCloseTo(9 * (0.5 - 0.9 * (1 - Math.exp(-0.5 / 0.9))), 5);
   });
   it("keeps the diagonal parcel sweep above ordinary roofs", () => {
      const run = createRun(77); advance(run, 4);
      const b = run.city.buildings[run.city.targets[0]];
      run.drone.x = b.x - 3.45; run.drone.z = b.z - 3.45;
      run.swing.x.x = run.swing.z.x = 0.35;
      stepRun(run, idle, 1 / 60);
      expect(run.drone.y).toBeGreaterThanOrEqual(roofAt(run.city, run.drone.x, run.drone.z) + 2.6);
      expect(run.parcel.y - 0.2).toBeGreaterThanOrEqual(b.height);
   });
   it("has one damage cooldown for simultaneous walls and no resting-contact farming", () => {
      const run = createRun(19); advance(run, 4);
      const tower = run.city.buildings[run.city.towers[0]];
      run.drone.x = tower.box.min.x - 0.51; run.drone.z = tower.z; run.drone.vx = 9;
      const before = run.battery;
      advance(run, 0.05, { dirX: 1, dirZ: 0, drop: false });
      expect(run.battery).toBeCloseTo(before - 3.05, 6);
      expect(run.events.hit).toBe(true);
      const hitAt = run.damageAt;
      advance(run, 0.5, { dirX: 1, dirZ: 0, drop: false });
      expect(run.damageAt).toBe(hitAt);
   });
});

function targetFixture(completed = 0) {
   const run = createRun(40); advance(run, 4);
   run.completed = completed; run.fragile = completed >= 8;
   const b = run.city.buildings[run.city.targets[completed]];
   run.drone.x = b.x; run.drone.z = b.z; run.drone.y = b.height + 3;
   run.altitude.x = run.drone.y; run.altitude.v = 0;
   return run;
}
describe("physical impacts and terminal precedence", () => {
   it("grades centre, exact rim, outside rim and fragile 39/40", () => {
      for (const [offset, valid, precision] of [[0, true, 100], [1.25, true, 0], [1.251, false, 0]] as const) {
         const run = targetFixture(); run.drone.x += offset; predictDrop(run, run.preview);
         expect(run.preview.valid).toBe(valid); expect(run.preview.precision).toBe(precision);
      }
      const fragile = targetFixture(8); fragile.drone.x += 0.755;
      predictDrop(fragile, fragile.preview); expect(fragile.preview.valid).toBe(false);
      fragile.drone.x -= 0.01; predictDrop(fragile, fragile.preview); expect(fragile.preview.valid).toBe(true);
   });
   it("express grades pickup age rather than release age at the real landing", () => {
      for (const [pickupAge, releaseAge, score] of [[11, 1, 250], [1, 11, 300]] as const) {
         const run = targetFixture();
         run.time = 30; run.pickupAt = run.time - pickupAge;
         releaseParcel(run);
         // Independent timestamp fixture: the reverse case is deliberately impossible in
         // chronological play, so replacing pickupAt with fallAt cannot pass either branch.
         run.fallAt = run.time - releaseAge;
         stepRun(run, idle, 0.01);
         expect(run.completed).toBe(1);
         expect(run.score).toBe(score);
      }
   });
   it("awards once, caps recharge and completes the twelfth roof as win", () => {
      const run = targetFixture(11); run.battery = 99;
      releaseParcel(run); advance(run, run.impact.time + 0.01);
      expect(run.reason).toBe("win"); expect(run.completed).toBe(12);
      expect(run.score).toBe(300); expect(run.battery).toBe(100);
      const score = run.score; stepRun(run, { ...idle, drop: true }, 0.05); expect(run.score).toBe(score);
   });
   it("uses the first side face, retains a missed target and refuses loading during a fall", () => {
      const run = targetFixture(), target = run.city.targets[0], b = run.city.buildings[target];
      run.drone.x = b.x - 3; run.drone.y = b.height + 1.9; run.drone.vx = 9;
      predictDrop(run, run.preview);
      expect(run.preview.building).toBe(target); expect(run.preview.roof).toBe(false); expect(run.preview.valid).toBe(false);
      expect(run.preview.x).toBeCloseTo(b.x - 2.5, 6);
      releaseParcel(run);
      run.drone.x = run.drone.z = 0; run.drone.vx = 0;
      stepRun(run, idle, run.impact.time / 2); expect(run.loading).toBe(0);
      advance(run, run.impact.time); expect(run.completed).toBe(0); expect(run.score).toBe(0);
      expect(run.city.targets[run.completed]).toBe(target);
   });
   it("handles upward and downward release velocities with the same analytic preview", () => {
      for (const vy of [-2, 2]) {
         const run = targetFixture(); run.altitude.v = vy; predictDrop(run, run.preview);
         const expected = (vy + Math.sqrt(vy * vy + 2 * 9.81 * 0.6)) / 9.81;
         expect(run.preview.time).toBeCloseTo(expected, 7);
         releaseParcel(run); expect(run.impact).toEqual(run.preview);
         advance(run, expected + 0.01); expect(run.completed).toBe(1);
      }
   });
   it("makes a pigeon contact release once, including a simultaneous manual drop", () => {
      const run = createRun(2); advance(run, 4);
      run.city.birds[0] = createPath([{ x: 0, y: 3, z: 0 }], { closed: true }); run.city.birdOffsets[0] = 0;
      run.birds[0].x = run.birds[0].z = 0; run.birds[0].y = 3;
      const before = run.battery;
      stepRun(run, idle, 0.01);
      expect(run.events.release).toBe(true); expect(run.attached).toBe(false); expect(run.falling).toBe(true);
      expect(run.battery).toBeCloseTo(before - 0.01, 7);
      const at = run.fallAt;
      stepRun(run, { ...idle, drop: true }, 0.01);
      expect(run.fallAt).toBe(at); expect(run.events.release).toBe(false);
   });
   it("battery expiry and hard ceiling suppress a simultaneous successful impact", () => {
      const expiry = targetFixture(); releaseParcel(expiry);
      expiry.battery = expiry.impact.time; advance(expiry, expiry.impact.time + 0.1);
      expect(expiry.reason).toBe("lose"); expect(expiry.score).toBe(0);
      const ceiling = targetFixture(); releaseParcel(ceiling);
      ceiling.time = 180 - ceiling.impact.time; ceiling.fallAt = ceiling.time;
      advance(ceiling, ceiling.impact.time + 0.1);
      expect(ceiling.reason).toBe("timeup"); expect(ceiling.score).toBe(0);
   });
   it("breaks attached loads on tower walls without a score or extra battery penalty", () => {
      const run = createRun(4); advance(run, 4);
      const tower = run.city.buildings[run.city.towers[0]];
      // Start the parcel 0.05 m into the wall, clear of the drone's 0.5 m radius.
      // Exact tangency at 0.9 m can round outside the box before the swing decays.
      run.drone.x = tower.box.min.x - 0.85; run.drone.z = tower.z;
      run.swing.x.x = 0.35; run.drone.vx = 0;
      const battery = run.battery; stepRun(run, idle, 0.05);
      expect(run.attached).toBe(false); expect(run.falling).toBe(false);
      expect(run.events.miss).toBe(true); expect(run.events.hit).toBe(false);
      expect(run.score).toBe(0); expect(run.battery).toBeCloseTo(battery - 0.05, 8);
      stepRun(run, idle, 0.05);
      expect(run.events.miss).toBe(false); expect(run.score).toBe(0);
      expect(run.battery).toBeCloseTo(battery - 0.1, 8);
   });
   it("re-arms a downward warning only above 25 percent", () => {
      const run = createRun(2); run.battery = 20.01; stepRun(run, idle, 0.02);
      expect(run.events.warning).toBe(true); stepRun(run, idle, 0.02); expect(run.events.warning).toBe(false);
      run.battery = 26; stepRun(run, idle, 0.02);
      run.battery = 20; stepRun(run, idle, 0.02); expect(run.events.warning).toBe(true);
   });
   it("applies wind at inclusive minimum and exclusive maximum zone edges", () => {
      for (const edge of [-4, 4]) {
         const run = createRun(6); run.time = 60; run.city.towers = [];
         const w = run.city.winds[0]; w.ax = 1.5; w.az = 0;
         run.drone.x = w.x + edge; run.drone.z = w.z;
         stepRun(run, idle, 1 / 120);
         expect(run.drone.vx).toBeCloseTo(edge === -4 ? 1.5 / (10 / 9) * (1 - Math.exp(-(10 / 9) / 120)) : 0, 7);
      }
   });
   it("throttles two simultaneous tower contacts globally", () => {
      const run = createRun(18); run.time = 10; run.attached = false;
      const first = run.city.buildings[run.city.towers[0]], second = run.city.buildings[run.city.towers[1]];
      first.box = { min: { x: 0, y: 0, z: -10 }, max: { x: 1, y: 16, z: 10 } };
      second.box = { min: { x: -10, y: 0, z: 0 }, max: { x: 10, y: 16, z: 1 } };
      run.city.towers = [run.city.towers[0], run.city.towers[1]];
      run.drone.x = run.drone.z = -0.6; run.drone.vx = run.drone.vz = 6.3;
      stepRun(run, { dirX: 1, dirZ: 1, drop: false }, 0.05);
      expect(run.battery).toBeCloseTo(96.95, 6);
      expect(run.events.hit).toBe(true);
   });
   it("consumes all frame time and loading identically under different partitions", () => {
      const a = createRun(9), b = createRun(9), c = createRun(9);
      advance(a, 5);
      for (let i = 0; i < 300; i++) stepRun(b, idle, 1 / 60);
      const rng = randomFrames(44); let t = 0;
      while (t < 5 - 1e-9) { const dt = Math.min(rng(), 5 - t); stepRun(c, idle, dt); t += dt; }
      for (const run of [b, c]) {
         expect(run.pickupAt).toBeCloseTo(a.pickupAt, 7); expect(run.battery).toBeCloseTo(a.battery, 7); expect(run.time).toBeCloseTo(5, 7);
      }
   });
   it("counts countdown remainder and clamps raw stalls without advancing pauses", () => {
      const store = createArcadeStore(); store.getState().configure({}); store.getState().markReady(); store.getState().start();
      for (let i = 0; i < 59; i++) advanceRunClock(store, 0.05);
      advanceRunClock(store, 0.07);
      expect(playedFrameDt(store.getState())).toBeCloseTo(0);
      advanceRunClock(store, 0.3);
      expect(playedFrameDt(store.getState())).toBeCloseTo(0.05);
      store.getState().pause(); const elapsed = store.getState().elapsedMs;
      advanceRunClock(store, 0.3); expect(store.getState().elapsedMs).toBe(elapsed); expect(playedFrameDt(store.getState())).toBe(0);
   });
});

describe("two-axis cable stability", () => {
   it("dissipates unforced energy for both damping modes over 60 seconds", () => {
      for (const damping of [1.2, 2.4]) {
         const swing = { x: { x: 0.3, v: 0.2 }, z: { x: -0.25, v: -0.1 } };
         const energy = () => 0.5 * (swing.x.v ** 2 + swing.z.v ** 2 + 9.81 / 2 * (swing.x.x ** 2 + swing.z.x ** 2));
         let previous = energy();
         const peak = previous;
         for (let i = 0; i < 7200; i++) { stepPendulum2D(swing, 1 / 120, { length: 2, gravity: 9.81, damping }, { x: 0, z: 0 }); const next = energy(); expect(next).toBeLessThanOrEqual(previous + 1e-12); previous = next; }
         expect(previous).toBeLessThan(1e-20);
         console.info("P-15 unforced cable energy", JSON.stringify({ damping, peak, final: previous }));
      }
   });
   it("bounds every axis under adversarial alternating acceleration", () => {
      const report = [];
      for (const steady of [false, true]) {
         const swing = { x: { x: 0, v: 0 }, z: { x: 0, v: 0 } };
         let peak = 0, clampX = 0, clampZ = 0, final = 0;
         for (let i = 0; i < 21600; i++) {
            const sign = Math.floor(i / 120) % 2 ? 1 : -1;
            stepWinch(swing, steady, 1 / 120, { x: sign * 10 * 0.35 / Math.SQRT2, z: -sign * 10 * 0.35 / Math.SQRT2 });
            const e = 0.5 * (swing.x.v ** 2 + swing.z.v ** 2 + 9.81 / 2 * (swing.x.x ** 2 + swing.z.x ** 2));
            peak = Math.max(peak, e);
            final = e;
            if (Math.abs(swing.x.x) >= 0.35) clampX++;
            if (Math.abs(swing.z.x) >= 0.35) clampZ++;
            expect(Math.abs(swing.x.x)).toBeLessThanOrEqual(0.35); expect(Math.abs(swing.z.x)).toBeLessThanOrEqual(0.35);
            expect(Math.abs(swing.x.v)).toBeLessThanOrEqual(1.5); expect(Math.abs(swing.z.v)).toBeLessThanOrEqual(1.5);
         }
         report.push({ steady, peak, final, clampXSeconds: clampX / 120, clampZSeconds: clampZ / 120, clampXFraction: clampX / 21600, clampZFraction: clampZ / 21600 });
      }
      console.info("P-15 adversarial cable measurements", JSON.stringify(report));
   });
});

describe("real-store scoring proof", () => {
   it("idle, spam and collision controls obey limits across 16 seeds in both damping modes", () => {
      for (let steady = 0; steady < 2; steady++) for (let variant = 0; variant < 3; variant++) {
         for (let seed = 0; seed < 16; seed++) {
            const run = createRun(seed, !!steady);
            // Long survival runs use the legal 50 ms clock cap; 2 seeds also vary frames.
            const frame = seed < 14 ? fixedFrames(50) : randomFrames(seed);
            const input = { dirX: variant === 2 ? 1 : 0, dirZ: variant === 2 ? 0.7 : 0, drop: variant !== 0 };
            let maxRateExcess = -Infinity;
            const final = simulateRun(createArcadeStore(), { frame, step: (dt, _time, store) => {
               stepRun(run, input, dt);
               const s = store.getState();
               if (run.events.score > 0) s.addScore(run.events.score);
               maxRateExcess = Math.max(maxRateExcess, store.getState().score - (300 + 75 * s.elapsedMs / 1000));
               if (run.reason) s.end(run.reason);
            } });
            expect(maxRateExcess).toBeLessThanOrEqual(1e-8);
            expect(withinServerLimits(final.score, final.elapsedMs, deliveryDroneMeta.scoring)).toBe(true);
            expect(capScore(final.score, final.elapsedMs, deliveryDroneMeta.scoring)).toBe(final.score);
         }
      }
   }, 60000);
});
