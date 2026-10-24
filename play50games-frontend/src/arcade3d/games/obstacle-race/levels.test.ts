// Obstacle Race levels proof (docs/arcade-levels.md §5 and §6.3): the per-level score limits and
// why they hold. Level 1 is today's game (buildCourse(LEVELS[1]) deep-equals rules.ts COURSE), so
// rules.test.ts pins it and this file proves levels 2-5 the same way: course sanity (every gap and
// skip bound cites rules.ts FOOT / V_RUN / COYOTE_MS / MAX_MOVE), monotone difficulty, the server
// window against the proven floor minFinishMsFor (earliestMs = ceil(line·1000/V_RUN)), and bot
// proofs — an honest-human-paced speedrun bot (rules.test.ts's bot, generalized per course) clears
// every level inside its window, cheap bots can never post a time below the floor, and the idle bot
// never wins. Seeds are kept lean so the whole file stays well under a minute (rules.test.ts's
// runtime is untouched); the win rates and best/median finishes are the README "Levels" numbers.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { createRng } from "@/arcade3d/core/math";
import { computeTimeScore, isRankedRun } from "@/arcade3d/core/scores";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import type { StoreApi } from "zustand/vanilla";
import definition from "./index";
import { LEVELS } from "./levels";
import { obstacleRaceMeta as meta } from "./meta";
import {
   BAR,
   BEAM,
   BLOCK,
   BUFFER_MS,
   COYOTE_MS,
   COURSE,
   DURATION_MS,
   FOOT,
   MAX_MOVE,
   MAX_STEP_MS,
   NONE,
   PLATFORM,
   PROPOSED_LEVEL_LIMITS,
   RUNNER,
   STAT,
   TIMING_L1,
   V_RUN,
   WATER_Y,
   blockX,
   buildCourse,
   createRun,
   createStepInput,
   finalScore,
   jumpReach,
   landingTime,
   minFinishMsFor,
   skipReach,
   step,
   wave,
   type Course,
   type ObstacleRun,
   type StepEvents,
   type StepInput,
   type Support,
} from "./rules";

// The five levels' finish lines and proven floors (minFinishMsFor = earliestMs(finishLine),
// rules.ts): the level-1 numbers are pinned by rules.test.ts; these pin 2-5.
const EXPECTED_FINISH_LINE: Record<LevelId, number> = { 1: 116, 2: 124.8, 3: 128.6, 4: 133.6, 5: 137.4 };
const EXPECTED_FLOOR: Record<LevelId, number> = { 1: 19334, 2: 20800, 3: 21434, 4: 22267, 5: 22900 };

// ---------- shared helpers (mirrors of rules.test.ts's, generalized per course) ----------

const input = (moveX: number, moveZ: number, jumpPressed = false): StepInput => ({ moveX, moveZ, jumpPressed });
const IDLE = input(0, 0);
const FWD = input(0, -1);
const FWD_PRESS = input(0, -1, true);
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const progress = (run: ObstacleRun): number => -run.runner.z;
const cloneRun = (run: ObstacleRun): ObstacleRun => ({ ...run, runner: { ...run.runner }, events: { ...run.events } });

/** A frame pattern (rules.test.ts's): fixed fps or random frames. */
interface Pattern {
   name: string;
   make(seed: number): () => number;
}
const fixed = (ms: number, name = `${ms} ms`): Pattern => ({ name, make: () => () => ms });
const FPS_60 = fixed(1000 / 60, "60 fps");
const FPS_30 = fixed(1000 / 30, "30 fps");
const FPS_144 = fixed(1000 / 144, "144 fps");

interface Bot {
   next(run: ObstacleRun, dtMs: number): StepInput;
}

const straightBot = (): Bot => ({ next: () => FWD });
const masherBot = (): Bot => ({ next: () => FWD_PRESS });

/** Random stick (mostly forward), held for 50-450 ms, and jump mashing. */
function randomBot(seed: number): Bot {
   const rng = createRng(seed);
   const inp = createStepInput();
   let hold = 0;
   return {
      next(_run, dtMs) {
         if (hold <= 0) {
            const a = (rng() < 0.75 ? rng() - 0.5 : rng() * 2) * Math.PI;
            const m = rng() < 0.6 ? 1 : rng();
            inp.moveX = Math.sin(a) * m;
            inp.moveZ = -Math.cos(a) * m;
            hold = 50 + rng() * 400;
         }
         hold -= dtMs;
         inp.jumpPressed = rng() < 0.08;
         return inp;
      },
   };
}

/** Adversarial: each frame, the stick direction and press that gain the most p in that frame (cloned lookahead). */
function greedyBot(): Bot {
   const candidates: StepInput[] = [];
   for (let a = -90; a <= 90; a += 15) {
      const rad = (a * Math.PI) / 180;
      for (const j of [false, true]) candidates.push(input(Math.sin(rad), -Math.cos(rad), j));
   }
   return {
      next(run, dtMs) {
         let best = candidates[0];
         let bestP = -Infinity;
         for (const c of candidates) {
            const sim = cloneRun(run);
            step(sim, dtMs, c);
            const score = sim.runner.state === "run" ? progress(sim) : -Infinity;
            if (score > bestP) {
               bestP = score;
               best = c;
            }
         }
         return best;
      },
   };
}

/**
 * One level's course data and speedrun bot (rules.test.ts's bot, generalized: the beam range, its
 * aim point and the finish aim come from the course; the hub waypoints and the bridge/CP1 indices
 * are fixed in every level). The bot's block/beam/bar reads thread the run's timing, so a bot made
 * for a course plays that course's obstacles.
 */
function makeKit(course: Course) {
   const PATH = course.supports;
   const S = Object.fromEntries(PATH.map((s, i) => [s.name, i])) as Record<string, number>;
   const beam = PATH[S["beam"]];
   const finishLine = course.finish.line;

   const centreX = (s: Support, ms: number, run: ObstacleRun): number =>
      (s.minX + s.maxX) / 2 + (s.block === NONE ? 0 : blockX(s.block, ms, run.timing));

   function steer(run: ObstacleRun, inp: StepInput, target: number): void {
      const r = run.runner;
      const p = -r.z;
      const ms = run.simMs;
      if (p >= beam.minP - 0.6 && p < beam.maxP - 0.2) {
         // the beam: hold x 0 against the slide (the level's amplitude, run.timing.beamSlide)
         const sx = clamp((-run.timing.beamSlide * wave(ms, BEAM.periodMs, 0) - 5 * r.x) / V_RUN, -0.6, 0.6);
         inp.moveX = sx;
         inp.moveZ = -Math.sqrt(1 - sx * sx);
         return;
      }
      let ax: number;
      let ap: number;
      if (target <= S["CP1"] && p < 28) {
         // past the hub on its left (the same route in every level; the fixed head)
         if (p < 12.5) [ax, ap] = [-1.2, 14];
         else if (p < 16) [ax, ap] = [-2.6, 17.5];
         else if (p < 19.5) [ax, ap] = [-2.6, 21];
         else if (p < 23.5) [ax, ap] = [-0.5, 25.5];
         else [ax, ap] = [0, 30];
      } else if (target === S["beam"]) {
         [ax, ap] = [0, beam.minP + 0.9];
      } else if (target === S["finish"] || p >= beam.maxP - 0.2) {
         [ax, ap] = [0, finishLine + 4];
      } else {
         const t = PATH[target];
         const lead = r.grounded ? 700 : Math.max(0, landingTime(t.top, r.arcY0, r.arcV) * 1000 - (ms - r.arcStart));
         ax = centreX(t, ms + lead, run);
         ap = (t.minP + t.maxP) / 2;
      }
      if (r.grounded && r.support !== NONE && PATH[r.support].kind !== "disc") {
         // stay on the current top while lining up
         const c = PATH[r.support];
         const ox = c.block === NONE ? 0 : blockX(c.block, ms, run.timing);
         ax = clamp(ax, c.minX + ox + 0.5, c.maxX + ox - 0.5);
      }
      const dx = ax - r.x;
      const dp = Math.max(0.5, ap - p);
      const len = Math.sqrt(dx * dx + dp * dp);
      inp.moveX = dx / len;
      inp.moveZ = -dp / len;
   }

   /** Does a press now land on `target`, `margin` past its back edge, 0.3 inside its sides and front? */
   function goodJump(run: ObstacleRun, dtMs: number, target: number, margin: number): boolean {
      const sim = cloneRun(run);
      const inp = createStepInput();
      steer(sim, inp, target);
      inp.jumpPressed = true;
      step(sim, dtMs, inp);
      if (!sim.events.jumped) return false;
      inp.jumpPressed = false;
      for (let t = 0; t < 1500 && sim.runner.state === "run" && !sim.runner.grounded; t += dtMs) {
         steer(sim, inp, target);
         step(sim, dtMs, inp);
      }
      const r = sim.runner;
      if (r.state !== "run" || !r.grounded || r.support !== target) return false;
      const s = PATH[target];
      const p = -r.z;
      if (p < s.minP + margin || p > s.maxP - 0.3) return false;
      const ox = s.block === NONE ? 0 : blockX(s.block, sim.simMs, sim.timing);
      return r.x >= s.minX + ox + 0.3 && r.x <= s.maxX + ox - 0.3;
   }

   /** Is the runner knocked (or lost) within `horizonMs` if it keeps steering, pressing jump now or not?
    *  With `fixed`, the sim holds that stick while airborne (the bot does the same through a bar-jump
    *  arc, so the clearance prediction replays the run bit for bit) and steers again once grounded. */
   function knockedWithin(run: ObstacleRun, press: boolean, horizonMs: number, fixed?: StepInput): boolean {
      const sim = cloneRun(run);
      const inp = createStepInput();
      // 1 ms steps: the take-off ms decides whether the bar is cleared, and the real clock steps
      // 1 ms whatever the frame rate (frame granularity here missed hits on the faster bars)
      for (let t = 0; t < horizonMs && sim.ended === null; t++) {
         const r = sim.runner;
         if (fixed && !r.grounded) {
            inp.moveX = fixed.moveX;
            inp.moveZ = fixed.moveZ;
         } else {
            steer(sim, inp, r.grounded ? Math.min(r.support + 1, PATH.length - 1) : S["bridge B"]);
         }
         inp.jumpPressed = press && t === 0;
         const ev = step(sim, 1, inp);
         if (ev.knocked || ev.lost) return true;
      }
      return false;
   }

   function speedrunBot(): Bot {
      const inp = createStepInput();
      let airTarget = NONE;
      // the stick captured with a bar-jump jump: held unchanged through the arc, so the clearance
      // sim above (same stick, 1 ms steps) replays the real arc bit for bit
      let barArc: { moveX: number; moveZ: number } | null = null;
      return {
         next(run, dtMs) {
            const r = run.runner;
            inp.jumpPressed = false;
            if (r.state !== "run") {
               airTarget = NONE;
               barArc = null;
               inp.moveX = 0;
               inp.moveZ = 0;
               return inp;
            }
            const target = r.grounded ? Math.min(r.support + 1, PATH.length - 1) : airTarget !== NONE ? airTarget : S["bridge A"];
            steer(run, inp, target);
            if (!r.grounded) {
               if (barArc) {
                  inp.moveX = barArc.moveX;
                  inp.moveZ = barArc.moveZ;
               }
               return inp;
            }
            barArc = null;
            airTarget = target;
            const cur = PATH[r.support];
            const t = PATH[target];
            const p = -r.z;
            if (t.minP - cur.maxP > 0) {
               const moving = t.kind === "block";
               if (goodJump(run, dtMs, target, moving ? 0.4 : 0.45)) {
                  inp.jumpPressed = true;
                  return inp;
               }
               if (moving) {
                  // wait at the edge for the block
                  const vmax = Math.sqrt(2 * 38 * Math.max(0, cur.maxP - 0.2 - p));
                  if (-inp.moveZ * V_RUN > vmax) inp.moveZ = -vmax / V_RUN;
               } else if (p > cur.maxP + FOOT - (0.006 * dtMs + 0.02)) {
                  inp.jumpPressed = true;
               }
               return inp;
            }
            if (p > 9 && p < 25.5) {
               // jump when the bar reaches the runner within 500 ms (the feet are above it from
               // ~96 ms to ~584 ms after take-off) and jumping clears a full second
               const stand = knockedWithin(run, false, 500);
               const jump = knockedWithin(run, true, 1000, inp);
               if (stand && !jump) {
                  barArc = { moveX: inp.moveX, moveZ: inp.moveZ };
                  inp.jumpPressed = true;
               }
            }
            return inp;
         },
      };
   }

   return { PATH, S, beam, finishLine, steer, speedrunBot };
}

interface Played {
   run: ObstacleRun;
   problems: string[];
   checkpoints: number[];
   jumps: number;
   knocks: number;
   respawns: number;
}

/**
 * Steps `run` with `bot` and frames from `nextDt` until it ends or reaches `limitMs`, checking the
 * proof on every frame: p moves at most MAX_MOVE per simulated ms and every checkpoint and the
 * finish come no earlier than earliestMs of their line (the same proof rules.test.ts runs).
 */
function play(run: ObstacleRun, bot: Bot, nextDt: () => number, limitMs = DURATION_MS): Played {
   const out: Played = { run, problems: [], checkpoints: [], jumps: 0, knocks: 0, respawns: 0 };
   for (let guard = 0; run.ended === null && run.simMs < limitMs && guard < 2_000_000; guard++) {
      const dt = nextDt();
      const before = progress(run);
      const ev = step(run, dt, bot.next(run, dt));
      const now = progress(run);
      if (ev.respawned) {
         out.respawns += 1;
         if (now > run.maxP + 1e-12) out.problems.push(`respawn at p ${now} past maxP ${run.maxP}`);
      } else if (now - before > MAX_MOVE * run.stepMs + 1e-9) {
         out.problems.push(`p +${now - before} in ${run.stepMs} ms at ${run.simMs}`);
      }
      if (ev.jumped) out.jumps += 1;
      if (ev.knocked) out.knocks += 1;
      if (ev.checkpoint !== NONE) {
         out.checkpoints.push(run.checkpointMs);
         if (run.checkpointMs < Math.ceil((run.course.checkpoints[ev.checkpoint].line * 1000) / V_RUN)) out.problems.push(`checkpoint ${ev.checkpoint} at ${run.checkpointMs}`);
      }
      if (ev.finished && run.finishMs < Math.ceil((run.course.finish.line * 1000) / V_RUN)) out.problems.push(`finish at ${run.finishMs}`);
   }
   return out;
}

/** What Scene.tsx does with a step's events (README "Scoring"). */
function sceneReport(store: StoreApi<ArcadeStore>, run: ObstacleRun, ev: StepEvents): void {
   const s = store.getState();
   if (ev.checkpoint !== NONE) s.setStat(STAT.checkpoint, ev.checkpoint);
   if (ev.finished) {
      s.setStat(STAT.finishMs, run.finishMs);
      s.end("win");
   } else if (ev.timeup) {
      s.end("timeup");
   }
}

/** Gap, rise and the plain-jump numbers between two supports in path order. */
function pairOf(a: Support, b: Support) {
   const gap = b.minP - a.maxP;
   const dy = b.top - a.top;
   return { gap, dy, travel: gap - 2 * FOOT, reach: jumpReach(dy) };
}

const median = (values: number[]): number => {
   const sorted = [...values].sort((a, b) => a - b);
   return sorted[Math.floor(sorted.length / 2)];
};

// ---------- 1. consistency: meta, definition and the proposed limits agree ----------

describe("obstacle-race levels: consistency", () => {
   it("meta.levels and definition.levels are the five levels, in order, with titles, descriptions and limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.levels!.map((level) => level.id)).toEqual([...LEVEL_IDS]);
      expect(definition.levels!.map((spec) => spec.id)).toEqual([...LEVEL_IDS]);
      for (const id of LEVEL_IDS) {
         // every level's server limits are the ones this branch proposes (copied into
         // arcade-games.json by Claude at merge; registry.sync.test.ts then pins them)
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(scoringFor(meta, id));
         expect(definition.levels![id - 1].description.trim().length).toBeGreaterThan(0);
         expect(definition.levels![id - 1].config).toEqual(LEVELS[id]);
      }
      // level 1 is today's game: its limits are the live meta.scoring
      expect(meta.levels![0].scoring).toEqual(meta.scoring);
   });
});

// ---------- 2. level 1 is today's game ----------

describe("obstacle-race levels: level 1 = today", () => {
   it("buildCourse(LEVELS[1]) deep-equals COURSE: the same course, bit for bit", () => {
      expect(buildCourse(LEVELS[1])).toEqual(COURSE);
   });

   it("TIMING_L1 is today's module constants", () => {
      expect(TIMING_L1).toEqual({ barOmega: BAR.omega, blockPeriodMs: BLOCK.periodMs, blockTravel: BLOCK.travel, beamSlide: BEAM.slide });
   });
});

// ---------- 3-5. per-level course sanity, monotony and limits ----------

for (const id of LEVEL_IDS) {
   describe(`obstacle-race level ${id} (${meta.levels![id - 1].title})`, () => {
      const level = LEVELS[id];
      const course = buildCourse(level);
      const PATH = course.supports;
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const floor = minFinishMsFor(course);

      it("the course is sound: parts in order, joins at equal heights, lines inside their pads", () => {
         // parts in p order; a walking join is at equal heights and overlaps in x (no sliver);
         // the fixed joins touch exactly, as in COURSE
         for (let i = 1; i < PATH.length; i++) {
            const a = PATH[i - 1];
            const b = PATH[i];
            expect(b.minP, `${b.name} after ${a.name}`).toBeGreaterThanOrEqual(a.minP);
            if (b.minP - a.maxP <= 0) {
               expect(b.top, `${a.name} -> ${b.name}`).toBe(a.top);
               if (a.kind !== "disc" && b.kind !== "disc") expect(Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)).toBeGreaterThan(0);
            }
         }
         const named = Object.fromEntries(PATH.map((s) => [s.name, s])) as Record<string, Support>;
         expect([named["start"].maxP, named["bridge B"].maxP, named["CP3"].maxP, named["beam"].maxP]).toEqual([
            named["bridge A"].minP,
            named["CP1"].minP,
            named["beam"].minP,
            named["finish"].minP,
         ]);
         // support indices: 0 start, 1 bridge A, 2 disc, 3 bridge B, 4 CP1, then the platforms,
         // CP2, the blocks, CP3, the beam, the finish
         const names = ["start", "bridge A", "disc", "bridge B", "CP1"];
         for (let k = 1; k <= level.jumps; k++) names.push(`J${k}`);
         names.push("CP2");
         for (let k = 1; k <= level.blocks; k++) names.push(`B${k}`);
         names.push("CP3", "beam", "finish");
         expect(PATH.map((s) => s.name)).toEqual(names);
         expect(course.sweeper).toBe(2);
         // every checkpoint line and the finish line inside its pad; the spawn is on the start line
         for (const line of [...course.checkpoints, course.finish]) {
            const pad = PATH[line.support];
            expect(pad.kind).toBe("pad");
            expect(line.line).toBeGreaterThanOrEqual(pad.minP);
            expect(line.line).toBeLessThanOrEqual(pad.maxP);
         }
         const run = createRun(course);
         expect([run.runner.x, run.runner.y, progress(run), run.runner.state, run.runner.support]).toEqual([0, 0, 0, "run", 0]);
         expect(run.timing).toEqual({ barOmega: level.barOmega, blockPeriodMs: level.blockPeriodMs, blockTravel: level.blockTravel, beamSlide: level.beamSlide });
         // the finish line and the proven floor are the design's (earliestMs = ceil(line·1000/V_RUN))
         expect(course.finish.line).toBe(EXPECTED_FINISH_LINE[id]);
         expect(floor).toBe(EXPECTED_FLOOR[id]);
      });

      it("every jump is at most 65 % of a plain jump's reach, and no section can be skipped", () => {
         // the jumps a player can count on: gap minus both FOOT graces over jumpReach(dy)
         let jumps = 0;
         for (let i = 1; i < PATH.length; i++) {
            const q = pairOf(PATH[i - 1], PATH[i]);
            if (q.gap <= 0) continue;
            jumps += 1;
            expect(q.travel / q.reach, `${PATH[i - 1].name} -> ${PATH[i].name}`).toBeLessThanOrEqual(0.65);
            const a = PATH[i - 1];
            const b = PATH[i];
            if (a.kind !== "block" && b.kind !== "block") expect(Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)).toBeGreaterThan(0);
         }
         expect(jumps).toBe(level.jumps + level.blocks + 2);
         // no skip: a support to the one after the next (nothing but a bridge between) is beyond
         // skipReach(dy) (the rules' most generous reach: both FOOT graces, MAX_MOVE at each end,
         // the COYOTE_MS run-on from the coyote fall's height); the 5.4 m same-height pairs over a
         // block keep the level-1 margin (>= 0.39 m)
         let sameHeight = 0;
         for (let i = 0; i + 2 < PATH.length; i++) {
            const a = PATH[i];
            const between = PATH[i + 1];
            const c = PATH[i + 2];
            if (between.kind === "bridge") continue;
            const distance = c.minP - a.maxP;
            const dy = c.top - a.top;
            expect(distance, `${a.name} -> ${c.name} over ${between.name}`).toBeGreaterThan(skipReach(dy));
            if (dy === 0 && Math.abs(distance - 5.4) < 1e-9) {
               sameHeight += 1;
               expect(distance - skipReach(dy)).toBeGreaterThanOrEqual(0.39);
            }
         }
         expect(sameHeight).toBe(level.blocks);
      });

      it("a pillar stands under every platform; the limits sit below the proven floor", () => {
         for (const s of PATH.filter((x) => x.kind === "platform")) {
            const pil = course.solids.find((o) => o.name === `${s.name} pillar`)!;
            expect(pil.shape).toBe("box");
            expect(pil.top).toBe(s.bottom);
            expect(pil.bottom).toBe(WATER_Y);
            expect(s.bottom).toBeCloseTo(s.top - PLATFORM.thickness, 12);
            expect(pil.minX - s.minX).toBeGreaterThan(RUNNER.radius);
            expect(s.maxP - pil.maxP).toBeGreaterThan(RUNNER.radius);
         }
         // the server window: maxScore is exactly the time-score at minDurationMs (the server
         // recomputes the score from the duration), and the floor (earliestMs of the finish line)
         // stays >= 3 % and >= 800 ms above the window's lower edge
         expect(computeTimeScore(limits, limits.minDurationMs)).toBe(limits.maxScore);
         expect(floor - limits.minDurationMs).toBeGreaterThanOrEqual(Math.ceil(0.03 * floor));
         expect(floor - limits.minDurationMs).toBeGreaterThanOrEqual(800);
         expect(limits.maxDurationMs).toBe(DURATION_MS);
         expect(limits.timeBaseMs).toBe(DURATION_MS);
         if (id === 1) expect(limits).toEqual(meta.scoring);
      });

      it("the speedrun bot clears the level inside its window (60/30/144 fps + random frames)", () => {
         const kit = makeKit(course);
         // frame patterns: the three fixed rates and RANDOM_SEEDS random-frame seeds per level
         // (kept lean for the file's runtime budget, documented at the top)
         const RANDOM_SEEDS = 4;
         const patterns: Array<{ name: string; make: () => () => number }> = [
            { name: "60 fps", make: () => FPS_60.make(1) },
            { name: "30 fps", make: () => FPS_30.make(1) },
            { name: "144 fps", make: () => FPS_144.make(1) },
            ...Array.from({ length: RANDOM_SEEDS }, (_unused, k) => ({
               name: `random 4-50 ms (seed ${100 + k})`,
               make: () => {
                  const rng = createRng(100 + k);
                  return () => 4 + rng() * 46;
               },
            })),
         ];
         const finishes: number[] = [];
         let wins = 0;
         for (const pattern of patterns) {
            const played = play(createRun(course), kit.speedrunBot(), pattern.make());
            expect(played.problems, pattern.name).toEqual([]);
            expect(played.checkpoints.length, pattern.name).toBe(3);
            if (played.run.ended === "win") {
               wins += 1;
               // a clean, honest run: no knock, no fall; inside the window, above the floor
               expect(played.knocks, pattern.name).toBe(0);
               expect(played.respawns, pattern.name).toBe(0);
               expect(played.run.finishMs, pattern.name).toBeGreaterThanOrEqual(floor);
               expect(played.run.finishMs, pattern.name).toBeGreaterThanOrEqual(limits.minDurationMs);
               expect(played.run.finishMs, pattern.name).toBeLessThanOrEqual(limits.maxDurationMs);
               expect(computeTimeScore(limits, played.run.finishMs), pattern.name).toBeLessThanOrEqual(limits.maxScore);
               finishes.push(played.run.finishMs);
            }
         }
         // the honest-human-paced bot clears at least 90 % of the patterns (measured: 100 %)
         expect(wins / patterns.length).toBeGreaterThanOrEqual(0.9);
         // the best bot scores at least 90 % of the level's maxScore
         expect(computeTimeScore(limits, Math.min(...finishes))).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         // the README's measured numbers
         console.info(`level ${id} speedrun bot: ${wins}/${patterns.length} wins, best ${Math.min(...finishes)} ms, median ${median(finishes)} ms`);
      }, 60_000);

      it("cheap bots can only win inside the window, and the idle bot never wins", () => {
         // seeds kept lean for the file's runtime budget (documented above); the proofs do not
         // depend on the seed count: any cheap-bot win must lie inside the window
         const CHEAP_SEEDS = 2;
         const runs: Array<{ name: string; played: Played }> = [];
         for (const [patternName, makePattern] of [
            ["60 fps", () => FPS_60.make(1)],
            ["random 4-50 ms", () => {
               const rng = createRng(9);
               return () => 4 + rng() * 46;
            }],
         ] as const) {
            for (let seed = 0; seed < CHEAP_SEEDS; seed++) {
               runs.push({ name: `straight ${patternName} ${seed}`, played: play(createRun(course), straightBot(), makePattern(), 45_000) });
               runs.push({ name: `masher ${patternName} ${seed}`, played: play(createRun(course), masherBot(), makePattern(), 45_000) });
               runs.push({ name: `random ${patternName} ${seed} (a)`, played: play(createRun(course), randomBot(20 + seed), makePattern(), 45_000) });
               runs.push({ name: `random ${patternName} ${seed} (b)`, played: play(createRun(course), randomBot(40 + seed), makePattern(), 45_000) });
            }
         }
         // greedy lookahead is the expensive one: one seed per level, 60 fps (rules.test.ts's set)
         runs.push({ name: "greedy 60 fps", played: play(createRun(course), greedyBot(), FPS_60.make(1), 30_000) });
         for (const { name, played } of runs) {
            expect(played.problems, name).toEqual([]);
            // any win an unskilled input can post lies inside the level's window, above its floor
            if (played.run.ended === "win") {
               expect(played.run.finishMs, name).toBeGreaterThanOrEqual(floor);
               expect(played.run.finishMs, name).toBeGreaterThanOrEqual(limits.minDurationMs);
               expect(played.run.finishMs, name).toBeLessThanOrEqual(limits.maxDurationMs);
            }
         }
         // doing nothing never wins: the runner never leaves the start line (30 s is already 10 s
         // past the level's fastest possible finish, floor >= 19334 ms)
         for (let seed = 0; seed < 2; seed++) {
            const played = play(createRun(course), { next: () => IDLE }, FPS_60.make(1), 30_000);
            expect(played.run.ended, `idle ${seed}`).not.toBe("win");
            expect(Math.abs(progress(played.run)), `idle ${seed}`).toBe(0);
            expect(played.problems, `idle ${seed}`).toEqual([]);
         }
      }, 60_000);

      it("fairness: identical inputs give the identical run, and the timing windows are level-independent", () => {
         const kit = makeKit(course);
         const next = () => {
            const rng = createRng(31);
            return () => 4 + rng() * 46;
         };
         const a = play(createRun(course), kit.speedrunBot(), next(), 60_000);
         const b = play(createRun(course), kit.speedrunBot(), next(), 60_000);
         expect(a.run.finishMs).toBe(b.run.finishMs);
         expect({ ...a.run, course: null }).toEqual({ ...b.run, course: null });
         // the windows every level shares (rules.ts constants, asserted once per level for the report)
         expect([COYOTE_MS, BUFFER_MS, MAX_STEP_MS, V_RUN]).toEqual([100, 120, 50, 6]);
      });

      it("the store hand-off: a win submits the exact finish ms and only a win is ranked", () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1200 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(course);
         const bot = makeKit(course).speedrunBot();
         for (let guard = 0; store.getState().phase !== "over" && guard < 100_000; guard++) {
            advanceRunClock(store, 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt === 0) continue;
            sceneReport(store, run, step(run, dt * 1000, bot.next(run, dt * 1000)));
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         expect(run.ended).toBe("win");
         expect(s.stats[STAT.finishMs]).toBe(run.finishMs);
         expect(s.stats[STAT.checkpoint]).toBe(3);
         const fin = finalScore(s);
         expect(fin.durationMs).toBe(run.finishMs);
         expect(Number.isInteger(fin.durationMs)).toBe(true);
         expect(fin.durationMs).toBeLessThanOrEqual(s.elapsedMs);
         expect(fin.durationMs).toBeGreaterThanOrEqual(limits.minDurationMs);
         expect(fin.durationMs).toBeLessThanOrEqual(limits.maxDurationMs);
         expect(computeTimeScore(limits, fin.durationMs)).toBeLessThanOrEqual(limits.maxScore);
         expect(isRankedRun(limits, s.endReason)).toBe(true);
         expect(isRankedRun(limits, "timeup")).toBe(false);
         expect(isRankedRun(limits, "quit")).toBe(false);
         // any other end keeps the store's elapsedMs (and is unranked anyway)
         expect(finalScore({ ...s, endReason: "timeup" }).durationMs).toBe(s.elapsedMs);
         expect(finalScore({ ...s, stats: {} }).durationMs).toBe(s.elapsedMs);
      }, 60_000);
   });
}

// ---------- 4. monotone difficulty across the five levels ----------

describe("obstacle-race levels: monotone difficulty", () => {
   it("counts and speeds never decrease, the blocks never slow, the pads never widen, the course never shortens", () => {
      const seq = LEVEL_IDS.map((id) => LEVELS[id]);
      for (let i = 1; i < seq.length; i++) {
         expect(seq[i].jumps, `level ${i + 1} jumps`).toBeGreaterThanOrEqual(seq[i - 1].jumps);
         expect(seq[i].blocks, `level ${i + 1} blocks`).toBeGreaterThanOrEqual(seq[i - 1].blocks);
         expect(seq[i].barOmega, `level ${i + 1} barOmega`).toBeGreaterThanOrEqual(seq[i - 1].barOmega);
         expect(seq[i].beamSlide, `level ${i + 1} beamSlide`).toBeGreaterThanOrEqual(seq[i - 1].beamSlide);
         expect(seq[i].blockPeriodMs, `level ${i + 1} blockPeriodMs`).toBeLessThanOrEqual(seq[i - 1].blockPeriodMs);
         expect(seq[i].padHalfX, `level ${i + 1} padHalfX`).toBeLessThanOrEqual(seq[i - 1].padHalfX);
      }
      const lines = LEVEL_IDS.map((id) => buildCourse(LEVELS[id]).finish.line);
      for (let i = 1; i < lines.length; i++) expect(lines[i], `level ${i + 1} finish line`).toBeGreaterThan(lines[i - 1]);
   });
});
