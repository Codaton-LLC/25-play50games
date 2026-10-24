// Five levels (docs/arcade-levels.md §6.3 step 6) plus the spring, rocket and wind.
// Level 1 stays today's tower. The envelope is the score proof for levels that boost.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { isLevelCleared, levelEnvironment, levelInstructions, levelRunConfig, definitionLevelProblems } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVELS, type TowerLevel } from "./levels";
import { towerClimbMeta as meta } from "./meta";
import definition from "./index";
import {
   G, HEIGHT_POINTS, HOLD_MS, MOVING, MOVING_SLAB, NONE, ROCKET, SPRING, STATIC, V_JUMP, V_RUN, V_SPRING, WIND, X_BOUND,
   PROPOSED_LEVEL_LIMITS, createRun, createStepInput, fillPools, landingTime, slabX, step, validateTower,
   type StepInput, type TowerRun,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const PAIR_S = 1.288181928856438;
const LAST_S = 0.75903166664352;
const SLACK_S = 0.0505;
const idle = { moveX: 0, jumpEdge: false };

function timeAt(height: number): number {
   if (height <= 0) return HOLD_MS / 1000;
   return HOLD_MS / 1000 + LAST_S + PAIR_S * (height - 1);
}

/** Optimistic climb: pair rate, then each spring's 3 m in its apex time and each rocket's 7.1 m in ~1.86 s. */
function envelope(level: TowerLevel): { peakPps: number; peakScore: number; endScore: number } {
   const springs: number[] = [];
   for (let i = 0, y = SPRING.minHeight; i < level.springs; i++, y += SPRING.gap) springs.push(y);
   const rockets: number[] = [];
   for (let i = 0, y = ROCKET.minHeight; i < level.rockets; i++, y += ROCKET.gap) rockets.push(y);
   const events = [
      ...springs.map((h) => ({ h, kind: "spring" as const })),
      ...rockets.map((h) => ({ h, kind: "rocket" as const })),
   ].sort((a, b) => a.h - b.h);
   let t = HOLD_MS / 1000, h = 0, slack = 0, peakPps = 0, peakScore = 0;
   const note = () => {
      const score = HEIGHT_POINTS * (Math.floor(h) + slack) + 25 * Math.floor(h / 8);
      const denom = t - SLACK_S;
      if (denom <= 0) return;
      const pps = score / denom;
      if (pps > peakPps) { peakPps = pps; peakScore = score; }
   };
   const climbTo = (target: number) => {
      while (h + 1e-9 < target) {
         const next = Math.min(target, Math.floor(h) + 1);
         t += Math.max(0, timeAt(next) - timeAt(h));
         h = next;
         note();
      }
   };
   const apexT = V_SPRING / G;
   const liftT = (V_JUMP - Math.sqrt(V_JUMP * V_JUMP - 2 * G * ROCKET.lift)) / G;
   for (const ev of events) {
      if (ev.h + 1e-9 < h) continue;
      climbTo(ev.h);
      if (ev.kind === "spring") { t += apexT; h += SPRING.apex; }
      else { t += liftT + ROCKET.durationMs / 1000; h += ROCKET.lift + ROCKET.gain; slack += 1; }
      note();
   }
   const remain = 1800 - t;
   if (remain > 0) { h += remain / PAIR_S; t = 1800; note(); }
   const endScore = HEIGHT_POINTS * (Math.floor(h) + slack) + 25 * Math.floor(h / 8);
   return { peakPps, peakScore, endScore };
}

function travelOf(level: TowerLevel, index: number, kind: number): number {
   if (kind !== MOVING) return 0;
   return index % 16 === 1 ? MOVING_SLAB.travel : level.movingTravel;
}

function layoutsMatch(a: TowerRun, b: TowerRun): boolean {
   const A = a.tower, B = b.tower;
   if (A.heights.length !== B.heights.length) return false;
   for (let i = 0; i < A.heights.length; i++) {
      if (A.heights[i] !== B.heights[i] || A.xs[i] !== B.xs[i] || A.kinds[i] !== B.kinds[i]) return false;
   }
   if (A.decoration.length !== B.decoration.length) return false;
   for (let i = 0; i < A.decoration.length; i++) if (A.decoration[i] !== B.decoration[i]) return false;
   return true;
}

describe("tower-climb levels: declarations", () => {
   it("declares five levels and the proposed limits, with level 1 equal to today's scoring", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.levels![0].scoring).toBe(meta.scoring);
      expect(meta.levels!.map((level) => level.clearScore)).toEqual([500, 800, 1200, 1700, undefined]);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(levelRunConfig(definition, 1).durationMs).toBe(1_800_000);
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["day", "day", "sunset", "night", "sunset"]);
   });

   it("level 1 is today's motion, and a short replay matches a run built with the level", () => {
      expect(LEVELS[1]).toMatchObject({ movingTravel: 0.2, periodMs: 2000, warningMs: 800, springs: 0, rockets: 0, winds: 0, fireworks: false });
      const plain = createRun(5050), leveled = createRun(5050, LEVELS[1]);
      expect(layoutsMatch(plain, leveled)).toBe(true);
      expect(plain.tower.spurCount).toBe(leveled.tower.spurCount);
      const input = { moveX: 1, jumpEdge: false };
      for (let i = 0; i < 40; i++) {
         step(plain, 50, input); step(leveled, 50, input);
      }
      expect(leveled.player).toEqual(plain.player);
      expect(leveled.score).toBe(plain.score);
      expect(leveled.maxHeight).toBe(plain.maxHeight);
      expect(leveled.limits).toBe(meta.scoring);
   });
});

describe("tower-climb levels: difficulty and the permanent route", () => {
   it("gets harder without dropping a warning under the flight or the walk-back", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const prev = LEVELS[(id - 1) as LevelId], next = LEVELS[id];
         expect(next.movingTravel).toBeGreaterThanOrEqual(prev.movingTravel);
         expect(next.periodMs).toBeLessThanOrEqual(prev.periodMs);
         expect(next.spurPresent / next.spurTotal).toBeGreaterThanOrEqual(prev.spurPresent / prev.spurTotal);
         expect(next.warningMs).toBeLessThanOrEqual(prev.warningMs);
         expect(next.springs).toBeGreaterThanOrEqual(prev.springs);
         expect(next.rockets).toBeGreaterThanOrEqual(prev.rockets);
         expect(next.winds).toBeGreaterThanOrEqual(prev.winds);
      }
      for (const id of LEVEL_IDS) expect(LEVELS[id].warningMs).toBeGreaterThanOrEqual(720);
      expect(LEVELS[2].fireworks).toBe(true);
      expect(LEVELS[1].fireworks).toBe(false);
      expect(LEVELS[3].fireworks).toBe(false);
   });

   it("levels 2-5 keep level 1's heights and decoration, and place more spurs", () => {
      for (const seed of [1, 7, 5050]) {
         const base = createRun(seed);
         for (const id of [2, 3, 4, 5] as const) expect(layoutsMatch(base, createRun(seed, LEVELS[id]))).toBe(true);
         const moved = createRun(seed, LEVELS[2]);
         let phasesDiffer = false;
         for (let i = 0; i < base.tower.phases.length; i++) if (base.tower.kinds[i] === MOVING && base.tower.phases[i] !== moved.tower.phases[i]) phasesDiffer = true;
         expect(phasesDiffer).toBe(true);
      }
      let low = 0, high = 0;
      for (let seed = 1; seed <= 30; seed++) {
         low += createRun(seed).tower.spurCount;
         high += createRun(seed, LEVELS[2]).tower.spurCount;
      }
      expect(high).toBeGreaterThan(low);
   });

   it("every required step is reachable on 200 seeds, with or without the new travel", () => {
      for (const id of LEVEL_IDS) for (let seed = 1; seed <= 200; seed++) {
         const run = createRun(seed * 17 + id, LEVELS[id]);
         expect(validateTower(run.tower)).toBe(true);
         const data = run.tower;
         for (let i = 1; i < data.heights.length; i++) {
            const rise = (data.heights[i] - data.heights[i - 1]) / 1000;
            const dx = Math.abs(data.xs[i] - data.xs[i - 1]) / 1000;
            const worst = dx + travelOf(LEVELS[id], i, data.kinds[i]) + travelOf(LEVELS[id], i - 1, data.kinds[i - 1]);
            const reach = V_RUN * landingTime(rise);
            if (!(worst <= reach - 0.04)) throw new Error(`level ${id} seed ${seed} step ${i} gap ${worst} reach ${reach}`);
         }
      }
   });
});

describe("tower-climb spring pads", () => {
   it("launches to a 3 m apex and only from an ordinary static slab", () => {
      expect(V_SPRING * V_SPRING / (2 * G)).toBeCloseTo(SPRING.apex, 6);
      for (const id of [1, 2] as const) expect(createRun(5050, LEVELS[id]).springCount).toBe(0);
      for (const id of [3, 4, 5] as const) {
         const run = createRun(5050, LEVELS[id]);
         expect(run.springCount).toBeGreaterThan(0);
         expect(run.springCount).toBeLessThanOrEqual(LEVELS[id].springs);
         for (let i = 0; i < run.springCount; i++) {
            const parent = run.springParent[i], target = run.springTarget[i];
            expect(run.tower.kinds[parent]).toBe(STATIC);
            expect(parent % 16).not.toBe(0);
            expect(run.tower.spurForParent[parent]).toBe(NONE);
            const rise = (run.tower.heights[target] - run.tower.heights[parent]) / 1000;
            expect(rise).toBeGreaterThanOrEqual(SPRING.minRise);
            expect(rise).toBeLessThanOrEqual(SPRING.maxRise);
            const dx = Math.abs(run.tower.xs[target] - run.tower.xs[parent]) / 1000 + travelOf(LEVELS[id], target, run.tower.kinds[target]);
            expect(V_RUN * landingTime(rise, V_SPRING)).toBeGreaterThanOrEqual(dx + 0.05);
         }
         const again = createRun(5050, LEVELS[id]);
         expect(Array.from(again.springParent.subarray(0, run.springCount))).toEqual(Array.from(run.springParent.subarray(0, run.springCount)));
      }
   });

   it("a centre landing springs, and an edge landing does not", () => {
      const run = createRun(11, LEVELS[3]);
      const parent = run.springParent[0];
      const y = run.tower.heights[parent] / 1000, x = run.tower.xs[parent] / 1000;
      const drop = (feetX: number) => {
         const copy = createRun(11, LEVELS[3]);
         // Drop the start contact first, or the pool will not recycle up to this pad.
         copy.player.grounded = false; copy.contactA = copy.contactB = NONE; copy.player.groundIndex = NONE;
         copy.holdUnlocked = true; copy.permission = false; copy.timeMs = 8000; copy.maxHeight = y + 0.4;
         copy.viewBottomY = copy.maxHeight - 2;
         fillPools(copy);
         copy.player.x = feetX; copy.player.y = y + 0.35; copy.player.vx = 0; copy.player.vy = 0;
         copy.flight.atMs = copy.timeMs; copy.flight.y = y + 0.35; copy.flight.vy = 0;
         for (let i = 0; i < 40; i++) step(copy, 50, idle);
         return copy;
      };
      const sprung = drop(x);
      expect(sprung.maxHeight).toBeCloseTo(y + SPRING.apex, 1);
      expect(sprung.springPad).toBe(parent);
      const edge = drop(x + 0.55);
      expect(edge.springPad).toBe(NONE);
      expect(edge.maxHeight).toBeLessThan(y + 1);
   });
});

describe("tower-climb rockets and wind", () => {
   it("places rockets only where the burnout still has a landing, and never before level 4", () => {
      for (const id of [1, 2, 3] as const) expect(createRun(3, LEVELS[id]).rocketCount).toBe(0);
      for (const id of [4, 5] as const) {
         const run = createRun(3, LEVELS[id]);
         expect(run.rocketCount).toBeGreaterThan(0);
         expect(run.rocketCount).toBeLessThanOrEqual(LEVELS[id].rockets);
         for (let i = 0; i < run.rocketCount; i++) {
            const parent = run.rocketParent[i], target = run.rocketTarget[i];
            expect(run.tower.kinds[parent]).toBe(STATIC);
            expect(parent % 16).not.toBe(0);
            expect(run.tower.kinds[target]).not.toBe(MOVING);
            const rise = run.tower.heights[target] / 1000 - run.tower.heights[parent] / 1000;
            const dx = Math.abs(run.tower.xs[target] - run.tower.xs[parent]) / 1000;
            expect(rise).toBeGreaterThanOrEqual(ROCKET.landLow);
            expect(rise).toBeLessThanOrEqual(ROCKET.landHigh);
            expect(dx).toBeLessThanOrEqual(1.2);
            // a grab near the slab still flies past this top; the burn plus the fall covers dx
            const drop = ROCKET.gain - rise;
            expect(drop).toBeGreaterThan(0.05);
            const fallT = Math.sqrt((2 * drop) / G);
            expect(V_RUN * (ROCKET.durationMs / 1000 + fallT)).toBeGreaterThanOrEqual(dx + ROCKET.reach + 0.05);
            // a grab at the 0.8 m jump apex still has this top above the loss line
            expect(rise).toBeGreaterThanOrEqual(0.8 + ROCKET.gain - 2 + 0.15);
            for (let s = 0; s < run.springCount; s++) expect(run.springParent[s]).not.toBe(parent);
         }
      }
   });

   it("a pickup flies 6.4 m in 1.6 s and then falls, while standing on the slab does not collect it", () => {
      const run = createRun(9, LEVELS[4]);
      const parent = run.rocketParent[0];
      const y = run.tower.heights[parent] / 1000, x = run.tower.xs[parent] / 1000;
      run.holdUnlocked = true; run.timeMs = 9000; run.maxHeight = y + 0.5; run.viewBottomY = y - 1.5;
      fillPools(run);
      run.player.x = x; run.player.y = y; run.player.grounded = true; run.player.groundIndex = parent; run.player.vx = 0;
      step(run, 50, idle);
      expect(run.boostUntilMs).toBe(NONE);
      run.player.grounded = false; run.player.y = y + 0.45; run.player.vy = 1;
      run.flight.atMs = run.timeMs; run.flight.y = run.player.y; run.flight.vy = 1;
      // 1 ms steps, so the collecting step does not also fly part of the burn
      let guard = 0;
      while (run.boostUntilMs < 0 && guard++ < 40) step(run, 1, idle);
      expect(run.boostUntilMs).toBe(run.timeMs + ROCKET.durationMs);
      const startY = run.player.y, until = run.boostUntilMs;
      while (run.timeMs < until && !run.ended) step(run, 50, { moveX: 1, jumpEdge: false });
      expect(run.rocketDropY - startY).toBeCloseTo(ROCKET.gain, 2);
      expect(run.rocketDropMs).toBe(until);
      expect(run.boostUntilMs).toBe(NONE);
      expect(run.player.x).toBeGreaterThan(x);
      const before = run.player.vy;
      step(run, 50, idle);
      expect(run.player.vy).toBeLessThan(before);
      expect(run.player.vy).toBeLessThanOrEqual(0);
   });

   it("wind pushes only outside the route corridor", () => {
      expect(WIND.xInner).toBeGreaterThan(1.4);
      const run = createRun(4, LEVELS[5]);
      expect(run.windCount).toBe(LEVELS[5].winds);
      for (let i = 1; i < run.tower.heights.length; i++) {
         const centre = Math.abs(run.tower.xs[i] / 1000) + travelOf(LEVELS[5], i, run.tower.kinds[i]);
         expect(centre).toBeLessThanOrEqual(1.4 + 1e-9);
      }
      const blow = (x: number) => {
         const copy = createRun(4, LEVELS[5]);
         copy.holdUnlocked = true; copy.timeMs = 5000; copy.maxHeight = 50; copy.viewBottomY = 40;
         copy.player.grounded = false; copy.player.x = x; copy.player.y = 40; copy.player.vx = 0; copy.player.vy = 0;
         copy.flight.atMs = copy.timeMs; copy.flight.y = 40; copy.flight.vy = 0;
         const from = copy.player.x;
         step(copy, 50, idle); step(copy, 50, idle);
         return copy.player.x - from;
      };
      expect(blow(1.75)).toBeGreaterThan(0.1);
      expect(blow(0)).toBeCloseTo(0, 2);
      expect(Math.abs(blow(1.75))).toBeLessThan(X_BOUND);
   });
});

describe("tower-climb level score envelope", () => {
   it("stays inside the proposed limits and fills at least 90% of each maxScore", () => {
      for (const id of LEVEL_IDS) {
         const env = envelope(LEVELS[id]);
         const limits = PROPOSED_LEVEL_LIMITS[id];
         expect(env.peakPps, `level ${id} peak ${env.peakPps}`).toBeLessThanOrEqual(limits.maxPointsPerSec);
         expect(env.endScore).toBeLessThanOrEqual(limits.maxScore);
         expect(env.endScore).toBeGreaterThanOrEqual(limits.maxScore * 0.9);
         expect(capScore(env.endScore, 1_800_000, limits)).toBe(env.endScore);
         expect(withinServerLimits(env.peakScore, Math.ceil(env.peakScore / env.peakPps * 1000), limits)).toBe(true);
      }
   });
});

function steer(run: TowerRun, index: number, out: StepInput): void {
   const p = run.player;
   const ty = run.tower.heights[index] / 1000;
   const slot = run.slabs[index % 32];
   const live = slot.active && slot.index === index ? slot : null;
   let remain = 0.45, when = run.timeMs + 450;
   if (!p.grounded && run.boostUntilMs >= 0) {
      const boost = Math.max(0, (run.boostUntilMs - run.timeMs) / 1000);
      const drop = Math.max(0, p.y + ROCKET.speed * boost - ty);
      remain = boost + Math.sqrt((2 * drop) / G);
      when = run.timeMs + remain * 1000;
   } else if (!p.grounded) {
      const t = landingTime(Math.max(0, ty - run.flight.y), run.flight.vy);
      if (Number.isFinite(t)) {
         remain = Math.max(0.001, (run.flight.atMs - run.timeMs) / 1000 + t);
         when = run.flight.atMs + t * 1000;
      }
   }
   const target = live ? slabX(live, when) : run.tower.xs[index] / 1000;
   const distance = target - p.x;
   if (p.grounded) {
      if (Math.abs(distance) <= 1.5) out.jumpEdge = true;
      else out.moveX = Math.sign(distance);
      return;
   }
   out.moveX = Math.max(-1, Math.min(1, distance / (3 * Math.max(0.04, remain))));
}

function levelClimb(run: TowerRun, out: StepInput): void {
   const p = run.player;
   out.jumpEdge = false; out.moveX = 0;
   if (!run.holdUnlocked || run.pendingLose || run.ended) return;
   let index = p.groundIndex + 1;
   // Steer at the rocket's landing for the whole burn and the fall. A later jump has cleared boostAim.
   if (!p.grounded && run.boostAim >= 0) index = run.boostAim;
   else if (!p.grounded && run.flight.vy > V_JUMP && run.springPad >= 0) {
      for (let i = 0; i < run.springCount; i++) if (run.springParent[i] === run.springPad) { index = run.springTarget[i]; break; }
   }
   if (index < 1 || index >= run.tower.heights.length) return;
   steer(run, index, out);
}

const CLEAR_M = [0, 50, 80, 120, 170, 250];

describe("tower-climb honest climbs", () => {
   it("an idle run scores 0 and never clears", () => {
      const run = createRun(1, LEVELS[1]);
      for (let i = 0; i < 200; i++) step(run, 50, idle);
      expect(run.score).toBe(0);
      expect(isLevelCleared("lose", run.score, meta.levels![0])).toBe(false);
   });

   it("reaches each level's height target", () => {
      const seeds = [1, 2, 3, 7, 11, 42, 100, 5050];
      const cleared: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const id of LEVEL_IDS) for (const seed of seeds) {
         const run = createRun(seed, LEVELS[id]);
         const controls = createStepInput();
         const goal = CLEAR_M[id];
         const limit = timeAt(goal) * 3 * 1000;
         while (!run.ended && run.metres < goal && run.timeMs < limit) {
            levelClimb(run, controls);
            step(run, 50, controls);
         }
         if (run.metres >= goal) cleared[id]++;
         else throw new Error(`level ${id} seed ${seed} reached ${run.metres}m in ${run.timeMs}ms (${run.ended})`);
         const level = meta.levels![id - 1];
         if (level.clearScore !== undefined) expect(isLevelCleared("lose", run.score, level)).toBe(true);
         else          expect(isLevelCleared("lose", run.score, level)).toBe(false);
      }
      for (const id of LEVEL_IDS) expect(cleared[id]).toBe(seeds.length);
   });
});
