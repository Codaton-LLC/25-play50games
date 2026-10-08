import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { pointAt, tangentAt } from "@/arcade3d/core/path";
import { PROPOSED_LIMITS, createRun, generateChunk, validChunk, stepRun, runScore, safeCentre, widthAt, airHeight, landingSpins, type StepInput, type Run } from "./rules";

const idle: StepInput = { steer: 0, left: false, right: false, jump: false };
const frames = (r: Run, seconds: number, input = idle) => {
   for (let t = 0; t < seconds - 1e-10; t += 1 / 120) stepRun(r, input, Math.min(1 / 120, seconds - t));
};

function simulate(seed: number, mode: "safe" | "spam" | "crash" | "reward", raw: () => number, forcedSpeed = false) {
   const store = createArcadeStore();
   store.getState().configure({ resultDelayMs: 1200 });
   store.getState().markReady();
   store.getState().start();
   const run = createRun(seed, false);
   if (forcedSpeed) run.speed = 22;
   const input = { ...idle };
   let played = 0;
   let topSpeed = 0;
   let frames = 0;
   while (store.getState().phase !== "over" && frames++ < 100_000) {
      if (frames % 101 === 0) store.getState().pause();
      if (frames % 101 === 1) store.getState().resume();
      advanceRunClock(store, raw());
      const dt = playedFrameDt(store.getState());
      if (!(dt > 0)) continue;
      const chunk = run.chunks[1];
      const centre = safeCentre(chunk, run.s - chunk.index * 60, run.branch);
      let target = centre;
      if (mode === "crash") {
         const next = run.chunks.flatMap((c) => c.obstacles).find((o) => !o.used && o.s >= run.s - 1);
         if (next) target = next.d;
      } else if (mode === "reward") {
         const next = run.chunks.flatMap((c) => c.fish).find((f) => !f.used && f.s >= run.s && (!f.branch || !run.branch || f.branch === run.branch));
         if (next) target = next.d;
         const ramp = run.chunks.flatMap((c) => c.ramp ? [c.ramp] : []).find((r) => !r.used && r.s >= run.s && r.s - run.s < 20);
         if (ramp) target = ramp.d;
      }
      input.steer = mode === "spam" ? Math.sin(played * 11) : Math.max(-1, Math.min(1, (target - run.d) * 2));
      if (mode === "reward" && run.rampAir) {
         const yaw = run.airDuration >= 0.72 ? 360 : 0;
         input.steer = Math.max(-1, Math.min(1, (yaw - run.yaw) / (600 * Math.max(0.01, run.airDuration - run.air))));
      }
      input.jump = mode === "spam" && frames % 2 === 0;
      const before = run.s;
      stepRun(run, input, dt);
      played += dt;
      topSpeed = Math.max(topSpeed, run.speed);
      expect(run.s - before).toBeLessThanOrEqual(22 * dt + 1e-8);
      const state = store.getState();
      state.addScore(run.events.score);
      if (run.end) {
         state.setScore(runScore(run));
         state.end(run.end);
      }
   }
   const state = store.getState();
   expect(state.phase).toBe("over");
   expect(state.score).toBe(runScore(run));
   expect(withinServerLimits(state.score, state.elapsedMs, PROPOSED_LIMITS)).toBe(true);
   expect(capScore(state.score, state.elapsedMs, PROPOSED_LIMITS)).toBe(state.score);
   return { score: state.score, ms: state.elapsedMs, crashes: run.crashes, elapsed: run.elapsed, topSpeed, played };
}

describe("penguin-slide course", () => {
   it("is deterministic and validates 1,000 seeds through all six forms", () => {
      const forms = new Set<string>();
      for (let seed = 0; seed < 1000; seed++) {
         let entry = createRun(seed).chunks[1].exit;
         for (let index = 1; index <= 6; index++) {
            const a = generateChunk(seed, index, entry, 120);
            const b = generateChunk(seed, index, entry, 120);
            expect(JSON.stringify(a)).toBe(JSON.stringify(b));
            expect(validChunk(a)).toBe(true);
            expect(a.path.total).toBeCloseTo(60, 7);
            expect(a.fish.length).toBeLessThanOrEqual(12);
            expect(a.obstacles.length).toBe(5);
            expect(new Set([...a.fish, ...a.obstacles].map((v) => v.id)).size).toBe(a.fish.length + a.obstacles.length);
            forms.add(a.form);
            entry = a.exit;
         }
      }
      expect(forms.size).toBe(6);
   }, 120_000);

   it("keeps the first 60 m empty and only three chunks resident", () => {
      const r = createRun(4);
      expect(r.chunks[1].obstacles).toHaveLength(0);
      expect(r.chunks[1].fish).toHaveLength(0);
      frames(r, 180);
      expect(r.chunks).toHaveLength(3);
      expect(r.end).toBe("timeup");
   });

   it("rejects hazards on the reserved line, spacing and reward budget violations", () => {
      const c = generateChunk(7, 2, createRun(7).chunks[2].exit, 120);
      c.obstacles[0].d = safeCentre(c, c.obstacles[0].s - 120, c.obstacles[0].branch);
      expect(validChunk(c)).toBe(false);
      const a = generateChunk(7, 2, createRun(7).chunks[2].exit, 120);
      a.obstacles[1].s = a.obstacles[0].s + 11.9;
      expect(validChunk(a)).toBe(false);
      const b = generateChunk(7, 2, createRun(7).chunks[2].exit, 120);
      b.fish.push({ ...b.fish[0], id: "extra" });
      expect(validChunk(b)).toBe(false);
   }, 120_000);

   it("preserves boundary points and tangents; split graph branches are 60 m and merge", () => {
      for (let seed = 0; seed < 1000; seed++) {
         const a = createRun(seed).chunks[2];
         const b = generateChunk(seed, 2, a.exit, 120);
         const p = pointAt(a.path, 60), q = pointAt(b.path, 0);
         expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(1e-7);
         const ta = tangentAt(a.path, 60), tb = tangentAt(b.path, 0);
         expect(Math.hypot(ta.x - tb.x, ta.y - tb.y, ta.z - tb.z)).toBeLessThan(1e-7);
         if (b.branches) {
            expect(b.graph.next(0, 0)).toBe(1); expect(b.graph.next(0, 1)).toBe(2);
            expect(b.graph.next(1, 0)).toBe(3); expect(b.graph.next(2, 0)).toBe(3);
            expect(b.branches[0].total).toBeCloseTo(60, 7); expect(b.branches[1].total).toBeCloseTo(60, 7);
            expect(pointAt(b.branches[0], 60)).toEqual(pointAt(b.branches[1], 60));
         }
      }
   }, 120_000);

   it("tries 16 candidates then uses a valid straight fallback with unchanged budgets", () => {
      let attempts = 0;
      const entry = createRun(2).chunks[1].exit;
      const c = generateChunk(2, 1, entry, 120, 0, () => { attempts++; return false; });
      expect(attempts).toBe(16);
      expect(c.attempts).toBe(16);
      expect(c.fallback).toBe(true);
      expect(c.form).toBe("straight");
      expect(c.fish).toHaveLength(12);
      expect(c.obstacles).toHaveLength(5);
      expect(validChunk(c)).toBe(true);
   });

   it("tapers every width and split and keeps safe corridors reachable at 22 m/s", () => {
      for (let seed = 0; seed < 1000; seed++) {
         const c = generateChunk(seed, 2, createRun(seed).chunks[2].exit, 120);
         for (const branch of [-1, 1] as const) {
            let last = safeCentre(c, 0, branch);
            for (let s = 0.25; s <= 60; s += 0.25) {
               const d = safeCentre(c, s, branch);
               expect(Math.abs(d - last)).toBeLessThanOrEqual(4 * 0.25 / 22 + 1e-9);
               expect(Math.abs(d) + 0.35).toBeLessThanOrEqual(widthAt(c, s) + 1e-9);
               last = d;
            }
         }
      }
   }, 120_000);
});

describe("penguin-slide movement and air", () => {
   it("smooths held input, consumes short presses once and cancels opposing presses", () => {
      const a = createRun(1);
      stepRun(a, { ...idle, right: true }, 0.05);
      expect(a.steer).toBeCloseTo(0.2);
      stepRun(a, idle, 0.05);
      expect(a.steer).toBeCloseTo(0.4);
      stepRun(a, idle, 0.1);
      expect(a.steer).toBeCloseTo(0);
      const b = createRun(1);
      stepRun(b, { ...idle, left: true, right: true }, 0.05);
      expect(b.steer).toBe(0);
      stepRun(b, { ...idle, steer: -1, right: true }, 0.05);
      expect(b.steer).toBeCloseTo(-0.2);
   });

   it("caps speed, clamps banks and does not advance after end or with zero dt", () => {
      const r = createRun(2);
      r.speed = 22;
      frames(r, 2, { ...idle, steer: 1 });
      expect(r.speed).toBeLessThanOrEqual(22);
      expect(r.d).toBeLessThanOrEqual(3.15);
      const before = [r.s, r.remaining, r.elapsed];
      stepRun(r, idle, 0);
      expect([r.s, r.remaining, r.elapsed]).toEqual(before);
      r.end = "lose";
      stepRun(r, idle, 0.05);
      expect([r.s, r.remaining, r.elapsed]).toEqual(before);
   });

   it("manual hops last 0.6 s, cannot score tricks and have no queued jump", () => {
      const r = createRun(3);
      stepRun(r, { ...idle, jump: true }, 0.05);
      expect(r.air).toBeCloseTo(0.05);
      expect(airHeight(r)).toBeGreaterThan(0);
      frames(r, 0.55);
      expect(r.airDuration).toBe(0);
      expect(r.trickPoints).toBe(0);
   });

   it("grades net ramp rotation including the inclusive 30-degree window", () => {
      for (const yaw of [335, 360, 385, -335, -360]) expect(landingSpins(yaw)).toBe(1);
      for (const yaw of [690, 720, -720]) expect(landingSpins(yaw)).toBe(2);
      expect(landingSpins(30)).toBe(0);
      expect(landingSpins(30.001)).toBe(-1);
      expect(landingSpins(329.999)).toBe(-1);
      expect(landingSpins(0)).toBe(0);
   });

   it("crashes once per contact, loses 40% speed and freezes for one second", () => {
      const r = createRun(6);
      r.s = 60;
      r.d = 2;
      r.chunks[2].obstacles[0].s = 60;
      r.chunks[2].obstacles[0].d = 2;
      r.chunks[2].obstacles[0].kind = "ice";
      r.chunks[2].obstacles[0].branch = 0;
      stepRun(r, idle, 1 / 120);
      expect(r.crashes).toBe(1);
      expect(r.speed).toBeLessThan(4.81);
      const s = r.s;
      frames(r, 0.9);
      expect(r.s).toBe(s);
      expect(r.crashes).toBe(1);
   });

   it("sweeps hazards at 22 m/s and immediately ends the third crash", () => {
      const r = createRun(6);
      r.s = 60; r.d = 2; r.speed = 22; r.crashes = 2;
      const obstacle = r.chunks[2].obstacles[0];
      obstacle.s = 60.1; obstacle.d = 2; obstacle.kind = "ice"; obstacle.branch = 0;
      stepRun(r, idle, 0.05);
      expect(r.end).toBe("lose");
      expect(r.crashes).toBe(3);
      const s = r.s;
      frames(r, 1);
      expect(r.s).toBe(s);
   });

   it("touch assist launches the same hop; manual input wins ties", () => {
      for (const manual of [false, true]) {
         const r = createRun(6, true);
         r.s = 60; r.d = 2; r.speed = 22;
         const o = r.chunks[2].obstacles[0];
         o.s = 62.5; o.d = 2; o.kind = "crack"; o.radius = 0.6; o.branch = 0;
         stepRun(r, { ...idle, jump: manual }, 0.05);
         expect(r.events.hop).toBe(true);
         expect(r.airDuration).toBe(0.6);
         expect(r.crashes).toBe(0);
      }
   });

   it("launches each grounded ramp once, and never relaunches a manual hop", () => {
      const r = createRun(6);
      r.s = 60; r.d = 1.5;
      r.chunks[2].obstacles.length = 0;
      const ramp = { id: "r", s: 60.1, d: 1.5, used: false, branch: 0 as const };
      r.chunks[2].ramp = ramp;
      stepRun(r, idle, 0.05);
      expect(r.rampAir).toBe(true);
      expect(ramp.used).toBe(true);
      const t = r.airDuration;
      stepRun(r, { ...idle, jump: true }, 0.05);
      expect(r.airDuration).toBe(t);
      const manual = createRun(6);
      manual.s = 60; manual.d = 1.5; manual.chunks[2].obstacles.length = 0;
      manual.chunks[2].ramp = { ...ramp, used: false };
      stepRun(manual, { ...idle, jump: true }, 0.05);
      expect(manual.rampAir).toBe(false);
      expect(manual.airDuration).toBe(0.6);
   });
});

describe("penguin-slide scoring and clocks", () => {
   it("distance floors, fish are ten and spins fifty", () => {
      const r = createRun(1);
      r.s = 73.9; r.fishCollected = 4; r.trickPoints = 100;
      expect(runScore(r)).toBe(213);
   });

   it("picks fish once with height and radius checks", () => {
      const r = createRun(9);
      r.s = 60;
      const fish = r.chunks[2].fish[0];
      fish.s = 60; fish.d = 0; fish.branch = 0;
      stepRun(r, idle, 1 / 120);
      expect(r.fishCollected).toBe(1);
      frames(r, 0.05);
      expect(r.fishCollected).toBe(1);
      expect(fish.used).toBe(true);
   });

   it("awards one and two successful spins, but failed landings and manual hops award zero", () => {
      for (const [yaw, points] of [[335, 50], [720, 100], [31, 0]] as const) {
         const r = createRun(2);
         r.airDuration = 1; r.air = 0.995; r.rampAir = true; r.yaw = yaw;
         stepRun(r, idle, 0.01);
         expect(r.trickPoints).toBe(points);
         expect(r.crashes).toBe(yaw === 31 ? 1 : 0);
         expect(runScore(r)).toBe(Math.floor(r.s) + points);
      }
   });

   it("gates add eight seconds only once; misses award nothing", () => {
      for (const hit of [true, false]) {
         const r = createRun(2);
         r.s = 119.9; r.speed = 22; r.d = hit ? 0 : 3;
         stepRun(r, idle, 0.01);
         expect(r.gates).toBe(hit ? 1 : 0);
         expect(r.remaining).toBeCloseTo(30 - 0.01 + (hit ? 8 : 0), 6);
         expect(r.gateS).toBe(240);
         frames(r, 0.1);
         expect(r.gates).toBe(hit ? 1 : 0);
      }
   });

   it("expiry beats a gate at equal time; third crash and ceiling end immediately", () => {
      const r = createRun(10);
      r.s = 119.9; r.speed = 22; r.remaining = 0.1 / r.speed;
      stepRun(r, idle, 0.05);
      expect(r.end).toBe("timeup");
      expect(r.gates).toBe(0);
      const c = createRun(10);
      c.elapsed = 179.99; c.remaining = 100;
      stepRun(c, idle, 0.05);
      expect(c.elapsed).toBe(180);
      expect(c.end).toBe("timeup");
   });

   it("same seed and input timeline give identical recycled runs", () => {
      const a = createRun(44), b = createRun(44);
      for (let i = 0; i < 6000; i++) {
         const input = { ...idle, steer: Math.sin(i / 70), jump: i % 31 === 0 };
         stepRun(a, input, 1 / 60); stepRun(b, input, 1 / 60);
      }
      expect(runScore(a)).toBe(runScore(b));
      expect([a.s, a.d, a.crashes, a.end]).toEqual([b.s, b.d, b.crashes, b.end]);
      expect(JSON.stringify(a.chunks)).toBe(JSON.stringify(b.chunks));
   });
});

describe("penguin-slide real-store score proof", () => {
   it("safe corridor bots survive 180 s without assist on 500 seeds, including forced 22 m/s", () => {
      for (let seed = 0; seed < 500; seed++) {
         for (const forcedSpeed of [false, true]) {
            const r = simulate(seed, "safe", () => 0.05, forcedSpeed);
            expect(r.crashes).toBe(0);
            expect(r.elapsed).toBe(180);
         }
      }
   }, 240_000);

   it("legal bots satisfy proposed limits, and capScore is a no-op at every frame rate", () => {
      const rng = createRng(21);
      for (let seed = 0; seed < 200; seed++) {
         for (const mode of ["safe", "spam", "crash", "reward"] as const) {
            const raw = seed % 3 === 0 ? () => 1 / 60 : seed % 3 === 1 ? () => 0.05 : () => 0.004 + rng() * 0.296;
            const r = simulate(seed, mode, raw);
            expect(r.topSpeed).toBeLessThanOrEqual(22);
            expect(r.ms).toBeGreaterThanOrEqual(9000);
            expect(r.played * 1000).toBeCloseTo(r.ms, 6);
         }
      }
   }, 240_000);
});
