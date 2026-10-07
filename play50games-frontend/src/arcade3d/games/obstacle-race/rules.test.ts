import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRAME_PRIORITY, MAX_FRAME_DT, advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { StoreApi } from "zustand/vanilla";
import { obstacleRaceMeta } from "./meta";
import {
   ACCEL,
   AIR_MS,
   APEX_HEIGHT,
   APEX_MS,
   ARCH,
   BAR,
   BAR_CLEAR_MS,
   BAR_MIN_RADIUS,
   BAR_WINDOW_MS,
   BEAM,
   BLOCK,
   BLOCK_PHASES,
   BLOCK_TOP_SPEED,
   BUFFER_MS,
   COURSE,
   COYOTE_DROP,
   COYOTE_MS,
   DISC,
   DURATION_MS,
   FLAT,
   FOOT,
   G,
   HUB,
   KILL_Y,
   KNOCK,
   KNOCK_RETURN_MS,
   KNOCK_STOP_MS,
   KNOCK_STOP_X,
   LINES,
   LOST_MS,
   MAX_MOVE,
   MAX_STEP_MS,
   MIN_FINISH_MS,
   NONE,
   PLATFORM,
   RAMP_M,
   RAMP_MS,
   RUNNER,
   SPAWN_MS,
   STAT,
   V_JUMP,
   V_RUN,
   WATER_Y,
   advanceClock,
   arcHeight,
   barAngle,
   barHits,
   beamSlide,
   blockX,
   boxSupport,
   createRun,
   createStepInput,
   earliestMs,
   finalScore,
   groundBelow,
   insideStatic,
   jumpReach,
   landingTime,
   onSupport,
   overlapsTop,
   skipReach,
   solidDistance,
   step,
   supportDistance,
   wave,
   type Course,
   type ObstacleRun,
   type StepEvents,
   type StepInput,
   type Support,
} from "./rules";

// ---------- shared helpers ----------

const PATH = COURSE.supports;
/** support index by name ("start", "bridge A", "disc", …, "finish") */
const S = Object.fromEntries(PATH.map((s, i) => [s.name, i])) as Record<string, number>;
const sup = (name: string): Support => PATH[S[name]];
const RULES = obstacleRaceMeta.scoring;

const input = (moveX: number, moveZ: number, jumpPressed = false): StepInput => ({ moveX, moveZ, jumpPressed });
const IDLE = input(0, 0);
const FWD = input(0, -1);
const PRESS = input(0, 0, true);
const FWD_PRESS = input(0, -1, true);

const progress = (run: ObstacleRun): number => -run.runner.z;
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** The runner grounded on support `i` at (x, p `at`), in state run, at rules ms `ms`, moving forward at `speed`. */
function place(run: ObstacleRun, i: number, x: number, at: number, ms = run.simMs, speed = 0): ObstacleRun {
   const s = run.course.supports[i];
   const r = run.runner;
   run.simMs = ms;
   run.remainder = 0;
   r.x = x;
   r.y = s.top;
   r.z = -at;
   r.vx = 0;
   r.vz = -speed;
   r.state = "run";
   r.grounded = true;
   r.support = i;
   r.arcStart = ms;
   r.arcY0 = s.top;
   r.arcV = 0;
   r.coyoteFrom = NONE;
   r.carryX = 0;
   r.knockDir = 0;
   r.timerMs = 0;
   run.pressMs = NONE;
   run.groundY = s.top;
   run.maxP = Math.max(run.maxP, at);
   return run;
}

/** The runner in the air at (x, p `at`) with its feet at y, on an arc starting now with speed v. */
function placeAir(run: ObstacleRun, x: number, at: number, y: number, v: number, ms = run.simMs, vz = 0, vx = 0): ObstacleRun {
   const r = run.runner;
   run.simMs = ms;
   run.remainder = 0;
   r.x = x;
   r.y = y;
   r.z = -at;
   r.vx = vx;
   r.vz = vz;
   r.state = "run";
   r.grounded = false;
   r.support = NONE;
   r.arcStart = ms;
   r.arcY0 = y;
   r.arcV = v;
   r.coyoteFrom = NONE;
   r.carryX = 0;
   r.knockDir = 0;
   run.pressMs = NONE;
   run.maxP = Math.max(run.maxP, at);
   return run;
}

/** `n` steps of 1 ms with `inp`; returns the ms at which `pick` first held (0 = never). */
function msSteps(run: ObstacleRun, n: number, inp: StepInput, pick?: (ev: StepEvents, run: ObstacleRun) => boolean): number {
   for (let k = 0; k < n && run.ended === null; k++) {
      const ev = step(run, 1, inp);
      if (pick && pick(ev, run)) return run.simMs;
   }
   return 0;
}

const cloneRun = (run: ObstacleRun): ObstacleRun => ({ ...run, runner: { ...run.runner }, events: { ...run.events } });
/** The run's game state: everything but the course and the per-step fields (events, stepMs). */
const stateOf = (run: ObstacleRun): string => JSON.stringify({ ...run, course: null, events: null, stepMs: null });

// ---------- frame patterns ----------

interface Pattern {
   name: string;
   make(seed: number): () => number;
}

const fixed = (ms: number, name = `${ms} ms`): Pattern => ({ name, make: () => () => ms });
const FPS_60 = fixed(1000 / 60, "60 fps");
const FPS_30 = fixed(1000 / 30, "30 fps");
const FPS_144 = fixed(1000 / 144, "144 fps");
const RANDOM_4_50: Pattern = {
   name: "random 4-50 ms",
   make: (seed) => {
      const rng = createRng(seed);
      return () => 4 + rng() * 46;
   },
};
/** README "Test plan": 1, 4, 16.7, 33 and 50 ms frames, plus 144 / 30 fps and random frames. */
const PATTERNS: Pattern[] = [fixed(1), fixed(4), FPS_60, fixed(33), fixed(50), FPS_144, FPS_30, RANDOM_4_50];

// ---------- bots ----------

interface Bot {
   next(run: ObstacleRun, dtMs: number): StepInput;
}

const straightBot = (): Bot => ({ next: () => FWD });

/** Full stick forward and a jump press on every frame. */
const masherBot = (): Bot => ({ next: () => FWD_PRESS });

/** Random stick (mostly forward), held for 50–450 ms, and jump mashing. */
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

// The speedrun bot: a scripted route (past the hub on its left, where the bar comes head-on),
// lookahead jumps (each jump is simulated on a clone of the run and taken at the first frame that
// lands well), waiting on the edge for the blocks, and a slide correction on the beam.

const centreX = (s: Support, ms: number): number => (s.minX + s.maxX) / 2 + (s.block === NONE ? 0 : blockX(s.block, ms));

function steer(run: ObstacleRun, inp: StepInput, target: number): void {
   const r = run.runner;
   const p = -r.z;
   const ms = run.simMs;
   if (p >= 93 && p < 113.9) {
      // the beam: hold x 0 against the slide
      const sx = clamp((-beamSlide(ms) - 5 * r.x) / V_RUN, -0.6, 0.6);
      inp.moveX = sx;
      inp.moveZ = -Math.sqrt(1 - sx * sx);
      return;
   }
   let ax: number;
   let ap: number;
   if (target <= S["CP1"] && p < 28) {
      if (p < 12.5) [ax, ap] = [-1.2, 14];
      else if (p < 16) [ax, ap] = [-2.6, 17.5];
      else if (p < 19.5) [ax, ap] = [-2.6, 21];
      else if (p < 23.5) [ax, ap] = [-0.5, 25.5];
      else [ax, ap] = [0, 30];
   } else if (target === S["beam"]) {
      [ax, ap] = [0, 94.5];
   } else if (target === S["finish"] || p >= 113.9) {
      [ax, ap] = [0, 120];
   } else {
      const t = PATH[target];
      const lead = r.grounded ? 700 : Math.max(0, landingTime(t.top, r.arcY0, r.arcV) * 1000 - (ms - r.arcStart));
      ax = centreX(t, ms + lead);
      ap = (t.minP + t.maxP) / 2;
   }
   if (r.grounded && r.support !== NONE && PATH[r.support].kind !== "disc") {
      // stay on the current top while lining up
      const c = PATH[r.support];
      const ox = c.block === NONE ? 0 : blockX(c.block, ms);
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
   const ox = s.block === NONE ? 0 : blockX(s.block, sim.simMs);
   return r.x >= s.minX + ox + 0.3 && r.x <= s.maxX + ox - 0.3;
}

/** Is the runner knocked (or lost) within `horizonMs` if it keeps steering, pressing jump now or not? */
function knockedWithin(run: ObstacleRun, dtMs: number, press: boolean, horizonMs: number): boolean {
   const sim = cloneRun(run);
   const inp = createStepInput();
   for (let t = 0; t < horizonMs && sim.ended === null; t += dtMs) {
      const r = sim.runner;
      steer(sim, inp, r.grounded ? Math.min(r.support + 1, PATH.length - 1) : S["bridge B"]);
      inp.jumpPressed = press && t === 0;
      const ev = step(sim, dtMs, inp);
      if (ev.knocked || ev.lost) return true;
   }
   return false;
}

function speedrunBot(): Bot {
   const inp = createStepInput();
   let airTarget = NONE;
   return {
      next(run, dtMs) {
         const r = run.runner;
         inp.jumpPressed = false;
         if (r.state !== "run") {
            airTarget = NONE;
            inp.moveX = 0;
            inp.moveZ = 0;
            return inp;
         }
         const target = r.grounded ? Math.min(r.support + 1, PATH.length - 1) : airTarget !== NONE ? airTarget : S["bridge A"];
         steer(run, inp, target);
         if (!r.grounded) return inp;
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
         if (p > 9 && p < 25.5 && knockedWithin(run, dtMs, false, 700) && !knockedWithin(run, dtMs, true, 1000)) inp.jumpPressed = true;
         return inp;
      },
   };
}

// ---------- playing a run ----------

interface Played {
   run: ObstacleRun;
   problems: string[];
   /** rules ms of each checkpoint activation, in order */
   checkpoints: number[];
   jumps: number;
   knocks: number;
   respawns: number;
   /** the supports the runner stood on at frame ends, in order, repeats collapsed */
   trail: number[];
}

/**
 * Steps `run` with `bot` and frames from `nextDt` until it ends or reaches `limitMs`, checking the
 * proof on every frame: p moves at most MAX_MOVE per simulated ms (a respawn only back to <= maxP),
 * and every checkpoint and the finish come no earlier than earliestMs of their line.
 */
function play(run: ObstacleRun, bot: Bot, nextDt: () => number, limitMs = DURATION_MS): Played {
   const out: Played = { run, problems: [], checkpoints: [], jumps: 0, knocks: 0, respawns: 0, trail: [run.runner.support] };
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
      if (run.runner.grounded && run.runner.support !== out.trail[out.trail.length - 1]) out.trail.push(run.runner.support);
      if (ev.checkpoint !== NONE) {
         out.checkpoints.push(run.checkpointMs);
         if (run.checkpointMs < earliestMs(run.course.checkpoints[ev.checkpoint].line)) out.problems.push(`checkpoint ${ev.checkpoint} at ${run.checkpointMs}`);
      }
      if (ev.finished && run.finishMs < earliestMs(run.course.finish.line)) out.problems.push(`finish at ${run.finishMs}`);
   }
   return out;
}

/** What Scene.tsx does with a step's events (README "Scoring" and "HUD"). */
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

/** One edge with nothing after it (the flat-edge reach test). */
const EDGE: Course = {
   name: "edge",
   supports: [boxSupport("ledge", "pad", -4, 10, -4, 4, 0, WATER_Y)],
   solids: [],
   sweeper: NONE,
   checkpoints: [{ line: 0, support: 0 }],
   finish: { line: 1000, support: 0 },
};

/**
 * The random test's oracle for "inside a static solid", written apart from insideStatic (which the
 * guard uses): the smallest horizontal distance from the centre (x, p) to the footprint of a static
 * top (every support but the blocks) or a solid whose span overlaps the runner's (feet below its
 * top, head above its bottom). Inside means less than FOOT. Infinity when nothing overlaps.
 */
function staticClearance(x: number, at: number, feet: number): number {
   const box = (minX: number, maxX: number, minP: number, maxP: number) => Math.hypot(Math.max(minX - x, 0, x - maxX), Math.max(minP - at, 0, at - maxP));
   const circle = (cx: number, cp: number, radius: number) => Math.max(0, Math.hypot(x - cx, at - cp) - radius);
   const spans = (bottom: number, top: number) => feet < top && feet + RUNNER.height > bottom;
   let min = Infinity;
   for (const s of COURSE.supports) {
      if (s.kind === "block" || !spans(s.bottom, s.top)) continue;
      min = Math.min(min, s.kind === "disc" ? circle(s.cx, s.cp, s.radius) : box(s.minX, s.maxX, s.minP, s.maxP));
   }
   for (const o of COURSE.solids) {
      if (!spans(o.bottom, o.top)) continue;
      min = Math.min(min, o.shape === "circle" ? circle(o.cx, o.cp, o.radius) : box(o.minX, o.maxX, o.minP, o.maxP));
   }
   return min;
}

/** Gap, rise and the plain-jump numbers between two supports in path order. */
function pairOf(a: Support, b: Support) {
   const gap = b.minP - a.maxP;
   const dy = b.top - a.top;
   return { gap, dy, travel: gap - 2 * FOOT, reach: jumpReach(dy) };
}

// ---------- tests ----------

describe("obstacle-race constants (golden)", () => {
   it("tuning numbers (README Constants)", () => {
      expect(DURATION_MS).toBe(300_000);
      expect(MAX_STEP_MS).toBe(50);
      expect(RUNNER).toEqual({ radius: 0.35, height: 1.5 });
      expect(V_RUN).toBe(6);
      expect(ACCEL).toEqual({ ground: 40, air: 20 });
      expect([G, V_JUMP, COYOTE_MS, BUFFER_MS, FOOT]).toEqual([25, 8.5, 100, 120, 0.2]);
      expect([KILL_Y, WATER_Y, LOST_MS, SPAWN_MS]).toEqual([-1.5, -2, 600, 300]);
      expect(DISC).toEqual({ x: 0, p: 18, radius: 6, top: 0 });
      expect(HUB).toEqual({ radius: 0.7, height: 1.6 });
      expect(BAR).toEqual({ reach: 5.9, thickness: 0.35, bottom: 0.25, top: 0.7, omega: 1.1 });
      expect(KNOCK).toEqual({ vx: 12, vy: 8 });
      expect(BLOCK).toEqual({ width: 2.4, depth: 2.2, height: 0.6, travel: 2.4, periodMs: 4000 });
      expect(BLOCK_PHASES).toEqual([0, 0.5, 0.25, 0.75, 0.5]);
      expect(BEAM).toEqual({ length: 20, width: 1, thickness: 0.4, slide: 1.8, periodMs: 3200, tiltDeg: 10 });
      expect(PLATFORM).toEqual({ size: 2.4, thickness: 0.3, pillar: 0.8 });
      expect(ARCH).toEqual({ width: 8, height: 4.2, depth: 0.8, postRadius: 0.4, postX: 3.6 });
      expect(LINES).toEqual({ start: 0, cp1: 29, cp2: 62, cp3: 88.6, finish: 116 });
      expect(MAX_MOVE).toBe(V_RUN / 1000);
   });

   it("the course table, part by part", () => {
      const box = (s: Support) => [s.kind, s.minP, s.maxP, s.minX, s.maxX, s.top];
      expect(PATH.map((s) => s.name)).toEqual([
         "start", "bridge A", "disc", "bridge B", "CP1", "J1", "J2", "J3", "J4", "J5", "CP2", "B1", "B2", "B3", "B4", "B5", "CP3", "beam", "finish",
      ]);
      expect(box(sup("start"))).toEqual(["pad", -4, 8, -4, 4, 0]);
      expect(box(sup("bridge A"))).toEqual(["bridge", 8, 13, -1.5, 1.5, 0]);
      expect([sup("disc").kind, sup("disc").cx, sup("disc").cp, sup("disc").radius, sup("disc").top]).toEqual(["disc", 0, 18, 6, 0]);
      expect(box(sup("bridge B"))).toEqual(["bridge", 23, 28, -1.5, 1.5, 0]);
      expect(box(sup("CP1"))).toEqual(["pad", 28, 34, -3, 3, 0]);
      expect(box(sup("J1"))).toEqual(["platform", 36.4, 38.8, -1.2, 1.2, 0.5]);
      expect(box(sup("J2"))).toEqual(["platform", 41.2, 43.6, -2.5, expect.closeTo(-0.1, 12), 1.0]);
      expect(box(sup("J3"))).toEqual(["platform", 46.2, 48.6, -0.7, 1.7, 1.5]);
      expect(box(sup("J4"))).toEqual(["platform", 51.2, 53.6, expect.closeTo(0.3, 12), 2.7, 1.0]);
      expect(box(sup("J5"))).toEqual(["platform", 56.2, 58.6, -1.2, 1.2, 0.5]);
      expect(box(sup("CP2"))).toEqual(["pad", 61, 67, -3, 3, 0]);
      expect(["B1", "B2", "B3", "B4", "B5"].map((n) => [sup(n).minP, sup(n).maxP, sup(n).block])).toEqual([
         [68.6, 70.8, 0],
         [72.4, 74.6, 1],
         [76.2, 78.4, 2],
         [80.0, 82.2, 3],
         [83.8, 86.0, 4],
      ]);
      for (const n of ["B1", "B2", "B3", "B4", "B5"]) expect(box(sup(n))).toEqual(["block", sup(n).minP, sup(n).maxP, -1.2, 1.2, 0]);
      expect(box(sup("CP3"))).toEqual(["pad", 87.6, 93.6, -3, 3, 0]);
      expect(box(sup("beam"))).toEqual(["beam", 93.6, 113.6, -0.5, 0.5, 0]);
      expect(box(sup("finish"))).toEqual(["pad", 113.6, 122, -4, 4, 0]);
      expect(COURSE.checkpoints).toEqual([
         { line: 0, support: S["start"] },
         { line: 29, support: S["CP1"] },
         { line: 62, support: S["CP2"] },
         { line: 88.6, support: S["CP3"] },
      ]);
      expect(COURSE.finish).toEqual({ line: 116, support: S["finish"] });
      expect(COURSE.sweeper).toBe(S["disc"]);
      // the solids: a pillar under each platform, the hub, the two arch posts
      const hub = COURSE.solids.find((o) => o.name === "hub")!;
      expect([hub.shape, hub.cx, hub.cp, hub.radius, hub.bottom, hub.top]).toEqual(["circle", 0, 18, 0.7, 0, 1.6]);
      const posts = COURSE.solids.filter((o) => o.name.startsWith("post"));
      expect(posts.map((o) => [o.cx, o.cp, o.radius, o.bottom, o.top])).toEqual([
         [-3.6, 116, 0.4, 0, 4.2],
         [3.6, 116, 0.4, 0, 4.2],
      ]);
      // each pillar: the platform's centre ± 0.4 in p and x, from the water up to the slab (top − 0.3)
      const pillars = COURSE.solids.filter((o) => o.name.endsWith("pillar"));
      expect(pillars.map((o) => [o.name, o.shape])).toEqual(["J1", "J2", "J3", "J4", "J5"].map((n) => [`${n} pillar`, "box"]));
      const rows = [
         [37.2, 38.0, -0.4, 0.4, -2, 0.2],
         [42.0, 42.8, -1.7, -0.9, -2, 0.7],
         [47.0, 47.8, 0.1, 0.9, -2, 1.2],
         [52.0, 52.8, 1.1, 1.9, -2, 0.7],
         [57.0, 57.8, -0.4, 0.4, -2, 0.2],
      ];
      expect(pillars.map((o) => [o.minP, o.maxP, o.minX, o.maxX, o.bottom, o.top])).toEqual(rows.map((row) => row.map((v) => expect.closeTo(v, 12))));
   });

   it("the jump: apex 1.445 m at 340 ms, 680 ms in the air, a coyote jump starts 0.125 m low", () => {
      expect(APEX_HEIGHT).toBeCloseTo(1.445, 12);
      expect(APEX_MS).toBe(340);
      expect(AIR_MS).toBe(680);
      expect(COYOTE_DROP).toBeCloseTo(0.125, 12);
      // the closed form in whole ms is exact
      expect(arcHeight(V_JUMP, 340)).toBe(1.445);
      expect(arcHeight(V_JUMP, 680)).toBe(0);
      expect(arcHeight(0, COYOTE_MS)).toBe(-0.125);
      expect(arcHeight(KNOCK.vy, 640)).toBe(0);
   });

   it("the jump table: time to land, reach at full speed, share of the reach", () => {
      expect(Math.round(landingTime(0.5) * 1000)).toBe(615);
      expect(Math.round(landingTime(-0.5) * 1000)).toBe(734);
      expect(landingTime(0) * 1000).toBeCloseTo(680, 9);
      expect(jumpReach(0.5)).toBeCloseTo(3.69, 2);
      expect(jumpReach(-0.5)).toBeCloseTo(4.41, 2);
      expect(jumpReach(0)).toBeCloseTo(4.08, 9);
      const share = (a: string, b: string) => {
         const q = pairOf(sup(a), sup(b));
         return q.travel / q.reach;
      };
      expect(Math.round(share("CP1", "J1") * 100)).toBe(54);
      expect(Math.round(share("J1", "J2") * 100)).toBe(54);
      expect(Math.round(share("J2", "J3") * 100)).toBe(60);
      expect(Math.round(share("J3", "J4") * 100)).toBe(50);
      expect(Math.round(share("J4", "J5") * 100)).toBe(50);
      expect(Math.round(share("J5", "CP2") * 100)).toBe(45);
      expect(Math.round(share("CP2", "B1") * 100)).toBe(29);
      expect(Math.round(share("B5", "CP3") * 100)).toBe(29);
   });

   it("the skip table: the longest reach of any jump (coyote run-on, coyote fall, both graces, 1 ms at each end)", () => {
      expect(skipReach(1)).toBeCloseTo(4.012, 9);
      expect(skipReach(0.5)).toBeCloseTo(4.58875, 5);
      expect(skipReach(0)).toBeCloseTo(5.0018, 4);
      expect(skipReach(-0.5)).toBeCloseTo(5.3415, 4);
      expect(skipReach(-1)).toBeCloseTo(5.6369, 4);
      expect(skipReach(-1.5)).toBeCloseTo(5.9018, 4);
      // the whole ms at the walk-off and at the landing: 6 mm each
      expect(skipReach(0) - (2 * FOOT + (V_RUN * COYOTE_MS) / 1000 + V_RUN * landingTime(0, -COYOTE_DROP))).toBeCloseTo(2 * MAX_MOVE, 12);
      // the reach grows with the coyote run-on and fall, so 100 ms is the worst case
      expect(skipReach(0)).toBeGreaterThan(2 * FOOT + V_RUN * landingTime(0));
   });

   it("bar, knock, blocks, beam and the ramp", () => {
      expect(BAR_WINDOW_MS.from).toBeCloseTo(95.87, 2);
      expect(BAR_WINDOW_MS.to).toBeCloseTo(584.13, 2);
      expect(Math.round(BAR_CLEAR_MS)).toBe(488);
      expect(BAR_MIN_RADIUS).toBeCloseTo(1.955, 3);
      // the bar's passage time at radius r: (0.35 + 0.7) / (1.1 r)
      const pass = (r: number) => (1000 * (BAR.thickness + 2 * RUNNER.radius)) / (BAR.omega * r);
      expect(Math.round(pass(2))).toBe(477);
      expect(Math.round(pass(3))).toBe(318);
      expect(Math.round(pass(5.9))).toBe(162);
      expect((2 * Math.PI * 1000) / BAR.omega).toBeCloseTo(5712, 0);
      expect(KNOCK_STOP_X).toBeCloseTo(6.35, 12);
      expect(KNOCK_STOP_MS).toBeCloseTo(529.17, 2);
      expect(KNOCK_RETURN_MS).toBe(640);
      expect(KNOCK_STOP_MS).toBeLessThan(KNOCK_RETURN_MS);
      // lost 792 ms after a hit from feet 0
      let k = 0;
      while (arcHeight(KNOCK.vy, k) >= KILL_Y) k++;
      expect(k).toBe(792);
      expect(BLOCK_TOP_SPEED).toBeCloseTo(3.6, 12);
      expect(RAMP_MS).toBe(150);
      expect(RAMP_M).toBeCloseTo(0.453, 12);
   });

   it("the proof's bound, each checkpoint's earliest ms, and the scoring limits of meta.ts", () => {
      expect(MIN_FINISH_MS).toBe(19334);
      expect([earliestMs(LINES.cp1), earliestMs(LINES.cp2), earliestMs(LINES.cp3), earliestMs(LINES.finish)]).toEqual([4834, 10334, 14767, 19334]);
      expect(RULES).toEqual({
         kind: "time",
         maxScore: 28150,
         minDurationMs: 18500,
         maxDurationMs: 300000,
         base: 0,
         maxPointsPerSec: 0,
         timeBaseMs: 300000,
         unitLabel: "time",
         display: "time",
      });
      expect(RULES.timeBaseMs).toBe(DURATION_MS);
      expect(RULES.maxDurationMs).toBe(DURATION_MS);
      // README: the bound stays 834 ms (4.3%, at least 3%) above the server's floor, and its score under maxScore
      expect(MIN_FINISH_MS - RULES.minDurationMs).toBe(834);
      expect(MIN_FINISH_MS - RULES.minDurationMs).toBeGreaterThanOrEqual(Math.ceil(0.03 * MIN_FINISH_MS));
      expect(computeTimeScore(RULES, MIN_FINISH_MS)).toBe(28066);
      expect(computeTimeScore(RULES, MIN_FINISH_MS)).toBeLessThanOrEqual(RULES.maxScore);
      // maxScore is exactly the score the server allows at its fastest accepted time
      expect(computeTimeScore(RULES, RULES.minDurationMs)).toBe(RULES.maxScore);
   });

   it("the score table (README Scoring)", () => {
      const table: Array<[number, number]> = [
         [19334, 28066],
         [19408, 28059],
         [28000, 27200],
         [45000, 25500],
         [90000, 21000],
         [299990, 1],
      ];
      for (const [ms, score] of table) expect(computeTimeScore(RULES, ms)).toBe(score);
   });
});

describe("obstacle-race course", () => {
   it("parts in p order; every join is at equal heights, overlaps in x and leaves no hole", () => {
      for (let i = 1; i < PATH.length; i++) {
         const a = PATH[i - 1];
         const b = PATH[i];
         expect(b.minP, `${b.name} after ${a.name}`).toBeGreaterThanOrEqual(a.minP);
         if (b.minP - a.maxP <= 0) {
            expect(b.top, `${a.name} -> ${b.name}`).toBe(a.top);
            if (a.kind !== "disc" && b.kind !== "disc") expect(Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)).toBeGreaterThan(0);
         }
      }
      // the bridges run 1 m into the disc: their inner corners lie inside it (no sliver)
      const disc = sup("disc");
      for (const [x, at] of [
         [-1.5, 13],
         [1.5, 13],
         [-1.5, 23],
         [1.5, 23],
      ]) {
         expect(Math.hypot(x - disc.cx, at - disc.cp)).toBeLessThan(disc.radius);
         expect(supportDistance(disc, x, -at, 0)).toBe(0);
      }
      expect(sup("bridge A").maxP - disc.minP).toBe(1);
      expect(disc.maxP - sup("bridge B").minP).toBe(1);
      // the walking joins touch exactly
      expect([sup("start").maxP, sup("bridge B").maxP, sup("CP3").maxP, sup("beam").maxP]).toEqual([
         sup("bridge A").minP,
         sup("CP1").minP,
         sup("beam").minP,
         sup("finish").minP,
      ]);
   });

   it("every checkpoint line and the finish line lie inside their pads; the spawn is on the start line", () => {
      for (const line of [...COURSE.checkpoints, COURSE.finish]) {
         const pad = PATH[line.support];
         expect(pad.kind).toBe("pad");
         expect(line.line).toBeGreaterThanOrEqual(pad.minP);
         expect(line.line).toBeLessThanOrEqual(pad.maxP);
         // the respawn spot (x 0, on the line) stands on the pad, clear of every solid
         expect(onSupport(pad, 0, -line.line, 0)).toBe(true);
         expect(insideStatic(COURSE, 0, -line.line, pad.top)).toBe(false);
         for (const o of COURSE.solids) if (o.top > pad.top && o.bottom < pad.top + RUNNER.height) expect(solidDistance(o, 0, -line.line)).toBeGreaterThan(RUNNER.radius);
      }
      const run = createRun();
      expect([run.runner.x, run.runner.y, progress(run), run.runner.state, run.runner.grounded, run.runner.support]).toEqual([0, 0, 0, "run", true, S["start"]]);
      expect([run.runner.vx, run.runner.vz, run.checkpoint, run.checkpointMs, run.simMs]).toEqual([0, 0, 0, 0, 0]);
   });

   it("every jump is at most 65 % of a plain jump's reach; neighbouring platforms overlap in x", () => {
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
      expect(jumps).toBe(12);
   });

   it("no section can be skipped: a support to the one after the next is out of reach (computed from COURSE)", () => {
      let pairs = 0;
      let sameHeight = 0;
      for (let i = 0; i + 2 < PATH.length; i++) {
         const a = PATH[i];
         const between = PATH[i + 1];
         const c = PATH[i + 2];
         // a bridge only joins two tops at the same height: jumping past it skips nothing
         if (between.kind === "bridge") continue;
         pairs += 1;
         const distance = c.minP - a.maxP;
         const dy = c.top - a.top;
         expect(distance, `${a.name} -> ${c.name} over ${between.name}`).toBeGreaterThan(skipReach(dy));
         if (dy === 0 && Math.abs(distance - 5.4) < 1e-9) {
            sameHeight += 1;
            expect(distance - skipReach(dy)).toBeGreaterThanOrEqual(0.39);
         }
      }
      expect(pairs).toBe(15);
      expect(sameHeight).toBe(5);
      // no skip pair drops more than 1 m, and the biggest reach anywhere (a 1.5 m drop) is 5.90 m
      expect(skipReach(-1.5)).toBeLessThan(7.4);
   });

   it("the block lane and the beam leave room: blocks never force a wait, the beam can be held", () => {
      // worst instant: neighbouring blocks 4.8 m apart; landing needs the centre within 1.4 of the target's
      const sideways = 2 * BLOCK.travel - (BLOCK.width / 2 + FOOT);
      const forward = 1.6 - 2 * FOOT;
      const needed = Math.hypot(sideways, forward) / (AIR_MS / 1000);
      expect(needed).toBeCloseTo(5.3, 1);
      expect(needed).toBeLessThan(V_RUN);
      // a runner on a block reaches at most 0.55 m past its front edge; the next row is 1.6 m away
      expect(FOOT + RUNNER.radius).toBeCloseTo(0.55, 12);
      for (let k = 0; k + 1 < 5; k++) expect(PATH[S["B1"] + k + 1].minP - PATH[S["B1"] + k].maxP).toBeCloseTo(1.6, 9);
      // countering the beam's slide at full stick leaves 5.7 m/s forward
      expect(Math.sqrt(V_RUN * V_RUN - BEAM.slide * BEAM.slide)).toBeCloseTo(5.72, 2);
   });

   it("pillars stand under their platforms, inside the top less the runner's radius", () => {
      for (const name of ["J1", "J2", "J3", "J4", "J5"]) {
         const top = sup(name);
         const pil = COURSE.solids.find((o) => o.name === `${name} pillar`)!;
         expect(pil.top).toBe(top.bottom);
         expect(pil.bottom).toBe(WATER_Y);
         expect(top.bottom).toBeCloseTo(top.top - PLATFORM.thickness, 12);
         expect(pil.minX - top.minX).toBeGreaterThan(RUNNER.radius);
         expect(top.maxP - pil.maxP).toBeGreaterThan(RUNNER.radius);
      }
   });
});

describe("obstacle-race movement", () => {
   it("top speed exactly 6 m/s; a diagonal is not faster; half a stick is half the speed; NaN counts as 0", () => {
      const run = place(createRun(FLAT), 0, 0, 0);
      let fastest = 0;
      for (let k = 0; k < 400; k++) {
         step(run, 1, FWD);
         fastest = Math.max(fastest, Math.hypot(run.runner.vx, run.runner.vz));
      }
      expect(fastest).toBeLessThanOrEqual(V_RUN);
      expect(run.runner.vz).toBeCloseTo(-6, 12);
      const diag = place(createRun(FLAT), 0, 0, 0);
      msSteps(diag, 400, input(1, -1));
      expect(Math.hypot(diag.runner.vx, diag.runner.vz)).toBeCloseTo(6, 12);
      expect(diag.runner.vx).toBeCloseTo(6 / Math.SQRT2, 12);
      // a stick longer than 1 is normalised before the easing: while turning at speed (where the cap
      // does not hide it), (2, 0) eases like (1, 0) and (1, −1) like the unit diagonal
      for (const [a, b] of [
         [input(2, 0), input(1, 0)],
         [input(1, -1), input(Math.SQRT1_2, -Math.SQRT1_2)],
      ] as const) {
         const ra = place(createRun(), S["CP1"], 0, 29, 0, V_RUN);
         const rb = cloneRun(ra);
         for (let k = 0; k < 100; k++) {
            step(ra, 1, a);
            step(rb, 1, b);
         }
         expect(ra.runner.vx).toBeCloseTo(rb.runner.vx, 12);
         expect(ra.runner.vz).toBeCloseTo(rb.runner.vz, 12);
      }
      const half = place(createRun(FLAT), 0, 0, 0);
      msSteps(half, 400, input(0, -0.5));
      expect(half.runner.vz).toBeCloseTo(-3, 12);
      const bad = place(createRun(FLAT), 0, 0, 0);
      msSteps(bad, 400, input(Number.NaN, -1));
      expect([bad.runner.vx, bad.runner.x]).toEqual([0, 0]);
      expect(bad.runner.vz).toBeCloseTo(-6, 12);
   });

   it("acceleration 40 m/s² (ramp 150 ms, 0.453 m), braking 40, in the air 20", () => {
      const run = createRun(FLAT);
      msSteps(run, 149, FWD);
      expect(run.runner.vz).toBeCloseTo(-5.96, 12);
      msSteps(run, 1, FWD);
      expect(run.runner.vz).toBeCloseTo(-6, 12);
      expect(progress(run)).toBeCloseTo(RAMP_M, 12);
      // braking from 6 m/s: 150 ms and 0.447 m
      const p0 = progress(run);
      msSteps(run, 150, IDLE);
      expect(run.runner.vz).toBeCloseTo(0, 12);
      expect(progress(run) - p0).toBeCloseTo(0.447, 12);
      // in the air: from rest, 300 ms to full speed
      const air = createRun(FLAT);
      step(air, 1, FWD_PRESS);
      expect(air.runner.grounded).toBe(false);
      msSteps(air, 149, FWD);
      expect(air.runner.vz).toBeCloseTo(-3, 12);
      msSteps(air, 150, FWD);
      expect(air.runner.vz).toBeCloseTo(-6, 12);
   });

   it("jump apex and airtime are identical at 1, 4, 16.7, 33 and 50 ms frames (1 ms steps inside)", () => {
      for (const pattern of PATTERNS) {
         const run = createRun(FLAT);
         const next = pattern.make(3);
         const ev0 = step(run, next(), PRESS);
         expect(ev0.jumped, pattern.name).toBe(true);
         const takeOff = run.runner.arcStart;
         // a press latched at the frame's first ms, from rest on the ground: it jumps at once
         expect(takeOff).toBe(1);
         let landedBy = 0;
         let landedAfter = 0;
         while (!landedBy && run.simMs < 2000) {
            const before = run.simMs;
            const ev = step(run, next(), IDLE);
            if (ev.landed) {
               landedAfter = before;
               landedBy = run.simMs;
            } else {
               // every frame ends on the same closed-form arc, whatever the frame length
               expect(run.runner.y, pattern.name).toBe(arcHeight(V_JUMP, run.simMs - takeOff));
            }
         }
         // the landing is the first ms with the feet below the top: take-off + 681
         expect(landedAfter, pattern.name).toBeLessThan(takeOff + 681);
         expect(landedBy, pattern.name).toBeGreaterThanOrEqual(takeOff + 681);
         expect([run.runner.grounded, run.runner.y]).toEqual([true, 0]);
         // find the landing ms exactly with 1 ms steps for the same take-off
         const exact = createRun(FLAT);
         step(exact, 1, PRESS);
         const landed = msSteps(exact, 800, IDLE, (ev) => ev.landed);
         expect(landed - takeOff, pattern.name).toBe(681);
      }
      // the apex: 1.445 m at 340 ms; at 680 ms the feet are exactly at the top again, below it at 681
      let apex = 0;
      let apexMs = 0;
      for (let k = 0; k <= 700; k++) if (arcHeight(V_JUMP, k) > apex) [apex, apexMs] = [arcHeight(V_JUMP, k), k];
      expect([apex, apexMs]).toEqual([1.445, 340]);
      expect(arcHeight(V_JUMP, 680)).toBe(0);
      expect(arcHeight(V_JUMP, 681)).toBeLessThan(0);
   });

   it("coyote time: a jump 99 or 100 ms after walking off works, 101 does not; the last one starts 0.125 m low", () => {
      const base = place(createRun(), S["CP1"], 0, 33.9, 1000, V_RUN);
      const walkOff = msSteps(base, 200, FWD, (_ev, r) => !r.runner.grounded);
      expect(walkOff).toBeGreaterThan(0);
      expect(base.runner.coyoteFrom).toBe(walkOff);
      expect(progress(base)).toBeGreaterThan(sup("CP1").maxP + FOOT);
      expect(progress(base)).toBeLessThanOrEqual(sup("CP1").maxP + FOOT + MAX_MOVE + 1e-9);
      for (const d of [99, 100, 101]) {
         const run = cloneRun(base);
         msSteps(run, d - 1, FWD);
         expect(run.simMs).toBe(walkOff + d - 1);
         const ev = step(run, 1, FWD_PRESS);
         expect(ev.jumped, `${d} ms`).toBe(d <= COYOTE_MS);
         if (d === COYOTE_MS) {
            expect(run.runner.arcY0).toBeCloseTo(-COYOTE_DROP, 12);
            expect(run.runner.arcV).toBe(V_JUMP);
         }
         if (d > COYOTE_MS) {
            // no later jump either: the press is buffered but the runner never lands in time
            expect(msSteps(run, 200, FWD, (e) => e.jumped)).toBe(0);
         }
      }
   });

   it("buffer: a press 119 or 120 ms before the first ms that can jump is kept and jumps then; 121 is dropped", () => {
      // jump at ms 1 on the flat, land at 682: ms 683 is the first that can jump again
      const first = 683;
      for (const d of [119, 120, 121]) {
         const run = createRun(FLAT);
         step(run, 1, PRESS);
         msSteps(run, first - d - 2, IDLE);
         expect(run.simMs).toBe(first - d - 1);
         step(run, 1, PRESS);
         expect(run.pressMs).toBe(first - d);
         const jumpedAt = msSteps(run, 300, IDLE, (ev) => ev.jumped);
         if (d <= BUFFER_MS) expect(jumpedAt, `${d} ms`).toBe(first);
         else expect(jumpedAt, `${d} ms`).toBe(0);
      }
   });

   it("a coyote jump uses up the coyote window: later presses in it never jump", () => {
      const run = createRun(EDGE);
      const walkOff = msSteps(run, 5000, FWD, (_ev, r) => !r.runner.grounded);
      expect(step(run, 1, FWD_PRESS).jumped).toBe(true);
      expect(run.simMs).toBe(walkOff + 1);
      expect([run.runner.coyoteFrom, run.pressMs]).toEqual([NONE, NONE]);
      for (let d = 2; d <= COYOTE_MS + 1; d++) expect(step(run, 1, FWD_PRESS).jumped, `${d} ms`).toBe(false);
   });

   it("one press, one jump: no jump in the air, a press is used once, no double jump", () => {
      // one 50 ms frame with the press, then 3 s with none: exactly one jump
      const run = createRun(FLAT);
      let jumps = 0;
      if (step(run, 50, PRESS).jumped) jumps += 1;
      for (let k = 0; k < 60; k++) if (step(run, 50, IDLE).jumped) jumps += 1;
      expect(jumps).toBe(1);
      // a press at the apex: no jump in the air, and it has expired by the landing
      const air = createRun(FLAT);
      step(air, 1, PRESS);
      msSteps(air, 339, IDLE);
      expect(air.simMs).toBe(340);
      expect(step(air, 1, PRESS).jumped).toBe(false);
      expect(msSteps(air, 800, IDLE, (ev) => ev.jumped)).toBe(0);
      expect(air.runner.grounded).toBe(true);
      // pressing on every frame of a jump never jumps in the air; it jumps again on the ms after landing
      const mash = createRun(FLAT);
      step(mash, 1, PRESS);
      const again = msSteps(mash, 800, PRESS, (ev) => ev.jumped);
      expect(again).toBe(683);
   });

   it("the flat-edge reach from the real step: off the edge at full speed, jump on the last coyote ms: 4.79 m", () => {
      const run = createRun(EDGE);
      const walkOff = msSteps(run, 5000, FWD, (_ev, r) => !r.runner.grounded);
      expect(run.runner.vz).toBeCloseTo(-6, 12);
      // it slides off the edge at full speed: the ledge band never slows it
      const pOff = progress(run);
      msSteps(run, COYOTE_MS - 1, FWD);
      expect(progress(run) - pOff).toBeCloseTo((COYOTE_MS - 1) * MAX_MOVE, 9);
      expect(step(run, 1, FWD_PRESS).jumped).toBe(true);
      expect(run.simMs).toBe(walkOff + COYOTE_MS);
      expect(run.runner.arcY0).toBeCloseTo(-0.125, 12);
      // the coyote jump starts below the top: wait for the crossing on the way down
      const below = msSteps(run, 2000, FWD, (_ev, r) => r.simMs - r.runner.arcStart > APEX_MS && r.runner.y < 0);
      expect(below).toBe(walkOff + COYOTE_MS + 665);
      const past = progress(run) - EDGE.supports[0].maxP;
      expect(past).toBeGreaterThan(4.78);
      expect(past).toBeLessThan(4.8);
      // with the landing grace this is the skip table's flat reach, within it
      expect(past + FOOT).toBeCloseTo(skipReach(0), 1);
      expect(past + FOOT).toBeLessThanOrEqual(skipReach(0));
   });

   it("skipReach is a true bound: every press ms around a walk-off, at every rise a skip pair uses, lands within it (and within 2 cm of it)", () => {
      const rises = [...new Set(PATH.slice(0, -2).map((a, i) => PATH[i + 2].top - a.top))].sort((a, b) => a - b);
      expect(rises).toEqual([-1, -0.5, 0, 0.5, 1]);
      const TOP = 1.5;
      const course: Course = { ...EDGE, supports: [boxSupport("ledge", "pad", -4, 10, -4, 4, TOP, WATER_Y)] };
      const walkOff = msSteps(createRun(course), 5000, FWD, (_e, r) => !r.runner.grounded);
      expect(walkOff).toBeGreaterThan(300);
      for (const dy of rises) {
         // every press ms from 300 ms before the walk-off to the last coyote ms; `base` is one ms short of it
         const base = createRun(course);
         msSteps(base, walkOff - 301, FWD);
         let best = -Infinity;
         let tried = 0;
         for (let at = walkOff - 300; at <= walkOff + COYOTE_MS; at++, step(base, 1, FWD)) {
            const run = cloneRun(base);
            expect(run.simMs).toBe(at - 1);
            if (!step(run, 1, FWD_PRESS).jumped) continue;
            tried += 1;
            // the first ms below the target's top on the way down: where a landing would happen
            if (msSteps(run, 3000, FWD, (_e, r) => r.simMs - r.runner.arcStart > APEX_MS && r.runner.y < TOP + dy)) {
               best = Math.max(best, progress(run) + FOOT - course.supports[0].maxP);
            }
         }
         expect(tried, `dy ${dy}`).toBe(401);
         expect(best, `dy ${dy}`).toBeLessThanOrEqual(skipReach(dy) + 1e-9);
         expect(best, `dy ${dy}`).toBeGreaterThan(skipReach(dy) - 0.02);
      }
   }, 60_000);

   it("a landing only from above; the centre 0.20 past an edge stands, 0.21 falls", () => {
      // a take-off never lands on its own top; the landing is on the way down
      const run = createRun(FLAT);
      const ev = step(run, 1, PRESS);
      expect([ev.jumped, ev.landed, run.runner.grounded]).toEqual([true, false, false]);
      // synthetic: rising up through J3 from under it (the guard keeps it in place while its head is in
      // the slab): no landing on the way up, a landing on the way down
      const j3 = sup("J3");
      const up = placeAir(createRun(), 1.4, 47.4, -0.5, 12, 500);
      let landedAt = 0;
      let crossedUp = 0;
      for (let k = 0; k < 1500 && !landedAt; k++) {
         const y0 = up.runner.y;
         const e = step(up, 1, IDLE);
         if (!crossedUp && y0 < j3.top && arcHeight(12, up.simMs - 500) - 0.5 >= j3.top) crossedUp = up.simMs;
         if (e.landed) landedAt = up.simMs;
         expect(up.runner.x).toBe(1.4);
      }
      expect(crossedUp).toBeGreaterThan(500);
      expect(landedAt - 500).toBeGreaterThan(480); // after the apex (12 / 25 s)
      expect(up.runner.support).toBe(S["J3"]);
      expect(up.runner.y).toBe(1.5);
      // the edge grace, forward and sideways
      for (const [x, at, stands] of [
         [0, 34.2, true],
         [0, 34.21, false],
         [3.2, 30, true],
         [3.21, 30, false],
         [-3.2, 30, true],
         [-3.21, 30, false],
      ] as const) {
         const edge = place(createRun(), S["CP1"], x, at, 0);
         step(edge, 1, IDLE);
         expect(edge.runner.grounded, `x ${x}, p ${at}`).toBe(stands);
      }
   });

   it("on a block the runner keeps its spot exactly; the launch carry is constant in the air; the beam slides it", () => {
      const b1 = S["B1"];
      const run = place(createRun(), b1, blockX(0, 0) + 0.3, 69.7, 0);
      for (let k = 0; k < 4000; k++) {
         step(run, 1, IDLE);
         expect(run.runner.support).toBe(b1);
         expect(run.runner.x - blockX(0, run.simMs)).toBeCloseTo(0.3, 9);
      }
      expect(progress(run)).toBeCloseTo(69.7, 12);
      // jump from B1 at its top speed (ms 1000: x 0, moving +x): the take-off's carry, every ms in the air
      const jump = place(createRun(), b1, 0, 69.7, 999);
      step(jump, 1, PRESS);
      const carry = jump.runner.carryX;
      expect(carry).toBeCloseTo(BLOCK_TOP_SPEED / 1000, 6);
      let airMs = 0;
      while (!jump.runner.grounded && jump.runner.state === "run" && airMs < 1000) {
         const x0 = jump.runner.x;
         step(jump, 1, IDLE);
         airMs += 1;
         if (!jump.runner.grounded && jump.runner.state === "run") expect(jump.runner.x - x0).toBeCloseTo(carry, 12);
      }
      expect(airMs).toBeGreaterThan(600);
      // the beam: a standing runner moves by the slide's formula, ms by ms
      const beam = place(createRun(), S["beam"], 0, 100, 1200);
      let expected = 0;
      for (let k = 0; k < 400; k++) {
         step(beam, 1, IDLE);
         expected += beamSlide(beam.simMs) / 1000;
         expect(beam.runner.x).toBeCloseTo(expected, 9);
      }
      expect(Math.abs(expected)).toBeGreaterThan(0.2);
      expect(beam.runner.support).toBe(S["beam"]);
   });

   it("running at full stick on the beam or a block: each ms p gains exactly 6 mm and x exactly the carry (the guard leaves the carry alone)", () => {
      const beam = place(createRun(), S["beam"], 0, 96, 650, V_RUN);
      for (let k = 0; k < 300; k++) {
         const [x0, p0] = [beam.runner.x, progress(beam)];
         step(beam, 1, FWD);
         expect(beam.runner.x - x0).toBeCloseTo(beamSlide(beam.simMs) / 1000, 12);
         expect(progress(beam) - p0).toBeCloseTo(MAX_MOVE, 12);
      }
      expect(beam.runner.support).toBe(S["beam"]);
      const b1 = place(createRun(), S["B1"], blockX(0, 900), 68.8, 900, V_RUN);
      for (let k = 0; k < 300; k++) {
         const [x0, p0] = [b1.runner.x, progress(b1)];
         step(b1, 1, FWD);
         expect(b1.runner.x - x0).toBeCloseTo(blockX(0, b1.simMs) - blockX(0, b1.simMs - 1), 12);
         expect(progress(b1) - p0).toBeCloseTo(MAX_MOVE, 12);
      }
      expect(b1.runner.support).toBe(S["B1"]);
   });

   it("pushed out of pillars, the hub and the arch posts, and slides along them", () => {
      // the hub, from its left (the bar is along ±p at ms 1428, far from the runner)
      const hub = place(createRun(), S["disc"], -1.3, 18, 1428);
      hub.runner.vx = 6;
      msSteps(hub, 60, input(1, 0));
      expect(hub.runner.state).toBe("run");
      expect(Math.hypot(hub.runner.x, progress(hub) - 18)).toBeCloseTo(HUB.radius + RUNNER.radius, 9);
      const p0 = progress(hub);
      for (let k = 0; k < 150; k++) {
         step(hub, 1, input(Math.SQRT1_2, -Math.SQRT1_2));
         expect(Math.hypot(hub.runner.x, progress(hub) - 18)).toBeGreaterThanOrEqual(HUB.radius + RUNNER.radius - 1e-9);
      }
      expect(hub.runner.state).toBe("run");
      expect(progress(hub) - p0).toBeGreaterThan(0.1);
      // an arch post, from its right
      const post = place(createRun(), S["finish"], -2.7, 116, 0);
      post.runner.vx = -6;
      msSteps(post, 40, input(-1, 0));
      expect(post.runner.x).toBeCloseTo(-ARCH.postX + ARCH.postRadius + RUNNER.radius, 9);
      const q0 = progress(post);
      msSteps(post, 150, input(-Math.SQRT1_2, -Math.SQRT1_2));
      expect(Math.hypot(post.runner.x + ARCH.postX, progress(post) - LINES.finish)).toBeGreaterThanOrEqual(ARCH.postRadius + RUNNER.radius - 1e-9);
      expect(progress(post) - q0).toBeGreaterThan(0.1);
      expect(post.ended).toBe(null);
      // J3's pillar (x 0.1..0.9, p 47.0..47.8), under its top: the head is below the slab
      const pil = placeAir(createRun(), -0.3, 47.4, -1.0, 0, 0, 0, 6);
      msSteps(pil, 20, input(1, 0));
      expect(pil.runner.x).toBeCloseTo(0.1 - RUNNER.radius, 9);
      const z0 = pil.runner.z;
      msSteps(pil, 80, input(Math.SQRT1_2, -Math.SQRT1_2));
      expect(pil.runner.x).toBeCloseTo(0.1 - RUNNER.radius, 9);
      expect(z0 - pil.runner.z).toBeGreaterThan(0.05);
      expect(pil.runner.state).toBe("run");
   });

   it("off the disc's rim, steering back: pushed out to 6.35, never inside", () => {
      // ms 1428: the bar lies along p, a quarter turn away from the runner
      const run = place(createRun(), S["disc"], 6.19, 18, 1428);
      run.runner.vx = 0.6;
      const walkOff = msSteps(run, 100, input(0.1, 0), (_e, r) => !r.runner.grounded);
      expect(walkOff).toBeGreaterThan(0);
      const rad = () => Math.hypot(run.runner.x - DISC.x, progress(run) - DISC.p);
      let prev = rad();
      let below = 0;
      for (let k = 0; k < 1000 && run.runner.state === "run"; k++) {
         step(run, 1, input(-1, 0));
         expect(insideStatic(COURSE, run.runner.x, run.runner.z, run.runner.y)).toBe(false);
         if (run.runner.y < DISC.top) {
            below += 1;
            expect(rad()).toBeGreaterThanOrEqual(Math.min(prev, DISC.radius + RUNNER.radius) - 1e-9);
         }
         if (run.simMs - walkOff >= 40 && run.runner.state === "run") expect(rad()).toBeGreaterThanOrEqual(DISC.radius + RUNNER.radius - 1e-9);
         prev = rad();
      }
      expect(below).toBeGreaterThan(300);
      expect(run.runner.state).toBe("lost");
   });

   it("the guard is needed: a block's front corner sliding into an airborne runner pushes it past 6 mm without it", () => {
      // B1 at ms 1000: x 0, moving +x at top speed; the runner just ahead of its right front corner,
      // falling in the gap behind B2 at full forward speed
      const setup = (guard: boolean) => {
         const run = placeAir(createRun(COURSE, { guard }), 1.2 + 0.3501, 70.8 + 0.005, -0.1, 0, 1000, -V_RUN);
         return run;
      };
      const free = setup(false);
      const x0 = free.runner.x;
      const p0 = progress(free);
      step(free, 1, FWD);
      const freeMove = Math.hypot(free.runner.x - x0, progress(free) - p0);
      expect(progress(free) - p0).toBeGreaterThan(MAX_MOVE + 5e-5);
      expect(freeMove).toBeGreaterThan(MAX_MOVE);
      const guarded = setup(true);
      step(guarded, 1, FWD);
      // the guard trims the whole non-carry step to exactly 6 mm, so p moves less than that
      expect(Math.hypot(guarded.runner.x - x0, progress(guarded) - p0)).toBeCloseTo(MAX_MOVE, 12);
      expect(progress(guarded) - p0).toBeLessThanOrEqual(MAX_MOVE);
      // the trim leaves an overlap with the block of at most one ms of block motion; the next ms resolves it
      expect(insideStatic(COURSE, guarded.runner.x, guarded.runner.z, guarded.runner.y)).toBe(false);
   });

   it("a pinned trim against a pillar's corner keeps last ms's position", () => {
      // synthetic: the core (FOOT circle) already in J3's pillar corner (0.9, 47.8), the head under the slab
      const setup = (guard: boolean) => placeAir(createRun(COURSE, { guard }), 0.9 + 0.07, 47.8 + 0.07, -1.0, 0, 0, -V_RUN);
      const run = setup(true);
      const [x0, z0] = [run.runner.x, run.runner.z];
      expect(insideStatic(COURSE, x0, z0, run.runner.y)).toBe(true);
      step(run, 1, FWD);
      expect([run.runner.x, run.runner.z]).toEqual([x0, z0]);
      expect(run.runner.y).toBeLessThan(-1);
      // without the guard the push-out moves it 0.25 m in one ms
      const free = setup(false);
      step(free, 1, FWD);
      expect(Math.hypot(free.runner.x - x0, free.runner.z - z0)).toBeGreaterThan(0.2);
   });

   it("a pinned trim against a support keeps last ms's position: the head in J1's slab, the core inside or within FOOT of its back edge", () => {
      const j1 = sup("J1");
      // the centre 0.05 inside J1's back edge, and 0.15 outside it (core still overlapping)
      for (const at of [j1.minP + 0.05, j1.minP - 0.15]) {
         const run = placeAir(createRun(), 0, at, 0.1, 0, 0);
         const [x0, z0] = [run.runner.x, run.runner.z];
         expect(insideStatic(COURSE, x0, z0, run.runner.y), `p ${at}`).toBe(true);
         let held = 0;
         for (let k = 0; k < 1000 && run.runner.state === "run"; k++) {
            step(run, 1, FWD);
            const r = run.runner;
            if (!(r.y < j1.top && r.y + RUNNER.height > j1.bottom)) break;
            expect([r.x, r.z], `p ${at}, ms ${run.simMs}`).toEqual([x0, z0]);
            held += 1;
         }
         // until the head drops below the slab (feet −1.3, 334 ms of falling)
         expect(held, `p ${at}`).toBe(334);
         // without the guard the push-out moves it out of the slab at once
         const free = placeAir(createRun(COURSE, { guard: false }), 0, at, 0.1, 0, 0);
         step(free, 1, FWD);
         expect(j1.minP - progress(free)).toBeCloseTo(RUNNER.radius, 9);
      }
   });

   it("insideStatic: a static top counts when the core overlaps it in the runner's span; a block never does", () => {
      const j1 = sup("J1");
      // the FOOT circle against J1's back edge, at feet 0.1 (head in the slab)
      expect(insideStatic(COURSE, 0, -(j1.minP - 0.19), 0.1)).toBe(true);
      expect(insideStatic(COURSE, 0, -(j1.minP - 0.21), 0.1)).toBe(false);
      expect(insideStatic(COURSE, j1.maxX + 0.19, -37.6, 0.1)).toBe(true);
      expect(insideStatic(COURSE, j1.maxX + 0.21, -37.6, 0.1)).toBe(false);
      // the span, strictly: feet at the top stand on it; a head under the slab's bottom passes under it
      expect(insideStatic(COURSE, 0, -37, j1.top)).toBe(false);
      expect(insideStatic(COURSE, 0, -37, j1.top - 0.01)).toBe(true);
      expect(insideStatic(COURSE, 0, -36.6, j1.bottom - RUNNER.height - 0.01)).toBe(false);
      expect(insideStatic(COURSE, 0, -36.6, j1.bottom - RUNNER.height + 0.01)).toBe(true);
      // the disc's rim (radius 6 + FOOT), below its top
      expect(insideStatic(COURSE, DISC.radius + 0.19, -DISC.p, -0.5)).toBe(true);
      expect(insideStatic(COURSE, DISC.radius + 0.21, -DISC.p, -0.5)).toBe(false);
      // blocks move: an overlap the trim leaves is resolved by the next ms, so they never count,
      // wherever they are (here each block's own centre at ms 0 and at ms 1000, under its top)
      for (let k = 0; k < 5; k++) {
         const b = PATH[S["B1"] + k];
         for (const ms of [0, 1000]) expect(insideStatic(COURSE, blockX(k, ms), -(b.minP + b.maxP) / 2, -0.3), `B${k + 1} at ${ms}`).toBe(false);
      }
   });

   it("200,000 random ms (the README asks for 50,000): p never moves more than 6 mm in one ms, a respawn never lands past maxP, nothing ends inside a static solid", () => {
      const rng = createRng(50_000);
      const problems: string[] = [];
      const counts = { ms: 0, jumps: 0, knocks: 0, lost: 0, respawns: 0, landings: 0, blocks: 0, airStarts: 0, pushed: 0 };
      const inp = createStepInput();
      const head = (y: number) => y + RUNNER.height;
      /** a clean random spot over a random support, touching no solid: grounded, or (30 %) on a random arc above it */
      const randomPlacement = (run: ObstacleRun): boolean => {
         // a quarter on the disc, where the bar knocks
         const i = rng() < 0.25 ? S["disc"] : Math.floor(rng() * PATH.length);
         const s = PATH[i];
         const ms = Math.floor(rng() * 30_000);
         let x: number;
         let at: number;
         if (s.kind === "disc") {
            const a = rng() * 2 * Math.PI;
            const rad = rng() * (s.radius - 0.1);
            x = s.cx + rad * Math.cos(a);
            at = s.cp + rad * Math.sin(a);
         } else {
            const ox = s.block === NONE ? 0 : blockX(s.block, ms);
            x = s.minX + ox + 0.1 + rng() * (s.maxX - s.minX - 0.2);
            at = s.minP + 0.1 + rng() * (s.maxP - s.minP - 0.2);
         }
         const air = rng() < 0.3;
         const y = air ? s.top + rng() * 1.2 : s.top;
         for (const o of COURSE.solids) if (y < o.top && head(y) > o.bottom && solidDistance(o, x, -at) < RUNNER.radius) return false;
         for (const t of PATH) if ((air || s.top < t.top) && y < t.top && head(y) > t.bottom && supportDistance(t, x, -at, ms) < RUNNER.radius) return false;
         if (barHits(COURSE, x, -at, y, ms)) return false;
         if (air) placeAir(run, x, at, y, (rng() - 0.3) * V_JUMP, ms);
         else place(run, i, x, at, ms);
         let k = 0;
         while (k + 1 < COURSE.checkpoints.length && COURSE.checkpoints[k + 1].line <= at) k++;
         run.checkpoint = k;
         run.maxP = at;
         const a = rng() * 2 * Math.PI;
         const v = rng() * V_RUN;
         run.runner.vx = v * Math.sin(a);
         run.runner.vz = -v * Math.cos(a);
         if (s.kind === "block") counts.blocks += 1;
         if (air) counts.airStarts += 1;
         return true;
      };
      while (counts.ms < 200_000) {
         const run = createRun();
         if (!randomPlacement(run)) continue;
         // mostly short episodes (many spots and phases), some long ones (falls, knocks, respawns)
         const len = rng() < 0.75 ? 100 + Math.floor(rng() * 300) : 1000 + Math.floor(rng() * 3000);
         const mash = rng() < 0.3 ? 0.05 : 0.01;
         const hold = 40 + Math.floor(rng() * 160);
         for (let k = 0; k < len && run.ended === null; k++) {
            if (k % hold === 0) {
               const a = rng() * 2 * Math.PI;
               const m = rng() < 0.5 ? 1 : rng();
               inp.moveX = Math.sin(a) * m;
               inp.moveZ = -Math.cos(a) * m;
            }
            inp.jumpPressed = rng() < mash;
            const before = progress(run);
            const x0 = run.runner.x;
            const vx = run.runner.vx;
            const carry = run.runner.carryX;
            const ev = step(run, 1, inp);
            counts.ms += 1;
            const r = run.runner;
            const now = progress(run);
            if (ev.respawned) {
               counts.respawns += 1;
               if (now > run.maxP + 1e-12) problems.push(`respawn at ${now} past maxP ${run.maxP}`);
            } else if (now - before > MAX_MOVE + 1e-12) {
               problems.push(`p +${now - before} at ${run.simMs} (${r.state})`);
            }
            if (staticClearance(r.x, now, r.y) < FOOT - 1e-9) problems.push(`inside a solid at x ${r.x}, p ${now}, y ${r.y} (${r.state})`);
            if (r.state === "knocked" && Math.abs(r.x) > KNOCK_STOP_X + 1e-12) problems.push(`fling at x ${r.x}`);
            // a push-out or the guard changed the x step (the input velocity is eased before the move)
            if (r.state === "run" && !ev.jumped && Math.abs(r.x - x0 - r.vx / 1000 - (r.grounded ? r.carryX : carry)) > 1e-6 && Math.abs(vx) >= 0) counts.pushed += 1;
            if (ev.jumped) counts.jumps += 1;
            if (ev.knocked) counts.knocks += 1;
            if (ev.lost) counts.lost += 1;
            if (ev.landed) counts.landings += 1;
         }
      }
      expect(problems.slice(0, 10)).toEqual([]);
      // the random play really covered jumps, landings, knocks, falls, respawns and the blocks
      expect(counts.jumps).toBeGreaterThan(200);
      expect(counts.landings).toBeGreaterThan(80);
      expect(counts.knocks).toBeGreaterThan(4);
      expect(counts.lost).toBeGreaterThan(25);
      expect(counts.respawns).toBeGreaterThan(15);
      expect(counts.blocks).toBeGreaterThan(30);
      expect(counts.airStarts).toBeGreaterThan(30);
      expect(counts.pushed).toBeGreaterThan(100);
   }, 60_000);
});

describe("obstacle-race obstacles", () => {
   it("golden positions of the bar, every block and the beam (negative ms for the countdown visuals)", () => {
      expect(barAngle(0)).toBe(0);
      expect(barAngle(1000)).toBeCloseTo(1.1, 12);
      expect(barAngle(-3000)).toBeCloseTo(-3.3, 12);
      const xs = (ms: number) => [0, 1, 2, 3, 4].map((k) => blockX(k, ms));
      const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12));
      close(xs(0), [-2.4, 2.4, 0, 0, 2.4]);
      close(xs(500), [-1.65, 1.65, 1.65, -1.65, 1.65]);
      close(xs(1000), [0, 0, 2.4, -2.4, 0]);
      close(xs(2000), [2.4, -2.4, 0, 0, -2.4]);
      close(xs(-3000), [0, 0, 2.4, -2.4, 0]);
      close(xs(4000), xs(0));
      close([0, 400, 800, 1600, -800, 3200].map(beamSlide), [-1.8, -1.2375, 0, 1.8, 0, -1.8]);
      expect(wave(-1, 4000, 0)).toBeCloseTo(wave(3999, 4000, 0), 12);
      // the blocks' top speed, measured ms by ms over a period
      let fastest = 0;
      for (let ms = 1; ms <= BLOCK.periodMs; ms++) fastest = Math.max(fastest, Math.abs(blockX(0, ms) - blockX(0, ms - 1)));
      expect(fastest * 1000).toBeCloseTo(BLOCK_TOP_SPEED, 2);
      expect(fastest * 1000).toBeLessThanOrEqual(BLOCK_TOP_SPEED + 1e-9);
   });

   it("the bar hits at feet 0.699, not 0.700; the head must be above its bottom; tangency counts; no sweeper, no bar", () => {
      // ms 0: the bar along ±x through (0, p 18)
      expect(barHits(COURSE, 3, -18, 0.699, 0)).toBe(true);
      expect(barHits(COURSE, 3, -18, 0.7, 0)).toBe(false);
      expect(barHits(COURSE, 3, -18, -1.249, 0)).toBe(true);
      expect(barHits(COURSE, 3, -18, -1.25, 0)).toBe(false);
      // tangent at the tip and across the bar
      expect(barHits(COURSE, BAR.reach + RUNNER.radius, -18, 0, 0)).toBe(true);
      expect(barHits(COURSE, BAR.reach + RUNNER.radius + 1e-9, -18, 0, 0)).toBe(false);
      // 18 + 0.175 + 0.35 (written out: the sum rounds up in floats)
      expect(barHits(COURSE, 3, -18.525, 0, 0)).toBe(true);
      expect(barHits(COURSE, 3, -18.525 - 1e-9, 0, 0)).toBe(false);
      // a quarter turn later it lies along p
      const quarter = Math.round((Math.PI / 2 / BAR.omega) * 1000);
      expect(barHits(COURSE, 3, -18, 0, quarter)).toBe(false);
      expect(barHits(COURSE, 0, -21, 0, quarter)).toBe(true);
      expect(barHits(FLAT, 3, -18, 0, 0)).toBe(false);
   });

   it("a timed jump at r = 3 clears the bar; a standing runner there is knocked", () => {
      // the next full sweep (at ms 0 the bar is already over the spot)
      let h1 = 0;
      for (let ms = 500; !h1; ms++) if (barHits(COURSE, 3, -18, 0, ms)) h1 = ms;
      let h2 = h1;
      while (barHits(COURSE, 3, -18, 0, h2 + 1)) h2++;
      // the bar covers the runner for ~320 ms (README: 318 ms at r = 3); a jump keeps the feet up for 488
      expect(h2 - h1 + 1).toBeGreaterThan(300);
      expect(h2 - h1 + 1).toBeLessThan(BAR_CLEAR_MS);
      const stand = place(createRun(), S["disc"], 3, 18, h1 - 1);
      expect(step(stand, 1, IDLE).knocked).toBe(true);
      expect(stand.simMs).toBe(h1);
      const takeOff = h1 - Math.ceil(BAR_WINDOW_MS.from) - 30;
      expect(takeOff + BAR_WINDOW_MS.to).toBeGreaterThan(h2);
      const jump = place(createRun(), S["disc"], 3, 18, takeOff - 1);
      expect(step(jump, 1, PRESS).jumped).toBe(true);
      expect(msSteps(jump, 1000, IDLE, (ev) => ev.knocked)).toBe(0);
      expect([jump.runner.state, jump.runner.grounded, jump.runner.support]).toEqual(["run", true, S["disc"]]);
   });

   it("the knock: a ghost that never lands on the disc again, z fixed, no input, lost 792 ms after the hit", () => {
      const run = place(createRun(), S["disc"], 3, 18, 0);
      // standing on the bar's line at ms 1 (barely turned)
      const ev = step(run, 1, IDLE);
      expect(ev.knocked).toBe(true);
      const hit = run.simMs;
      const z0 = run.runner.z;
      let lostAt = 0;
      for (let k = 0; k < 1000 && !lostAt; k++) {
         const e = step(run, 1, FWD_PRESS);
         expect(e.landed || e.jumped).toBe(false);
         expect(run.runner.z).toBe(z0);
         expect(run.runner.x).toBeGreaterThan(0);
         if (e.lost) lostAt = run.simMs;
      }
      expect(lostAt - hit).toBe(792);
      expect(run.runner.x).toBeCloseTo(KNOCK_STOP_X, 9);
   });

   it("knocks from every spot the bar can hit: the fling stops on the first ms clear of every top, |x| <= 6.35, feet still up", () => {
      const problems: string[] = [];
      let spots = 0;
      let zeroSpots = 0;
      for (let ix = -25; ix <= 25; ix++) {
         for (let ip = 47; ip <= 97; ip++) {
            const x = ix / 4;
            const at = ip / 4;
            const z = -at;
            const support = [S["disc"], S["bridge A"], S["bridge B"]].find((i) => onSupport(PATH[i], x, z, 0));
            if (support === undefined) continue;
            if (Math.hypot(x, at - DISC.p) < HUB.radius + RUNNER.radius + 1e-6) continue;
            let hit = 0;
            for (let ms = 1; ms <= 2900 && !hit; ms++) if (barHits(COURSE, x, z, 0, ms)) hit = ms;
            if (!hit) continue;
            spots += 1;
            const run = place(createRun(), support, x, at, hit - 1);
            if (!step(run, 1, IDLE).knocked) {
               problems.push(`no knock at ${x}, ${at}`);
               continue;
            }
            let stopped = 0;
            let lostAt = 0;
            for (let k = 1; k <= 1000 && !lostAt; k++) {
               const sliding = run.runner.knockDir !== 0;
               const e = step(run, 1, FWD_PRESS);
               const r = run.runner;
               // away from x = 0, and towards +x from exactly 0 (README "Constants")
               if (k === 1 && (x === 0 ? !(r.x > 0) : Math.sign(r.x - x) !== Math.sign(x))) problems.push(`fling towards ${r.x} from ${x}, ${at}`);
               if (k === 1 && x === 0) zeroSpots += 1;
               if (Math.abs(r.x) > KNOCK_STOP_X + 1e-12) problems.push(`|x| ${r.x} from ${x}, ${at}`);
               if (r.z !== z) problems.push(`z moved from ${x}, ${at}`);
               if (sliding && r.knockDir === 0) {
                  stopped = k;
                  if (overlapsTop(COURSE, r.x, r.z, run.simMs)) problems.push(`stopped over a top from ${x}, ${at}`);
                  if (!(r.y > 0)) problems.push(`feet ${r.y} at the stop from ${x}, ${at}`);
               }
               if (r.knockDir !== 0 && !overlapsTop(COURSE, r.x, r.z, run.simMs)) problems.push(`still sliding clear of the tops from ${x}, ${at}`);
               if (e.lost) lostAt = k;
            }
            if (!stopped || stopped > Math.ceil(KNOCK_STOP_MS)) problems.push(`stop at ${stopped} from ${x}, ${at}`);
            if (lostAt !== 792) problems.push(`lost at ${lostAt} from ${x}, ${at}`);
         }
      }
      expect(problems.slice(0, 10)).toEqual([]);
      expect(spots).toBeGreaterThan(1000);
      expect(zeroSpots).toBeGreaterThan(10);
   }, 60_000);

   it("groundBelow: the highest top at or under the feet below the centre, the blocks where they are, else the water", () => {
      expect(groundBelow(COURSE, 0, -37.6, 0.6, 0)).toBe(0.5);
      expect(groundBelow(COURSE, 0, -37.6, 0.4, 0)).toBe(WATER_Y);
      expect(groundBelow(COURSE, 0, -35.2, 0.3, 0)).toBe(WATER_Y);
      expect(groundBelow(COURSE, 0, -30, 0, 0)).toBe(0);
      expect(groundBelow(COURSE, blockX(2, 700), -77.3, 0.2, 700)).toBe(0);
      expect(groundBelow(COURSE, blockX(2, 700) + 3, -77.3, 0.2, 700)).toBe(WATER_Y);
   });
});

describe("obstacle-race checkpoints and respawns", () => {
   it("activation needs the runner grounded on the pad: crossing the line in the air does nothing until the landing", () => {
      const run = place(createRun(), S["bridge B"], 0, 26.2, 0, V_RUN);
      run.checkpoint = 0;
      let crossedAt = 0;
      let activatedAt = 0;
      step(run, 1, FWD_PRESS);
      expect(run.runner.grounded).toBe(false);
      for (let k = 0; k < 800 && !activatedAt; k++) {
         const ev = step(run, 1, FWD);
         if (!crossedAt && progress(run) >= LINES.cp1) crossedAt = run.simMs;
         if (ev.checkpoint !== NONE) {
            expect(ev.checkpoint).toBe(1);
            expect(ev.landed).toBe(true);
            activatedAt = run.simMs;
         }
      }
      expect(crossedAt).toBeGreaterThan(0);
      expect(activatedAt - crossedAt).toBeGreaterThan(100);
      expect(run.checkpoint).toBe(1);
      expect(progress(run)).toBeGreaterThan(LINES.cp1 + 1);
   });

   it("activated at the line, the respawn is exactly on the line (never ahead of the activation, never past maxP)", () => {
      const run = place(createRun(), S["CP1"], 2.9, 28.99, 0, V_RUN);
      const at = msSteps(run, 10, FWD, (ev) => ev.checkpoint === 1);
      expect(at).toBe(2);
      const activationP = progress(run);
      expect(activationP).toBeGreaterThanOrEqual(LINES.cp1);
      expect(activationP).toBeLessThan(LINES.cp1 + MAX_MOVE);
      // off the pad's side, into the pool
      const respawnAt = msSteps(run, 3000, input(1, 0), (ev) => ev.respawned);
      expect(respawnAt).toBeGreaterThan(0);
      expect([run.runner.x, progress(run), run.runner.y, run.runner.state, run.runner.support]).toEqual([0, LINES.cp1, 0, "spawn", S["CP1"]]);
      expect(progress(run)).toBeLessThanOrEqual(activationP);
      expect(progress(run)).toBeLessThanOrEqual(run.maxP);
      // a respawn at the pad's centre (p 31) would be past every point this run reached
      expect(run.maxP).toBeLessThan((sup("CP1").minP + sup("CP1").maxP) / 2);
      expect(run.respawns).toBe(1);
      expect(run.checkpoint).toBe(1);
   });

   it("in order only: CP2's pad with CP1 inactive activates nothing; the finish pad without CP3 does not finish", () => {
      const cp2 = place(createRun(), S["CP2"], 0, 63, 0, V_RUN);
      expect(msSteps(cp2, 300, FWD, (ev) => ev.checkpoint !== NONE)).toBe(0);
      expect(cp2.checkpoint).toBe(0);
      const fin = place(createRun(), S["finish"], 0, 117, 0);
      fin.checkpoint = 2;
      expect(msSteps(fin, 300, FWD, (ev) => ev.finished || ev.checkpoint !== NONE)).toBe(0);
      expect(fin.ended).toBe(null);
      const won = place(createRun(), S["finish"], 0, 117, 0);
      won.checkpoint = 3;
      expect(step(won, 1, IDLE).finished).toBe(true);
      expect(won.finishMs).toBe(1);
   });

   it("hand-off keys and the camera height: STAT matches the hudStats key; groundY rises on a landing and drops on a respawn", () => {
      // index.tsx's hudStats key is "checkpoint" (README "HUD"); finishMs is never shown
      expect(STAT).toEqual({ checkpoint: "checkpoint", finishMs: "finishMs" });
      const up = place(createRun(), S["J2"], -0.4, 42, 0, V_RUN);
      expect(up.groundY).toBe(1.0);
      msSteps(up, 400, FWD, (_e, r) => progress(r) >= 43.5);
      step(up, 1, FWD_PRESS);
      expect(up.groundY).toBe(1.0);
      msSteps(up, 1000, FWD, (e) => e.landed);
      expect([up.runner.support, up.groundY]).toEqual([S["J3"], 1.5]);
      up.checkpoint = 1;
      // off J3's side: the camera holds 1.5 through the fall, then drops to CP1's top on the respawn
      let held = true;
      const respawnAt = msSteps(up, 3000, input(1, 0), (e, r) => {
         if (!e.respawned && r.groundY !== 1.5) held = false;
         return e.respawned;
      });
      expect(respawnAt).toBeGreaterThan(0);
      expect(held).toBe(true);
      expect([up.groundY, up.runner.support]).toEqual([0, S["CP1"]]);
   });

   it("lost 600 ms, then spawn 300 ms, exact; input ignored in both; the clock keeps counting", () => {
      const run = place(createRun(), S["CP1"], 3.21, 30, 1000);
      run.checkpoint = 1;
      const lostAt = msSteps(run, 1000, IDLE, (ev) => ev.lost);
      // walked off at ms 1001, then 347 ms of falling
      expect(lostAt - 1001).toBe(347);
      expect(run.runner.state).toBe("lost");
      const yLost = run.runner.y;
      for (let k = 1; k < LOST_MS; k++) {
         const ev = step(run, 1, FWD_PRESS);
         expect([ev.respawned, run.runner.state, run.runner.y]).toEqual([false, "lost", yLost]);
      }
      const ev = step(run, 1, FWD_PRESS);
      expect(ev.respawned).toBe(true);
      expect(run.simMs).toBe(lostAt + LOST_MS);
      for (let k = 1; k < SPAWN_MS; k++) {
         step(run, 1, FWD_PRESS);
         expect([run.runner.state, run.runner.x, progress(run), run.runner.vz]).toEqual(["spawn", 0, LINES.cp1, 0]);
      }
      step(run, 1, FWD_PRESS);
      expect(run.runner.state).toBe("run");
      expect(run.simMs).toBe(lostAt + LOST_MS + SPAWN_MS);
      expect(progress(run)).toBe(LINES.cp1);
      // the first run ms moves; none of the presses made during the freeze survived
      const first = step(run, 1, FWD);
      expect(first.jumped).toBe(false);
      expect(progress(run)).toBeGreaterThan(LINES.cp1);
      expect(run.simMs).toBe(lostAt + LOST_MS + SPAWN_MS + 1);
   });
});

describe("obstacle-race finish", () => {
   it("finishes once, on the ms the line is crossed grounded; later steps change nothing", () => {
      const run = place(createRun(), S["finish"], 0, LINES.finish - 0.05, 5000, V_RUN);
      run.checkpoint = 3;
      const ev = step(run, 50, FWD);
      expect(ev.finished).toBe(true);
      expect(run.finishMs).toBe(5009);
      expect(run.simMs).toBe(5009);
      expect(run.ended).toBe("win");
      expect(progress(run)).toBeGreaterThanOrEqual(LINES.finish);
      const frozen = stateOf(run);
      for (let k = 0; k < 10; k++) {
         const e = step(run, 50, FWD_PRESS);
         expect(Object.values(e).some((v) => v === true)).toBe(false);
         expect(e.checkpoint).toBe(NONE);
      }
      expect(stateOf(run)).toBe(frozen);
   });

   it("a jump over the line finishes on the landing ms", () => {
      const run = place(createRun(), S["finish"], 0, 114, 2000, V_RUN);
      run.checkpoint = 3;
      step(run, 1, FWD_PRESS);
      let crossed = 0;
      for (let k = 0; k < 1000 && run.ended === null; k++) {
         const ev = step(run, 1, FWD);
         if (!crossed && progress(run) >= LINES.finish) crossed = run.simMs;
         if (ev.finished) expect(ev.landed).toBe(true);
      }
      expect(run.ended).toBe("win");
      expect(run.finishMs).toBe(2001 + 681);
      expect(run.finishMs - crossed).toBeGreaterThan(100);
   });
});

describe("obstacle-race minimum-time proof (README.md)", () => {
   it("the real store, driven like ShellStage: no untimed step, simMs <= elapsedMs < simMs + 1 after every frame", () => {
      expect(FRAME_PRIORITY.clock).toBeLessThan(FRAME_PRIORITY.simulation);
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1200 });
      store.getState().markReady();
      const rng = createRng(2026);
      let carried = 0;
      let pausedFrames = 0;
      let untimed = 0;
      const problems: string[] = [];
      for (const [i, ending] of (["restart", "restart", "timeup", "restart"] as const).entries()) {
         const { phase } = store.getState();
         if (phase === "ready" || phase === "over") store.getState().start();
         // GameShell remounts the Scene: a fresh run
         const run = createRun();
         const bot = randomBot(300 + i);
         const stopAt = 5_000 + rng() * 40_000;
         let first = true;
         while (store.getState().phase !== "over") {
            const roll = rng();
            if (roll < 0.01) store.getState().pause();
            else if (roll < 0.03) store.getState().resume();
            const before = store.getState().elapsedMs;
            advanceRunClock(store, rng() < 0.1 ? 0.05 + rng() * 0.25 : 0.004 + rng() * 0.046);
            const s = store.getState();
            if (s.phase === "paused") pausedFrames += 1;
            const dt = playedFrameDt(s);
            if (dt === 0) continue;
            if (dt * 1000 > s.elapsedMs - before + 1e-9) untimed += 1;
            if (first && dt < MAX_FRAME_DT - 1e-9) carried += 1;
            first = false;
            const ev = step(run, dt * 1000, bot.next(run, dt * 1000));
            sceneReport(store, run, ev);
            const e = store.getState().elapsedMs;
            if (run.simMs > e + 1e-6) problems.push(`simMs ${run.simMs} ahead of ${e}`);
            if (run.ended === null && !(e < run.simMs + 1)) problems.push(`simMs ${run.simMs} lags ${e}`);
            if (ending === "restart" && e >= stopAt) break;
         }
         if (ending === "timeup") {
            // the rules own the 300 s cap: the store has no timer, the Scene ends the run
            const s = store.getState();
            expect(s.timeLeftMs).toBe(null);
            expect(run.ended).toBe("timeup");
            expect(run.simMs).toBe(DURATION_MS);
            expect(s.endReason).toBe("timeup");
            expect(s.elapsedMs).toBeGreaterThanOrEqual(DURATION_MS);
            // the frame that reached the cap counted its rest too (at most one frame)
            expect(s.elapsedMs).toBeLessThan(DURATION_MS + MAX_STEP_MS);
            expect(isRankedRun(RULES, s.endReason)).toBe(false);
            expect(isRankedRun(RULES, "quit")).toBe(false);
            expect(isRankedRun(RULES, "win")).toBe(true);
         } else {
            store.getState().restart();
         }
      }
      expect(problems.slice(0, 10)).toEqual([]);
      expect(untimed).toBe(0);
      // the random frames really ended countdowns mid-frame and paused runs
      expect(carried).toBeGreaterThan(0);
      expect(pausedFrames).toBeGreaterThan(0);
   }, 60_000);

   it("the flat course: a straight line at full stick from the first ms reaches each line at 150 + ceil((line - 0.453) / 0.006), at every frame pattern", () => {
      const expected = [4908, 10408, 14842];
      for (const line of [LINES.cp1, LINES.cp2, LINES.cp3, LINES.finish]) {
         expect(RAMP_MS + Math.ceil((line - RAMP_M) / MAX_MOVE)).toBe({ 29: 4908, 62: 10408, 88.6: 14842, 116: 19408 }[line]);
      }
      for (const pattern of PATTERNS) {
         const played = play(createRun(FLAT), straightBot(), pattern.make(7));
         expect(played.problems, pattern.name).toEqual([]);
         expect(played.checkpoints, pattern.name).toEqual(expected);
         expect(played.run.finishMs, pattern.name).toBe(19408);
      }
      // each is above the proof's earliest ms; the 74 ms between them is the 150 ms ramp
      expect(19408 - MIN_FINISH_MS).toBe(74);
      expect(4908 - earliestMs(LINES.cp1)).toBe(74);
   });

   it("nothing beats the straight line on the flat course: jump mashing, random sticks, greedy lookahead", () => {
      const bots: Array<[string, () => Bot]> = [
         ["masher", masherBot],
         ["greedy", greedyBot],
         ...[1, 2, 3, 4].map((seed): [string, () => Bot] => [`random ${seed}`, () => randomBot(seed)]),
      ];
      for (const [name, make] of bots) {
         for (const pattern of [fixed(1), FPS_60, RANDOM_4_50]) {
            const played = play(createRun(FLAT), make(), pattern.make(11), 40_000);
            expect(played.problems, `${name} ${pattern.name}`).toEqual([]);
            const [cp1, cp2, cp3] = played.checkpoints;
            if (cp1 !== undefined) expect(cp1).toBeGreaterThanOrEqual(4908);
            if (cp2 !== undefined) expect(cp2).toBeGreaterThanOrEqual(10408);
            if (cp3 !== undefined) expect(cp3).toBeGreaterThanOrEqual(14842);
            if (played.run.ended === "win") expect(played.run.finishMs).toBeGreaterThanOrEqual(19408);
         }
      }
   }, 60_000);

   it("on the real course no bot finishes before the bound, and every checkpoint respects its earliest ms", () => {
      const bots: Array<[string, () => Bot, number]> = [
         ["masher", masherBot, 60_000],
         ["greedy", greedyBot, 30_000],
         ...[5, 6, 7, 8, 9, 10].map((seed): [string, () => Bot, number] => [`random ${seed}`, () => randomBot(seed), 60_000]),
      ];
      let respawns = 0;
      for (const [name, make, limit] of bots) {
         for (const pattern of [FPS_60, RANDOM_4_50]) {
            const played = play(createRun(), make(), pattern.make(13), limit);
            expect(played.problems, `${name} ${pattern.name}`).toEqual([]);
            respawns += played.respawns;
         }
      }
      expect(respawns).toBeGreaterThan(20);
   }, 60_000);

   it("the speedrun bot finishes with no fall: pinned at 60 fps, and above the bound at 30 and 144 fps", () => {
      const runs = [FPS_60, FPS_30, FPS_144].map((pattern) => ({ pattern, played: play(createRun(), speedrunBot(), pattern.make(1)) }));
      for (const { pattern, played } of runs) {
         expect(played.problems, pattern.name).toEqual([]);
         expect(played.run.ended, pattern.name).toBe("win");
         expect(played.respawns, pattern.name).toBe(0);
         expect(played.knocks, pattern.name).toBe(0);
         expect(played.checkpoints.length).toBe(3);
         expect(played.run.finishMs).toBeGreaterThan(MIN_FINISH_MS);
         // the free path through every section: 5 platform jumps, 5 block jumps and 1 onto CP3 at least
         expect(played.jumps).toBeGreaterThanOrEqual(11);
         // every section, in course order (the bot presses only from the ground, so frame ends see each
         // landing; a bridge is a walking join and may be jumped)
         const notBridge = (i: number) => PATH[i].kind !== "bridge";
         expect(played.trail.filter(notBridge), pattern.name).toEqual(PATH.map((_, i) => i).filter(notBridge));
      }
      // pinned from the first run (README "What real play will score")
      expect(Math.abs(runs[0].played.run.finishMs - 22452)).toBeLessThanOrEqual(500);
   }, 60_000);

   it("finalScore with the speedrun bot's final store state: durationMs = finishMs <= elapsedMs, the score the server computes", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1200 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun();
      const bot = speedrunBot();
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
      expect(s.score).toBe(0);
      const fin = finalScore(s);
      expect(fin.durationMs).toBe(run.finishMs);
      expect(Number.isInteger(fin.durationMs)).toBe(true);
      expect(fin.durationMs).toBeLessThanOrEqual(s.elapsedMs);
      expect(s.elapsedMs - fin.durationMs).toBeLessThan(1000 / 60 + 1);
      const submitted = normalizeRun({ slug: "obstacle-race", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-06T00:00:00Z" }, RULES);
      expect(submitted.durationMs).toBe(run.finishMs);
      expect(submitted.score).toBe(computeTimeScore(RULES, run.finishMs));
      expect(submitted.durationMs).toBeGreaterThanOrEqual(RULES.minDurationMs);
      expect(submitted.durationMs).toBeLessThanOrEqual(RULES.maxDurationMs);
      expect(submitted.score).toBeLessThanOrEqual(28066);
      expect(isRankedRun(RULES, s.endReason)).toBe(true);
      // the frame's end (GameShell's default) would never rank a run higher
      expect(computeTimeScore(RULES, s.elapsedMs)).toBeLessThanOrEqual(submitted.score);
      // any other end keeps elapsedMs (and is unranked anyway)
      expect(finalScore({ ...s, endReason: "timeup" }).durationMs).toBe(s.elapsedMs);
      expect(finalScore({ ...s, stats: {} }).durationMs).toBe(s.elapsedMs);
   }, 60_000);

   it("the rules' cap: an idle run times up at exactly 300000; that ms moves nothing; later steps do nothing", () => {
      const run = createRun();
      let last: StepEvents | null = null;
      let frames = 0;
      while (run.ended === null) {
         last = step(run, 50, IDLE);
         frames += 1;
      }
      expect(frames).toBe(DURATION_MS / 50);
      expect([run.ended, run.simMs, last!.timeup]).toEqual(["timeup", DURATION_MS, true]);
      const frozen = stateOf(run);
      const ev = step(run, 50, FWD_PRESS);
      expect(Object.values(ev).some((v) => v === true)).toBe(false);
      expect(stateOf(run)).toBe(frozen);
      // a runner at full speed: the ms that reaches the cap does not move it
      const moving = place(createRun(), S["CP1"], 0, 30, DURATION_MS - 1, V_RUN);
      const p0 = progress(moving);
      expect(step(moving, 1, FWD).timeup).toBe(true);
      expect(progress(moving)).toBe(p0);
      expect(moving.simMs).toBe(DURATION_MS);
   });

   it("a finish at ms 299999 is a win; one that would come at ms 300000 is a time-up (also inside one frame)", () => {
      const setup = (ms: number, at: number) => {
         const run = place(createRun(), S["finish"], 0, at, ms, V_RUN);
         run.checkpoint = 3;
         return run;
      };
      const win = setup(DURATION_MS - 2, LINES.finish - 0.003);
      expect(step(win, 1, FWD).finished).toBe(true);
      expect([win.ended, win.finishMs]).toEqual(["win", DURATION_MS - 1]);
      const late = setup(DURATION_MS - 1, LINES.finish - 0.003);
      const ev = step(late, 1, FWD);
      expect([ev.finished, ev.timeup, late.ended, late.finishMs]).toEqual([false, true, "timeup", 0]);
      // in one 50 ms frame: 9 ms to the line wins, 10 ms is the cap
      const frameWin = setup(DURATION_MS - 10, LINES.finish - 0.05);
      step(frameWin, 50, FWD);
      expect([frameWin.ended, frameWin.finishMs]).toEqual(["win", DURATION_MS - 1]);
      const frameLate = setup(DURATION_MS - 10, LINES.finish - 0.06 + 1e-9);
      step(frameLate, 50, FWD);
      expect([frameLate.ended, frameLate.simMs]).toEqual(["timeup", DURATION_MS]);
   });

   it("the integer clock: whole ms with the remainder carried, at most 50 per frame, never ahead of the dts", () => {
      for (const pattern of PATTERNS) {
         const run = createRun();
         const next = pattern.make(5);
         let sum = 0;
         for (let k = 0; k < 2000; k++) {
            const dt = next();
            const before = run.simMs;
            step(run, dt, IDLE);
            sum += Math.min(dt, MAX_STEP_MS);
            expect(Number.isInteger(run.simMs)).toBe(true);
            expect(run.simMs).toBeLessThanOrEqual(sum + 1e-6);
            expect(run.simMs).toBeGreaterThan(sum - 1);
            expect(run.stepMs).toBe(run.simMs - before);
            expect(run.remainder).toBeGreaterThanOrEqual(0);
            expect(run.remainder).toBeLessThan(1);
         }
      }
      const run = createRun();
      expect(advanceClock(run, 300)).toBe(MAX_STEP_MS);
      expect(advanceClock(run, 0.4)).toBe(0);
      expect(advanceClock(run, 0.7)).toBe(1);
      expect(run.remainder).toBeCloseTo(0.1, 9);
      // a step with no time does nothing, not even latch a press
      const idle = createRun();
      for (const dt of [0, -5, Number.NaN]) {
         step(idle, dt, FWD_PRESS);
         expect([idle.simMs, idle.pressMs, idle.runner.vz]).toEqual([0, NONE, 0]);
      }
      // a sub-ms frame keeps its press for the next ms
      step(idle, 0.5, PRESS);
      expect([idle.simMs, idle.pressMs]).toEqual([0, 1]);
      expect(step(idle, 0.5, IDLE).jumped).toBe(true);
   });
});

describe("obstacle-race determinism", () => {
   it("the same frames and inputs give deep-equal runs and event sequences", () => {
      const record = () => {
         const run = createRun();
         const bot = randomBot(77);
         const next = RANDOM_4_50.make(78);
         const events: string[] = [];
         for (let k = 0; k < 3000 && run.ended === null; k++) {
            const dt = next();
            const ev = step(run, dt, bot.next(run, dt));
            events.push(JSON.stringify(ev));
         }
         return { run, events };
      };
      const a = record();
      const b = record();
      expect(a.events).toEqual(b.events);
      expect({ ...a.run, course: null }).toEqual({ ...b.run, course: null });
      expect(a.events.some((e) => e.includes('"jumped":true'))).toBe(true);
      // the speedrun bot too, at random frames
      const s1 = play(createRun(), speedrunBot(), RANDOM_4_50.make(9), 60_000).run;
      const s2 = play(createRun(), speedrunBot(), RANDOM_4_50.make(9), 60_000).run;
      expect({ ...s1, course: null }).toEqual({ ...s2, course: null });
   }, 60_000);

   it("no allocation: step reuses the run's objects and returns the same events object", () => {
      const run = createRun();
      const refs = [run.runner, run.events, run.course];
      const ev = step(run, 16, FWD_PRESS);
      expect(ev).toBe(run.events);
      play(run, randomBot(5), FPS_60.make(1), 30_000);
      expect([run.runner, run.events, run.course]).toEqual(refs);
      refs.forEach((ref, i) => expect([run.runner, run.events, run.course][i]).toBe(ref));
   });

   it("rules.ts is pure: it imports only core/collision and core types (no three.js, React, Rapier, randomness or clocks)", () => {
      const source = readFileSync(new URL("./rules.ts", import.meta.url), "utf8");
      const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]).sort();
      expect(imports).toEqual(["@/arcade3d/core/collision", "@/arcade3d/core/types"]);
      expect(source).toMatch(/^import type \{ RunState \} from "@\/arcade3d\/core\/types";$/m);
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code).not.toMatch(/Math\.random|Date\.now|performance\.now|requestAnimationFrame|window|document/);
      expect(code).not.toMatch(/three|react|rapier|dimforge/i);
   });
});
