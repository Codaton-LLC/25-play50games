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
   CHASE_GRACE_S,
   CHASE_REST_S,
   CHASE_S,
   HALL_HALF,
   REJOIN_CLEAR,
   SEP_GAP,
   SPAWN_CLEAR,
   VAC_R,
   createRun,
   idleInput,
   syncStore,
   objectiveCeiling,
   onBed,
   pushOutXZ,
   step,
   timeBonus,
   PROPOSED_LEVEL_LIMITS,
   type CatInput,
   type Run,
} from "./rules";

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
      run.cat.x = run.vacuums[0].agent.x;
      run.cat.z = run.vacuums[0].agent.z;
      const hopping = idleInput();
      hopping.jumpPressed = true;
      step(run, hopping, 1 / 60, 90_000);
      expect(run.cat.hop).toBeGreaterThan(0);
      expect(run.lives).toBe(LIVES);
      expect(run.ev.hop).toBe(true);
      // The cat stays on the patrolling vacuum: no hit during the hop, a hit the frame after it ends.
      for (let t = 0; t < HOP_S * 60 + 10 && run.lives === LIVES; t++) {
         run.cat.x = run.vacuums[0].agent.x;
         run.cat.z = run.vacuums[0].agent.z;
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
         run.cat.x = run.vacuums[0].agent.x;
         run.cat.z = run.vacuums[0].agent.z;
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

describe("cat vacuums: the loop, the chase and getting away", () => {
   const run1 = (id: LevelId, seed = 3) => createRun(seed, LEVELS[id]);
   it("vacuums spawn spread over the loop, SPAWN_CLEAR along it from the start corner, never near the cat", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 50; seed++) {
            const run = run1(id, seed);
            expect(run.vacuums.length).toBe(LEVELS[id].vacuums);
            const ghosts = run.vacuums.map((v) => v.ghost).sort((a, b) => a - b);
            for (const g of ghosts) {
               expect(g).toBeGreaterThanOrEqual(SPAWN_CLEAR);
               expect(g).toBeLessThanOrEqual(run.route.total - SPAWN_CLEAR);
            }
            for (let i = 1; i < ghosts.length; i++) expect(ghosts[i] - ghosts[i - 1]).toBeGreaterThan(SEP_GAP);
            for (const v of run.vacuums) expect(Math.hypot(v.agent.x - START.x, v.agent.z - START.z)).toBeGreaterThan(3);
         }
      }
   });
   it("patrolling vacuums keep their spacing (one just behind another waits), so they never stack", () => {
      for (const id of [3, 5] as const) {
         const run = run1(id);
         const idle = idleInput();
         for (let t = 0; t < 60 && !run.over; t += 1 / 30) {
            run.cat.x = -2.1;
            run.cat.z = run.length - 0.4;
            run.cat.mercy = 1;
            step(run, idle, 1 / 30, 90_000);
            for (let i = 0; i < run.vacuums.length; i++)
               for (let j = i + 1; j < run.vacuums.length; j++) {
                  const a = run.vacuums[i];
                  const b = run.vacuums[j];
                  if (a.mode === "patrol" && b.mode === "patrol") expect(Math.hypot(a.agent.x - b.agent.x, a.agent.z - b.agent.z)).toBeGreaterThan(2 * VAC_R);
               }
         }
      }
   });
   it("a chase lasts 4 s at the level's chase speed, then the vacuum drives back harmless, docks, and rests before chasing again", () => {
      const run = run1(2);
      const v = run.vacuums[0];
      run.time = CHASE_GRACE_S + 0.1;
      run.cat.x = v.agent.x;
      run.cat.z = v.agent.z + 3;
      const idle = idleInput();
      run.cat.mercy = 100;
      step(run, idle, 1 / 60, 90_000);
      expect(v.mode).toBe("chase");
      const z0 = v.agent.z;
      step(run, idle, 0.05, 90_000);
      expect(v.agent.z - z0).toBeCloseTo(LEVELS[2].chaseSpeed * 0.05, 6);
      let t = 1 / 60 + 0.05;
      while (v.mode === "chase" && t < 10) {
         run.cat.x = v.agent.x + 1.5;
         run.cat.z = v.agent.z;
         step(run, idle, 0.05, 90_000);
         t += 0.05;
      }
      expect(t).toBeGreaterThan(CHASE_S - 0.06);
      expect(t).toBeLessThan(CHASE_S + 0.08);
      expect(v.mode).toBe("return");
      run.cat.mercy = 0;
      run.cat.x = v.agent.x;
      run.cat.z = v.agent.z;
      step(run, idle, 1 / 60, 90_000);
      expect(run.ev.lifeLost).toBe(false);
      run.cat.mercy = 100;
      for (let k = 0; k < 600 && !v.docked; k++) {
         run.cat.x = v.agent.x;
         run.cat.z = v.agent.z + 0.3;
         step(run, idle, 1 / 60, 90_000);
      }
      expect(v.docked).toBe(true);
      run.cat.x = v.agent.x;
      run.cat.z = v.agent.z + 0.3;
      step(run, idle, 1 / 60, 90_000);
      expect(v.mode).toBe("return");
      run.cat.x = v.agent.x;
      run.cat.z = v.agent.z + (v.agent.z < run.length / 2 ? 1 : -1) * (0.3 + RADIUS + VAC_R + REJOIN_CLEAR);
      step(run, idle, 1 / 60, 90_000);
      expect(v.mode).toBe("patrol");
      expect(v.rest).toBeCloseTo(CHASE_REST_S, 6);
      run.cat.x = v.agent.x;
      run.cat.z = v.agent.z + 2;
      step(run, idle, 1 / 60, 90_000);
      expect(v.mode).toBe("patrol");
   });
   it("each chasing level drives its vacuum at its own chase speed", () => {
      for (const id of [2, 3, 4, 5] as const) {
         const run = run1(id);
         const v = run.vacuums[0];
         run.time = CHASE_GRACE_S + 0.1;
         run.cat.mercy = 100;
         v.mode = "chase";
         v.chase = CHASE_S;
         run.cat.x = v.agent.x;
         run.cat.z = v.agent.z + (v.agent.z < run.length / 2 ? 3 : -3);
         const x0 = v.agent.x;
         const z0 = v.agent.z;
         step(run, idleInput(), 0.05, 90_000);
         expect(Math.hypot(v.agent.x - x0, v.agent.z - z0)).toBeCloseTo(LEVELS[id].chaseSpeed * 0.05, 6);
      }
   });
   it("hopping over a chaser shakes it off: it drives back, harmless", () => {
      const run = run1(3);
      const v = run.vacuums[0];
      run.time = CHASE_GRACE_S + 0.1;
      v.mode = "chase";
      v.chase = CHASE_S;
      run.cat.x = v.agent.x;
      run.cat.z = v.agent.z;
      const hop = idleInput();
      hop.jumpPressed = true;
      step(run, hop, 1 / 60, 90_000);
      expect(run.lives).toBe(LIVES);
      expect(v.mode).toBe("return");
   });
   it("each level reads its own patrol speed and chase range (L1 never chases)", () => {
      for (const id of LEVEL_IDS) {
         const fresh0 = run1(id);
         const moved = run1(id);
         moved.cat.mercy = 100;
         step(moved, idleInput(), 0.1, 90_000);
         const a = fresh0.vacuums[0].agent;
         const b = moved.vacuums[0].agent;
         expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(LEVELS[id].patrolSpeed * 0.1, 3);
         // in the open lane, just inside / just outside the range, after the grace
         for (const [d, chases] of [[LEVELS[id].chaseRange - 0.2, id !== 1], [LEVELS[id].chaseRange + 0.4, false]] as const) {
            const run = run1(id);
            const v = run.vacuums[0];
            run.time = CHASE_GRACE_S + 0.1;
            run.cat.mercy = 100;
            run.blockers.length = 0;
            run.cat.x = v.agent.x;
            run.cat.z = v.agent.z - d >= RADIUS ? v.agent.z - d : v.agent.z + d;
            step(run, idleInput(), 1 / 60, 90_000);
            expect(v.mode).toBe(chases ? "chase" : "patrol");
         }
      }
   });
   it("the hall walls hold the cat in", () => {
      for (const id of LEVEL_IDS) {
         const run = run1(id);
         const go = (mx: number, my: number, frames: number) => {
            const inp = idleInput();
            inp.moveX = mx;
            inp.moveY = my;
            for (let k = 0; k < frames; k++) {
               run.cat.mercy = 100;
               step(run, inp, 1 / 60, 90_000);
            }
         };
         go(1, 0, 120);
         expect(run.cat.x).toBeLessThanOrEqual(HALL_HALF - RADIUS + 1e-9);
         go(-1, 0, 160);
         expect(run.cat.x).toBeGreaterThanOrEqual(-HALL_HALF + RADIUS - 1e-9);
         go(0, -1, 120);
         expect(run.cat.z).toBeGreaterThanOrEqual(RADIUS - 1e-9);
         run.cat.x = 0;
         run.cat.z = run.length - 1;
         go(0, 1, 60);
         expect(run.cat.z).toBeLessThanOrEqual(LEVELS[id].rooms * ROOM_LEN - RADIUS + 1e-9);
         expect(run.length).toBe(LEVELS[id].rooms * ROOM_LEN);
      }
   });
});

describe("cat store sync", () => {
   it("writes score, lives, the win and the stats only on a change", () => {
      const run = fresh(1, 2);
      const calls: string[] = [];
      const store = { getState: () => ({ addScore: (n: number) => calls.push(`score ${n}`), setStat: (k: string, v: number) => calls.push(`${k} ${v}`), loseLife: () => calls.push("life"), end: (r: string) => calls.push(`end ${r}`) }) };
      syncStore(run, step(run, idleInput(), 1 / 60, 90_000), store);
      expect(calls).toEqual(["treats 0", "hop 1"]);
      calls.length = 0;
      syncStore(run, step(run, idleInput(), 1 / 60, 90_000), store);
      expect(calls).toEqual([]);
      const t = run.treats[0];
      run.cat.x = t.x;
      run.cat.z = t.z;
      syncStore(run, step(run, idleInput(), 1 / 60, 90_000), store);
      expect(calls).toEqual(["score 30", "treats 1"]);
   });
});
