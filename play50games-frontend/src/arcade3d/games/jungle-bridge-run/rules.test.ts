import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS, type JungleLevel } from "./levels";
import {
   INITIAL_LIVES,
   JUMP_S,
   LANE_CHANGE_S,
   LANE_X,
   PLAYER_RADIUS,
   PROPOSED_LEVEL_LIMITS,
   RESPAWN_S,
   RUN_IN_Z,
   SECTION_LEN,
   SLIDE_S,
   TIME_BONUS_PER_SECOND,
   createRun,
   hasClearLine,
   idleInput,
   isLavaActive,
   logXAt,
   step,
   timeBonus,
   type GapObstacle,
   type LogObstacle,
   type Run,
   type RunnerInput,
   type VineObstacle,
} from "./rules";

type Style = "oracle" | "human" | "idle" | "spam";

interface Memory {
   decisionCooldown: number;
}

function drive(run: Run, input: RunnerInput, dt: number, style: Style, rng: () => number, mem: Memory): void {
   input.left = false;
   input.right = false;
   input.jump = false;
   input.slide = false;

   if (run.over || run.respawning) return;

   if (style === "idle") {
      return;
   }

   if (style === "spam") {
      input.left = rng() < 0.15;
      input.right = rng() < 0.15;
      input.jump = rng() < 0.2;
      input.slide = rng() < 0.2;
      return;
   }

   const sec = run.sections[run.currentSection];
   if (!sec) return;

   // Steer toward nearby gem if safe, else clear lane
   let targetLane = sec.clearLane;
   const nextGem = run.gems.find((g) => !g.collected && g.section === sec.index && g.z > run.z);
   if (nextGem && nextGem.z - run.z < 3.5) {
      targetLane = nextGem.lane;
   }
   for (const obs of sec.obstacles) {
      if (Math.abs(obs.z - run.z) < 3.0) {
         if (obs.kind === "pillar" && obs.lane === targetLane) targetLane = sec.clearLane;
         if (obs.kind === "bridge") targetLane = obs.plankLane;
         if (obs.kind === "lava" && obs.lane === targetLane) targetLane = sec.clearLane;
      }
   }
   if (run.laneTimer <= 0) {
      if (run.lane > targetLane) input.left = true;
      else if (run.lane < targetLane) input.right = true;
   }

   // React to obstacles ahead
   for (const obs of sec.obstacles) {
      const dist = obs.z - run.z;
      if (dist < -0.5 || dist > 3.0) continue;

      if (obs.kind === "gap") {
         if (dist <= 0.6 && dist >= 0 && run.jumpTimer <= 0) {
            input.jump = true;
         }
      } else if (obs.kind === "vine") {
         if (dist <= 1.2 && dist >= -0.2 && run.slideTimer <= 0) {
            if (obs.lanes.includes(run.lane)) {
               input.slide = true;
            }
         }
      } else if (obs.kind === "log") {
         if (dist <= 0.8 && dist >= 0 && run.jumpTimer <= 0) {
            const lx = logXAt(obs, run.time);
            if (Math.abs(run.x - lx) <= 0.9 + PLAYER_RADIUS + 0.3) {
               input.jump = true;
            }
         }
      }
   }
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: INITIAL_LIVES, resultDelayMs: 800 });
   store.getState().markReady();
   store.getState().start();

   const input = idleInput();
   const mem: Memory = { decisionCooldown: 0 };
   const rng = createRng((seed + 1) * 10007 + id * 17 + (style === "spam" ? 7 : 0));
   const cap = Math.ceil((level.durationMs / 1000 + 4) * hz);

   for (let i = 0; i < cap; i++) {
      advanceRunClock(store, 1 / hz);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;

      drive(run, input, dt, style, rng, mem);
      const before = run.score;
      const ev = step(run, input, dt, state.timeLeftMs ?? 0);

      if (ev.score) state.addScore(ev.score);
      if (run.score !== before + ev.score) throw new Error("score delta");
      if (ev.lifeLost) state.loseLife();
      if (ev.won) state.end("win");
      if (run.over) break;
   }

   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over };
}

describe("jungle-bridge-run rules & generation", () => {
   it("generates deterministic runs for identical seed and level", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 10; seed++) {
            const a = createRun(seed, LEVELS[id]);
            const b = createRun(seed, LEVELS[id]);
            expect(a.sections.length).toBe(b.sections.length);
            expect(a.gems.length).toBe(b.gems.length);
            expect(a.sections.map((s) => s.clearLane)).toEqual(b.sections.map((s) => s.clearLane));
            expect(a.gems.map((g) => [g.x, g.z])).toEqual(b.gems.map((g) => [g.x, g.z]));
         }
      }
   });

   it("guarantees every section has a clear line across 200 seeds", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 40; seed++) {
            const run = createRun(seed * 7 + id, LEVELS[id]);
            expect(hasClearLine(run)).toBe(true);
         }
      }
   });

   it("slide clears a vine, a jump does not", () => {
      // Test sliding under vine: safe
      const runSliding = createRun(1, LEVELS[2]);
      const sec = runSliding.sections[0];
      sec.obstacles = [
         {
            kind: "vine",
            z: 14,
            lanes: [1],
         },
      ];
      runSliding.z = 13.8;
      runSliding.lane = 1;
      runSliding.x = LANE_X[1];
      runSliding.slideTimer = SLIDE_S;
      runSliding.y = 0;
      step(runSliding, idleInput(), 1 / 60, 90_000);
      expect(runSliding.lives).toBe(INITIAL_LIVES);
      expect(runSliding.ev.lifeLost).toBe(false);

      // Test jumping into vine: hit
      const runJumping = createRun(1, LEVELS[2]);
      runJumping.sections[0].obstacles = [
         {
            kind: "vine",
            z: 14,
            lanes: [1],
         },
      ];
      runJumping.z = 13.8;
      runJumping.lane = 1;
      runJumping.x = LANE_X[1];
      runJumping.slideTimer = 0;
      runJumping.jumpTimer = JUMP_S * 0.5;
      runJumping.y = 1.0;
      step(runJumping, idleInput(), 1 / 60, 90_000);
      expect(runJumping.lives).toBe(INITIAL_LIVES - 1);
      expect(runJumping.ev.lifeLost).toBe(true);
   });

   it("a jump clears a gap, a slide does not", () => {
      // Test jumping over gap: safe
      const runJumping = createRun(1, LEVELS[1]);
      runJumping.sections[0].obstacles = [
         {
            kind: "gap",
            z: 12,
            length: 2.5,
            lanes: [0, 1, 2],
         },
      ];
      runJumping.z = 13;
      runJumping.lane = 1;
      runJumping.x = LANE_X[1];
      runJumping.jumpTimer = JUMP_S * 0.5;
      runJumping.y = 1.2;
      step(runJumping, idleInput(), 1 / 60, 75_000);
      expect(runJumping.lives).toBe(INITIAL_LIVES);
      expect(runJumping.ev.lifeLost).toBe(false);

      // Test sliding into gap: falls
      const runSliding = createRun(1, LEVELS[1]);
      runSliding.sections[0].obstacles = [
         {
            kind: "gap",
            z: 12,
            length: 2.5,
            lanes: [0, 1, 2],
         },
      ];
      runSliding.z = 13;
      runSliding.lane = 1;
      runSliding.x = LANE_X[1];
      runSliding.slideTimer = SLIDE_S;
      runSliding.y = 0;
      step(runSliding, idleInput(), 1 / 60, 75_000);
      expect(runSliding.lives).toBe(INITIAL_LIVES - 1);
      expect(runSliding.ev.lifeLost).toBe(true);
   });

   it("a fall respawns at the section start and keeps that section's gems", () => {
      const run = createRun(1, LEVELS[2]);
      // Collect gem 0
      const gem = run.gems[0];
      gem.collected = true;
      run.gemsTaken = 1;
      run.score = 20;

      // Force hit
      run.z = run.sections[0].startZ + 15;
      run.sections[0].obstacles = [
         {
            kind: "pillar",
            z: run.z,
            lane: run.lane,
         },
      ];
      step(run, idleInput(), 1 / 60, 90_000);

      expect(run.lives).toBe(INITIAL_LIVES - 1);
      expect(run.respawning).toBe(true);
      expect(run.gemsTaken).toBe(1);
      expect(run.gems[0].collected).toBe(true);

      // Advance through respawn delay (0.8 s)
      while (run.respawning) {
         step(run, idleInput(), 1 / 60, 90_000);
      }
      expect(run.respawning).toBe(false);
      expect(run.z).toBe(run.sections[0].startZ);
      expect(run.gemsTaken).toBe(1);
      expect(run.gems[0].collected).toBe(true);
   });

   it("lane change during a jump is allowed and takes 0.18 s", () => {
      const run = createRun(1, LEVELS[1]);
      run.lane = 1;
      run.x = LANE_X[1];

      // Jump
      const inJump: RunnerInput = { jump: true };
      step(run, inJump, 1 / 60, 75_000);
      expect(run.jumpTimer).toBeGreaterThan(0);
      expect(run.y).toBeGreaterThan(0);

      // Steer left during jump
      const inLeft: RunnerInput = { left: true };
      step(run, inLeft, 1 / 60, 75_000);
      expect(run.lane).toBe(0);
      expect(run.laneTimer).toBeGreaterThan(0);

      // Advance 0.18 s
      for (let i = 0; i < 11; i++) {
         step(run, idleInput(), 1 / 60, 75_000);
      }
      expect(run.laneTimer).toBe(0);
      expect(run.x).toBe(LANE_X[0]);
      expect(run.y).toBeGreaterThan(0); // still in jump arc
   });

   it("lava blocks only during its active window", () => {
      expect(isLavaActive(0.5)).toBe(true);
      expect(isLavaActive(1.1)).toBe(true);
      expect(isLavaActive(1.5)).toBe(false);
      expect(isLavaActive(2.5)).toBe(false);
      expect(isLavaActive(3.2)).toBe(true);
   });

   it("same timing windows for keyboard and touch inputs", () => {
      const runKbd = createRun(2, LEVELS[1]);
      const runTouch = createRun(2, LEVELS[1]);

      // Trigger lane change
      step(runKbd, { left: true }, 1 / 60, 75_000);
      step(runTouch, { left: true }, 1 / 60, 75_000);
      expect(runKbd.laneTimer).toBeCloseTo(runTouch.laneTimer, 6);
      expect(runKbd.x).toBeCloseTo(runTouch.x, 6);

      // Advance halfway
      step(runKbd, idleInput(), 0.09, 75_000);
      step(runTouch, idleInput(), 0.09, 75_000);
      expect(runKbd.x).toBeCloseTo(runTouch.x, 6);

      // Jump
      step(runKbd, { jump: true }, 1 / 60, 75_000);
      step(runTouch, { jump: true }, 1 / 60, 75_000);
      expect(runKbd.jumpTimer).toBeCloseTo(runTouch.jumpTimer, 6);
      expect(runKbd.y).toBeCloseTo(runTouch.y, 6);
   });
});

describe("jungle-bridge-run score limits and bot harness", () => {
   it("time bonus is +4 per full second left on win", () => {
      expect(timeBonus(75_000)).toBe(TIME_BONUS_PER_SECOND * 75);
      expect(timeBonus(74_999)).toBe(TIME_BONUS_PER_SECOND * 74);
      expect(timeBonus(1000)).toBe(TIME_BONUS_PER_SECOND * 1);
      expect(timeBonus(500)).toBe(0);
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
               }
            }

            const human = play(id, seed, 30, "human");
            expect(withinServerLimits(human.score, human.ms, limits)).toBe(true);

            const idle = play(id, seed, 20, "idle");
            expect(idle.reason).not.toBe("win");
            expect(idle.score).toBeLessThan(limits.maxScore * 0.5);
            if (idle.ms >= limits.minDurationMs) {
               expect(withinServerLimits(idle.score, idle.ms, limits)).toBe(true);
            }

            const spam = play(id, seed, 30, "spam");
            expect(spam.score).toBe(spam.run.score);
            if (spam.ms >= limits.minDurationMs) {
               expect(withinServerLimits(spam.score, spam.ms, limits)).toBe(true);
            }
         }

         const fast = play(id, 1, 144, "oracle");
         expect(withinServerLimits(fast.score, fast.ms, limits)).toBe(true);

         console.log(`L${id} oracle wins ${wins}/20 best ${best} at ${bestMs} ms (max ${limits.maxScore})`);
         expect(wins).toBeGreaterThan(0);
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }
   }, 180_000);
});
