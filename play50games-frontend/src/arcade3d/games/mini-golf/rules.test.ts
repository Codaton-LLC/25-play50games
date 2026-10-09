// Mini Golf rules: the ball physics pins, frame-rate independence, strokes and scoring, the run's
// end, and the scoring-limit proof with bots through the real store (core botHarness simulateRun).
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { HILL_GRADE, HOLE_COUNT, PARS, PAR_TOTAL, RAMP, TURNTABLE, WINDMILL, buildHole, generateCourse, type Hole } from "./course";
import { miniGolfMeta } from "./meta";
import { BALL, CUP, MOVING, bladeChord, createBall, createBallEvents, launchBall, placeBall, previewLength, stepBall } from "./physics";
import { PICK_UP_OVER, RUN, TICK, advanceRun, canPutt, createRun, currentHole, holeScore, syncStore, type RunState } from "./rules";
import { ACE_LINES, PAR_LINES, linePsi, playPutt, type LinePutt } from "./solver";

const DEG = Math.PI / 180;
const ev = createBallEvents();

/** Roll a ball from `at` with velocity (vx, vz) on `hole` until it stops; returns the ball and the sub-steps. */
function roll(hole: Hole, at: { x: number; z: number }, vx: number, vz: number, maxSteps = 240 * 30) {
   const b = createBall(at, hole.terrain === "tiers");
   placeBall(hole, b, at, b.upper);
   b.vx = vx;
   b.vz = vz;
   b.mode = "roll";
   let n = 0;
   while (n < maxSteps && stepBall(hole, b, n / 240, 1 / 240, ev)) n++;
   return { b, n };
}

// ---------- bots ----------

type Bot = "ace" | "par" | "spam" | "idle";

/** One run on the real store with the Scene's calls (advanceRun + syncStore). */
function runBot(seed: number, bot: Bot, frame: () => number) {
   const run = createRun(seed);
   const rng = createRng(seed ^ 0x9e3779b9);
   let hole = -1;
   let next = 0;
   const strokesPerHole: number[] = [];
   let minEnd = Infinity;
   const end = simulateRun(createArcadeStore(), {
      frame,
      step: (dt, _time, store) => {
         if (run.hole !== hole) {
            hole = run.hole;
            next = 0;
         }
         const h = currentHole(run);
         let putt = false;
         let psi = 0;
         let p = 0.5;
         if (bot === "ace" || bot === "par") {
            const line: LinePutt[] = (bot === "ace" ? ACE_LINES : PAR_LINES)[run.hole];
            const q = line[next];
            if (q && canPutt(run) && run.holeTicks >= q.w) {
               putt = true;
               psi = linePsi(h, q);
               p = q.p;
               next++;
            }
         } else if (bot === "spam") {
            putt = rng() < 0.5;
            psi = (rng() - 0.5) * 2 * Math.PI;
            p = rng();
         }
         advanceRun(run, dt, psi, p, putt);
         const ev = run.events;
         if (ev.holeOut >= 0) strokesPerHole.push(ev.holeStrokes);
         if (ev.win) minEnd = run.time;
         syncStore(run, store.getState());
      },
   });
   return { run, end, strokesPerHole, minEnd };
}

const framesFor = (k: number) => [fixedFrames(1000 / 60), fixedFrames(50), fixedFrames(1000 / 144), randomFrames(k)][k % 4];

// ---------- tests ----------

describe("mini-golf ball", () => {
   it("pins the tuning the proof rests on", () => {
      expect(BALL).toMatchObject({ radius: 0.06, friction: 0.9, vCap: 6, vMax: 4.5, restSpeed: 0.05 });
      expect(CUP).toMatchObject({ radius: 0.1, captureSpeed: 1.2, lipKeep: 0.85 });
      expect(WINDMILL).toMatchObject({ tunnelHalf: 0.116, bladeZ: 0.8, hubY: 1.148, length: 1.1 });
      expect(TURNTABLE).toMatchObject({ half: 0.85, omega: 1.2 });
      expect(TICK).toMatchObject({ hz: 120, sub: 2, ready: 0.5, holeOut: 2.0, guard: 20 });
      expect(PARS).toEqual([2, 2, 3, 3, 3, 4]);
      expect(PAR_TOTAL).toBe(17);
   });

   it("rolls v^2 / 1.8 on flat felt (within 1 cm) and never reverses", () => {
      const hole = buildHole(3, false);
      for (const v of [0.5, 1, 2]) {
         const { b } = roll(hole, { x: 0, z: 2.9 }, 0, -v);
         expect(Math.abs(2.9 - b.z - (v * v) / 1.8)).toBeLessThan(0.01);
      }
   });

   it("10,000 random static-rail hits never gain speed; the clamp holds", () => {
      const hole = buildHole(1, false);
      const rng = createRng(7);
      for (let i = 0; i < 10_000; i++) {
         const b = createBall({ x: 0, z: 0 }, false);
         b.x = (rng() - 0.5) * 0.85;
         b.z = -1.5 + rng() * 4.9;
         const a = rng() * 2 * Math.PI;
         const v = rng() * 8;
         b.vx = Math.cos(a) * v;
         b.vz = Math.sin(a) * v;
         b.mode = "roll";
         const before = Math.min(BALL.vCap, v);
         stepBall(hole, b, 0, 1 / 240, ev);
         expect(Math.hypot(b.vx, b.vz)).toBeLessThanOrEqual(before + 1e-9);
      }
   });

   it("rests under 0.05 m/s on <= 2 % felt, never on the 9 deg hill or the 12 deg ramp", () => {
      expect(BALL.slope * HILL_GRADE).toBeGreaterThan(BALL.friction);
      expect(BALL.slope * RAMP.grade).toBeGreaterThan(BALL.friction);
      expect(BALL.slope * 0.02).toBeLessThan(BALL.friction);
      const hill = buildHole(5, false);
      const { b } = roll(hill, { x: 0, z: 2 }, 0, 0.01);
      expect(b.z).toBeLessThan(-0.3);
      const ramp = buildHole(2, false);
      const r = roll(ramp, { x: 0, z: 1.5 }, 0, -2.0);
      expect(r.b.z).toBeGreaterThan(1.0); // short of the lip: back down the ramp
   });

   it("captures at 1.19 m/s and lips out at 1.21, turned away and slowed", () => {
      const hole = buildHole(3, false);
      const slow = roll(hole, { x: hole.cup.x, z: hole.cup.z + 0.11 }, 0, -1.19 - 0.9 / 240);
      expect(slow.b.mode).toBe("cup");
      const fast = createBall({ x: hole.cup.x + 0.03, z: hole.cup.z + 0.11 }, false);
      fast.vz = -1.21 - 0.9 / 240;
      fast.mode = "roll";
      let lip = false;
      for (let n = 0; n < 60; n++) {
         stepBall(hole, fast, 0, 1 / 240, ev);
         lip ||= ev.lipOut;
      }
      expect(lip).toBe(true);
      expect(fast.mode).not.toBe("cup");
      expect(fast.vx).toBeGreaterThan(0); // the cup's centre was on its left: turned right, away
   });

   it("water: a ball in hole 6's pond splashes; a slow ball off hole 3's lip drops into the gap", () => {
      const hole = buildHole(5, false);
      const a = roll(hole, { x: -0.5, z: -2.3 }, 0, -1.2);
      expect(ev.water).toBe(true);
      expect(a.b.z).toBeLessThan(-2.79);
      const ramp = buildHole(2, false);
      const b = createBall({ x: 0, z: 0.01 }, false);
      b.vz = -0.3;
      b.mode = "roll";
      let n = 0;
      while (n < 2400 && stepBall(ramp, b, 0, 1 / 240, ev)) n++;
      expect(ev.water).toBe(true);
   });

   it("clears the gap from a 2.4 m/s lip, not from 2.0", () => {
      const ramp = buildHole(2, false);
      const lip = (v: number) => roll(ramp, { x: 0, z: 0.001 }, 0, -v);
      expect(lip(2.4).b.z).toBeLessThan(RAMP.gapEnd);
      lip(2.0);
      expect(ev.water).toBe(true);
   });

   it("pipes keep the speed and take length / max(speed, 0.6): a slow ball spends 6.4 / 0.6 = 10.7 s in the centre pipe", () => {
      const hole = buildHole(4, false);
      const b = createBall({ x: 0, z: 1.503 }, true);
      b.vz = -0.3;
      b.mode = "roll";
      let n = 0;
      let out = -1;
      while (n < 240 * 20) {
         stepBall(hole, b, 0, 1 / 240, ev);
         n++;
         if (ev.pipeOut) {
            out = n;
            break;
         }
      }
      expect(out / 240).toBeCloseTo(6.4 / 0.6, 1);
      expect(b.vz).toBeGreaterThan(0); // out of the back rail heading +z
   });

   it("the windmill blocks the mouth 0.47 s of every 1.5 s (open 1.03 s)", () => {
      const out = { c0: 0, c1: 0 };
      let closed = 0;
      const n = 6000;
      for (let i = 0; i < n; i++) {
         const t = (i / n) * 1.5;
         let blocked = false;
         for (let k = 0; k < 4; k++) {
            if (bladeChord(WINDMILL.hubY, WINDMILL.length, WINDMILL.halfWidth, WINDMILL.phase + WINDMILL.omega * t + (k * Math.PI) / 2, out) && out.c0 <= WINDMILL.tunnelHalf && out.c1 >= -WINDMILL.tunnelHalf) blocked = true;
         }
         if (blocked) closed++;
      }
      expect((closed / n) * 1.5).toBeCloseTo(0.466, 2);
      expect(MOVING.bladeE).toBe(0.75);
   });

   it("a moving-wall hit changes the speed by at most (1 + e) |v_wall|", () => {
      const hole = buildHole(5, false);
      const rng = createRng(3);
      const tip = TURNTABLE.omega * TURNTABLE.half;
      for (let i = 0; i < 4000; i++) {
         const b = createBall({ x: 0, z: 0 }, false);
         const r = rng() * 0.85;
         const a = rng() * 2 * Math.PI;
         b.x = Math.cos(a) * r;
         b.z = TURNTABLE.z + Math.sin(a) * r;
         b.vx = (rng() - 0.5) * 3;
         b.vz = (rng() - 0.5) * 3;
         b.mode = "roll";
         const v0 = Math.hypot(b.vx, b.vz);
         stepBall(hole, b, rng() * 10, 1 / 240, ev);
         expect(Math.hypot(b.vx, b.vz)).toBeLessThanOrEqual(v0 + (1 + MOVING.barE) * tip + 0.2);
      }
   });

   it("mirrored holes give mirrored outcomes (within 1e-9)", () => {
      for (let h = 0; h < HOLE_COUNT; h++) {
         const a = buildHole(h, false);
         const m = buildHole(h, true);
         for (const [deg, p, st] of [[3, 0.6, 0], [-8, 0.9, 37], [12, 0.75, 101]]) {
            const r = playPutt(a, a.tee, a.terrain === "tiers", deg * DEG, p, st);
            const s = playPutt(m, m.tee, m.terrain === "tiers", -deg * DEG, p, st);
            expect(s.captured).toBe(r.captured);
            expect(Math.abs(s.x + r.x)).toBeLessThan(1e-9);
            expect(Math.abs(s.z - r.z)).toBeLessThan(1e-9);
         }
      }
   });

   it("the preview reaches the first rail contact or the flat roll, at most 2.5 m", () => {
      const hole = buildHole(0, false);
      const b = createBall(hole.tee, false);
      expect(previewLength(hole, b, 0, -1, 1)).toBeCloseTo(1 / 1.8, 2);
      expect(previewLength(hole, b, 0, -1, 4.5)).toBeCloseTo(2.5, 5);
      // straight at the right rail (x 0.5): contact when the centre is 0.06 from it
      expect(previewLength(hole, b, 1, 0, 4.5)).toBeCloseTo(0.44, 2);
      const r = roll(hole, hole.tee, 1.0, 0);
      expect(ev.railHit).toBeGreaterThanOrEqual(0);
      expect(r.b.x).toBeLessThan(0.45);
   });
});

describe("mini-golf frame-rate independence", () => {
   it("the same putt from the same start tick ends in the same place at 30, 60, 144 fps and random frames (every hole)", () => {
      for (let h = 0; h < HOLE_COUNT; h++) {
         const rests: string[] = [];
         for (const frame of [fixedFrames(1000 / 30), fixedFrames(1000 / 60), fixedFrames(1000 / 144), randomFrames(h + 1, 0.004, 0.05)]) {
            const run = createRun(1, Array.from({ length: HOLE_COUNT }, (_v, i) => buildHole(i, false)));
            run.hole = h;
            const hole = currentHole(run);
            placeBall(hole, run.ball, hole.tee, hole.terrain === "tiers");
            run.lastRest = { x: hole.tee.x, z: hole.tee.z, upper: run.ball.upper };
            let fired = false;
            for (let f = 0; f < 20000 && !run.over; f++) {
               const go = !fired && run.holeTicks >= 120;
               advanceRun(run, frame(), 0.05, 0.62, go);
               fired ||= go;
               if (fired && run.phase !== "moving" && !run.pending.on) break;
            }
            const same = playPutt(hole, hole.tee, hole.terrain === "tiers", 0.05, 0.62, run.puttTick);
            if (same.water) {
               // splashed: back on the tee, the putt and the penalty counted
               expect([run.ball.x, run.ball.z, run.strokes]).toEqual([hole.tee.x, hole.tee.z, 2]);
            } else if (run.phase === "aim") {
               expect(run.ball.x).toBe(same.x);
               expect(run.ball.z).toBe(same.z);
            } else expect(same.captured).toBe(true);
            rests.push(`${run.puttTick >= 120 && run.puttTick <= 126}`);
         }
         expect(rests.every((r) => r === "true")).toBe(true);
      }
   });
});

describe("mini-golf strokes and scoring", () => {
   it("scores 100 per stroke under par + 3, +200 for an ace; picked up = 0", () => {
      expect(holeScore(2, 1)).toBe(600);
      expect(holeScore(3, 1)).toBe(700);
      expect(holeScore(4, 1)).toBe(800);
      expect(holeScore(3, 2)).toBe(400);
      expect(holeScore(3, 3)).toBe(300);
      expect(holeScore(3, 6)).toBe(0);
      expect(holeScore(3, 3 + PICK_UP_OVER)).toBe(0);
      expect(PARS.reduce((s, par) => s + holeScore(par, 1), 0)).toBe(4100);
   });

   it("picks the ball up at par + 4, counting water penalties", () => {
      const run = createRun(5, Array.from({ length: HOLE_COUNT }, (_v, i) => buildHole(i, false)));
      run.hole = 2; // the ramp jump: a weak putt rolls back, a medium one splashes
      const hole = currentHole(run);
      placeBall(hole, run.ball, hole.tee, false);
      let outs = 0;
      for (let f = 0; f < 60 * 120 && run.hole === 2; f++) {
         advanceRun(run, 1 / 60, 0, 0.7, true);
         if (run.events.water) expect(run.ball.x).toBe(hole.tee.x);
         if (run.events.holeOut === 2) {
            outs++;
            expect(run.events.pickedUp).toBe(true);
            expect(run.events.holeStrokes).toBe(3 + PICK_UP_OVER);
            expect(run.events.holeScore).toBe(0);
         }
      }
      expect(outs).toBe(1);
   });

   it("ignores putts while the ball moves and for 0.5 s after it stops", () => {
      const run = createRun(9);
      advanceRun(run, 1 / 60, 0, 0.3, true);
      expect(run.strokes).toBe(1);
      let accepted = 0;
      let stoppedAt = -1;
      for (let f = 0; f < 600; f++) {
         if (run.phase === "aim" && stoppedAt < 0) stoppedAt = run.time;
         const before = run.strokes;
         advanceRun(run, 1 / 60, 0, 0.3, true);
         if (run.strokes > before) {
            accepted++;
            expect(run.time - stoppedAt).toBeGreaterThanOrEqual(0.5 - 1e-9);
            break;
         }
      }
      expect(accepted).toBe(1);
   });

   it("an idle player times out at 600 s with 0 points", () => {
      const { end, run } = runBot(1, "idle", fixedFrames(50));
      expect(end.endReason).toBe("timeup");
      expect(end.score).toBe(0);
      expect(run.time).toBeLessThanOrEqual(RUN.capS + 0.05);
      expect(end.elapsedMs).toBeLessThanOrEqual(miniGolfMeta.scoring.maxDurationMs);
   });

   it("generateCourse mirrors each hole on a seeded bit; the same seed gives the same course", () => {
      const seen = new Set<string>();
      for (let s = 0; s < 1000; s++) seen.add(generateCourse(s).map((h) => (h.mirrored ? 1 : 0)).join(""));
      expect(seen.size).toBe(64);
      expect(generateCourse(42).map((h) => h.mirrored)).toEqual(generateCourse(42).map((h) => h.mirrored));
   });
});

describe("mini-golf scoring limit proof (README.md)", () => {
   const limits = miniGolfMeta.scoring;
   const tee = (h: Hole) => Math.hypot(h.tee.x - h.cup.x, h.tee.z - h.cup.z);

   it("the earliest win is 15.75 s on the speed bound", () => {
      const course = Array.from({ length: HOLE_COUNT }, (_v, i) => buildHole(i, false));
      const capture = course.reduce((s, h) => s + (tee(h) - CUP.radius) / BALL.vCap, 0);
      expect(capture).toBeCloseTo(5.75, 1);
      expect(capture + 5 * TICK.holeOut).toBeGreaterThan(limits.minDurationMs / 1000);
      expect(PARS.reduce((s, par) => s + 100 * (par + 2) + 200, 0)).toBe(limits.maxScore);
   });

   const stats = { ace: [] as number[], par: [] as number[], spam: [] as number[] };
   for (const bot of ["ace", "par", "spam"] as const) {
      it(`${bot} bots on 200 seeds (60 / 20 / 144 Hz, random frames) stay within the server limits`, { timeout: 120_000 }, () => {
         let best = 0;
         let fastest = Infinity;
         for (let seed = 0; seed < 200; seed++) {
            const { end, run, strokesPerHole } = runBot(seed * 7919 + 13, bot, framesFor(seed));
            expect(end.phase).toBe("over");
            expect(withinServerLimits(end.score, end.elapsedMs, limits), `seed ${seed} score ${end.score} in ${end.elapsedMs} ms`).toBe(true);
            expect(capScore(end.score, end.elapsedMs, limits)).toBe(end.score);
            expect(run.topSpeed).toBeLessThanOrEqual(BALL.vCap + 1e-9);
            expect(end.elapsedMs).toBeGreaterThanOrEqual(15_750 - 1);
            if (bot === "ace") {
               expect(end.endReason).toBe("win");
               expect(strokesPerHole).toEqual([1, 1, 1, 1, 1, 1]);
            }
            if (bot === "par") {
               expect(end.endReason).toBe("win");
               strokesPerHole.forEach((s, i) => expect(s).toBeLessThanOrEqual(PARS[i]));
            }
            best = Math.max(best, end.score);
            if (end.endReason === "win") fastest = Math.min(fastest, end.elapsedMs);
            stats[bot].push(end.score);
         }
         if (bot === "ace") expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         // eslint-disable-next-line no-console
         console.log(`${bot}: best ${best}, fastest win ${fastest} ms`);
      });
   }

   it("a run is the same twice (determinism)", () => {
      const a = runBot(77, "spam", randomFrames(3));
      const b = runBot(77, "spam", randomFrames(3));
      expect(a.end.score).toBe(b.end.score);
      expect(a.end.elapsedMs).toBe(b.end.elapsedMs);
      expect(a.run.card).toEqual(b.run.card);
   });

   it("keeps the ball moving no faster than the clamp in every state the bots reach", () => {
      const run: RunState = runBot(5, "spam", fixedFrames(16)).run;
      expect(run.topSpeed).toBeLessThanOrEqual(BALL.vCap);
   });
});

void launchBall;
