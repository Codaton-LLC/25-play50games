// Test-only bots (never imported by runtime code). They drive the real rules through a fresh store
// exactly like the canvas (core/testing/botHarness simulateRun), with the Scene's store calls.
import { createRng } from "../../../core/math";
import { fixedFrames, randomFrames, simulateRun } from "../../../core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "../../../core/useArcadeStore";
import type { LevelId } from "../../../types";
import { LEVELS } from "../levels";
import { VEHICLE, createRun, stepRun, target, type Controls, type Point, type Run } from "../rules";

export type BotKind = "oracle" | "greedy" | "idle" | "spam" | "wetRetry";
export type Frames = 30 | 60 | 144 | "random";

export interface BotResult { run: Run; store: ArcadeStore; score: number; elapsedMs: number; endReason: ArcadeStore["endReason"]; }

/** Street route: along the current street to the corner, then along the goal's street (both are grid lines). */
function route(from: Point, goal: Point): Point[] {
   if (Math.abs(from.x - goal.x) < 0.5 || Math.abs(from.z - goal.z) < 0.5) return [goal];
   return [{ x: goal.x, z: from.z }, goal];
}

function makeDriver(run: Run, kind: BotKind, seed: number): (dt: number) => Controls {
   const input: Controls = { moveX: 0, moveY: 0, jumpPressed: false };
   if (kind === "idle") return () => input;
   if (kind === "spam") {
      const rng = createRng(seed ^ 0xbeef);
      return () => { input.moveX = rng() * 2 - 1; input.moveY = rng() * 2 - 1; input.jumpPressed = rng() < 0.2; return input; };
   }
   const oracle = kind === "oracle";
   const corner = oracle ? 7 : 3.2, brake = oracle ? 15.5 : 11, top = oracle ? VEHICLE.topSpeed : 9;
   let path: Point[] = [], key = "", still = 0, backUp = 0, prev: Point = { x: run.player.x, z: run.player.z };
   return (dt: number) => {
      const p = run.player;
      let goal = target(run);
      // wetRetry: carry the first order into a wet patch and wait there until it spoils, then deliver it again
      const detour = kind === "wetRetry" && run.carrying && run.delivered === 0 && run.misses === 0 && run.wet.length > 0;
      if (detour) goal = { x: run.wet[0].x, z: run.wet[0].z };
      const k = `${run.carrying}:${run.delivered}:${detour}:${run.misses}`;
      if (k !== key) { key = k; prev = { x: p.x, z: p.z }; path = route(prev, goal); }
      while (path.length > 1 && Math.hypot(path[0].x - p.x, path[0].z - p.z) < (oracle ? Math.max(0.6, Math.abs(p.speed) / VEHICLE.steer) : 0.6)) { prev = path.shift()!; }
      const wp = path[0];
      const d = Math.hypot(wp.x - p.x, wp.z - p.z);
      // pure pursuit on the street's centre line: aim 3 m ahead on the segment, not at the far corner
      let ax = wp.x, az = wp.z;
      if (d > 3) {
         if (Math.abs(wp.z - prev.z) < 0.5) { ax = p.x + Math.sign(wp.x - p.x) * 3; az = wp.z; }
         else if (Math.abs(wp.x - prev.x) < 0.5) { az = p.z + Math.sign(wp.z - p.z) * 3; ax = wp.x; }
      }
      const head = Math.atan2(ax - p.x, az - p.z);
      const err = Math.atan2(Math.sin(head - p.yaw), Math.cos(head - p.yaw));
      const last = path.length === 1;
      const endSpeed = last ? 0 : corner;
      // a wet detour parks in the middle of the patch
      let want = d < (last ? 0.25 : 0.4) ? endSpeed : Math.min(top, Math.sqrt(endSpeed * endSpeed + 2 * brake * Math.max(0, d - (last ? 0.2 : 0.4))));
      if (Math.abs(err) > 0.5) want = Math.min(want, oracle ? 5 : 2);
      if (detour && d < 0.6) want = 0;
      // stick right lowers the yaw (rules.ts substep)
      input.moveX = -Math.max(-1, Math.min(1, err * 3));
      input.moveY = p.speed > want + 0.15 ? 1 : p.speed < want - 0.15 ? -1 : 0;
      // creep while turning on the spot: the scooter turns only when it rolls
      if (Math.abs(err) > 0.3 && Math.abs(p.speed) < 0.6 && !last) input.moveY = -0.6;
      if (last && d < 0.6 && Math.abs(p.speed) < 0.3) input.moveY = 0;
      // wedged on a wall or a car: back off for a moment
      still = Math.abs(p.speed) < 0.2 && d > 1 && !(detour && d < 0.6) ? still + dt : 0;
      if (still > 0.6) { backUp = 0.7; still = 0; }
      if (backUp > 0) { backUp -= dt; input.moveY = 1; input.moveX = -input.moveX; }
      return input;
   };
}

const frameOf = (f: Frames, seed: number) => (f === "random" ? randomFrames(seed) : fixedFrames(1000 / f));

/** One run through a fresh store, with the Scene's store calls (score on change, a life per miss, end). */
export function playBot(id: LevelId, seed: number, kind: BotKind, frames: Frames = 60): BotResult {
   const config = LEVELS[id];
   const run = createRun(seed, id);
   const drive = makeDriver(run, kind, seed);
   let synced = -1;
   const end = simulateRun(createArcadeStore(), {
      durationMs: config.durationMs,
      lives: 3,
      resultDelayMs: 900,
      frame: frameOf(frames, seed),
      step: (dt, _t, store) => {
         const misses = run.misses;
         stepRun(run, drive(dt), dt);
         const s = store.getState();
         if (synced !== run.score) s.setScore((synced = run.score));
         for (let i = misses; i < run.misses; i++) store.getState().loseLife();
         if (run.end) store.getState().end(run.end);
      },
   });
   return { run, store: end, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason };
}

/**
 * The same bot on the rules alone (no store): the clear-rate sweeps use it. Equivalent to playBot's run
 * (the fixed 1/120 s integrator does not depend on the frame split; tests pin that), only faster.
 */
export function playRules(id: LevelId, seed: number, kind: BotKind, hz = 60): Run {
   const run = createRun(seed, id);
   const drive = makeDriver(run, kind, seed);
   const dt = 1 / hz;
   const frames = Math.ceil((LEVELS[id].durationMs / 1000) * hz) + 2;
   for (let f = 0; f < frames && !run.end; f++) stepRun(run, drive(dt), dt);
   return run;
}
