// Test-only bots for Dog Park Fetch (never imported by runtime code). They play through the real
// rules and a fresh store exactly like the canvas (core/testing/botHarness simulateRun + rules.frame).
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { CATCH_H, DOG_R, FRISBEE_WINDOW_S, MOWER_R, createRun, frame, heightOf, idleInput, toyXZ, type DogInput, type Run } from "../rules";

export type BotKind = "oracle" | "honest" | "idle" | "spam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   run: Run;
   score: number;
   elapsedMs: number;
   endReason: ArcadeStore["endReason"];
}

const XZ = { x: 0, z: 0 };

function walkable(run: Run, x: number, z: number, margin: number): boolean {
   if (Math.abs(x) > run.level.width / 2 - DOG_R || Math.abs(z) > run.level.depth / 2 - DOG_R) return false;
   for (const p of run.props) if (Math.hypot(x - p.x, z - p.z) < p.r + DOG_R + margin) return false;
   return true;
}

function makeDriver(run: Run, kind: BotKind, seed: number): (dt: number) => DogInput {
   const input = idleInput();
   if (kind === "idle") return () => input;
   if (kind === "spam") {
      const rng = createRng(seed ^ 0xd06);
      return () => {
         input.moveX = rng() * 2 - 1;
         input.moveY = rng() * 2 - 1;
         input.jumpPressed = rng() < 0.15;
         return input;
      };
   }
   const oracle = kind === "oracle";
   const grid = createGrid({ cell: 0.25, halfX: run.level.width / 2, halfZ: run.level.depth / 2 });
   const free = freeGrid(grid, (x, z) => walkable(run, x, z, oracle ? 0.05 : 0.15));
   const dir = { dirX: 0, dirZ: 0 };
   let follower: PathFollower | null = null;
   let key = "";
   let replan = 0;
   return (dt: number) => {
      input.jumpPressed = false;
      input.yaw = 0;
      const th = run.active;
      const dog = run.dog;
      let gx = run.blanket.x;
      let gz = run.blanket.z;
      let k = "wait";
      if (th && th.state === "carried") k = "home";
      else if (th) {
         // The oracle runs to where the throw will land the moment it leaves the owner's hand
         // (a player reads the arc); the honest bot follows the toy's shadow.
         if (oracle) {
            gx = th.lx;
            gz = th.lz;
         } else {
            toyXZ(th, XZ);
            gx = XZ.x;
            gz = XZ.z;
         }
         k = `toy${th.index}:${th.state}`;
         if (th.state === "flying" && th.kind === "frisbee" && th.t >= th.flight - FRISBEE_WINDOW_S) {
            // Meet the frisbee: the oracle waits on its landing spot, the honest bot heads for its
            // shadow; both leap once it is close and low.
            toyXZ(th, XZ);
            if (!oracle) {
               gx = XZ.x;
               gz = XZ.z;
            }
            const close = Math.hypot(XZ.x - dog.x, XZ.z - dog.z);
            if (dog.leap <= 0 && heightOf(th) < CATCH_H + (oracle ? 0.15 : 0) && close < (oracle ? 0.9 : 0.7)) input.jumpPressed = true;
         }
      }
      replan -= dt;
      if (k !== key || !follower || replan <= 0) {
         key = k;
         replan = 0.3;
         follower = followPath(grid, free, dog.x, dog.z, gx, gz);
      }
      steer(grid, follower, dog.x, dog.z, dir, 0.35);
      let mx = dir.dirX;
      let mz = dir.dirZ;
      // Keep clear of a mower: push away inside 2.2 m (the honest bot also slows near it).
      for (const m of run.mowers) {
         const dx = dog.x - m.agent.x;
         const dz = dog.z - m.agent.z;
         const d = Math.hypot(dx, dz);
         const keep = MOWER_R + DOG_R + (oracle ? 0.9 : 1.4);
         if (d < keep && d > 1e-6) {
            const w = (keep - d) / keep;
            mx += (dx / d) * w * 2.5;
            mz += (dz / d) * w * 2.5;
         }
      }
      const len = Math.hypot(mx, mz);
      const speed = oracle ? 1 : 0.9;
      // inputToWorld at yaw 0: world +x = moveX, world +z = moveY (the stick's down)
      input.moveX = len > 1e-9 ? (mx / len) * speed : 0;
      input.moveY = len > 1e-9 ? (mz / len) * speed : 0;
      return input;
   };
}

const framesOf = (f: FrameKind, seed: number) => (f === "random" ? randomFrames(seed) : fixedFrames(1000 / f));

export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const drive = makeDriver(run, kind, seed);
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      resultDelayMs: 900,
      frame: framesOf(frames, seed),
      step: (dt, _t, store) => {
         frame(run, drive(dt), dt, store);
      },
   });
   return { run, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason };
}
