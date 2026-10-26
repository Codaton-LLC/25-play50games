import { describe, expect, it } from "vitest";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, passengerCount, type StationLevel } from "./levels";
import {
   BOARD_REACH,
   CONCOURSE_DEPTH,
   DELIVER_POINTS,
   FOLLOW_RADIUS,
   FOLLOW_SPEED,
   LIVES,
   MAX_JUMP,
   MAX_SPEED,
   PROMPT_POINTS,
   PROPOSED_LEVEL_LIMITS,
   RADIUS,
   SPOTS,
   START,
   STATION_END,
   TIME_BONUS_PER_SECOND,
   USE_RANGE,
   concourseHalf,
   createRun,
   earliestEndS,
   earliestWinS,
   idleInput,
   inStation,
   nearestFreePoint,
   padPoint,
   standable,
   step,
   targetAt,
   taskQueue,
   trackX,
   trainIn,
   winCeiling,
   type Run,
} from "./rules";

const L = (id: 1 | 2 | 3 | 4 | 5) => LEVELS[id];
const press = (run: Run, timeLeftMs = 100_000) => {
   const input = idleInput();
   input.actionPressed = true;
   return step(run, input, 1 / 60, timeLeftMs);
};
const place = (run: Run, x: number, z: number) => {
   run.hero.x = x;
   run.hero.z = z;
   run.hero.vx = run.hero.vz = 0;
};
const waitUntil = (run: Run, t: number) => {
   const input = idleInput();
   while (run.time < t - 1e-9 && !run.over) step(run, input, Math.min(1 / 60, t - run.time), 100_000);
};
const spotOf = (run: Run, task: number) => (SPOTS[run.level.parallel] ?? SPOTS[1])[run.tasks[task].spot];
const openTasks = (run: Run) => run.tasks.map((t, i) => (t.state === "open" || t.state === "taken" ? i : -1)).filter((i) => i >= 0);
const noCrowd = (level: StationLevel): StationLevel => ({ ...level, crowd: 0 });

/** Takes the open task `i` at its spot. */
function take(run: Run, i: number) {
   const s = spotOf(run, i);
   place(run, s.x, s.z + 0.5);
   return press(run);
}
/** Hands the held task over at its pad once its train is in (a passenger is set beside the pad). */
function deliver(run: Run) {
   const task = run.tasks[run.holding];
   const pad = padPoint(run.level, task.platform);
   if (run.time < task.arriveAt) waitUntil(run, task.arriveAt + 0.01);
   place(run, pad.x, pad.z - 0.5);
   if (task.kind === "passenger") {
      run.follower.x = pad.x;
      run.follower.z = pad.z - 1.4;
   }
   return press(run);
}

describe("station layout and task queue", () => {
   it("is the same run for the same seed; platforms come from a shuffle bag; the passenger count is exact", () => {
      for (const id of LEVEL_IDS) {
         const level = L(id);
         for (let seed = 0; seed < 200; seed++) {
            const a = taskQueue(seed, level);
            expect(a).toEqual(taskQueue(seed, level));
            expect(a).toHaveLength(level.tasks);
            expect(a.filter((t) => t.kind === "passenger")).toHaveLength(passengerCount(level));
            for (let r = 0; r * level.platforms < level.tasks; r++) {
               const round = a.slice(r * level.platforms, (r + 1) * level.platforms).map((t) => t.platform);
               expect(new Set(round).size).toBe(round.length);
            }
            for (let k = 1; k < a.length; k++) expect(a[k].platform).not.toBe(a[k - 1].platform);
         }
      }
      expect(taskQueue(7, L(5))).not.toEqual(taskQueue(8, L(5)));
   });

   it("opens `parallel` tasks at the start, never two for one platform, and their trains on the timetable", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 50; seed++) {
            const run = createRun(seed, L(id));
            const open = openTasks(run);
            expect(open).toHaveLength(L(id).parallel);
            expect(new Set(open.map((i) => run.tasks[i].platform)).size).toBe(open.length);
            for (const i of open) {
               expect(run.tasks[i].arriveAt).toBe(L(id).arriveS);
               expect(run.tasks[i].leaveAt).toBe(L(id).arriveS + L(id).dwellS);
            }
         }
      }
   });

   it("flood fill: every entrance spot and every pad's Use zone is reachable from the start (200 seeds, the crowd where it starts)", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 200; seed += id === 5 ? 1 : 10) {
            const run = createRun(seed, L(id));
            const half = concourseHalf(run.level);
            const cell = 0.2;
            const cols = Math.round((half * 2) / cell) + 1;
            const rows = Math.round(STATION_END / cell) + 1;
            const seen = new Uint8Array(cols * rows);
            const wx = (c: number) => -half + c * cell;
            const wz = (r: number) => r * cell;
            const queue: number[] = [];
            const push = (c: number, r: number) => {
               if (c < 0 || r < 0 || c >= cols || r >= rows) return;
               const k = r * cols + c;
               if (seen[k] || !standable(run, wx(c), wz(r), RADIUS)) return;
               seen[k] = 1;
               queue.push(k);
            };
            push(Math.round((START.x + half) / cell), Math.round(START.z / cell));
            expect(queue.length).toBe(1);
            while (queue.length) {
               const k = queue.pop()!;
               const c = k % cols;
               const r = (k - c) / cols;
               push(c + 1, r); push(c - 1, r); push(c, r + 1); push(c, r - 1);
            }
            const reached = (px: number, pz: number) => {
               for (let k = 0; k < seen.length; k++) if (seen[k] && Math.hypot(wx(k % cols) - px, wz(Math.floor(k / cols)) - pz) <= USE_RANGE - 0.1) return true;
               return false;
            };
            for (const s of SPOTS[run.level.parallel]) expect(reached(s.x, s.z)).toBe(true);
            for (let p = 0; p < run.level.platforms; p++) expect(reached(padPoint(run.level, p).x, padPoint(run.level, p).z)).toBe(true);
         }
      }
   });

   it("track beds are never walkable", () => {
      for (const id of LEVEL_IDS) {
         const level = L(id);
         for (let p = 0; p < level.platforms; p++) {
            for (let z = CONCOURSE_DEPTH + 0.01; z < STATION_END; z += 0.5) expect(inStation(level, trackX(level, p), z, 0)).toBe(false);
            expect(inStation(level, trackX(level, p), CONCOURSE_DEPTH - 0.2, RADIUS)).toBe(false);
            expect(inStation(level, trackX(level, p), CONCOURSE_DEPTH - 0.5, RADIUS)).toBe(true);
         }
      }
   });
});

describe("station tasks, trains and the follower", () => {
   it("a bag handed to the wrong platform does not score and costs nothing", () => {
      const run = createRun(3, noCrowd(L(2)));
      const i = openTasks(run)[0];
      run.tasks[i].kind = "bag";
      take(run, i);
      waitUntil(run, run.tasks[i].arriveAt + 0.1);
      const wrong = (run.tasks[i].platform + 1) % run.level.platforms;
      const pad = padPoint(run.level, wrong);
      place(run, pad.x, pad.z - 0.4);
      const ev = press(run);
      expect(ev.buzz).toBe(true);
      expect(ev.score).toBe(0);
      expect(ev.lifeLost).toBe(false);
      expect(run.holding).toBe(i);
      expect(run.lives).toBe(LIVES);
   });

   it("Use at the right pad before the train is in only buzzes; once it is in, it scores +100 (+50 with more than half the dwell left)", () => {
      const run = createRun(4, noCrowd(L(1)));
      const i = openTasks(run)[0];
      take(run, i);
      const task = run.tasks[i];
      const pad = padPoint(run.level, task.platform);
      place(run, pad.x, pad.z - 0.4);
      expect(trainIn(task, run.time)).toBe(false);
      expect(press(run).buzz).toBe(true);
      waitUntil(run, task.arriveAt + 0.05);
      expect(trainIn(task, run.time)).toBe(true);
      place(run, pad.x, pad.z - 0.4);
      const ev = press(run);
      expect(ev.delivered).toBe(i);
      expect(ev.score).toBe(DELIVER_POINTS + PROMPT_POINTS);
      // the next task: delivered late in its dwell, no bonus
      const j = openTasks(run)[0];
      take(run, j);
      waitUntil(run, run.tasks[j].leaveAt - run.level.dwellS / 2 + 0.1);
      const late = deliver(run);
      expect(late.delivered).toBe(j);
      expect(late.score).toBe(DELIVER_POINTS);
   });

   it("a task resolves exactly once: a missed train costs a life, drops what was held and opens the next task", () => {
      const run = createRun(5, noCrowd(L(1)));
      const i = openTasks(run)[0];
      take(run, i);
      const seen: number[] = [];
      const input = idleInput();
      while (run.time < run.tasks[i].leaveAt + 1) {
         const ev = step(run, input, 1 / 60, 100_000);
         if (ev.missed >= 0) seen.push(ev.missed);
         if (ev.delivered >= 0) seen.push(-ev.delivered - 1);
      }
      expect(seen).toEqual([i]);
      expect(run.tasks[i].state).toBe("missed");
      expect(run.holding).toBe(-1);
      expect(run.lives).toBe(LIVES - 1);
      expect(openTasks(run)).toHaveLength(1);
      // pressing at its pad later changes nothing
      const pad = padPoint(run.level, run.tasks[i].platform);
      place(run, pad.x, pad.z - 0.4);
      expect(press(run).delivered).toBe(-1);
      expect(run.tasks[i].state).toBe("missed");
   });

   it("parallel 1 never shows two open tasks; parallel 2 never two for one platform (honest play, 30 seeds)", async () => {
      const { drive } = await import("./bots.testing");
      const { createRng } = await import("@/arcade3d/core/math");
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 30; seed++) {
            const run = createRun(seed, L(id));
            const input = idleInput();
            const rng = createRng(seed + 99);
            const mem = { wait: 0, pause: 0, lastHolding: -1, still: 0, side: 1, dodge: 0 };
            while (!run.over && run.time < run.level.durationMs / 1000) {
               drive(run, input, 1 / 60, "honest", rng, mem);
               step(run, input, 1 / 60, 100_000);
               const open = openTasks(run);
               expect(open.length).toBeLessThanOrEqual(run.level.parallel);
               expect(new Set(open.map((t) => run.tasks[t].platform)).size).toBe(open.length);
            }
         }
      }
   });

   it("a passenger follows, boards only from within reach of the pad, and its train leaving loses it", () => {
      const run = createRun(6, noCrowd(L(2)));
      const i = openTasks(run)[0];
      run.tasks[i].kind = "passenger";
      take(run, i);
      expect(run.follower.task).toBe(i);
      waitUntil(run, run.tasks[i].arriveAt + 0.1);
      const pad = padPoint(run.level, run.tasks[i].platform);
      place(run, pad.x, pad.z - 0.4);
      run.follower.x = pad.x;
      run.follower.z = pad.z - BOARD_REACH - 0.6;
      expect(press(run).buzz).toBe(true);
      run.follower.z = pad.z - BOARD_REACH + 0.3;
      const ev = press(run);
      expect(ev.delivered).toBe(i);
      expect(run.follower.task).toBe(-1);
   });

   it("the follower never stands in a track bed, and a stuck jump lands on free floor within MAX_JUMP (a traveller in the gap)", () => {
      const level = { ...L(3), crowd: 1 };
      for (let seed = 0; seed < 40; seed++) {
         const run = createRun(seed, level);
         const i = openTasks(run)[0];
         run.tasks[i].kind = "passenger";
         take(run, i);
         // the worker goes down an island; a traveller parks in the lane between them
         const pad = padPoint(run.level, run.tasks[i].platform);
         place(run, pad.x, pad.z);
         run.follower.x = pad.x + (seed % 2 ? 2.2 : -2.2);
         run.follower.z = CONCOURSE_DEPTH - 1;
         run.crowd[0].x = (run.follower.x + pad.x) / 2;
         run.crowd[0].z = CONCOURSE_DEPTH - 0.9;
         const input = idleInput();
         for (let k = 0; k < 600 && !run.over; k++) {
            const fx = run.follower.x;
            const fz = run.follower.z;
            step(run, input, 1 / 60, 100_000);
            if (run.follower.task < 0) break;
            expect(standable(run, run.follower.x, run.follower.z, FOLLOW_RADIUS, false)).toBe(true);
            expect(Math.hypot(run.follower.x - fx, run.follower.z - fz)).toBeLessThanOrEqual(Math.max(FOLLOW_SPEED / 60, MAX_JUMP) + 1e-9);
         }
      }
      // the free point itself: on the segment, standable, never further than MAX_JUMP
      const run = createRun(1, noCrowd(L(1)));
      const out = { x: 0, z: 0 };
      expect(nearestFreePoint(run, 0, 2, 0, 7, out)).toBe(true);
      expect(Math.hypot(out.x, out.z - 2)).toBeLessThanOrEqual(MAX_JUMP + 1e-9);
      expect(standable(run, out.x, out.z, FOLLOW_RADIUS)).toBe(true);
   });

   it("a passenger never travels faster than 3.0 m/s over its walk (the proof's bound)", async () => {
      const { playBot } = await import("./bots.testing");
      for (let seed = 0; seed < 20; seed++) {
         const r = playBot(L(5), seed, 60, "oracle");
         for (const t of r.run.tasks) {
            if (t.kind !== "passenger" || t.state !== "delivered") continue;
            const s = SPOTS[r.run.level.parallel][t.spot];
            const pad = padPoint(r.run.level, t.platform);
            // taken no sooner than it opened: the walk took at least (distance - reach) / 3.0
            expect(t.doneAt - t.openAt).toBeGreaterThanOrEqual((Math.hypot(s.x - pad.x, s.z - pad.z) - BOARD_REACH) / FOLLOW_SPEED - 1e-6);
         }
      }
   });

   it("win: every task resolved with at most one train missed (+5 per full second left); two misses with all resolved lose; three lose on lives", () => {
      const win = createRun(8, noCrowd(L(1)));
      for (let k = 0; k < win.level.tasks; k++) {
         const i = openTasks(win)[0];
         take(win, i);
         const ev = deliver(win);
         if (k === win.level.tasks - 1) {
            expect(ev.won).toBe(true);
         }
      }
      expect(win.over).toBe("win");
      expect(win.score).toBeGreaterThanOrEqual(win.level.tasks * DELIVER_POINTS);
      // one miss then the rest delivered: still a win
      const one = createRun(9, noCrowd(L(1)));
      waitUntil(one, one.tasks[openTasks(one)[0]].leaveAt + 0.02);
      expect(one.missed).toBe(1);
      while (!one.over) {
         take(one, openTasks(one)[0]);
         deliver(one);
      }
      expect(one.over).toBe("win");
      // two misses, then the rest delivered: a loss once the last task resolves
      const two = createRun(10, noCrowd(L(1)));
      for (let m = 0; m < 2; m++) waitUntil(two, two.tasks[openTasks(two)[0]].leaveAt + 0.02);
      expect(two.lives).toBe(LIVES - 2);
      let lost = false;
      while (!two.over) {
         take(two, openTasks(two)[0]);
         if (deliver(two).lost) lost = true;
      }
      expect(two.over).toBe("lose");
      expect(lost).toBe(true);
      // idle: three trains leave, lives 0
      const idle = createRun(11, noCrowd(L(2)));
      waitUntil(idle, 1000);
      expect(idle.over).toBe("lose");
      expect(idle.lives).toBe(0);
      expect(idle.score).toBe(0);
   });

   it("Use at a spot while already holding a task buzzes; one task in hand at a time", () => {
      const run = createRun(2, noCrowd(L(4)));
      const [a, b] = openTasks(run);
      take(run, a);
      const ev = take(run, b);
      expect(ev.buzz).toBe(true);
      expect(run.holding).toBe(a);
      expect(run.tasks[b].state).toBe("open");
   });
});

describe("station movement", () => {
   it("the worker never moves faster than 4.6 m/s and stays on walkable floor (20 000 random frames, with the crowd)", () => {
      for (const id of [1, 5] as const) {
         const run = createRun(11, L(id));
         for (let i = 0; i < 20000 && !run.over; i++) {
            const input = idleInput();
            input.moveX = Math.sin(i * 0.037);
            input.moveY = Math.cos(i * 0.021);
            input.actionPressed = i % 97 === 0;
            const dt = 0.004 + ((i * 7919) % 46) / 1000;
            const x = run.hero.x;
            const z = run.hero.z;
            step(run, input, dt, 100_000);
            expect(Math.hypot(run.hero.x - x, run.hero.z - z)).toBeLessThanOrEqual(MAX_SPEED * dt + 1e-9);
            expect(standable(run, run.hero.x, run.hero.z, RADIUS - 1e-6, false)).toBe(true);
         }
      }
   });

   it("Use reaches spots and pads within 1.2 m, and the zones never overlap", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, L(id));
         const points = [...SPOTS[run.level.parallel], ...Array.from({ length: run.level.platforms }, (_, p) => padPoint(run.level, p))];
         for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) expect(Math.hypot(points[a].x - points[b].x, points[a].z - points[b].z)).toBeGreaterThan(2 * USE_RANGE);
         const pad = padPoint(run.level, 0);
         expect(targetAt(run, pad.x, pad.z - 1.1)).toEqual({ kind: "pad", platform: 0 });
         expect(targetAt(run, pad.x, pad.z - 1.3)).toBeNull();
      }
   });
});

describe("station score-limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: limits derive from the earliest win and end; every win and every partial run fits base + pps t`, () => {
         const level = L(id);
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const t0 = earliestWinS(level);
         const clock = level.durationMs / 1000;
         const bonus = TIME_BONUS_PER_SECOND * Math.floor(clock - t0);
         expect(limits.base).toBe((DELIVER_POINTS + PROMPT_POINTS) * level.tasks);
         expect(limits.maxScore).toBe(limits.base! + bonus);
         expect(limits.maxPointsPerSec).toBe(Math.ceil(bonus / t0));
         expect(limits.minDurationMs).toBe(Math.floor((earliestEndS(level) - 0.1) * 10) * 100);
         expect(limits.maxDurationMs).toBe(level.durationMs + 2000);
         for (let t = t0; t <= clock + 1e-9; t += 0.01) {
            const score = winCeiling(level, t);
            expect(score).toBeLessThanOrEqual(limits.maxScore);
            expect(withinServerLimits(score, Math.max(t * 1000, limits.minDurationMs), limits)).toBe(true);
         }
         expect(withinServerLimits((DELIVER_POINTS + PROMPT_POINTS) * (level.tasks - 1), limits.minDurationMs, limits)).toBe(true);
      });
   }
});
