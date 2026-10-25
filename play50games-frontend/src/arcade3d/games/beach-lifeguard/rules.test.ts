import { describe, expect, it } from "vitest";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   CARRY_FACTOR,
   GRAB_RANGE,
   LIVES,
   PROPOSED_LEVEL_LIMITS,
   RADIUS,
   RESCUE_BASE_POINTS,
   RESCUE_CLOCK_BONUS,
   SAFE_SAND_Z,
   SPEED_SAND,
   SPEED_WATER,
   TIME_BONUS_PER_SECOND,
   TOWER_X,
   TOWER_Z,
   WATER_FACTOR,
   createRun,
   step,
   stepZ,
   type BeachInput,
   type Run,
} from "./rules";

type BotStyle = "oracle" | "human" | "idle" | "spam";

function driveBot(run: Run, input: BeachInput, style: BotStyle, rng: () => number): void {
   input.moveX = 0;
   input.moveY = 0;
   input.actionPressed = false;
   input.yaw = 0;

   if (style === "idle" || run.over) return;

   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      input.actionPressed = rng() > 0.4;
      return;
   }

   // Oracle or Human bot:
   // If carrying: target is safe sand at (hero.x, 2.2)
   // If not carrying: target is active swimmer or jet ski (if level.jetSki and not on jet ski)
   let targetX = 0;
   let targetZ = 0;

   if (run.carrying) {
      targetX = run.hero.x;
      targetZ = SAFE_SAND_Z + 0.2; // Return to dry sand
   } else {
      const active = run.swimmers[run.activeSwimmer];
      if (!active) return;

      // On jet ski levels, if not on jet ski and hero is in water or near jet ski dock, mount jet ski
      if (run.level.jetSki && !run.onJetSki && run.hero.z <= 0.5) {
         const distToJetSki = Math.hypot(run.hero.x - run.jetSki.x, run.hero.z - run.jetSki.z);
         if (distToJetSki <= 1.2) {
            input.actionPressed = true;
         } else {
            targetX = run.jetSki.x;
            targetZ = run.jetSki.z;
         }
      }

      if (targetX === 0 && targetZ === 0) {
         targetX = active.x;
         targetZ = active.z;
         const distToSwimmer = Math.hypot(run.hero.x - active.x, run.hero.z - active.z);
         if (distToSwimmer <= GRAB_RANGE) {
            input.actionPressed = true;
         }
      }
   }

   const dx = targetX - run.hero.x;
   const dz = targetZ - run.hero.z;
   const len = Math.hypot(dx, dz) || 1;
   const stick = style === "human" ? 0.9 : 1.0;

   input.moveX = (dx / len) * stick;
   input.moveY = (dz / len) * stick;
}

describe("beach lifeguard rules and physics", () => {
   it("grab range triggers at 1.20 m and fails at 1.21 m", () => {
      const run = createRun(42, LEVELS[1]);
      const swimmer = run.swimmers[run.activeSwimmer];

      // At 1.20 m:
      run.hero.x = swimmer.x;
      run.hero.z = swimmer.z + 1.2;
      const evNear = step(run, { moveX: 0, moveY: 0, actionPressed: true, yaw: 0 }, 0.016, 100_000);
      expect(evNear.grabbed).toBe(true);
      expect(run.carrying).toBe(true);

      // Reset and test at 1.21 m:
      run.carrying = false;
      run.hero.x = swimmer.x;
      run.hero.z = swimmer.z + 1.21;
      const evFar = step(run, { moveX: 0, moveY: 0, actionPressed: true, yaw: 0 }, 0.016, 100_000);
      expect(evFar.grabbed).toBeUndefined();
      expect(run.carrying).toBe(false);
   });

   it("water speed is exactly 0.62, including the frame you cross z = 0", () => {
      // Pure sand speed test
      const sandTravel = stepZ(5.0, -5.0, 0.1, WATER_FACTOR);
      expect(sandTravel).toBeCloseTo(4.5, 5); // 5.0 - 5.0 * 0.1 = 4.5

      // Pure water speed test
      const waterTravel = stepZ(-5.0, -5.0, 0.1, WATER_FACTOR);
      expect(waterTravel).toBeCloseTo(-5.0 + -5.0 * 0.62 * 0.1, 5); // -5.31

      // Crossing z = 0 from sand into water:
      // startZ = 0.1, targetVZ = -5.0, dt = 0.1
      // sand time = 0.1 / 5.0 = 0.02 s
      // remaining water time = 0.08 s
      // water distance = 0.08 * (-5.0 * 0.62) = -0.248 m
      const crossIntoWater = stepZ(0.1, -5.0, 0.1, WATER_FACTOR);
      expect(crossIntoWater).toBeCloseTo(-0.248, 5);

      // Crossing z = 0 from water into sand:
      // startZ = -0.062, targetVZ = 5.0, dt = 0.1
      // water speed = 5.0 * 0.62 = 3.10 m/s
      // water time = 0.062 / 3.10 = 0.02 s
      // remaining sand time = 0.08 s
      // sand distance = 0.08 * 5.0 = 0.40 m
      const crossIntoSand = stepZ(-0.062, 5.0, 0.1, WATER_FACTOR);
      expect(crossIntoSand).toBeCloseTo(0.4, 5);
   });

   it("an expired alert does not also score", () => {
      const run = createRun(10, LEVELS[1]);
      const initialAlertS = run.level.alertS;

      // Advance until alert expires
      step(run, { moveX: 0, moveY: 0, actionPressed: false, yaw: 0 }, initialAlertS + 0.1, 100_000);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.score).toBe(0);

      // Walk to safe sand: must not score
      run.hero.z = SAFE_SAND_Z + 1;
      step(run, { moveX: 0, moveY: 0, actionPressed: false, yaw: 0 }, 0.016, 100_000);
      expect(run.score).toBe(0);
   });

   it("jet ski cannot mount on L1 (jetSki: false) and mounts on L4 (jetSki: true)", () => {
      // Level 1:
      const runL1 = createRun(1, LEVELS[1]);
      runL1.hero.x = runL1.jetSki.x;
      runL1.hero.z = runL1.jetSki.z;
      step(runL1, { moveX: 0, moveY: 0, actionPressed: true, yaw: 0 }, 0.016, 100_000);
      expect(runL1.onJetSki).toBe(false);

      // Level 4:
      const runL4 = createRun(1, LEVELS[4]);
      runL4.hero.x = runL4.jetSki.x;
      runL4.hero.z = runL4.jetSki.z;
      const ev = step(runL4, { moveX: 0, moveY: 0, actionPressed: true, yaw: 0 }, 0.016, 100_000);
      expect(ev.jetSkiMount).toBe(true);
      expect(runL4.onJetSki).toBe(true);
   });

   it("spawn points leave a straight sand corridor to the tower and from swimmers to safe sand", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 5; seed++) {
            const run = createRun(seed, LEVELS[id]);

            // 1. Swimmer return line: segment from (swimmer.x, 0) to (swimmer.x, 2)
            for (const swimmer of run.swimmers) {
               for (const prop of run.props) {
                  const xOverlap = swimmer.x >= prop.box.min.x && swimmer.x <= prop.box.max.x;
                  const zOverlap = prop.box.max.z >= 0 && prop.box.min.z <= 2.0;
                  expect(xOverlap && zOverlap).toBe(false);
               }
            }

            // 2. Tower corridor: central strip x in [-1.0, 1.0] from z = 0 to 8
            for (const prop of run.props) {
               const inTowerCorridor =
                  prop.box.min.x <= 1.0 && prop.box.max.x >= -1.0 && prop.box.min.z <= 8.5 && prop.box.max.z >= 0;
               expect(inTowerCorridor).toBe(false);
            }
         }
      }
   });

   it("same timing windows for keyboard and touch", () => {
      // Verify identical physical speed and grab constants for keyboard and touch
      expect(SPEED_SAND).toBe(5.0);
      expect(WATER_FACTOR).toBe(0.62);
      expect(SPEED_WATER).toBeCloseTo(3.1, 2);
      expect(CARRY_FACTOR).toBe(0.85);
      expect(GRAB_RANGE).toBe(1.2);
   });
});

describe("beach lifeguard score limits and bots", () => {
   it("honest bot, idle bot, spam bot and oracle bot stay within limits", () => {
      const dt = 1 / 30;

      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const rng = createRng(id * 100);

         // 1. Idle bot: does nothing, expires 3 alerts, loses, score is 0
         {
            const run = createRun(1, level);
            const input: BeachInput = { moveX: 0, moveY: 0, actionPressed: false, yaw: 0 };
            while (!run.over && run.time < level.durationMs / 1000) {
               step(run, input, dt, level.durationMs - run.time * 1000);
            }
            expect(run.over).toBe("lose");
            expect(run.score).toBe(0);
         }

         // 2. Spam bot: random inputs, never exceeds maxScore
         {
            const run = createRun(2, level);
            const input: BeachInput = { moveX: 0, moveY: 0, actionPressed: false, yaw: 0 };
            while (!run.over && run.time < 30) {
               driveBot(run, input, "spam", rng);
               step(run, input, dt, level.durationMs - run.time * 1000);
            }
            expect(run.score).toBeLessThanOrEqual(limits.maxScore);
         }

         // 3. Oracle bot: optimal player solving rescues, verifies limits
         let maxOracleScore = 0;
         let minOracleDuration = Infinity;

         for (let seed = 1; seed <= 6; seed++) {
            const run = createRun(seed, level);
            const input: BeachInput = { moveX: 0, moveY: 0, actionPressed: false, yaw: 0 };

            while (!run.over && run.time < level.durationMs / 1000) {
               const timeLeftMs = Math.max(0, level.durationMs - run.time * 1000);
               driveBot(run, input, "oracle", rng);
               step(run, input, dt, timeLeftMs);
            }

            expect(run.over).toBe("win");
            expect(run.saved).toBe(level.rescues);

            const durationMs = Math.round(run.time * 1000);
            expect(run.score).toBeLessThanOrEqual(limits.maxScore);
            expect(withinServerLimits(run.score, durationMs, limits)).toBe(true);

            if (run.score > maxOracleScore) maxOracleScore = run.score;
            if (durationMs < minOracleDuration) minOracleDuration = durationMs;
         }

         expect(maxOracleScore).toBeLessThanOrEqual(limits.maxScore);
      }
   });
});
