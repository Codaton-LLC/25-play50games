// Test-only bots for Beach Lifeguard (never imported by runtime code). They drive the real rules and the
// Scene's store calls (step + syncStore) through a fresh store, like the canvas (botHarness simulateRun).
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import {
   GRAB_RANGE,
   JET_SKI_SPEED,
   LIVES,
   RADIUS,
   SAFE_SAND_Z,
   SAND_DEPTH,
   SPEED_SAND,
   SPEED_WATER,
   createRun,
   step,
   syncStore,
   type BeachInput,
   type Run,
} from "../rules";

export type BotKind = "oracle" | "greedy" | "idle" | "spam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   end: ArcadeStore;
   run: Run;
}

/** Walkable nodes on the beach with a margin round the solids (the tower and the props). */
function beachGrid(run: Run, margin: number) {
   const halfW = run.level.width / 2;
   const midZ = (SAND_DEPTH - run.level.water) / 2;
   const halfZ = (SAND_DEPTH + run.level.water) / 2;
   // the harness grid is centred on 0: shift z by midZ in and out
   const grid = createGrid({ cell: 0.5, halfX: halfW - RADIUS, halfZ: halfZ - RADIUS });
   const free = freeGrid(grid, (x, zc) => {
      const z = zc + midZ;
      for (const b of run.solids) {
         if (x > b.min.x - RADIUS - margin && x < b.max.x + RADIUS + margin && z > b.min.z - RADIUS - margin && z < b.max.z + RADIUS + margin) return false;
      }
      return true;
   });
   return { grid, free, midZ };
}

function makeDriver(run: Run, kind: BotKind, seed: number): (input: BeachInput, dt: number) => void {
   if (kind === "idle") return (input) => {
      input.moveX = input.moveY = 0;
      input.actionPressed = false;
   };
   if (kind === "spam") {
      const rng = createRng(seed ^ 0x51ab);
      return (input) => {
         input.moveX = rng() * 2 - 1;
         input.moveY = rng() * 2 - 1;
         input.actionPressed = rng() < 0.4;
      };
   }
   const oracle = kind === "oracle";
   const { grid, free, midZ } = beachGrid(run, oracle ? 0.05 : 0.25);
   const dir = { dirX: 0, dirZ: 0 };
   let follower: PathFollower | null = null;
   let goalKey = "";
   let useSki = false;
   const go = (input: BeachInput, gx: number, gz: number, _dt: number) => {
      const hero = run.hero;
      const key = run.carrying ? `carry` : `${gx.toFixed(2)},${gz.toFixed(2)}`;
      // the solids never move: one path per goal (the carry goal follows the hero's x, so only its z counts)
      if (key !== goalKey || !follower) {
         goalKey = key;
         follower = followPath(grid, free, hero.x, hero.z - midZ, gx, gz - midZ);
      }
      // off the sand nothing blocks: head straight for the goal
      if (hero.z <= 0.5 && gz <= 0.5) {
         dir.dirX = gx - hero.x;
         dir.dirZ = gz - hero.z;
         const l = Math.hypot(dir.dirX, dir.dirZ) || 1;
         dir.dirX /= l;
         dir.dirZ /= l;
      } else {
         steer(grid, follower, hero.x, hero.z - midZ, dir, 0.4);
      }
      const d = Math.hypot(gx - hero.x, gz - hero.z);
      // ease in on the last metre (a full stick overshoots a 1.2 m grab by at most one frame)
      const k = d < 0.4 ? Math.max(0.2, d / 0.4) : 1;
      input.moveX = dir.dirX * k;
      input.moveY = dir.dirZ * k;
   };
   return (input, dt) => {
      const hero = run.hero;
      input.actionPressed = false;
      input.moveX = input.moveY = 0;
      const s = run.swimmers[run.activeSwimmer];
      if (!s) return;
      if (run.carrying) {
         // straight up the beach (the return lane is clear of props by construction)
         go(input, hero.x, SAFE_SAND_Z + 0.4, dt);
         return;
      }
      const near = Math.hypot(hero.x - s.x, hero.z - s.z);
      if (near <= GRAB_RANGE - 0.05) {
         input.actionPressed = true;
         return;
      }
      // the oracle on jet-ski levels: ride when the ride beats the swim (estimated from the speeds)
      if (oracle && run.level.jetSki && !run.onJetSki && hero.z >= 0) {
         const swim = Math.abs(hero.x - s.x) / SPEED_SAND + Math.max(0, hero.z) / SPEED_SAND + (-s.z - GRAB_RANGE) / SPEED_WATER;
         const ski = Math.hypot(hero.x - run.jetSki.x, Math.max(0, hero.z)) / SPEED_SAND + 2 / SPEED_WATER + Math.hypot(s.x - run.jetSki.x, s.z - run.jetSki.z) / JET_SKI_SPEED;
         useSki = ski < swim;
      }
      if (useSki && !run.onJetSki) {
         if (Math.hypot(hero.x - run.jetSki.x, hero.z - run.jetSki.z) <= 1.0) {
            input.actionPressed = true;
            return;
         }
         go(input, run.jetSki.x, run.jetSki.z, dt);
         return;
      }
      if (run.onJetSki) {
         go(input, s.x, s.z + 0.6, dt);
         return;
      }
      // on foot, the straight line (it beat running the sand first on every level): the oracle stops at
      // the edge of the grab, the greedy bot walks up to the swimmer
      go(input, s.x, s.z + (oracle ? GRAB_RANGE - 0.1 : 0.6), dt);
   };
}

const frameOf = (frames: FrameKind, seed: number) => (frames === "random" ? randomFrames(seed) : fixedFrames(1000 / frames));

/** One run of `kind` on level `id`: the rules + the Scene's store calls through a fresh store. */
export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const run = createRun(seed, level, id);
   const drive = makeDriver(run, kind, seed);
   const input: BeachInput = { moveX: 0, moveY: 0, actionPressed: false, yaw: 0 };
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      lives: LIVES,
      resultDelayMs: 900,
      frame: frameOf(frames, seed),
      step: (dt, _time, store) => {
         drive(input, dt);
         const ev = step(run, input, dt, store.getState().timeLeftMs ?? 0);
         syncStore(run, ev, store);
      },
   });
   return { end, run };
}

export interface PureResult {
   run: Run;
   endReason: "win" | "lose" | "timeup";
   elapsedMs: number;
   score: number;
}

/**
 * The same run without the store: the rules plus the shell clock's arithmetic (elapsed += dt, the
 * time-left bonus from D - elapsed, timeup at D). Equal to playBot on the same seed and frames (tested),
 * and ten times faster, so the 200-seed sweeps use it.
 */
export function playPure(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): PureResult {
   const level = LEVELS[id];
   const run = createRun(seed, level, id);
   const drive = makeDriver(run, kind, seed);
   const frame = frameOf(frames, seed);
   const input: BeachInput = { moveX: 0, moveY: 0, actionPressed: false, yaw: 0 };
   let elapsedMs = 0;
   for (;;) {
      const dt = Math.min(frame(), 0.05);
      const dtMs = Math.min(dt * 1000, level.durationMs - elapsedMs);
      elapsedMs += dtMs;
      if (elapsedMs >= level.durationMs) return { run, endReason: "timeup", elapsedMs: level.durationMs, score: run.score };
      drive(input, dtMs / 1000);
      step(run, input, dtMs / 1000, level.durationMs - elapsedMs);
      if (run.over) return { run, endReason: run.over, elapsedMs, score: run.score };
   }
}
