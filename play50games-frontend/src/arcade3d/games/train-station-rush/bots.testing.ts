// Test bots for Train Station Rush (vitest only: no runtime file imports this). They drive the real
// rules through createArcadeStore exactly like the canvas does (advanceRunClock + playedFrameDt).
//
// - oracle: full stick along the lane, Use on the first frame it would act;
// - honest: a human pace: 0.9 stick, stops at each point, reads the card (0.35-0.6 s), 0.2-0.45 s
//   before each Use, slows down for a passenger that falls behind, sidesteps when blocked;
// - idle: never touches anything;
// - spam: a random stick and Use on 30 % of frames.
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { StationLevel } from "./levels";
import { BOARD_REACH, CONCOURSE_DEPTH, LIVES, SPOTS, createRun, idleInput, islandX, padPoint, step, targetAt, type Run, type StationInput, type Target } from "./rules";

export type BotStyle = "oracle" | "honest" | "idle" | "spam";

const LANE_Z = CONCOURSE_DEPTH - 0.7;

interface Goal { x: number; z: number; target: Target }

function goalOf(run: Run): Goal | null {
   if (run.holding >= 0) {
      const task = run.tasks[run.holding];
      const pad = padPoint(run.level, task.platform);
      return { x: pad.x, z: pad.z, target: { kind: "pad", platform: task.platform } };
   }
   let best = -1;
   for (let i = 0; i < run.tasks.length; i++) {
      const t = run.tasks[i];
      if (t.state !== "open") continue;
      if (best < 0 || t.leaveAt < run.tasks[best].leaveAt) best = i;
   }
   if (best < 0) return null;
   const spot = (SPOTS[run.level.parallel] ?? SPOTS[1])[run.tasks[best].spot];
   return { x: spot.x, z: spot.z + 0.6, target: { kind: "spot", task: best } };
}

const sameTarget = (a: Target | null, b: Target) => !!a && a.kind === b.kind && (a.kind === "spot" ? b.kind === "spot" && a.task === b.task : b.kind === "pad" && a.platform === b.platform);

/** The island (pair) under x on the platforms, else -1. */
function islandOf(run: Run, x: number): number {
   for (let k = 0; k < run.level.platforms / 2; k++) {
      const [x0, x1] = islandX(run.level, k);
      if (x >= x0 && x <= x1) return k;
   }
   return -1;
}

/**
 * The next point on the way. Between the concourse and an island the straight line to the goal is
 * kept, its crossing of the platform edge clamped into that island's gate (so it never cuts a track
 * bed); between two islands it goes up to the edge first.
 */
function waypoint(run: Run, goal: Goal): { x: number; z: number } {
   const h = run.hero;
   const edge = CONCOURSE_DEPTH;
   const onPlatforms = h.z > edge - 0.05;
   const goalOnPlatforms = goal.z > edge;
   const gate = (pair: number, x: number) => {
      const [x0, x1] = islandX(run.level, pair);
      return Math.min(x1 - 0.55, Math.max(x0 + 0.55, x));
   };
   const cross = (fromX: number, fromZ: number, toX: number, toZ: number) => fromX + ((toX - fromX) * (edge - fromZ)) / (toZ - fromZ || 1e-9);
   if (onPlatforms && goalOnPlatforms) {
      const here = islandOf(run, h.x);
      if (here === islandOf(run, goal.x)) return goal;
      return { x: gate(here, h.x), z: edge - 0.5 };
   }
   if (!onPlatforms && goalOnPlatforms) {
      const x = gate(islandOf(run, goal.x), cross(h.x, h.z, goal.x, goal.z));
      if (Math.abs(h.x - x) < 0.25 || h.z > edge - 0.6) return h.z > edge - 0.6 && Math.abs(h.x - x) < 0.25 ? goal : { x, z: edge + 0.3 };
      return { x, z: edge + 0.3 };
   }
   if (onPlatforms && !goalOnPlatforms) {
      const here = islandOf(run, h.x);
      const x = gate(here < 0 ? islandOf(run, goal.x) : here, cross(h.x, h.z, goal.x, goal.z));
      return Math.abs(h.x - x) < 0.25 && h.z < edge + 0.4 ? goal : { x, z: edge - 0.4 };
   }
   return goal;
}

interface Memory { wait: number; pause: number; lastHolding: number; still: number; side: number; dodge: number }

export function drive(run: Run, input: StationInput, dt: number, style: BotStyle, rng: () => number, mem: Memory): void {
   input.moveX = 0;
   input.moveY = 0;
   input.actionPressed = false;
   input.yaw = 0;
   if (style === "idle" || run.over) return;
   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      input.actionPressed = rng() < 0.3;
      return;
   }
   const goal = goalOf(run);
   if (!goal) return;
   const h = run.hero;
   if (style === "honest") {
      if (run.holding !== mem.lastHolding) {
         mem.pause = run.holding >= 0 ? 0.35 + rng() * 0.25 : 0.15 + rng() * 0.15;
         mem.lastHolding = run.holding;
      }
      if (mem.pause > 0) {
         mem.pause -= dt;
         return;
      }
   }
   const holdingTask = run.holding >= 0 ? run.tasks[run.holding] : null;
   const leading = holdingTask?.kind === "passenger";
   const followerReady = !leading || Math.hypot(run.follower.x - goal.x, run.follower.z - goal.z) <= BOARD_REACH - 0.15;
   const reach = sameTarget(targetAt(run, h.x, h.z), goal.target);
   const trainReady = !holdingTask || (run.time >= holdingTask.arriveAt && run.time < holdingTask.leaveAt);
   if (style === "oracle" && reach && followerReady && trainReady) {
      input.actionPressed = true;
      return;
   }
   const point = waypoint(run, goal);
   const dx = point.x - h.x;
   const dz = point.z - h.z;
   const d = Math.hypot(dx, dz);
   if (reach && Math.hypot(goal.x - h.x, goal.z - h.z) < 0.4) {
      if (style === "honest" && followerReady && trainReady) {
         mem.wait += dt;
         if (mem.wait >= 0.2 + (run.seed % 5) * 0.06) {
            input.actionPressed = true;
            mem.wait = 0;
         }
      }
      return;
   }
   mem.wait = 0;
   let stick = style === "honest" ? 0.9 : 1;
   // a passenger lagging far behind: wait for them
   if (leading && Math.hypot(run.follower.x - h.x, run.follower.z - h.z) > 3) stick = style === "honest" ? 0.3 : 0.5;
   const slow = style === "honest" ? Math.max(0.3, Math.min(1, d / 0.6)) : 1;
   let mx = (dx / (d || 1)) * stick * slow;
   let mz = (dz / (d || 1)) * stick * slow;
   // blocked by a traveller: step aside for a moment
   const speed = Math.hypot(h.vx, h.vz);
   if (speed < 0.3 && d > 0.5) mem.still += dt;
   else mem.still = 0;
   if (mem.still > 0.4) {
      mem.dodge = 0.35;
      mem.side = rng() < 0.5 ? -1 : 1;
      mem.still = 0;
   }
   if (mem.dodge > 0) {
      mem.dodge -= dt;
      const px = -mz * mem.side;
      const pz = mx * mem.side;
      mx = px;
      mz = pz;
   }
   // yaw 0: world (dx, dz) = (moveX, moveY)
   input.moveX = mx;
   input.moveY = mz;
}

export interface BotResult { run: Run; score: number; ms: number; reason: string | null; won: boolean }

export function playBot(level: StationLevel, seed: number, hz: number, style: BotStyle): BotResult {
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: LIVES, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();
   const input = idleInput();
   const mem: Memory = { wait: 0, pause: 0, lastHolding: -1, still: 0, side: 1, dodge: 0 };
   const rng = createRng((seed + 1) * 7919 + hz * 31 + (style === "spam" ? 5 : 0));
   const cap = Math.ceil((level.durationMs / 1000 + 5) * hz);
   for (let i = 0; i < cap; i++) {
      advanceRunClock(store, 1 / hz);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;
      drive(run, input, dt, style, rng, mem);
      const before = run.score;
      const ev = step(run, input, dt, state.timeLeftMs ?? 0);
      if (run.score !== before + ev.score) throw new Error("score delta");
      if (ev.score) state.addScore(ev.score);
      if (ev.lifeLost) state.loseLife();
      if (ev.won) state.end("win");
      if (ev.lost && store.getState().phase !== "over") state.end("lose");
      if (run.over) break;
   }
   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over, won: final.endReason === "win" };
}
