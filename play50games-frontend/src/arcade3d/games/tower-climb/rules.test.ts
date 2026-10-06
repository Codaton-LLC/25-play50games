import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { InputState } from "@/arcade3d/core/types";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { rngNext } from "@/arcade3d/core/math";
import { advanceRunClock, isResultShown, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { towerClimbMeta } from "./meta";
import * as tower from "./rules";

const idle = { moveX: 0, jumpEdge: false };

function advance(run: tower.TowerRun, ms: number, input = idle): void {
   while (ms > 0) { const dt = Math.min(ms, 50); tower.step(run, dt, input); ms -= dt; }
}

function input(): InputState {
   return { moveX: 0, moveY: 0, jump: false, action: false, jumpPressed: false,
      actionPressed: false, pressed: { left: false, right: false, up: false, down: false },
      swipe: null, tap: null, tapDown: null, pointer: { x: 0, y: 0, down: false } };
}

/** A real generated static parent/spur, positioned at a valid standing contact. */
function onParent(side: number, offset = 0): { run: tower.TowerRun; spur: tower.SpurSlot; parent: tower.SlabSlot } {
   const run = tower.createRun(5050), data = run.tower;
   let index = -1;
   for (let i = 0; i < data.spurCount; i++) {
      const parent = data.spurParents[i];
      if (Math.sign(data.spurXs[i] - data.xs[parent]) === side) { index = i; break; }
   }
   if (index < 0) throw new Error("The seed must exercise both spur sides");
   const parentIndex = data.spurParents[index], y = data.heights[parentIndex] / 1000;
   run.player.grounded = false; run.contactA = run.contactB = tower.NONE;
   run.maxHeight = y; run.viewBottomY = y - 2; run.cameraTarget.y = y + 1;
   run.timeMs = Math.max(1000, Math.ceil(y * 500) + 350); run.holdUnlocked = true;
   tower.fillPools(run);
   const parent = run.slabs[parentIndex % 32], spur = run.spurs[index % 16];
   run.player.x = parent.baseX + side * offset; run.player.y = y; run.player.vy = 0;
   run.player.grounded = true; run.player.groundIndex = parentIndex;
   run.contactA = parent.id; run.permission = true;
   run.metres = Math.floor(y); run.rawScore = run.score = run.metres * 10;
   return { run, spur, parent };
}

describe("tower-climb approved tuning and input", () => {
   it("pins the physics, clocks, footprint, pools and 47250 proof ceiling", () => {
      expect(tower).toMatchObject({ G: 10, V_JUMP: 4, V_RUN: 3, MIN_LAUNCH_MS: 400,
         COYOTE_MS: 100, BUFFER_MS: 120, HOLD_MS: 350, MIN_LOSS_MS: 3000,
         MAX_STEP_MS: 50, DURATION_MS: 1800000, BLOCKS: 451, REWARD_BANDS: 450,
         STEPS_PER_BLOCK: 16, MAX_THEORETICAL_SCORE: 47250 });
      expect(tower.RUNNER).toEqual({ halfWidth: 0.22, height: 0.55, depth: 0.4 });
      expect(tower.POOLS).toEqual({ slabs: 32, spurs: 16, coins: 4, flags: 4, sections: 8 });
      expect(tower.SPUR).toMatchObject({ width: 0.8, offset: 1.2, warningMs: 800, halfGuard: 1.1, gravity: 6, maxSpeed: 6 });
      expect(tower.MOVING_SLAB).toEqual({ travel: 0.2, periodMs: 2000, speed: 0.4 });
   });

   it("maps held horizontal input first, lost key taps second, and one jump edge without reading swipe", () => {
      const raw = input(), out = tower.createStepInput();
      raw.moveX = 0.4; raw.pressed.left = true;
      expect(tower.readStepInput(raw, out)).toBe(out); expect(out).toEqual({ moveX: 0.4, jumpEdge: false });
      raw.moveX = 0; tower.readStepInput(raw, out); expect(out.moveX).toBe(-1);
      raw.pressed.right = true; tower.readStepInput(raw, out); expect(out.moveX).toBe(0);
      raw.jump = true; raw.moveY = -1; raw.swipe = "up";
      tower.readStepInput(raw, out); expect(out.jumpEdge).toBe(false);
      Object.defineProperty(raw, "swipe", { get() { throw new Error("Never read swipe"); } });
      raw.pressed.up = true; raw.jumpPressed = true; tower.readStepInput(raw, out); expect(out.jumpEdge).toBe(true);
      raw.moveX = 9; tower.readStepInput(raw, out); expect(out.moveX).toBe(1);
      raw.moveX = NaN; tower.readStepInput(raw, out); expect(out.moveX).toBe(0);
   });

   it("keeps a broad idle start safe, discards hold edges, then follows the 4t-5t² jump", () => {
      const run = tower.createRun(1);
      advance(run, 349, { moveX: 1, jumpEdge: true });
      expect(run.player.y).toBe(0); expect(run.launches).toBe(0); expect(run.score).toBe(0);
      tower.step(run, 1, idle); expect(run.bufferUntilMs).toBe(tower.NONE);
      run.player.x = 0;
      tower.step(run, 1, { moveX: 0, jumpEdge: true });
      expect(run.lastJumpMs).toBe(350); expect(run.launches).toBe(1);
      advance(run, 399);
      expect(run.player.y).toBeCloseTo(0.8, 10); expect(run.player.vy).toBeCloseTo(0, 10);
      expect(run.maxHeight).toBeCloseTo(0.8, 10);
   });
});

/** Test-only placement on generated geometry. Every live probe after placement goes through step. */
function standAt(index: number, x?: number): tower.TowerRun {
   const run = tower.createRun(5050), y = run.tower.heights[index] / 1000;
   run.player.grounded = false; run.contactA = run.contactB = tower.NONE;
   run.maxHeight = y; run.viewBottomY = y - 2; run.cameraTarget.y = y + 1;
   run.timeMs = Math.max(4000, Math.ceil(y * 500) + 350); run.holdUnlocked = true;
   tower.fillPools(run);
   run.player.x = x ?? tower.slabX(run.slabs[index % 32], run.timeMs); run.player.y = y;
   run.player.grounded = true; run.player.groundIndex = index; run.permission = true;
   run.contactA = index * 2; run.metres = Math.floor(y); run.score = run.rawScore = run.metres * 10;
   return run;
}

function descending(run: tower.TowerRun, afterMs: number): void {
   const seconds = afterMs / 1000;
   run.player.y += seconds + 5 * seconds * seconds; run.player.vy = -1;
   run.player.grounded = false; run.contactA = run.contactB = tower.NONE;
   run.permission = false; run.coyoteUntilMs = tower.NONE;
   run.flight.atMs = run.timeMs; run.flight.y = run.player.y; run.flight.vy = -1;
   run.maxHeight = Math.max(run.maxHeight, run.player.y);
}

describe("tower-climb generated permanent route", () => {
   it("reaches every checkpoint over 1000 seeds, including both moving extremes and complete prop extents", () => {
      let moving = 0, spurs = 0, left = 0, right = 0;
      for (let seed = 0; seed < 1000; seed++) {
         const data = tower.generateTower(seed);
         if (!tower.validateTower(data)) throw new Error(`Invalid seed ${seed}`);
         if (data.heights.length !== 7217 || data.heights[7216] !== 3608000) throw new Error("Guard block");
         for (let i = 1; i < 7217; i++) {
            const rise = (data.heights[i] - data.heights[i - 1]) / 1000;
            const seconds = (4 + Math.sqrt(16 - 20 * rise)) / 10;
            const worstShift = Math.abs(data.xs[i] - data.xs[i - 1]) / 1000
               + (data.kinds[i] === 1 ? 0.2 : 0) + (data.kinds[i - 1] === 1 ? 0.2 : 0);
            if (rise < 0.45 || rise > 0.55 || Math.abs(data.xs[i]) > 1000 || data.xs[i] % 100
               || Math.abs(data.xs[i] - data.xs[i - 1]) > 1000 || worstShift > 3 * seconds - 0.47)
               throw new Error(`Unreachable link ${seed}:${i}`);
            if (i % 2 === 0 && data.heights[i] - data.heights[i - 2] !== 1000) throw new Error("Pair total");
            if (i % 16 === 0 && (data.kinds[i] !== 2 || data.xs[i] !== 0 || data.heights[i] !== i * 500))
               throw new Error("Checkpoint");
            if (data.kinds[i] === 1) moving++;
         }
         let pair = -1;
         for (let i = 0; i < data.spurCount; i++) {
            const p = data.spurParents[i], x = data.spurXs[i] / 1000, px = data.xs[p] / 1000;
            const side = Math.sign(x - px), nextPair = Math.floor((p - 1) / 2);
            if (data.kinds[p] !== 0 || nextPair <= pair || data.spurForParent[p] !== i
               || Math.abs(Math.abs(x - px) - 1.2) > 1e-12 || side !== -Math.sign(px)
               || Math.abs(x - data.xs[p + 1] / 1000) > 1 + 1e-12 || Math.abs(x) + 0.4 > 1.1 + 1e-12
               || Math.abs(x) + 0.4 > 1.2 - 0.1 + 1e-12 || Math.abs(x) + 0.4 > 1.7 - 0.6 + 1e-12)
               throw new Error(`Spur clearance ${seed}:${p}`);
            pair = nextPair; spurs++;
         }
         for (let k = 1; k <= 450; k++) {
            const next = data.xs[k * 16 + 1] / 1000, coin = data.coinXs[k] / 1000, flag = data.flagXs[k] / 1000;
            if (Math.abs(coin) !== 1.5 || Math.abs(flag) !== 1.9 || Math.sign(coin) !== Math.sign(flag)
               || (next !== 0 && Math.sign(coin) !== -Math.sign(next))
               || Math.abs(coin - next) - 0.3 - 0.9 < 0.3 - 1e-12
               || Math.abs(flag - next) - 0.2 - 0.9 < 0.8 - 1e-12) throw new Error("Full prop clearance");
            if (coin < 0) left++; else right++;
         }
      }
      expect(moving).toBeGreaterThan(1000000); expect(spurs).toBeGreaterThan(100000);
      expect(left).toBeGreaterThan(100000); expect(right).toBeGreaterThan(100000);
   });

   it("is deterministic at uint32 extremes; rejected rise/shift/prop/spur mutations cannot pass validation", () => {
      for (const seed of [0, 5050, 0x80000000, 0xffffffff]) {
         const a = tower.generateTower(seed), b = tower.generateTower(seed);
         expect(a.spurCount).toBe(b.spurCount);
         for (const key of ["heights", "xs", "kinds", "phases", "spurXs", "spurParents", "coinXs", "flagXs", "decoration"] as const)
            expect(Buffer.compare(Buffer.from(a[key].buffer), Buffer.from(b[key].buffer))).toBe(0);
      }
      const data = tower.generateTower(5050);
      data.heights[1] += 1; expect(tower.validateTower(data)).toBe(false); data.heights[1] -= 1;
      const x = data.xs[1]; data.xs[1] = 1100; expect(tower.validateTower(data)).toBe(false); data.xs[1] = x;
      const coin = data.coinXs[1]; data.coinXs[1] *= -1; data.flagXs[1] *= -1;
      expect(tower.validateTower(data)).toBe(false); data.coinXs[1] = coin; data.flagXs[1] *= -1;
      data.spurXs[0] = 1200; expect(tower.validateTower(data)).toBe(false);
   });
});

describe("tower-climb swept support, coyote and buffer", () => {
   for (const side of [-1, 1]) {
      it(`warns on descending spur-only and straddled landings, side ${side}`, () => {
         for (const offset of [0.7, 1.2]) {
            const { run, spur, parent } = onParent(side, offset), before = run.timeMs;
            descending(run, 0.5); tower.step(run, 1, idle);
            expect(run.events.landed).toBe(offset === 0.7 ? parent.id : spur.id);
            expect(run.contactB).toBe(offset === 0.7 ? spur.id : tower.NONE);
            expect(spur.warnStartMs).toBe(before + 1); expect(run.player.y).toBe(parent.y);
         }
      });
      for (const delay of [99, 100, 101]) it(`spur-only collapse gives inclusive coyote ${delay} ms, side ${side}`, () => {
         const { run, spur } = onParent(side, 1.2);
         tower.step(run, 1, idle); advance(run, 800);
         expect(run.player.grounded).toBe(false); expect(spur.state).toBe(tower.FALLING);
         expect(run.coyoteUntilMs).toBe(spur.collapseMs + 100);
         advance(run, delay); tower.step(run, 1, { moveX: 0, jumpEdge: true });
         expect(run.launches).toBe(delay <= 100 ? 1 : 0);
         if (delay <= 100) { expect(run.permission).toBe(false); expect(run.bufferUntilMs).toBe(tower.NONE); }
      });
   }

   for (const after of [119, 120, 121]) it(`buffer landing at ${after} ms is inclusive through 120`, () => {
      const run = standAt(1); descending(run, after);
      tower.step(run, 1, { moveX: 0, jumpEdge: true }); advance(run, after);
      expect(run.launches).toBe(after <= 120 ? 1 : 0);
      expect(run.player.grounded).toBe(after > 120);
   });

   it("does not warn on upward/underside contact, spawn, proximity or jump-over", () => {
      const { run, spur } = onParent(1, 1.2);
      run.player.grounded = false; run.permission = false; run.contactA = tower.NONE;
      run.player.y -= 0.1; run.flight.atMs = run.timeMs; run.flight.y = run.player.y; run.flight.vy = 4;
      advance(run, 50); expect(run.player.y).toBeGreaterThan(spur.y); expect(spur.state).toBe(tower.INTACT);
      expect(run.player.grounded).toBe(false); expect(run.permission).toBe(false);
   });

   it("carries moving supports horizontally without adding height and finishes landing remainder once", () => {
      const data = tower.generateTower(5050), index = data.kinds.findIndex(k => k === tower.MOVING);
      const run = standAt(index), slab = run.slabs[index % 32], x = run.player.x, y = run.player.y, at = run.timeMs;
      tower.step(run, 50, idle);
      expect(run.player.x - x).toBeCloseTo(tower.slabX(slab, at + 50) - tower.slabX(slab, at), 12);
      expect(run.player.y).toBe(y); expect(run.player.vy).toBe(0);
      descending(run, 0.5); const beforeX = run.player.x, beforeTime = run.timeMs;
      tower.step(run, 1, { moveX: 0.2, jumpEdge: false });
      expect(run.player.grounded).toBe(true);
      expect(run.player.x).toBeCloseTo(beforeX + 0.0006
         + tower.slabX(slab, beforeTime + 1) - tower.slabX(slab, beforeTime + 0.5), 11);
   });

   it("a moving edge is tested at the exact crossing, then carries the valid landing", () => {
      const data = tower.generateTower(5050), index = data.kinds.findIndex(k => k === tower.MOVING);
      const run = standAt(index), slab = run.slabs[index % 32];
      slab.phaseMs = 0; run.timeMs = 4000; run.player.x = tower.slabX(slab, 4000.5) - 0.92 + 0.00001;
      descending(run, 0.5); tower.step(run, 1, idle);
      expect(run.events.landed).toBe(index * 2); expect(run.player.grounded).toBe(true);
      expect(run.player.x).toBeCloseTo(tower.slabX(slab, 4001) - 0.92 + 0.00001, 12);
   });

   it("the 400 ms guard cannot be bypassed by buffered landing or coyote", () => {
      const run = standAt(1); run.lastJumpMs = run.timeMs - 399;
      tower.step(run, 0.25, { moveX: 0, jumpEdge: true }); expect(run.launches).toBe(0);
      tower.step(run, 0.75, idle); expect(run.launches).toBe(1); expect(run.lastJumpMs).toBe(4001);
      advance(run, 300); expect(run.launches).toBe(1);
      tower.step(run, 50, { moveX: 0, jumpEdge: true }); expect(run.launches).toBe(1);
   });

   it("a fast downward crossing cannot tunnel through a one-way top", () => {
      const run = standAt(1), top = run.player.y;
      run.player.grounded = false; run.permission = false; run.contactA = tower.NONE;
      run.player.y = top + 0.2; run.player.vy = -40;
      run.flight.atMs = run.timeMs; run.flight.y = run.player.y; run.flight.vy = -40;
      tower.step(run, 50, idle);
      expect(run.player.y).toBe(top); expect(run.player.grounded).toBe(true); expect(run.events.landed).toBe(2);
   });

   it("a spur expires before a simultaneous descending landing; its permanent parent remains", () => {
      for (const offset of [0.7, 1.2]) {
         const { run, spur, parent } = onParent(1, offset);
         tower.step(run, 1, idle); advance(run, 799); descending(run, 1);
         tower.step(run, 1, idle);
         expect(spur.state).toBe(tower.FALLING); expect(run.contactB).toBe(tower.NONE);
         expect(run.events.landed).toBe(offset === 0.7 ? parent.id : tower.NONE);
         expect(run.player.grounded).toBe(offset === 0.7);
      }
   });

   it("walking off grants one coyote jump, and later midair edges cannot rearm it", () => {
      const run = standAt(1); run.player.x = run.slabs[1].baseX + 0.919;
      tower.step(run, 1, { moveX: 1, jumpEdge: false });
      const left = run.timeMs;
      expect(run.player.grounded).toBe(false); expect(run.coyoteUntilMs).toBe(left + 100);
      tower.step(run, 1, { moveX: 0, jumpEdge: true }); expect(run.launches).toBe(1);
      advance(run, 350, { moveX: 0, jumpEdge: true });
      expect(run.launches).toBe(1); expect(run.permission).toBe(false);
      expect(run.maxHeight).toBeLessThanOrEqual(run.flight.y + 0.8);
   });
});

function assertProof(run: tower.TowerRun): void {
   const t = run.timeMs / 1000, u = Math.max(0, t - 0.2995);
   const heightBound = t < 0.35 ? 0 : 0.8 + 2 * u;
   if (run.maxHeight > heightBound + 1e-9 || run.collectedCoins > Math.floor(run.maxHeight / 8)
      || run.rawScore !== Math.floor(run.maxHeight) * 10 + run.collectedCoins * 25
      || run.score !== run.rawScore || run.score * 1000 > 100 * run.timeMs
      || run.score > 47250 || run.maxHeight > 3600.201 + 1e-9)
      throw new Error(`Proof failed at ${run.timeMs}: H=${run.maxHeight}, coins=${run.collectedCoins}, raw=${run.rawScore}, score=${run.score}`);
}

/** Knows this seed, aims at each required slab's future centre, and detours to every coin. */
function climbInput(run: tower.TowerRun, out: tower.StepInput): void {
   const p = run.player, index = p.groundIndex + 1;
   out.jumpEdge = false; out.moveX = 0;
   if (!run.holdUnlocked || run.pendingLose || index >= run.tower.heights.length) return;
   if (p.grounded && p.groundIndex > 0 && p.groundIndex % 16 === 0 && run.tower.coinTaken[p.groundIndex / 16] === 0) {
      const target = run.tower.coinXs[p.groundIndex / 16] / 1000 - Math.sign(run.tower.coinXs[p.groundIndex / 16]) * 0.4;
      out.moveX = Math.max(-1, Math.min(1, (target - p.x) * 10)); return;
   }
   const slab = run.slabs[index % 32], rise = slab.y - (p.grounded ? p.y : run.flight.y);
   const arrival = p.grounded ? run.timeMs + 1000 * tower.landingTime(rise)
      : run.flight.atMs + 1000 * tower.landingTime(rise, run.flight.vy);
   const target = tower.slabX(slab, arrival), distance = target - p.x;
   if (p.grounded) {
      if (Math.abs(distance) <= 1.5) out.jumpEdge = true;
      else { out.moveX = Math.sign(distance); return; }
   }
   out.moveX = Math.max(-1, Math.min(1, distance / (3 * Math.max(0.001, (arrival - run.timeMs) / 1000))));
}

function runBot(frame: number, random = false, adversarial = false): tower.TowerRun {
   const run = tower.createRun(5050), controls = tower.createStepInput(), rng = { s: 7331 };
   let previousLaunch = -400, warned = 0, checkpoints = 0, coins = 0;
   while (!run.ended) {
      const dt = random ? 1 + Math.floor(rngNext(rng) * 50) : frame;
      if (adversarial) {
         controls.moveX = Math.floor(rngNext(rng) * 3) - 1;
         controls.jumpEdge = true;
      } else climbInput(run, controls);
      tower.step(run, dt, controls); assertProof(run);
      if (run.events.jumped) {
         if (run.lastJumpMs - previousLaunch < 400) throw new Error("Launch guard bypassed");
         previousLaunch = run.lastJumpMs;
      }
      if (run.events.warned >= 0) warned++;
      if (run.events.checkpoint >= 0) checkpoints++;
      if (run.events.coin >= 0) coins++;
   }
   if (!withinServerLimits(run.score, run.timeMs, towerClimbMeta.scoring) || !run.ranked) throw new Error("Unrankable terminal run");
   if (!adversarial && (run.ended !== "timeup" || checkpoints < 100 || coins < 100))
      throw new Error(`Climber failed: ${run.ended} at ${run.timeMs}, checkpoint=${checkpoints}, coins=${coins}, warnings=${warned}`);
   return run;
}

describe("tower-climb score proof and recycled pools", () => {
   it("pins coin dimensions, band density, moving/slab sizes, weights and score rates", () => {
      expect(tower.COIN).toEqual({ radius: 0.3, lift: 0.3, pickupReach: 0.52, playerLift: 0.275 });
      expect(tower.FLAG).toEqual({ height: 0.8, halfWidth: 0.2 });
      expect(tower.SLAB).toEqual({ width: 1.4, depth: 0.6, thickness: 0.16 });
      expect(tower.WEIGHTS).toEqual({ static: 8, moving: 2, absent: 1, present: 1 });
      expect(tower).toMatchObject({ BLOCK_MM: 8000, HEIGHT_POINTS: 10, COIN_POINTS: 25, X_BOUND: 1.98 });
      expect(towerClimbMeta.scoring).toMatchObject({ kind: "points", base: 0, maxScore: 50000,
         maxPointsPerSec: 100, minDurationMs: 3000, maxDurationMs: 1800000 });
      for (let ms = 350; ms <= 1800000; ms++) {
         const h = 0.8 + 2 * Math.max(0, ms / 1000 - 0.2995);
         const score = 10 * Math.floor(h) + 25 * Math.floor(h / 8);
         if (score > 47250 || score * 1000 > 100 * ms || capScore(score, ms, towerClimbMeta.scoring) !== score)
            throw new Error(`Analytic upper bound at ${ms}`);
      }
   });

   it("perfect/adversarial bots obey the uncapped proof at 8.3/16.7/50 ms and random 1–50 ms", () => {
      let best = 0;
      for (const [frame, random] of [[8.3, false], [16.7, false], [50, false], [50, true]] as const) {
         const perfect = runBot(frame, random), adversary = runBot(frame, random, true);
         best = Math.max(best, perfect.score / 30);
         expect(adversary.ended).toBe("lose");
      }
      console.info(`Tower measured best seeded centre-landing bot: ${best.toFixed(2)} pts/min (30-minute runs, seed 5050)`);
      expect(best).toBeGreaterThan(400); expect(best).toBeLessThan(1575);
   });

   it("coins require feet at the band, are unique, and 17.9 m/two coins gives 220", () => {
      const run = standAt(16), coin = run.coins[1], before = run.score;
      run.player.x = coin.x; run.player.y = 7.999; run.player.grounded = false;
      run.flight.atMs = run.timeMs; run.flight.y = 7.999; run.flight.vy = 0;
      tower.step(run, 1, idle); expect(run.collectedCoins).toBe(0);
      run.player.y = 8; run.player.grounded = true; run.player.groundIndex = 16; run.contactA = 32;
      tower.step(run, 1, idle); expect(run.events.delta).toBe(25); expect(run.score).toBe(before + 25);
      advance(run, 500); expect(run.collectedCoins).toBe(1); expect(run.events.coin).toBe(tower.NONE);
      run.contactA = run.contactB = tower.NONE; run.player.grounded = false;
      run.maxHeight = 17.9; run.viewBottomY = 15.9; run.cameraTarget.y = 18.9; tower.fillPools(run);
      const second = run.coins[2]; run.player.x = second.x; run.player.y = 16;
      run.player.grounded = true; run.player.groundIndex = 32; run.contactA = 64;
      tower.step(run, 1, idle); expect(run.score).toBe(220); expect(run.collectedCoins).toBe(2);
      advance(run, 500); expect(run.score).toBe(220);
   });

   it("fixed slot/event identities survive the whole tower; missed coins never respawn and live targets cannot recycle", () => {
      const run = tower.createRun(21), slabs = run.slabs.slice(), spurs = run.spurs.slice(), coins = run.coins.slice();
      const flags = run.flags.slice(), sections = run.sections.slice(), events = run.events;
      run.contactA = run.contactB = tower.NONE; run.player.grounded = false;
      for (let height = 0; height <= 3600; height += 0.25) {
         run.maxHeight = height; run.viewBottomY = height - 2; tower.fillPools(run);
         if (run.slabs.filter(s => s.active).length > 24 || run.spurs.filter(s => s.active).length > 12)
            throw new Error("Window exceeds fixed ring");
      }
      expect(run.slabs).toEqual(slabs); expect(run.spurs).toEqual(spurs); expect(run.coins).toEqual(coins);
      for (const [now, before] of [[run.slabs, slabs], [run.spurs, spurs], [run.coins, coins], [run.flags, flags], [run.sections, sections]])
         for (let i = 0; i < now.length; i++) expect(now[i]).toBe(before[i]);
      expect(run.tower.coinTaken[1]).toBe(2); expect(run.events).toBe(events);
      const protectedRun = tower.createRun(21), protectedSlot = protectedRun.slabs[0];
      protectedRun.maxHeight = 30; protectedRun.viewBottomY = 28;
      expect(tower.fillPools(protectedRun)).toBe(false); expect(protectedSlot.id).toBe(0); expect(protectedSlot.active).toBe(true);
   });
});

describe("tower-climb integer clock, loss latch and drawn-only poses", () => {
   it("carries fractions, ignores invalid dt, clamps long frames and bounds x without changing an idle score", () => {
      const run = tower.createRun(1); let counted = 0;
      for (let i = 0; i < 10000; i++) {
         const dt = i % 3 === 0 ? 1000 / 120 : i % 3 === 1 ? 1000 / 60 : 16.7;
         tower.step(run, dt, { moveX: 1, jumpEdge: false }); counted += dt;
         if (run.timeMs > counted + 1e-7 || counted - run.timeMs >= 1.0000001) throw new Error("Remainder drift");
      }
      expect(run.player.x).toBe(1.98); expect(run.score).toBe(0);
      const time = run.timeMs, remainder = run.remainder, pose = { ...run.player };
      for (const bad of [0, -1, NaN, Infinity]) tower.step(run, bad, { moveX: -1, jumpEdge: true });
      expect(run.timeMs).toBe(time); expect(run.remainder).toBe(remainder); expect(run.player).toEqual(pose);
      tower.step(run, 3000, idle); expect(run.timeMs - time).toBe(50);
   });

   it("early loss latches once, freezes physics/awards, waits to 3000 and cannot be recovered", () => {
      const run = tower.createRun(5050); advance(run, 350);
      run.player.grounded = false; run.contactA = tower.NONE; run.permission = false;
      run.player.y = -1.999; run.player.vy = -1; run.flight.atMs = 350; run.flight.y = -1.999; run.flight.vy = -1;
      tower.step(run, 1, idle); expect(run.events.hit).toBe(true); expect(run.pendingLose).toBe(true);
      const loss = { ...run.loss }, pose = { ...run.player }, moving = run.slabs.find(s => s.kind === 1)!;
      const x = tower.slabX(moving, run.timeMs);
      advance(run, 2648, { moveX: 1, jumpEdge: true }); expect(run.ended).toBe(null); expect(run.timeMs).toBe(2999);
      expect(run.events.hit).toBe(false); expect(run.player).toEqual(pose); expect(run.loss).toEqual(loss);
      expect(tower.slabX(moving, run.timeMs)).toBe(x); expect(run.score).toBe(0);
      tower.step(run, 50, idle); expect(run.timeMs).toBe(3000); expect(run.ended).toBe("lose"); expect(run.ranked).toBe(true);
      tower.step(run, 50, idle); expect(run.events.ended).toBe(null); expect(run.events.hit).toBe(false);
      expect(tower.lossFall(loss, loss.atMs)).toBe(loss.footY);
      expect(tower.lossFall(loss, loss.atMs + 557)).toBeLessThan(loss.footY - 1.55);
   });

   it("time-up takes precedence over movement/pickups; result poses are callback-order independent", () => {
      const run = standAt(16); run.timeMs = 1799999; run.player.x = run.coins[1].x;
      const p = { ...run.player }, score = run.score;
      tower.step(run, 1, { moveX: 1, jumpEdge: true });
      expect(run.ended).toBe("timeup"); expect(run.score).toBe(score); expect(run.player).toEqual(p);
      const visual = tower.createPoseClock();
      expect(tower.posedMs(run, visual, "playing", 30)).toBe(1800000);
      expect(tower.posedMs(run, visual, "paused", 40)).toBe(1800000);
      expect(tower.posedMs(run, visual, "over", 50)).toBe(1800000);
      expect(tower.posedMs(run, visual, "over", 50)).toBe(1800000);
      expect(tower.posedMs(run, visual, "over", 50.8)).toBeCloseTo(1800800);
      expect(tower.debrisDrop(-5)).toBe(0); expect(tower.debrisDrop(1000)).toBe(3);
      expect(tower.debrisDrop(1800)).toBeCloseTo(7.8);
   });
});

describe("tower-climb core parity and allocation contract", () => {
   it("identical held input and jump edges reproduce the same analytic state across frame partitions", () => {
      const replay = (frame: number, random: boolean): unknown => {
         const run = tower.createRun(5050), rng = { s: 8234 };
         advance(run, 350); tower.step(run, 1, { moveX: 0, jumpEdge: true });
         let left = 6999;
         while (left > 0 && !run.ended) {
            const dt = Math.min(left, random ? 1 + Math.floor(rngNext(rng) * 50) : frame);
            tower.step(run, dt, idle); left -= dt;
         }
         return { p: run.player, maxHeight: run.maxHeight, score: run.score, launches: run.launches,
            warnStarts: run.tower.warnStarts, collapseTimes: run.tower.collapseTimes, loss: run.loss, ended: run.ended };
      };
      const baseline = replay(50, false);
      for (const [frame, random] of [[8.3, false], [16.7, false], [50, true]] as const) expect(replay(frame, random)).toEqual(baseline);
      for (const side of [-1, 1]) {
         const outcomes: unknown[] = [];
         for (const frame of [1, 8.3, 16.7, 50]) {
            const { run, spur } = onParent(side, 0.579), target = run.timeMs + 900;
            // Compare the same consumed integer-ms endpoint, including its fractional carry.
            while (run.timeMs < target) {
               const dt = Math.min(frame, target - run.timeMs - run.remainder);
               tower.step(run, dt, { moveX: side * 0.1, jumpEdge: false });
            }
            outcomes.push({ x: run.player.x, warn: spur.warnStartMs, collapse: spur.collapseMs, grounded: run.player.grounded });
         }
         for (const outcome of outcomes) expect(outcome).toEqual(outcomes[0]);
      }
   });

   it("real store counts residual play, pauses/retries, score/height events, early loss and 800 ms result delay", () => {
      const store = createArcadeStore(); store.getState().configure({ durationMs: 1800000 });
      store.getState().markReady(); store.getState().start(); store.getState().setStat("height", 0);
      for (let i = 0; i < 59; i++) advanceRunClock(store, 0.05);
      advanceRunClock(store, 0.047); advanceRunClock(store, 0.01);
      expect(store.getState().elapsedMs).toBeCloseTo(7, 8);
      const run = tower.createRun(5050), controls = tower.createStepInput(), rng = { s: 93 };
      tower.step(run, playedFrameDt(store.getState()) * 1000, idle);
      for (let i = 0; i < 1500; i++) {
         if (i === 300) store.getState().pause(); if (i === 310) store.getState().resume();
         const before = run.timeMs;
         advanceRunClock(store, i % 4 === 0 ? 0.3 : (1 + rngNext(rng) * 49) / 1000);
         const dt = playedFrameDt(store.getState());
         if (dt > 0) {
            climbInput(run, controls); const ev = tower.step(run, dt * 1000, controls);
            if (ev.delta) store.getState().addScore(ev.delta);
            if (ev.height >= 0) store.getState().setStat("height", ev.height);
         } else expect(run.timeMs).toBe(before);
         if (run.timeMs > store.getState().elapsedMs + 1e-8 || store.getState().elapsedMs - run.timeMs >= 1.0000001)
            throw new Error("Rules ran for uncounted time");
         expect(run.ended).toBe(null);
      }
      expect(store.getState().score).toBe(run.score); expect(store.getState().stats.height).toBe(Math.floor(run.maxHeight));
      store.getState().restart(); expect(store.getState().elapsedMs).toBe(0);
      const fresh = tower.createRun(93); expect(fresh.score).toBe(0); expect(fresh.remainder).toBe(0);
      // A failed early flight: Scene must keep calling step during pendingLose, including after pause.
      for (let i = 0; i < 60; i++) advanceRunClock(store, 0.05);
      fresh.player.grounded = false; fresh.contactA = tower.NONE; fresh.permission = false;
      fresh.holdUnlocked = true; fresh.player.y = -1.999;
      fresh.flight.y = -1.999; fresh.flight.vy = -1;
      let hits = 0;
      while (!fresh.ended) {
         advanceRunClock(store, 0.05); const dt = playedFrameDt(store.getState());
         if (dt > 0) {
            const ev = tower.step(fresh, dt * 1000, idle); if (ev.hit) hits++;
            if (ev.ended) store.getState().end(ev.ended);
         }
         if (fresh.timeMs === 1000) {
            store.getState().pause(); const clock = fresh.timeMs, fraction = fresh.remainder;
            for (let i = 0; i < 20; i++) { advanceRunClock(store, 0.05); expect(playedFrameDt(store.getState())).toBe(0); }
            expect(fresh.timeMs).toBe(clock); expect(fresh.remainder).toBe(fraction); store.getState().resume();
         }
      }
      expect(hits).toBe(1); expect(store.getState().elapsedMs).toBe(3000); expect(fresh.timeMs).toBe(3000);
      expect(store.getState().endReason).toBe("lose");
      const frozen = structuredClone(fresh);
      for (let i = 0; i < 15; i++) {
         advanceRunClock(store, 0.05); expect(playedFrameDt(store.getState())).toBe(0); expect(isResultShown(store.getState())).toBe(false);
      }
      advanceRunClock(store, 0.05); expect(isResultShown(store.getState())).toBe(true); expect(fresh).toEqual(frozen);
   });

   it("core time-up skips the final simulation frame and submits its already-earned score at exactly 30 minutes", () => {
      const store = createArcadeStore(); store.getState().configure({ durationMs: 1800000 });
      store.getState().markReady(); store.getState().start();
      for (let i = 0; i < 60; i++) advanceRunClock(store, 0.05);
      const run = tower.createRun(1);
      for (let i = 0; i < 36000; i++) {
         advanceRunClock(store, 0.05); const dt = playedFrameDt(store.getState());
         if (dt > 0) tower.step(run, dt * 1000, idle);
      }
      expect(store.getState().elapsedMs).toBe(1800000); expect(store.getState().endReason).toBe("timeup");
      expect(run.timeMs).toBe(1799950); expect(run.score).toBe(0); expect(playedFrameDt(store.getState())).toBe(0);
      expect(withinServerLimits(run.score, store.getState().elapsedMs, towerClimbMeta.scoring)).toBe(true);
   });

   it("step/fills and all their local callees allocate nothing, use no live RNG and read no wall clock/swipe", () => {
      const text = readFileSync(new URL("./rules.ts", import.meta.url), "utf8");
      const source = ts.createSourceFile("rules.ts", text, ts.ScriptTarget.Latest, true);
      const funcs = new Map<string, ts.FunctionDeclaration>();
      for (const node of source.statements) if (ts.isFunctionDeclaration(node) && node.name) funcs.set(node.name.text, node);
      const seen = new Set<string>();
      const allocatingMethods = new Set(["slice", "splice", "map", "filter", "concat", "flat", "flatMap", "from", "of", "split",
         "join", "keys", "values", "entries", "bind", "toSorted", "toReversed", "toSpliced", "with", "assign", "create", "toString", "toFixed"]);
      const inspect = (name: string): void => {
         if (seen.has(name)) return; seen.add(name);
         const body = funcs.get(name)?.body; if (!body) throw new Error(`Missing ${name}`);
         const visit = (node: ts.Node): void => {
            if (ts.isNewExpression(node) || ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)
               || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isSpreadElement(node)
               || ts.isSpreadAssignment(node) || ts.isTemplateExpression(node)) throw new Error(`Allocation in ${name}`);
            if (ts.isCallExpression(node)) {
               if (ts.isPropertyAccessExpression(node.expression) && allocatingMethods.has(node.expression.name.text)) throw new Error(`Allocating method in ${name}`);
               if (ts.isIdentifier(node.expression)) {
                  if (["rngNext", "createRng", "structuredClone"].includes(node.expression.text)) throw new Error(`Live allocation/RNG in ${name}`);
                  if (funcs.has(node.expression.text)) inspect(node.expression.text);
               }
            }
            ts.forEachChild(node, visit);
         };
         visit(body);
      };
      inspect("step"); inspect("fillPools");
      expect(text).toMatch(/import .*rngNext.*core\/math/);
      expect(text).not.toMatch(/Math\.random\s*\(|Date\.now\s*\(|performance\.now\s*\(|setTimeout\s*\(|input\.swipe|0x6d2b79f5/);
   });
});

describe("tower-climb first-contact spur warning", () => {
   for (const side of [-1, 1]) for (const frame of [1, 16, 33, 50]) {
      it(`walking past 0.58 starts the warning in the first ms, side ${side}, frame ${frame}`, () => {
         const { run, spur, parent } = onParent(side, 0.579), start = run.timeMs;
         tower.step(run, frame, idle); expect(spur.state).toBe(tower.INTACT);
         const before = run.timeMs;
         tower.step(run, frame, { moveX: side, jumpEdge: false });
         expect(spur.state).toBe(tower.WARNING); expect(spur.warnStartMs).toBe(before + 1);
         expect(spur.deadlineMs).toBe(before + 801);
         expect(run.player.grounded).toBe(true); expect(run.launches).toBe(0);
         expect(parent.id).toBe(run.contactA); expect(run.timeMs).toBe(start + frame * 2);
      });

      it(`an exactly touching edge is not a contact, side ${side}, frame ${frame}`, () => {
         const { run, spur } = onParent(side);
         run.player.x = spur.baseX - side * (0.4 + 0.22);
         tower.step(run, frame, idle);
         expect(spur.state).toBe(tower.INTACT); expect(spur.warnStartMs).toBe(tower.NONE);
      });
   }

   it("does not refresh on straddling and removes collision at exactly 800 ms before a jump", () => {
      const { run, spur, parent } = onParent(1, 0.6);
      tower.step(run, 1, idle); const started = spur.warnStartMs;
      run.player.x = parent.baseX + 0.579; advance(run, 20);
      run.player.x = parent.baseX + 0.7; advance(run, 779);
      expect(spur.state).toBe(tower.WARNING); expect(spur.warnStartMs).toBe(started);
      tower.step(run, 1, idle);
      expect(spur.state).toBe(tower.FALLING); expect(spur.collapseMs).toBe(started + 800);
      expect(run.player.grounded).toBe(true); expect(run.contactA).toBe(parent.id);
      expect(run.coyoteUntilMs).toBe(tower.NONE);
   });
});
