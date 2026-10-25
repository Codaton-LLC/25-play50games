import { describe, expect, it } from "vitest";
import { hasLineOfSightXZ } from "@/arcade3d/core/ai";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   HOP_S,
   LANE_HALF,
   LIVES,
   MERCY_S,
   RADIUS,
   ROOM_LEN,
   START,
   STREAK_CAP,
   TIME_BONUS_PER_SECOND,
   TREAT_POINTS,
   TOY_POINTS,
   createRun,
   idleInput,
   objectiveCeiling,
   onBed,
   pushOutXZ,
   step,
   timeBonus,
   PROPOSED_LEVEL_LIMITS,
   type CatInput,
   type Run,
} from "./rules";

type Style = "honest" | "idle" | "spam";

const CELL = 0.2;
const WALL = 2.2;

/** Walkable centre points: inside the walls, clear of every box by the cat's radius. */
function walkable(run: Run, x: number, z: number): boolean {
   if (Math.abs(x) > WALL || z < 0.2 || z > run.level.rooms * ROOM_LEN - 0.2) return false;
   for (const box of run.blockers) {
      const m = RADIUS + 0.05;
      if (x > box.min.x - m && x < box.max.x + m && z > box.min.z - m && z < box.max.z + m) return false;
   }
   return true;
}

/** Breadth-first flood from the start over the walkable grid: which points the cat can reach. */
function reachable(run: Run): (x: number, z: number) => boolean {
   const length = run.level.rooms * ROOM_LEN;
   const nx = Math.round((2 * WALL) / CELL) + 1;
   const nz = Math.round(length / CELL) + 1;
   const cellX = (i: number) => -WALL + i * CELL;
   const cellZ = (j: number) => j * CELL;
   const seen = new Uint8Array(nx * nz);
   const ok = new Uint8Array(nx * nz);
   for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) ok[i * nz + j] = walkable(run, cellX(i), cellZ(j)) ? 1 : 0;
   const nearest = (x: number, z: number) => ({ i: Math.round((x + WALL) / CELL), j: Math.round(z / CELL) });
   const s = nearest(START.x, START.z);
   const queue = [s.i * nz + s.j];
   seen[s.i * nz + s.j] = 1;
   for (let q = 0; q < queue.length; q++) {
      const n = queue[q];
      const i = Math.floor(n / nz);
      const j = n % nz;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
         const a = i + di;
         const b = j + dj;
         if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
         const m = a * nz + b;
         if (!ok[m] || seen[m]) continue;
         seen[m] = 1;
         queue.push(m);
      }
   }
   return (x, z) => {
      const p = nearest(x, z);
      return p.i >= 0 && p.j >= 0 && p.i < nx && p.j < nz && seen[p.i * nz + p.j] === 1;
   };
}

function nextTarget(run: Run): { x: number; z: number; key: string } {
   let best: { x: number; z: number; key: string; d: number } | null = null;
   for (let i = 0; i < run.treats.length; i++) {
      const t = run.treats[i];
      if (t.got) continue;
      const d = Math.hypot(t.x - run.cat.x, t.z - run.cat.z);
      if (!best || d < best.d) best = { x: t.x, z: t.z, key: `t${i}:${run.lives}`, d };
   }
   if (best) return best;
   return { x: run.home.x, z: run.home.z, key: `home:${run.lives}` };
}

interface Bot {
   follower: PathFollower | null;
   key: string;
   dir: { dirX: number; dirZ: number };
}

function drive(run: Run, input: CatInput, style: Style, rng: () => number, bot: Bot, grid: ReturnType<typeof createGrid>, free: Uint8Array): void {
   input.moveX = 0;
   input.moveY = 0;
   input.jumpPressed = false;
   input.yaw = 0;
   if (style === "idle" || run.over) return;
   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      input.jumpPressed = rng() > 0.9;
      return;
   }
   const target = nextTarget(run);
   if (!bot.follower || bot.key !== target.key) {
      bot.follower = followPath(grid, free, run.cat.x, run.cat.z, target.x, target.z);
      bot.key = target.key;
   }
   steer(grid, bot.follower, run.cat.x, run.cat.z, bot.dir);
   // A human-paced stick (0.9) and a hop when a vacuum is about to touch the cat.
   input.moveX = bot.dir.dirX * 0.9;
   input.moveY = bot.dir.dirZ * 0.9;
   const near = run.vacuums.some((v) => Math.hypot(v.agent.x - run.cat.x, v.agent.z - run.cat.z) < 1.3);
   if (near && run.cat.cool <= 0 && run.cat.hop <= 0) input.jumpPressed = true;
   // A chasing vacuum inside 1.8 m: steer straight away from it.
   const chaser = run.vacuums.find((v) => v.chase > 0 && Math.hypot(v.agent.x - run.cat.x, v.agent.z - run.cat.z) < 1.8);
   if (chaser) {
      const ax = run.cat.x - chaser.agent.x;
      const az = run.cat.z - chaser.agent.z;
      const len = Math.hypot(ax, az) || 1;
      input.moveX = ax / len;
      input.moveY = az / len;
   }
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const grid = createGrid({ cell: 0.2, halfX: WALL, halfZ: level.rooms * ROOM_LEN });
   const free = freeGrid(grid, (x, z) => walkable(run, x, z));
   const bot: Bot = { follower: null, key: "", dir: { dirX: 0, dirZ: 0 } };
   const rng = createRng(seed * 131 + id * 7 + (style === "spam" ? 3 : 0));
   const input = idleInput();
   const store = createArcadeStore();
   const end = simulateRun(store, {
      durationMs: level.durationMs,
      lives: LIVES,
      resultDelayMs: 900,
      frame: fixedFrames(1000 / hz),
      step: (dt, _time, st) => {
         drive(run, input, style, rng, bot, grid, free);
         const before = run.score;
         const ev = step(run, input, dt, st.getState().timeLeftMs ?? 0);
         if (ev.score) st.getState().addScore(ev.score);
         if (run.score !== before + ev.score) throw new Error("score delta");
         if (ev.lifeLost) st.getState().loseLife();
         if (ev.won) st.getState().end("win");
      },
   });
   return { run, score: end.score, ms: end.elapsedMs, reason: end.endReason ?? run.over };
}

function fresh(level: LevelId = 1, seed = 1): Run {
   return createRun(seed, LEVELS[level]);
}

describe("cat layout", () => {
   it("places the spec counts, the bed and the same run for the same seed", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 20; seed++) {
            const a = createRun(seed, LEVELS[id]);
            const b = createRun(seed, LEVELS[id]);
            expect(a.treats.map((t) => [t.x, t.z])).toEqual(b.treats.map((t) => [t.x, t.z]));
            expect(a.treats).toHaveLength(LEVELS[id].treats);
            expect(a.toys).toHaveLength(LEVELS[id].toys);
            expect(a.vacuums).toHaveLength(LEVELS[id].vacuums);
            expect(a.clutter).toHaveLength(LEVELS[id].clutter);
            expect(a.furniture).toHaveLength(LEVELS[id].rooms);
            expect(a.furniture[0].kind).toBe("bed");
         }
      }
   });

   it("keeps every treat, toy and the bed reachable for 200 seeds, with treats 1.5 m apart", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 40; seed++) {
            const run = createRun(seed, LEVELS[id]);
            const can = reachable(run);
            for (const p of [...run.treats, ...run.toys]) expect(can(p.x, p.z)).toBe(true);
            expect(can(run.homeSpot.x, run.homeSpot.z)).toBe(true);
            const all = [...run.treats, ...run.toys];
            for (let i = 0; i < all.length; i++) {
               for (let j = i + 1; j < all.length; j++) {
                  expect(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z)).toBeGreaterThanOrEqual(1.5);
               }
            }
         }
      }
   });

   it("keeps the vacuums' loop in the open lane", () => {
      const run = createRun(3, LEVELS[5]);
      expect(run.blockers.length).toBeGreaterThan(0);
      for (const box of run.blockers) {
         expect(box.min.x > LANE_HALF || box.max.x < -LANE_HALF).toBe(true);
      }
   });
});

describe("cat moves, hops and gets hit", () => {
   it("a hop ignores the vacuum overlap and a plain overlap costs a life", () => {
      const run = fresh();
      run.vacuums[0].agent.x = run.cat.x;
      run.vacuums[0].agent.z = run.cat.z;
      const hopping = idleInput();
      hopping.jumpPressed = true;
      step(run, hopping, 1 / 60, 90_000);
      expect(run.cat.hop).toBeGreaterThan(0);
      expect(run.lives).toBe(LIVES);
      expect(run.ev.hop).toBe(true);
      // The vacuum stays on the cat: no hit during the hop, a hit the frame after it ends.
      for (let t = 0; t < HOP_S * 60 + 10 && run.lives === LIVES; t++) {
         run.vacuums[0].agent.x = run.cat.x;
         run.vacuums[0].agent.z = run.cat.z;
         step(run, idleInput(), 1 / 60, 90_000);
         if (run.cat.hop > 0) expect(run.lives).toBe(LIVES);
      }
      expect(run.lives).toBe(LIVES - 1);
      expect(run.ev.lifeLost).toBe(true);
   });

   it("a hit sends the cat home, gives mercy, and three hits end the run", () => {
      const run = fresh();
      const idle = idleInput();
      const hitNow = () => {
         run.vacuums[0].agent.x = run.cat.x;
         run.vacuums[0].agent.z = run.cat.z;
         step(run, idle, 1 / 60, 90_000);
      };
      hitNow();
      expect(run.lives).toBe(LIVES - 1);
      expect(run.cat.x).toBeCloseTo(run.homeSpot.x, 5);
      expect(run.cat.mercy).toBeGreaterThan(0);
      hitNow();
      expect(run.lives).toBe(LIVES - 1);
      const wait = () => {
         for (let t = 0; t < MERCY_S * 60 + 5; t++) step(run, idle, 1 / 60, 90_000);
      };
      wait();
      hitNow();
      expect(run.lives).toBe(LIVES - 2);
      wait();
      hitNow();
      expect(run.lives).toBe(0);
      expect(run.over).toBe("lose");
   });

   it("the cat is pushed out of a clutter box", () => {
      const run = createRun(5, LEVELS[4]);
      const box = run.clutter[0];
      const p = { x: (box.min.x + box.max.x) / 2, y: 0, z: (box.min.z + box.max.z) / 2 };
      pushOutXZ(p, RADIUS, box);
      const outside = p.x < box.min.x || p.x > box.max.x || p.z < box.min.z || p.z > box.max.z;
      expect(outside).toBe(true);
   });

   it("a stationary cat off the vacuum path on level 1 is never hit", () => {
      const run = createRun(2, LEVELS[1]);
      run.cat.x = 2.0;
      run.cat.z = 5.5;
      const idle = idleInput();
      for (let t = 0; t < 90 * 60; t++) step(run, idle, 1 / 60, 90_000);
      expect(run.lives).toBe(LIVES);
   });

   it("a sofa cuts the sight line of a vacuum, the open side does not", () => {
      const run = createRun(4, LEVELS[2]);
      const sofa = run.furniture.find((f) => f.kind === "sofa");
      if (!sofa) throw new Error("no sofa");
      const a = { x: sofa.x, y: 0, z: sofa.z - 2.2 };
      const b = { x: sofa.x, y: 0, z: sofa.z + 2.2 };
      expect(hasLineOfSightXZ(a, b, run.blockers)).toBe(false);
      const open = { x: 0, y: 0, z: sofa.z - 2.2 };
      const openEnd = { x: 0, y: 0, z: sofa.z + 2.2 };
      expect(hasLineOfSightXZ(open, openEnd, run.blockers)).toBe(true);
   });
});

describe("cat scoring", () => {
   it("a treat is 30, a streak adds 5 per step up to 15, and a gap over 4 s resets it", () => {
      const run = fresh();
      const idle = idleInput();
      const grab = (index: number) => {
         run.cat.x = run.treats[index].x;
         run.cat.z = run.treats[index].z;
         run.cat.vx = 0;
         run.cat.vz = 0;
         return step(run, idle, 1 / 60, 90_000);
      };
      expect(grab(0).score).toBe(TREAT_POINTS);
      // The next treat 4.0 s later still extends the streak.
      run.lastTreat = run.time + 1 / 60 - 4;
      expect(grab(1).score).toBe(TREAT_POINTS + 5);
      run.lastTreat = run.time + 1 / 60 - 4.01;
      expect(grab(2).score).toBe(TREAT_POINTS);
      expect(STREAK_CAP).toBe(15);
   });

   it("a toy is worth 20 and never extends the treat streak", () => {
      const run = fresh();
      run.cat.x = run.toys[0].x;
      run.cat.z = run.toys[0].z;
      expect(step(run, idleInput(), 1 / 60, 90_000).score).toBe(TOY_POINTS);
   });

   it("the time bonus is 4 per full second left and only a win on the bed adds it", () => {
      expect(timeBonus(90_000)).toBe(TIME_BONUS_PER_SECOND * 90);
      expect(timeBonus(89_999)).toBe(TIME_BONUS_PER_SECOND * 89);
      expect(timeBonus(0)).toBe(0);
      const run = fresh();
      for (const t of run.treats) t.got = true;
      run.collected = run.treats.length;
      run.cat.x = run.home.x - 0.9;
      run.cat.z = run.home.z;
      expect(onBed(run)).toBe(true);
      const ev = step(run, idleInput(), 1 / 60, 30_000);
      expect(ev.won).toBe(true);
      expect(run.over).toBe("win");
      expect(run.score).toBe(TIME_BONUS_PER_SECOND * 30);
   });

   it("the bed without every treat does not win", () => {
      const run = fresh();
      run.cat.x = run.home.x - 0.9;
      run.cat.z = run.home.z;
      const ev = step(run, idleInput(), 1 / 60, 90_000);
      expect(ev.won).toBe(false);
      expect(run.over).toBe(null);
   });

   it("the objective ceiling is the full treat and toy value", () => {
      for (const id of LEVEL_IDS) {
         expect(objectiveCeiling(LEVELS[id])).toBe((TREAT_POINTS + STREAK_CAP) * LEVELS[id].treats + TOY_POINTS * LEVELS[id].toys);
      }
   });

   it("the chase range on level 1 is zero", () => {
      expect(LEVELS[1].chaseRange).toBe(0);
   });
});

describe("cat score limits", () => {
   it("an honest bot, an idle bot and a spam bot stay inside each level's limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let best = 0;
         let bestMs = Infinity;
         for (let seed = 0; seed < 8; seed++) {
            const honest = play(id, seed, 60, "honest");
            expect(honest.score).toBe(honest.run.score);
            expect(withinServerLimits(honest.score, honest.ms, limits), `honest score ${honest.score} ms ${honest.ms} max ${limits.maxScore} pps ${limits.maxPointsPerSec} base ${limits.base}`).toBe(true);
            if (honest.reason === "win" && honest.score > best) {
               best = honest.score;
               bestMs = honest.ms;
            }
            const idle = play(id, seed, 20, "idle");
            expect(idle.score).toBe(0);
            expect(idle.reason).not.toBe("win");
            expect(withinServerLimits(idle.score, idle.ms, limits), `idle score ${idle.score} ms ${idle.ms} max ${limits.maxScore} pps ${limits.maxPointsPerSec} base ${limits.base}`).toBe(true);
            const spam = play(id, seed, 30, "spam");
            expect(spam.score).toBe(spam.run.score);
            expect(withinServerLimits(spam.score, spam.ms, limits), `spam score ${spam.score} ms ${spam.ms} max ${limits.maxScore} pps ${limits.maxPointsPerSec} base ${limits.base}`).toBe(true);
         }
         for (const hz of [30, 144]) {
            const run = play(id, 1, hz, "honest");
            expect(withinServerLimits(run.score, run.ms, limits), `run score ${run.score} ms ${run.ms} max ${limits.maxScore} pps ${limits.maxPointsPerSec} base ${limits.base}`).toBe(true);
         }
         expect(bestMs).toBeLessThan(Infinity);
         expect(best).toBeGreaterThan(0);
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }
   }, 240_000);
});


