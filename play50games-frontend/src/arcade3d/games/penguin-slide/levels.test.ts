// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's game,
// monotone difficulty, each level setting reaching the simulation, the limit proof per level and the
// bots through the real store. rules.test.ts (level 1's own proof and bots) is untouched.
import { describe, expect, it, vi } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { definitionLevelProblems, isLevelCleared, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, formIndex, slotsAt, type SlideLevel } from "./levels";
import { penguinSlideMeta as meta } from "./meta";
import {
   CLOCK,
   COURSE,
   POINTS,
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   chunkAt,
   createRun,
   generateChunk,
   runScore,
   safeCentre,
   stepRun,
   validChunk,
   type Entry,
   type Run,
   type StepInput,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const ENTRY: Entry = { x: 0, y: 0, z: 0, heading: 0, grade: 0.05, corridor: 0 };
const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const levelMeta = (id: LevelId) => meta.levels![id - 1];

/** Human-paced corridor follower: looks 0.35 s ahead, sees it 0.25 s late, wanders up to 0.35 m. */
function human(seed: number): (run: Run, input: StepInput) => void {
   const rng = createRng(seed * 7919 + 1);
   const queue: { t: number; v: number }[] = [];
   let noise = 0;
   let noiseAt = 0;
   return (run, input) => {
      const look = run.s + run.speed * 0.35;
      const c = chunkAt(run, look);
      queue.push({ t: run.elapsed, v: safeCentre(c, look - c.index * COURSE.chunk, run.branch) + noise });
      // what it saw 0.25 s ago, whatever the frame rate
      while (queue.length > 1 && queue[1].t <= run.elapsed - 0.25) queue.shift();
      const seen = queue[0].v;
      if (run.elapsed >= noiseAt) { noise = (rng() * 2 - 1) * 0.35; noiseAt = run.elapsed + 0.4 + rng() * 1.2; }
      input.steer = Math.max(-1, Math.min(1, (seen - run.d) * 1.6));
      input.jump = false;
   };
}

/** Steers into the next obstacle (the earliest loss), or wiggles and hops (input spam). */
function hostile(kind: "crash" | "spam"): (run: Run, input: StepInput) => void {
   let n = 0;
   return (run, input) => {
      n += 1;
      if (kind === "spam") {
         input.steer = Math.sin(n * 0.19);
         input.jump = n % 2 === 0;
         return;
      }
      let target = run.d;
      for (const c of run.chunks) for (const o of c.obstacles) if (!o.used && o.s >= run.s - 1 && (target === run.d)) target = o.d;
      input.steer = Math.max(-1, Math.min(1, (target - run.d) * 2));
      input.jump = false;
   };
}

const idleBot = (_run: Run, input: StepInput) => { input.steer = 0; input.jump = false; };

/** One run through the real store; checks the per-frame line and the end. */
function playStore(seed: number, id: LevelId, brain: (run: Run, input: StepInput) => void, raw: () => number) {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const store = createArcadeStore();
   store.getState().configure({ resultDelayMs: 1200 });
   store.getState().markReady();
   store.getState().start();
   const run = createRun(seed, false, LEVELS[id]);
   const input: StepInput = { steer: 0, left: false, right: false, jump: false };
   let frames = 0;
   let worst = -Infinity;
   while (store.getState().phase !== "over" && frames++ < 200_000) {
      advanceRunClock(store, raw());
      const dt = playedFrameDt(store.getState());
      if (!(dt > 0)) continue;
      brain(run, input);
      const before = run.s;
      stepRun(run, input, dt);
      worst = Math.max(worst, run.s - before - 22 * dt);
      const state = store.getState();
      state.addScore(run.events.score);
      const allowed = limits.base! + (limits.maxPointsPerSec! * state.elapsedMs) / 1000;
      expect(state.score).toBeLessThanOrEqual(allowed);
      if (run.end) {
         state.setScore(runScore(run));
         state.end(run.end);
      }
   }
   const state = store.getState();
   expect(worst).toBeLessThanOrEqual(1e-8);
   expect(state.phase).toBe("over");
   expect(withinServerLimits(state.score, state.elapsedMs, limits)).toBe(true);
   expect(capScore(state.score, state.elapsedMs, limits)).toBe(state.score);
   return { run, score: state.score, ms: state.elapsedMs, end: state.endReason };
}

describe("penguin-slide levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      for (const id of LEVEL_IDS) {
         // the sum board: a harder level never offers fewer points than level 1, and level 5 stays under 3x
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      }
      const targets = [1, 2, 3, 4].map((id) => levelMeta(id as LevelId).clearScore!);
      expect(targets).toEqual([3000, 3500, 4000, 4500]);
      expect(levelMeta(5).clearScore).toBeUndefined();
   });

   it("level 1 is today's game: same obstacle ramp, form pick, clock, course, HUD and start card", () => {
      const l1 = LEVELS[1];
      expect(l1).toEqual({ slots: 2, extraSlots: 3, rampS: 120, clock: CLOCK.initial, forms: [1, 1, 1, 1, 1, 1], site: "snowHill", kinds: [1, 1, 1] });
      for (let e = 0; e <= 200; e += 0.5) expect(slotsAt(l1, e)).toBe(2 + Math.floor(3 * Math.min(e / 120, 1)));
      const rng = createRng(5);
      for (let i = 0; i < 5000; i++) {
         const u = rng();
         expect(formIndex(l1, u)).toBe(Math.floor(u * 6));
      }
      for (const u of [0, 1 / 6, 2 / 6, 0.5, 4 / 6, 5 / 6, 1 - 1e-12]) expect(formIndex(l1, u)).toBe(Math.floor(u * 6));
      for (let seed = 0; seed < 30; seed++) {
         const today = createRun(seed, false);
         const named = createRun(seed, false, l1);
         expect(named.remaining).toBe(today.remaining);
         expect(JSON.stringify(named.chunks)).toBe(JSON.stringify(today.chunks));
         const bot = human(seed);
         const input: StepInput = { steer: 0, left: false, right: false, jump: false };
         const twin: StepInput = { ...input };
         const bot2 = human(seed);
         for (let n = 0; n < 60 * 150; n++) {
            bot(today, input);
            bot2(named, twin);
            stepRun(today, input, 1 / 60);
            stepRun(named, twin, 1 / 60);
         }
         expect(runScore(named)).toBe(runScore(today));
         expect(named.s).toBe(today.s);
         expect(JSON.stringify(named.chunks)).toBe(JSON.stringify(today.chunks));
      }
      for (const elapsed of [0, 40, 80, 119, 120, 170]) {
         expect(JSON.stringify(generateChunk(9, 4, ENTRY, elapsed, 0, validChunk, l1))).toBe(JSON.stringify(generateChunk(9, 4, ENTRY, elapsed)));
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: undefined, resultDelayMs: 1200 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
   });

   it("keeps the same look, chips and instructions on every level", () => {
      for (const id of LEVEL_IDS) {
         expect(levelInstructions(definition, id)).toBe(definition.instructions);
         expect(levelHudStats(definition, id)).toEqual(definition.hudStats);
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
      }
   });
});

describe("penguin-slide levels: difficulty", () => {
   it("is monotone: never fewer obstacles at any moment, never more straights, never less clock", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         let denser = false;
         for (let e = 0; e <= 180; e += 0.25) {
            expect(slotsAt(b, e)).toBeGreaterThanOrEqual(slotsAt(a, e));
            if (slotsAt(b, e) > slotsAt(a, e)) denser = true;
         }
         const share = (l: SlideLevel, i: number) => l.forms[i] / l.forms.reduce((x, y) => x + y, 0);
         expect(share(b, 0)).toBeLessThanOrEqual(share(a, 0));
         expect(b.clock).toBeGreaterThanOrEqual(a.clock);
         expect(denser || share(b, 0) < share(a, 0)).toBe(true);
         expect(levelMeta(id).clearScore ?? Infinity).toBeGreaterThan(levelMeta((id - 1) as LevelId).clearScore!);
      }
      for (const id of LEVEL_IDS) for (let e = 0; e <= 180; e += 1) expect(slotsAt(LEVELS[id], e)).toBeLessThanOrEqual(5);
   });
});

describe("penguin-slide levels: the simulation reads the level", () => {
   it("the starting clock and the first hazard chunk are the level's", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, false, LEVELS[id]);
         expect(run.remaining).toBe(LEVELS[id].clock);
         expect(run.chunks[2].obstacles.length, `L${id}`).toBe(slotsAt(LEVELS[id], 0));
      }
   });

   it("a chunk carries the level's obstacle count, also when its first candidates are rejected", () => {
      for (const id of LEVEL_IDS) {
         for (const elapsed of [0, 45, 200]) {
            const c = generateChunk(11, 3, ENTRY, elapsed, 0, validChunk, LEVELS[id]);
            expect(c.obstacles.length, `L${id} @${elapsed}`).toBe(slotsAt(LEVELS[id], elapsed));
            const retried = generateChunk(11, 3, ENTRY, elapsed, 0, (chunk) => chunk.attempts > 2 && validChunk(chunk), LEVELS[id]);
            expect(retried.attempts).toBeGreaterThan(2);
            expect(retried.obstacles.length, `L${id} retry`).toBe(slotsAt(LEVELS[id], elapsed));
         }
      }
   });

   it("chunks generated during the run (recycling) use the run's level", () => {
      for (const id of [1, 4] as const) {
         const run = createRun(21, false, LEVELS[id]);
         const bot = human(21);
         const input: StepInput = { steer: 0, left: false, right: false, jump: false };
         while (run.chunks[2].index < 4 && !run.end) { bot(run, input); stepRun(run, input, 1 / 60); }
         expect(run.chunks[2].obstacles.length, `L${id}`).toBe(slotsAt(LEVELS[id], run.elapsed));
      }
   });

   it("the course form mix follows the level's weights", () => {
      const straights = (id: LevelId) => {
         let n = 0;
         for (let seed = 0; seed < 600; seed++) if (generateChunk(seed, 2, ENTRY, 0, 0, () => true, LEVELS[id]).form === "straight") n++;
         return n / 600;
      };
      const l1 = straights(1);
      const l5 = straights(5);
      expect(l1).toBeGreaterThan(0.12);
      expect(l1).toBeLessThan(0.22);
      expect(l5).toBeLessThan(0.06);
   });
});

describe("penguin-slide levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: the proof's inputs hold on 300 seeds (spacing, first obstacle, fish budget, one ramp)`, () => {
      for (let seed = 0; seed < 300; seed++) {
         for (const elapsed of [0, 60, 180]) {
            const index = 1 + (seed % 7);
            const c = generateChunk(seed, index, ENTRY, elapsed, 0, validChunk, LEVELS[id]);
            expect(c.fish.length).toBeLessThanOrEqual(POINTS.fishBudget);
            expect(c.obstacles.length).toBeLessThanOrEqual(5);
            for (let i = 0; i < c.obstacles.length; i++) {
               expect(c.obstacles[i].s).toBeGreaterThanOrEqual(index * COURSE.chunk + 3);
               if (i) expect(c.obstacles[i].s - c.obstacles[i - 1].s).toBeGreaterThanOrEqual(COURSE.separation);
            }
            expect(validChunk(c) || c.fallback).toBe(true);
         }
      }
      expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(PROPOSED_LIMITS);
   });
});

describe("penguin-slide levels: bots through the real store", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the human-paced bot clears on at least 90% of 40 seeds; idle never clears on 200`, () => {
         let cleared = 0;
         for (let seed = 1; seed <= 40; seed++) {
            const r = playStore(seed, id, human(seed), () => (seed % 3 === 0 ? 1 / 20 : 1 / 60));
            expect(r.ms).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
            // level 5 has nothing to unlock: there the bot must reach 5000 (above level 4's target)
            if (id === 5 ? r.score >= 5000 : isLevelCleared(r.end, r.score, levelMeta(id))) cleared += 1;
         }
         expect(cleared / 40).toBeGreaterThanOrEqual(0.9);
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, false, LEVELS[id]);
            const input: StepInput = { steer: 0, left: false, right: false, jump: false };
            while (!run.end) stepRun(run, input, 1 / 60);
            expect(isLevelCleared(run.end, runScore(run), levelMeta(id)), `seed ${seed} ${runScore(run)}`).toBe(false);
            expect(runScore(run)).toBeLessThan(levelMeta(1).clearScore!);
            expect(run.elapsed * 1000).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
         }
      }, 120_000);

      it(`L${id}: the crash, spam and idle bots stay inside the window at 60, 20 Hz and random frames`, () => {
         for (let seed = 0; seed < 12; seed++) {
            const rng = createRng(77 + seed);
            const raw = seed % 3 === 0 ? () => 1 / 60 : seed % 3 === 1 ? () => 1 / 20 : () => 0.004 + rng() * 0.296;
            const brain = seed % 3 === 0 ? hostile("crash") : seed % 3 === 1 ? hostile("spam") : idleBot;
            const r = playStore(seed, id, brain, raw);
            expect(r.ms).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
         }
      }, 120_000);
   }
});
