import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   CAULDRON_BODY,
   CLEAN_POINTS,
   MAX_SPEED,
   RECIPE_POINTS,
   WANDER_LEN,
   POT_STAND,
   RADIUS,
   STUN_S,
   TIME_BONUS_PER_SECOND,
   USE_RANGE,
   WANDER_PERIOD,
   createRun,
   idleInput,
   itemXZ,
   objectiveCeiling,
   shelfFor,
   step,
   timeBonus,
   PROPOSED_LEVEL_LIMITS,
   type Ingredient,
   type LabInput,
   type Run,
} from "./rules";

type Style = "oracle" | "human" | "idle" | "spam";

const P = { x: 0, z: 0 };
const Q = { x: 0, z: 0 };

function standAt(x: number, z: number): { x: number; z: number } {
   const d = Math.hypot(x, z) || 1;
   const r = Math.max(POT_STAND + 0.15, d - 0.85);
   return { x: (x / d) * r, z: (z / d) * r };
}

function potPoint(run: Run): { x: number; z: number } {
   let x = run.hero.x;
   let z = run.hero.z;
   let d = Math.hypot(x, z);
   if (d < 0.2) {
      x = 0;
      z = 1;
      d = 1;
   }
   return { x: (x / d) * POT_STAND, z: (z / d) * POT_STAND };
}

function goal(run: Run): { x: number; z: number; mode: "item" | "pot"; type: Ingredient } | null {
   if (run.over) return null;
   if (run.carried) {
      const at = potPoint(run);
      return { ...at, mode: "pot", type: run.carried };
   }
   let best: { x: number; z: number; d: number; type: Ingredient } | null = null;
   for (const recipe of run.recipes) {
      if (!recipe.open || recipe.done) continue;
      const type = recipe.steps[recipe.at];
      const shelf = shelfFor(run, type);
      if (!shelf) continue;
      itemXZ(shelf, run.time, P);
      const at = standAt(P.x, P.z);
      const d = Math.hypot(at.x - run.hero.x, at.z - run.hero.z);
      if (!best || d < best.d) best = { ...at, d, type };
   }
   return best ? { x: best.x, z: best.z, mode: "item", type: best.type } : null;
}

function wantsPress(run: Run, at: { mode: "item" | "pot"; type: Ingredient }): boolean {
   if (at.mode === "pot") {
      const dPot = Math.hypot(run.hero.x, run.hero.z);
      if (dPot > USE_RANGE - 0.04 || !run.carried) return false;
      const shelf = shelfFor(run, run.carried);
      if (!shelf) return true;
      itemXZ(shelf, run.time, P);
      return dPot < Math.hypot(run.hero.x - P.x, run.hero.z - P.z);
   }
   const shelf = shelfFor(run, at.type);
   if (!shelf) return false;
   itemXZ(shelf, run.time, P);
   const d = Math.hypot(run.hero.x - P.x, run.hero.z - P.z);
   if (d > 1.05) return false;
   for (const other of run.shelves) {
      if (other.type === at.type) continue;
      itemXZ(other, run.time, Q);
      if (Math.hypot(run.hero.x - Q.x, run.hero.z - Q.z) < d) return false;
   }
   return true;
}

interface Memory { arm: number; fired: boolean; still: number; side: number }

function drive(run: Run, input: LabInput, dt: number, style: Style, rng: () => number, mem: Memory): void {
   input.moveX = 0;
   input.moveY = 0;
   input.actionPressed = false;
   input.yaw = 0;
   if (style === "idle" || run.over) return;
   if (run.hero.stun > 0) {
      mem.fired = false;
      mem.arm = 0;
      return;
   }
   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      input.actionPressed = rng() > 0.72;
      return;
   }
   const at = goal(run);
   if (!at) return;
   const dx = at.x - run.hero.x;
   const dz = at.z - run.hero.z;
   const len = Math.hypot(dx, dz) || 1;
   const stick = style === "human" ? 0.9 : 1;
   let mx = (dx / len) * stick;
   let my = (dz / len) * stick;
   const speed = Math.hypot(run.hero.vx, run.hero.vz);
   if (speed < 0.12 && len > 0.5) mem.still += dt;
   else mem.still = 0;
   if (mem.still > 0.32) {
      mx += mem.side * 0.85;
      my += mem.side * 0.2;
      if (mem.still > 0.62) mem.side = -mem.side;
   }
   input.moveX = mx;
   input.moveY = my;
   if (!wantsPress(run, at)) {
      mem.arm = 0;
      mem.fired = false;
      return;
   }
   if (len < 0.22) {
      input.moveX = 0;
      input.moveY = 0;
   }
   mem.arm += dt;
   if (mem.fired) return;
   if (style === "human" && mem.arm < 0.16) return;
   input.actionPressed = true;
   mem.fired = true;
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({
      durationMs: level.durationMs,
      lives: level.wrongCostsLife ? level.lives : undefined,
      resultDelayMs: 900,
   });
   store.getState().markReady();
   store.getState().start();
   const input = idleInput();
   const mem: Memory = { arm: 0, fired: false, still: 0, side: 1 };
   const rng = createRng((seed + 1) * 10007 + id * 17 + (style === "spam" ? 3 : 0));
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

function atPot(run: Run): void {
   run.hero.x = 0;
   run.hero.z = POT_STAND;
   run.hero.vx = 0;
   run.hero.vz = 0;
   run.hero.stun = 0;
}

function press(run: Run, timeLeft = 100_000) {
   const input = idleInput();
   input.actionPressed = true;
   return step(run, input, 1 / 60, timeLeft);
}

describe("wizard layout", () => {
   it("is the same run for the same seed, and every recipe is on the shelves", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 200; seed++) {
            const a = createRun(seed, LEVELS[id]);
            const b = createRun(seed, LEVELS[id]);
            expect(a.recipes.map((r) => r.steps)).toEqual(b.recipes.map((r) => r.steps));
            expect(a.shelves.map((s) => [s.type, s.x, s.z, s.wander])).toEqual(b.shelves.map((s) => [s.type, s.x, s.z, s.wander]));
            expect(a.recipes).toHaveLength(LEVELS[id].recipes);
            const have = new Set(a.shelves.map((s) => s.type));
            expect(a.shelves.length).toBe(have.size);
            let open = 0;
            for (const recipe of a.recipes) {
               expect(recipe.steps).toHaveLength(LEVELS[id].steps);
               for (let i = 0; i < recipe.steps.length; i++) {
                  expect(have.has(recipe.steps[i])).toBe(true);
                  if (i > 0) expect(recipe.steps[i]).not.toBe(recipe.steps[i - 1]);
               }
               if (recipe.open) open += 1;
            }
            expect(open).toBe(LEVELS[id].dual ? 2 : 1);
            expect(a.shelves.filter((s) => s.wander)).toHaveLength(LEVELS[id].wander ? 1 : 0);
         }
      }
   });

   it("keeps a wander path inside the lab and outside the cauldron", () => {
      for (const id of [3, 4, 5] as const) {
         for (let seed = 0; seed < 200; seed++) {
            const run = createRun(seed, LEVELS[id]);
            const shelf = run.shelves.find((s) => s.wander);
            expect(shelf).toBeTruthy();
            for (let i = 0; i <= 24; i++) {
               itemXZ(shelf!, (i / 24) * WANDER_PERIOD, P);
               const d = Math.hypot(P.x, P.z);
               expect(d).toBeLessThan(LEVELS[id].radius - 0.25);
               expect(d).toBeGreaterThan(CAULDRON_BODY + 0.4);
            }
            const ends = [0.25, 0.75].map((u) => {
               itemXZ(shelf!, u * WANDER_PERIOD, P);
               return { x: P.x, z: P.z };
            });
            expect(Math.hypot(ends[0].x - ends[1].x, ends[0].z - ends[1].z)).toBeCloseTo(3, 5);
         }
      }
   });
});

describe("wizard cauldron", () => {
   it("refuses an item that is not a current head, including a later step on dual", () => {
      const run = createRun(4, LEVELS[5]);
      for (const recipe of run.recipes) {
         recipe.open = false;
         recipe.done = false;
         recipe.at = 0;
      }
      run.recipes[0].steps = ["mushroom", "crystal", "berry", "herb", "flower"];
      run.recipes[0].open = true;
      run.recipes[1].steps = ["berry", "crystal", "mushroom", "flower", "herb"];
      run.recipes[1].open = true;
      atPot(run);
      run.carried = "crystal";
      press(run);
      expect(run.carried).toBeNull();
      expect(run.recipes[0].at).toBe(0);
      expect(run.recipes[1].at).toBe(0);
      expect(run.score).toBe(0);
      expect(run.ev.wrong).toBe(true);
      expect(run.hero.stun).toBe(STUN_S);

      run.recipes[0].at = 1;
      run.hero.stun = 0;
      run.carried = "crystal";
      press(run);
      expect(run.ev.added).toBe(true);
      expect(run.recipes[0].at).toBe(2);
      expect(run.recipes[1].at).toBe(0);
      expect(run.score).toBe(0);
   });

   it("returns a wrong ingredient and does not advance the recipe", () => {
      const run = createRun(1, LEVELS[2]);
      const before = run.recipes[0].at;
      atPot(run);
      run.carried = "bottle";
      if (run.recipes[0].steps[0] === "bottle") run.recipes[0].steps[0] = "mushroom";
      const score = run.score;
      press(run);
      expect(run.carried).toBeNull();
      expect(run.recipes[0].at).toBe(before);
      expect(run.score).toBe(score);
      expect(run.recipes[0].clean).toBe(false);
   });

   it("stuns for 0.60 s on keyboard and on touch, and level 1 spends no life", () => {
      const stunFor = (label: string) => {
         const run = createRun(label === "touch" ? 2 : 2, LEVELS[1]);
         expect(run.lives).toBe(0);
         atPot(run);
         run.carried = "bottle";
         run.recipes[0].steps[0] = "mushroom";
         press(run);
         expect(run.ev.lifeLost).toBe(false);
         expect(run.lives).toBe(0);
         expect(run.over).toBeNull();
         const input = idleInput();
         input.actionPressed = true;
         let t = 0;
         while (run.hero.stun > 0 && t < 2) {
            step(run, input, 1 / 60, 120_000);
            t += 1 / 60;
         }
         expect(run.recipes[0].at).toBe(0);
         return t;
      };
      const keyboard = stunFor("keyboard");
      const touch = stunFor("touch");
      expect(keyboard).toBeGreaterThanOrEqual(STUN_S - 1 / 60);
      expect(keyboard).toBeLessThan(STUN_S + 1 / 30);
      expect(touch).toBeCloseTo(keyboard, 5);
   });

   it("level 2 spends a life on a wrong add and loses on the third", () => {
      const run = createRun(3, LEVELS[2]);
      expect(run.lives).toBe(3);
      for (let i = 0; i < 3; i++) {
         atPot(run);
         run.hero.stun = 0;
         run.carried = "bottle";
         run.recipes[0].steps[0] = "mushroom";
         press(run);
         expect(run.ev.lifeLost).toBe(true);
         expect(run.score).toBe(0);
      }
      expect(run.lives).toBe(0);
      expect(run.over).toBe("lose");
      expect(run.ev.lost).toBe(true);
   });

   it("puts the ingredient back when the shelf is closer than the cauldron", () => {
      const run = createRun(5, LEVELS[1]);
      const shelf = run.shelves[0];
      run.hero.x = shelf.x;
      run.hero.z = shelf.z;
      run.hero.vx = 0;
      run.hero.vz = 0;
      press(run);
      expect(run.carried).toBe(shelf.type);
      press(run);
      expect(run.carried).toBeNull();
      expect(run.score).toBe(0);
      expect(run.ev.wrong).toBe(false);
   });

   it("scores 380 for a clean recipe, 300 after a wrong add, and the clock only on a win", () => {
      const run = createRun(6, LEVELS[1]);
      const recipe = run.recipes[0];
      for (let i = 0; i < recipe.steps.length; i++) {
         atPot(run);
         run.carried = recipe.steps[recipe.at];
         press(run, 90_000);
      }
      expect(recipe.done).toBe(true);
      expect(run.score).toBe(380);
      expect(run.over).toBeNull();
      expect(timeBonus(90_000)).toBe(TIME_BONUS_PER_SECOND * 90);
      expect(objectiveCeiling(LEVELS[1])).toBe(760);

      const dirty = createRun(7, LEVELS[1]);
      atPot(dirty);
      dirty.carried = "bottle";
      dirty.recipes[0].steps[0] = "mushroom";
      press(dirty);
      const next = dirty.recipes[0];
      for (let i = 0; i < next.steps.length; i++) {
         atPot(dirty);
         dirty.hero.stun = 0;
         dirty.carried = next.steps[next.at];
         press(dirty, 50_000);
      }
      expect(dirty.score).toBe(300);
      expect(dirty.over).toBeNull();

      const win = createRun(8, LEVELS[1]);
      win.recipes[1].done = true;
      win.recipes[1].open = false;
      win.done = 1;
      const last = win.recipes[0];
      for (let i = 0; i < last.steps.length; i++) {
         atPot(win);
         win.carried = last.steps[last.at];
         press(win, 80_000);
      }
      expect(win.over).toBe("win");
      expect(win.score).toBe(380 + timeBonus(80_000));
   });

   it("moves the same way for the same stick, and stays outside the cauldron", () => {
      const shift = (yaw: number) => {
         const run = createRun(1, LEVELS[1]);
         const input = idleInput();
         input.moveX = 0.4;
         input.moveY = -0.7;
         input.yaw = yaw;
         for (let i = 0; i < 40; i++) step(run, input, 1 / 60, 120_000);
         return { x: run.hero.x, z: run.hero.z };
      };
      expect(shift(0.6)).toEqual(shift(0.6));
      const run = createRun(2, LEVELS[4]);
      const input = idleInput();
      input.moveY = -1;
      for (let i = 0; i < 240; i++) step(run, input, 1 / 60, 180_000);
      const d = Math.hypot(run.hero.x, run.hero.z);
      expect(d).toBeGreaterThanOrEqual(CAULDRON_BODY + RADIUS - 0.02);
      expect(d).toBeLessThanOrEqual(LEVELS[4].radius - RADIUS + 0.02);
   });
});

describe("wizard score limits", () => {
   it("an honest bot, an idle bot and a spam bot stay inside each level's limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let best = 0;
         let bestMs = Infinity;
         let wins = 0;
         for (let seed = 0; seed < 8; seed++) {
            for (const hz of [30, 60]) {
               const oracle = play(id, seed, hz, "oracle");
               if (!withinServerLimits(oracle.score, oracle.ms, limits)) {
                  console.log(`L${id} oracle over ${oracle.score} at ${oracle.ms} ms (${oracle.reason})`);
               }
               expect(withinServerLimits(oracle.score, oracle.ms, limits)).toBe(true);
               expect(capScore(oracle.score, oracle.ms, limits)).toBe(oracle.score);
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
            expect(capScore(human.score, human.ms, limits)).toBe(human.score);
            const idle = play(id, seed, 20, "idle");
            expect(idle.score).toBe(0);
            expect(idle.reason).not.toBe("win");
            expect(withinServerLimits(idle.score, idle.ms, limits)).toBe(true);
            const spam = play(id, seed, 30, "spam");
            if (!withinServerLimits(spam.score, spam.ms, limits)) {
               console.log(`L${id} spam over ${spam.score} at ${spam.ms} ms (${spam.reason})`);
            }
            expect(withinServerLimits(spam.score, spam.ms, limits)).toBe(true);
            expect(capScore(spam.score, spam.ms, limits)).toBe(spam.score);
         }
         const fast = play(id, 1, 144, "oracle");
         expect(withinServerLimits(fast.score, fast.ms, limits)).toBe(true);
         console.log(`L${id} oracle wins ${wins}/16 best ${best} at ${bestMs} ms (max ${limits.maxScore})`);
         expect(wins).toBeGreaterThan(0);
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }
   }, 180_000);
});

describe("wizard clearing", () => {
   it("a level clears only on a win: a paced player wins at least 99% of 100 seeds, the oracle stays inside the limits on 60 more, an idle one never wins", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let won = 0;
         for (let seed = 0; seed < 100; seed++) {
            const human = play(id, seed + 1000, 30, "human");
            expect(withinServerLimits(human.score, human.ms, limits)).toBe(true);
            if (human.reason === "win") won += 1;
         }
         expect(won / 100, `level ${id}`).toBeGreaterThanOrEqual(0.99);
         for (let seed = 0; seed < 60; seed++) {
            const oracle = play(id, seed + 2000, seed % 2 ? 60 : 144, "oracle");
            expect(withinServerLimits(oracle.score, oracle.ms, limits)).toBe(true);
         }
         const idle = play(id, 3, 20, "idle");
         expect(idle.reason).not.toBe("win");
         expect(idle.score).toBe(0);
      }
   }, 900_000);
});

describe("wizard spec literals", () => {
   it("keeps the spec's numbers: radius 0.36, top speed 4.4, use range 1.2, stun 0.60, +300 / +80 / +4 per second, a 3 m wander", () => {
      expect(RADIUS).toBe(0.36);
      expect(MAX_SPEED).toBe(4.4);
      expect(USE_RANGE).toBe(1.2);
      expect(STUN_S).toBe(0.6);
      expect(RECIPE_POINTS).toBe(300);
      expect(CLEAN_POINTS).toBe(80);
      expect(TIME_BONUS_PER_SECOND).toBe(4);
      expect(WANDER_LEN).toBe(3);
      expect(timeBonus(10_999)).toBe(40);
   });
});
