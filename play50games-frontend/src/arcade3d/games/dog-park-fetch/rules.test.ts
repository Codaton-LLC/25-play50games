import { describe, expect, it } from "vitest";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   BLANKET_R,
   CATCH_H,
   DOG_R,
   FRISBEE_CATCH_POINTS,
   PICK_R,
   PROP_GAP,
   PROPOSED_LEVEL_LIMITS,
   QUICK_POINTS,
   STUN_S,
   THROW_GAP_S,
   TOY_POINTS,
   canCatch,
   createRun,
   frisbeeCount,
   heightOf,
   idleInput,
   landingOk,
   objectiveCeiling,
   step,
   timeBonus,
   toyXZ,
   type DogInput,
   type Run,
   type Throw,
} from "./rules";

type Style = "honest" | "idle" | "spam";

/** A walkable point for the dog: inside the fence and clear of every prop by the dog's radius. */
function walkable(run: Run, x: number, z: number): boolean {
   const hw = run.level.width / 2 - 0.2;
   const hd = run.level.depth / 2 - 0.2;
   if (Math.abs(x) > hw || Math.abs(z) > hd) return false;
   for (const p of run.props) {
      if (Math.hypot(x - p.x, z - p.z) < p.r + DOG_R + 0.05) return false;
   }
   return true;
}

function toyTarget(run: Run): { x: number; z: number; key: string } | null {
   const th = run.active;
   if (!th) return null;
   if (th.state === "carried") return { x: run.blanket.x, z: run.blanket.z, key: `back:${th.index}` };
   const xz = toyXZ(th, { x: 0, z: 0 });
   return { x: xz.x, z: xz.z, key: `${th.state}:${th.index}` };
}

interface Bot {
   follower: PathFollower | null;
   key: string;
   dir: { dirX: number; dirZ: number };
}

function drive(run: Run, input: DogInput, style: Style, rng: () => number, bot: Bot, grid: ReturnType<typeof createGrid>, free: Uint8Array): void {
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
   const target = toyTarget(run) ?? { x: run.blanket.x, z: run.blanket.z, key: "wait" };
   if (!bot.follower || bot.key !== target.key) {
      bot.follower = followPath(grid, free, run.dog.x, run.dog.z, target.x, target.z);
      bot.key = target.key;
   }
   steer(grid, bot.follower, run.dog.x, run.dog.z, bot.dir);
   input.moveX = bot.dir.dirX * 0.9;
   input.moveY = bot.dir.dirZ * 0.9;
   // A frisbee in its last second, low and close: leap for it.
   const th = run.active;
   if (th && th.state === "flying" && th.kind === "frisbee" && th.t >= th.flight - 0.9 && run.dog.leap <= 0) {
      const xz = toyXZ(th, { x: 0, z: 0 });
      if (Math.hypot(xz.x - run.dog.x, xz.z - run.dog.z) < 0.9) input.jumpPressed = true;
   }
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const grid = createGrid({ cell: 0.2, halfX: level.width / 2, halfZ: level.depth / 2 });
   const free = freeGrid(grid, (x, z) => walkable(run, x, z));
   const bot: Bot = { follower: null, key: "", dir: { dirX: 0, dirZ: 0 } };
   const rng = createRng(seed * 131 + id * 7 + (style === "spam" ? 3 : 0));
   const input = idleInput();
   const store = createArcadeStore();
   const end = simulateRun(store, {
      durationMs: level.durationMs,
      resultDelayMs: 900,
      frame: fixedFrames(1000 / hz),
      step: (dt, _time, st) => {
         drive(run, input, style, rng, bot, grid, free);
         const before = run.score;
         const ev = step(run, input, dt, st.getState().timeLeftMs ?? 0);
         if (ev.score) st.getState().addScore(ev.score);
         if (run.score !== before + ev.score) throw new Error("score delta");
         if (ev.won) st.getState().end("win");
         if (ev.lost) st.getState().end("lose");
      },
   });
   return { run, score: end.score, ms: end.elapsedMs, reason: end.endReason ?? run.over };
}

function fresh(level: LevelId = 1, seed = 1): Run {
   return createRun(seed, LEVELS[level]);
}

/** A flying frisbee on the dog's spot, at time t. */
function frisbeeAt(run: Run, t: number): Throw {
   const plan = run.plan.find((p) => p.kind === "frisbee") ?? run.plan[0];
   return {
      index: 0,
      kind: "frisbee",
      sx: run.blanket.x,
      sz: run.blanket.z,
      lx: plan.lx,
      lz: plan.lz,
      flight: 1.6,
      apex: 1.5,
      t,
      state: "flying",
      landedAt: 0,
   };
}

/** The time in the frisbee's flight where its height is `target` (the descending side). */
function timeAtHeight(target: number): number {
   // Descending side of the arc: the apex is at half the flight (0.8 s).
   let lo = 0.8;
   let hi = 1.6;
   const th = frisbeeAt(fresh(), 0);
   for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      th.t = mid;
      if (heightOf(th) > target) lo = mid;
      else hi = mid;
   }
   return hi;
}

describe("dog plan and layout", () => {
   it("makes the same plan for the same seed, with ceil(throws / 3) frisbees", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 20; seed++) {
            const a = createRun(seed, LEVELS[id]);
            const b = createRun(seed, LEVELS[id]);
            expect(a.plan).toEqual(b.plan);
            expect(a.plan).toHaveLength(LEVELS[id].throws);
            expect(a.plan.filter((p) => p.kind === "frisbee")).toHaveLength(frisbeeCount(LEVELS[id].throws));
            expect(a.plan[0].kind).toBe("frisbee");
         }
      }
      expect(frisbeeCount(4)).toBe(2);
      expect(frisbeeCount(6)).toBe(2);
      expect(frisbeeCount(12)).toBe(4);
   });

   it("lands every throw inside the fence, clear of props, at least 6 m from the blanket (200 seeds)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 0; seed < 200; seed++) {
            const run = createRun(seed, level);
            for (const p of run.plan) {
               expect(landingOk(level, run.props, p.lx, p.lz)).toBe(true);
               for (const prop of run.props) expect(Math.hypot(p.lx - prop.x, p.lz - prop.z)).toBeGreaterThanOrEqual(prop.r + PROP_GAP);
               expect(Math.hypot(p.lx - run.blanket.x, p.lz - run.blanket.z)).toBeGreaterThanOrEqual(6);
            }
         }
      }
   });

   it("keeps the first throw 0.8 s after the start and one throw at a time", () => {
      const run = fresh();
      const idle = idleInput();
      while (run.issued === 0) step(run, idle, 1 / 60, 90_000);
      expect(run.time).toBeGreaterThanOrEqual(THROW_GAP_S);
      expect(run.active?.index).toBe(0);
      const before = run.issued;
      for (let i = 0; i < 60; i++) step(run, idle, 1 / 60, 90_000);
      expect(run.issued).toBe(before);
   });
});

describe("dog catches, pickups and deliveries", () => {
   it("a frisbee caught at 1.39 m pays the bonus, at 1.41 m it does not", () => {
      const low = timeAtHeight(1.39);
      const high = timeAtHeight(1.41);
      const run = fresh();
      const th = frisbeeAt(run, low);
      expect(heightOf(th)).toBeLessThan(CATCH_H);
      const at = toyXZ(th, { x: 0, z: 0 });
      expect(canCatch(th, true, at.x, at.z)).toBe(true);
      th.t = high;
      expect(heightOf(th)).toBeGreaterThanOrEqual(CATCH_H);
      expect(canCatch(th, true, at.x, at.z)).toBe(false);
      // Through step(): the catch pays FRISBEE_CATCH_POINTS once.
      run.active = frisbeeAt(run, low);
      const spot = toyXZ(run.active, { x: 0, z: 0 });
      run.dog.x = spot.x;
      run.dog.z = spot.z;
      run.dog.leap = 0.4;
      const ev = step(run, idleInput(), 1 / 600, 90_000);
      expect(ev.caught).toBe(true);
      expect(run.score).toBe(FRISBEE_CATCH_POINTS);
   });

   it("a mower drop puts the toy on the grass at the dog, pays nothing and stuns the dog", () => {
      const run = createRun(2, LEVELS[3]);
      run.dog.x = 3;
      run.dog.z = 0;
      const th: Throw = { index: 0, kind: "ball", sx: 0, sz: 0, lx: 0, lz: 0, flight: 1, apex: 1, t: 1, state: "carried", landedAt: 0 };
      run.active = th;
      run.mowers[0].agent.x = run.dog.x;
      run.mowers[0].agent.z = run.dog.z;
      const ev = step(run, idleInput(), 1 / 60, 90_000);
      expect(ev.mowerHit).toBe(true);
      expect(ev.dropped).toBe(true);
      expect(th.state).toBe("ground");
      expect(th.lx).toBeCloseTo(run.dog.x, 5);
      expect(run.score).toBe(0);
      expect(run.dog.stun).toBeCloseTo(STUN_S, 5);
   });

   it("a returned toy pays 100, and 140 when it came back within 8 s of landing", () => {
      const run = fresh();
      const idle = idleInput();
      const give = (landedAgo: number) => {
         run.active = { index: 0, kind: "ball", sx: 0, sz: 0, lx: run.blanket.x, lz: run.blanket.z, flight: 1, apex: 1, t: 1, state: "carried", landedAt: run.time - landedAgo };
         run.dog.x = run.blanket.x;
         run.dog.z = run.blanket.z;
         return step(run, idle, 1 / 60, 90_000).score;
      };
      expect(give(7)).toBe(TOY_POINTS + QUICK_POINTS);
      expect(give(9)).toBe(TOY_POINTS);
   });

   it("a toy on the ground is picked up on overlap and not before", () => {
      const run = fresh();
      run.active = { index: 0, kind: "ball", sx: 0, sz: 0, lx: 4, lz: 4, flight: 1, apex: 1, t: 1, state: "ground", landedAt: 0 };
      run.dog.x = 4 + PICK_R + 0.1;
      run.dog.z = 4;
      step(run, idleInput(), 1 / 60, 90_000);
      expect(run.active.state).toBe("ground");
      run.dog.x = 4 + PICK_R - 0.1;
      step(run, idleInput(), 1 / 60, 90_000);
      expect(run.active.state).toBe("carried");
   });
});

describe("dog patience, timeouts and the ceiling", () => {
   it("a throw left on the grass past patience is fetched by the owner (0 points), and the next one starts", () => {
      const run = createRun(4, LEVELS[4]);
      const idle = idleInput();
      let guard = 0;
      while (run.timedOut === 0 && guard++ < 60 * 60) step(run, idle, 1 / 60, 180_000);
      expect(run.timedOut).toBe(1);
      expect(run.score).toBe(0);
      expect(run.active).toBe(null);
      const issued = run.issued;
      for (let i = 0; i < Math.ceil((THROW_GAP_S + 0.1) * 60); i++) step(run, idle, 1 / 60, 180_000);
      expect(run.issued).toBe(issued + 1);
   });

   it("two timed-out throws end a patience level at once with a lose", () => {
      const run = createRun(4, LEVELS[4]);
      const idle = idleInput();
      let guard = 0;
      while (!run.over && guard++ < 60 * 300) step(run, idle, 1 / 60, 180_000);
      expect(run.timedOut).toBe(2);
      expect(run.over).toBe("lose");
   });

   it("levels 1 to 3 never time out a throw", () => {
      for (const id of [1, 2, 3] as const) {
         const run = createRun(6, LEVELS[id]);
         for (let i = 0; i < 90 * 60; i++) step(run, idleInput(), 1 / 60, 180_000);
         expect(run.timedOut).toBe(0);
      }
   });

   it("the objective ceiling is every toy with its quick bonus, and every catch", () => {
      for (const id of LEVEL_IDS) {
         expect(objectiveCeiling(LEVELS[id])).toBe((TOY_POINTS + QUICK_POINTS) * LEVELS[id].throws + FRISBEE_CATCH_POINTS * frisbeeCount(LEVELS[id].throws));
      }
      expect(timeBonus(90_000)).toBe(4 * 90);
      expect(BLANKET_R).toBeGreaterThan(0);
   });
});

describe("dog score limits", () => {
   it("an honest bot, an idle bot and a spam bot stay inside each level's limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let best = 0;
         for (let seed = 0; seed < 12; seed++) {
            const honest = play(id, seed, 60, "honest");
            expect(honest.score).toBe(honest.run.score);
            expect(withinServerLimits(honest.score, honest.ms, limits), `honest ${id}/${seed} score ${honest.score} ms ${honest.ms}`).toBe(true);
            if (honest.reason === "win") best = Math.max(best, honest.score);
            const idle = play(id, seed, 20, "idle");
            expect(idle.score).toBe(0);
            expect(idle.reason).not.toBe("win");
            expect(withinServerLimits(idle.score, idle.ms, limits), `idle ${id}/${seed} ms ${idle.ms}`).toBe(true);
            const spam = play(id, seed, 30, "spam");
            expect(spam.score).toBe(spam.run.score);
            expect(withinServerLimits(spam.score, spam.ms, limits), `spam ${id}/${seed} score ${spam.score} ms ${spam.ms}`).toBe(true);
         }
         for (const hz of [30, 144]) {
            const run = play(id, 1, hz, "honest");
            expect(withinServerLimits(run.score, run.ms, limits), `hz ${hz} ${id} score ${run.score} ms ${run.ms}`).toBe(true);
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }
   }, 300_000);
});


