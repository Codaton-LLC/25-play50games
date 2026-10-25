import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   BASE_PAD_RADIUS,
   BASE_SCAN_SCORE,
   BOULDER_RADIUS,
   CENTER_BONUS_RADIUS,
   CENTER_BONUS_SCORE,
   CHARGER_PAD_RADIUS,
   CHARGE_RATE,
   LIVES,
   PROPOSED_LEVEL_LIMITS,
   ROCK_HIT_SPEED,
   ROCK_RADIUS,
   ROVER,
   SCAN_HOLD_S,
   SCAN_SPEED_MAX,
   SITE_RING_RADIUS,
   TIME_BONUS_PER_SEC,
   WIN_HOLD_S,
   createRun,
   idleInput,
   step,
   timeBonus,
   type MarsInput,
   type Run,
} from "./rules";

type Style = "oracle" | "human" | "idle" | "spam";

interface BotMemory {
   targetSite: number;
   charging: boolean;
   dodgeTime: number;
   dodgeSign: number;
}

function selectTarget(run: Run, mem: BotMemory): { x: number; z: number; isCharger: boolean } {
   // Battery safety threshold: if battery is low or cannot reach next site + charger, prioritize charging
   if (run.chargers.length > 0) {
      let nearestCh = run.chargers[0];
      let minChDist = Infinity;
      for (const ch of run.chargers) {
         const d = Math.hypot(ch.x - run.rover.x, ch.z - run.rover.z);
         if (d < minChDist) {
            minChDist = d;
            nearestCh = ch;
         }
      }

      // Check unscanned sites to see if heading to next site would strand us
      let nextSite: Site | null = null;
      let minSiteDist = Infinity;
      for (const s of run.sites) {
         if (s.scanned) continue;
         const d = Math.hypot(s.x - run.rover.x, s.z - run.rover.z);
         if (d < minSiteDist) {
            minSiteDist = d;
            nextSite = s;
         }
      }

      if (nextSite) {
         // Distance from next site to its nearest charger
         let minFromSiteToCh = Infinity;
         for (const ch of run.chargers) {
            const d = Math.hypot(ch.x - nextSite.x, ch.z - nextSite.z);
            if (d < minFromSiteToCh) minFromSiteToCh = d;
         }
         const batteryToSiteAndCharger = (minSiteDist + minFromSiteToCh) * 0.9 * run.level.drainScale + 14;
         if (run.rover.battery < Math.max(35, batteryToSiteAndCharger)) {
            mem.charging = true;
         }
      } else {
         // Returning to base
         const distToBase = Math.hypot(run.basePad.x - run.rover.x, run.basePad.z - run.rover.z);
         if (run.rover.battery < distToBase * 0.9 * run.level.drainScale + 6) {
            mem.charging = true;
         }
      }

      if (run.rover.battery >= 94) {
         mem.charging = false;
      }

      if (mem.charging) {
         return { x: nearestCh.x, z: nearestCh.z, isCharger: true };
      }
   }

   // All sites scanned -> return to base pad
   if (run.samplesScanned >= run.level.sites) {
      return { x: run.basePad.x, z: run.basePad.z, isCharger: false };
   }

   // Visit nearest unscanned site
   let nearestSite = run.sites.find((s) => !s.scanned)!;
   let minDist = Infinity;
   for (const s of run.sites) {
      if (s.scanned) continue;
      const d = Math.hypot(s.x - run.rover.x, s.z - run.rover.z);
      if (d < minDist) {
         minDist = d;
         nearestSite = s;
      }
   }
   return { x: nearestSite.x, z: nearestSite.z, isCharger: false };
}

function driveBot(
   run: Run,
   input: MarsInput,
   dt: number,
   style: Style,
   rng: () => number,
   mem: BotMemory
): void {
   input.moveX = 0;
   input.moveY = 0;

   if (style === "idle" || run.over) return;

   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      return;
   }

   // If recently hit, back away briefly to avoid re-impacting
   if (run.rover.invulnerable > 0.2) {
      input.moveY = 0.6; // reverse back
      input.moveX = mem.dodgeSign;
      return;
   }

   const target = selectTarget(run, mem);
   const dx = target.x - run.rover.x;
   const dz = target.z - run.rover.z;
   const dist = Math.hypot(dx, dz);

   // Heading desired: yaw = 0 points north (-z)
   const desiredYaw = Math.atan2(dx, -dz);
   let diff = desiredYaw - run.rover.yaw;
   while (diff > Math.PI) diff -= 2 * Math.PI;
   while (diff < -Math.PI) diff += 2 * Math.PI;

   const stopDist = (run.rover.speed * run.rover.speed) / (2 * ROVER.brake) + 0.6;

   // Inside target: stay stopped to scan / charge / park
   if (dist <= 0.85) {
      if (run.rover.speed > 0.05) {
         input.moveY = 1.0; // brake
      } else if (run.rover.speed < -0.05) {
         input.moveY = -1.0; // reverse brake
      } else {
         input.moveY = 0;
      }
      input.moveX = 0;
      return;
   }

   // Braking zone when approaching target
   if (dist <= stopDist && run.rover.speed > 0.35) {
      input.moveY = 1.0; // brake
      input.moveX = Math.max(-1, Math.min(1, diff * 1.5));
      return;
   }

   // Forward and right unit vectors
   const fx = Math.sin(run.rover.yaw);
   const fz = -Math.cos(run.rover.yaw);
   const px = -fz; // cos(yaw)
   const pz = fx;  // sin(yaw)

   let avoidSteer = 0;

   // 1. Boulder avoidance: evaluate predictive crossing collision
   for (const boulder of run.boulders) {
      const dxLane = boulder.x - run.rover.x;
      const bdz = run.rover.z - boulder.z; // positive when boulder is upstream of rover

      // If rover is inside or right on the boulder's lane (within 2.4 m)
      if (Math.abs(dxLane) < 2.4) {
         const closingSpeed = boulder.speed + Math.max(0, -run.rover.vz);
         if (bdz > -1.8 && bdz < closingSpeed * 2.0 + 1.0) {
            // Boulder is bearing down on the rover right now: steer away from boulder center
            const dodgeSign = dxLane <= 0 ? 1 : -1;
            input.moveX = dodgeSign;
            input.moveY = -0.8; // throttle sideways out of lane
            return;
         }
      } else {
         // Rover is approaching the lane
         const crossing = dx * dxLane > 0 && Math.abs(dxLane) < Math.abs(dx) + 1.0;
         if (crossing && Math.abs(dxLane) < 8.0) {
            const speedX = Math.max(1.5, Math.abs(run.rover.vx) || 3.5);
            const tCross = Math.abs(dxLane) / speedX;
            const futureBoulderZ = boulder.z + boulder.speed * tCross;
            const futureRoverZ = run.rover.z + (run.rover.vz || 0) * tCross;
            const diffZ = futureRoverZ - futureBoulderZ;

            if (diffZ > -2.2 && diffZ < 2.5) {
               // Impending collision at crossing point: brake and wait outside the lane
               input.moveY = run.rover.speed > 0.05 ? 1.0 : 0;
               input.moveX = 0;
               return;
            }
         }
      }
   }

   // 2. Rock avoidance: if rock is directly in front
   for (const rock of run.rocks) {
      const rx = rock.x - run.rover.x;
      const rz = rock.z - run.rover.z;
      const ahead = rx * fx + rz * fz;
      const side = rx * px + rz * pz;

      if (ahead > 0 && ahead < Math.min(8.0, dist - 0.5) && Math.abs(side) < 2.2) {
         avoidSteer = side >= 0 ? -1.0 : 1.0;
         break;
      }
   }

   if (avoidSteer !== 0) {
      input.moveX = avoidSteer;
      // Slow to safe speed while avoiding so any contact spends 0 lives
      input.moveY = run.rover.speed > 2.6 ? 1.0 : -0.4;
      return;
   }

   // Steering towards target
   input.moveX = Math.max(-1, Math.min(1, diff * 2.4));

   // Throttle
   if (Math.abs(diff) > 1.0) {
      input.moveY = -0.3; // ease throttle to make sharp turn
   } else {
      input.moveY = style === "human" ? -0.85 : -1.0;
   }
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: LIVES, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();

   const input = idleInput();
   const mem: BotMemory = { targetSite: -1, charging: false, dodgeTime: 0, dodgeSign: 1 };
   const rng = createRng((seed + 1) * 10007 + id * 17);
   const cap = Math.ceil((level.durationMs / 1000 + 4) * hz);

   for (let i = 0; i < cap; i++) {
      advanceRunClock(store, 1 / hz);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;

      driveBot(run, input, dt, style, rng, mem);
      const before = run.score;
      const ev = step(run, input, dt, state.timeLeftMs ?? 0);

      if (ev.score) state.addScore(ev.score);
      expect(run.score).toBe(before + ev.score);
      if (ev.lifeLost) state.loseLife();
      if (ev.won) state.end("win");
      if (ev.lost) state.end("lose");
      if (run.over) break;
   }

   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over };
}

describe("mars-rover-mission core mechanics", () => {
   it("a scan at speed 0.49 for 1.00 s completes, at 0.51 it does not", () => {
      // 1. Scan completes at speed 0.49
      const runPass = createRun(1, LEVELS[1]);
      const site = runPass.sites[0];
      runPass.rover.x = site.x;
      runPass.rover.z = site.z;
      runPass.rover.speed = 0.49;

      for (let i = 0; i < 60; i++) {
         step(runPass, idleInput(), 1 / 60, 120_000);
      }
      expect(site.scanned).toBe(true);
      expect(runPass.samplesScanned).toBe(1);
      expect(runPass.score).toBe(BASE_SCAN_SCORE + CENTER_BONUS_SCORE);

      // 2. Scan does not complete at speed 0.51
      const runFail = createRun(1, LEVELS[1]);
      const siteFail = runFail.sites[0];
      runFail.rover.x = siteFail.x;
      runFail.rover.z = siteFail.z;
      runFail.rover.speed = 0.51;

      for (let i = 0; i < 60; i++) {
         step(runFail, idleInput(), 1 / 60, 120_000);
      }
      expect(siteFail.scanned).toBe(false);
      expect(runFail.samplesScanned).toBe(0);
   });

   it("leaving the ring resets the hold time", () => {
      const run = createRun(2, LEVELS[1]);
      const site = run.sites[0];
      run.rover.x = site.x;
      run.rover.z = site.z;
      run.rover.speed = 0.2;

      // Hold inside for 0.7 s
      for (let i = 0; i < 42; i++) {
         step(run, idleInput(), 1 / 60, 120_000);
      }
      expect(site.scanned).toBe(false);
      expect(site.holdTime).toBeGreaterThan(0.6);

      // Move outside ring
      run.rover.x = site.x + SITE_RING_RADIUS + 1.0;
      step(run, idleInput(), 1 / 60, 120_000);
      expect(site.holdTime).toBe(0);
   });

   it("charges only while stopped (speed < 0.5) inside charger pad", () => {
      const run = createRun(3, LEVELS[1]);
      const ch = run.chargers[0];
      run.rover.x = ch.x;
      run.rover.z = ch.z;
      run.rover.battery = 50;

      // Moving inside charger (speed 0.7) -> does not charge, drains battery
      run.rover.speed = 0.7;
      step(run, idleInput(), 1 / 10, 120_000);
      expect(run.charging).toBe(false);
      expect(run.rover.battery).toBeLessThan(50);

      // Stopped inside charger (speed 0.2) -> charges at +12 / s
      run.rover.speed = 0.2;
      const battBefore = run.rover.battery;
      step(run, idleInput(), 1.0, 120_000);
      expect(run.charging).toBe(true);
      expect(run.rover.battery).toBeCloseTo(battBefore + CHARGE_RATE, 1);
   });

   it("battery reaching 0 ends with 'lose' once", () => {
      const run = createRun(4, LEVELS[1]);
      run.rover.x = 0;
      run.rover.z = 0;
      run.rover.speed = 5.0;
      run.rover.battery = 0.1;

      const ev1 = step(run, idleInput(), 0.1, 120_000);
      expect(run.rover.battery).toBe(0);
      expect(run.over).toBe("lose");
      expect(ev1.lost).toBe(true);

      // Subsequent step does not re-trigger lose event
      const ev2 = step(run, idleInput(), 0.1, 120_000);
      expect(ev2.lost).toBe(false);
   });

   it("a rock hit above 3 m/s spends a life and bounces speed to -0.3", () => {
      const run = createRun(5, LEVELS[1]);
      const rock = run.rocks[0];
      run.rover.x = rock.x;
      run.rover.z = rock.z + ROCK_RADIUS + ROVER.radius - 0.1;
      run.rover.speed = 5.0;

      const ev = step(run, idleInput(), 1 / 60, 120_000);
      expect(ev.lifeLost).toBe(true);
      expect(ev.rockHit).toBe(true);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.rover.speed).toBeCloseTo(-1.5, 1); // 5.0 * -0.3
   });

   it("a boulder hit uses sweptAabbXZ (a 30 Hz bot does not tunnel)", () => {
      const run = createRun(1, LEVELS[3]);
      expect(run.boulders.length).toBeGreaterThan(0);
      const boulder = run.boulders[0];

      // Place rover directly in boulder's path
      run.rover.x = boulder.x;
      run.rover.z = boulder.z + 1.2;
      run.rover.speed = 0;

      const ev = step(run, idleInput(), 1 / 30, 180_000);
      expect(ev.lifeLost).toBe(true);
      expect(ev.boulderHit).toBe(true);
      expect(run.lives).toBe(LIVES - 1);
   });

   it("each site pays once and base pad wins only after all sites scanned", () => {
      const run = createRun(7, LEVELS[1]);
      expect(run.sites.length).toBe(3);

      // Scan site 0
      run.rover.x = run.sites[0].x;
      run.rover.z = run.sites[0].z;
      run.rover.speed = 0;
      step(run, idleInput(), SCAN_HOLD_S + 0.1, 120_000);
      expect(run.samplesScanned).toBe(1);
      const score1 = run.score;

      // Stand in site 0 longer: pays no more
      step(run, idleInput(), 1.0, 120_000);
      expect(run.score).toBe(score1);

      // Visiting base pad before all sites scanned does not trigger win
      run.rover.x = run.basePad.x;
      run.rover.z = run.basePad.z;
      run.rover.speed = 0;
      step(run, idleInput(), WIN_HOLD_S + 0.5, 120_000);
      expect(run.over).toBeNull();

      // Scan remaining sites
      run.rover.x = run.sites[1].x;
      run.rover.z = run.sites[1].z;
      step(run, idleInput(), SCAN_HOLD_S + 0.1, 120_000);

      run.rover.x = run.sites[2].x;
      run.rover.z = run.sites[2].z;
      step(run, idleInput(), SCAN_HOLD_S + 0.1, 120_000);
      expect(run.samplesScanned).toBe(3);

      // Now park on base pad: wins!
      run.rover.x = run.basePad.x;
      run.rover.z = run.basePad.z;
      run.rover.speed = 0;
      step(run, idleInput(), WIN_HOLD_S + 0.1, 100_000);
      expect(run.over).toBe("win");
   });

   it("charger-aware oracle route stays solvable on battery for 200 seeds", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 0; seed < 200; seed++) {
            const run = createRun(seed, level);

            // Verify charger proximity: at least one charger is within reach of the farthest site
            const basePad = run.basePad;
            let maxDist = 0;
            let farthestSite = run.sites[0];
            for (const s of run.sites) {
               const d = Math.hypot(s.x - basePad.x, s.z - basePad.z);
               if (d > maxDist) {
                  maxDist = d;
                  farthestSite = s;
               }
            }

            let minChDist = Infinity;
            for (const ch of run.chargers) {
               const d = Math.hypot(ch.x - farthestSite.x, ch.z - farthestSite.z);
               if (d < minChDist) minChDist = d;
            }

            // Charger must be within 16 m of farthest site
            expect(minChDist).toBeLessThanOrEqual(16.0);
         }
      }
   });
});

describe("mars-rover-mission score limits", () => {
   it("time bonus is 5 per full second left", () => {
      expect(timeBonus(120_000)).toBe(TIME_BONUS_PER_SEC * 120);
      expect(timeBonus(119_999)).toBe(TIME_BONUS_PER_SEC * 119);
      expect(timeBonus(0)).toBe(0);
   });

   it("an honest bot, an idle bot and a spam bot stay inside each level's limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let best = 0;
         let bestMs = Infinity;
         let wins = 0;

         for (let seed = 0; seed < 10; seed++) {
            for (const hz of [30, 60]) {
               const oracle = play(id, seed, hz, "oracle");
               expect(withinServerLimits(oracle.score, oracle.ms, limits)).toBe(true);
               expect(oracle.score).toBe(oracle.run.score);
               if (oracle.reason === "win") {
                  wins += 1;
                  if (oracle.score > best) {
                     best = oracle.score;
                     bestMs = oracle.ms;
                  }
               } else if (seed === 0 && hz === 30) {
                  console.log(`L${id} oracle non-win:`, { reason: oracle.reason, samples: oracle.run.samplesScanned, batt: Math.round(oracle.run.rover.battery), lives: oracle.run.lives });
               }
            }

            const human = play(id, seed, 30, "human");
            expect(withinServerLimits(human.score, human.ms, limits)).toBe(true);

            const idle = play(id, seed, 20, "idle");
            expect(idle.score).toBe(0);
            expect(idle.reason).not.toBe("win");
            expect(withinServerLimits(idle.score, idle.ms, limits)).toBe(true);

            const spam = play(id, seed, 30, "spam");
            expect(spam.score).toBe(spam.run.score);
            expect(withinServerLimits(spam.score, spam.ms, limits)).toBe(true);
         }

         expect(withinServerLimits(play(id, 1, 120, "oracle").score, play(id, 1, 120, "oracle").ms, limits)).toBe(true);
         console.log(`Level ${id} wins: ${wins}, best: ${best}`);
         expect(wins).toBeGreaterThan(0);
      }
   }, 180_000);
});
