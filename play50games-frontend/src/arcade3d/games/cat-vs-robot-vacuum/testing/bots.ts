// Test-only bots for Cat vs Robot Vacuum (never imported by runtime code). They drive the real rules
// and the real store exactly like the canvas (core/testing/botHarness simulateRun).
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { HALL_HALF, LIVES, RADIUS, VAC_R, createRun, step, syncStore, type CatInput, type Run } from "../rules";

export type BotKind = "oracle" | "greedy" | "idle" | "spam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   store: ArcadeStore;
   run: Run;
   score: number;
   elapsedMs: number;
   endReason: ArcadeStore["endReason"];
}

/** Grid points the cat's centre can stand on (inside the walls, clear of every box by its radius + margin). */
export function catGrid(run: Run, margin: number) {
   const half = HALL_HALF - RADIUS;
   const grid = createGrid({ cell: 0.2, halfX: half, halfZ: run.length });
   const free = freeGrid(grid, (x, z) => {
      if (z < RADIUS || z > run.length - RADIUS) return false;
      const m = RADIUS + margin;
      for (const b of run.blockers) if (x > b.min.x - m && x < b.max.x + m && z > b.min.z - m && z < b.max.z + m) return false;
      return true;
   });
   return { grid, free };
}

function makeDriver(run: Run, kind: BotKind, seed: number): (dt: number) => CatInput {
   const input: CatInput = { moveX: 0, moveY: 0, jumpPressed: false, yaw: 0 };
   if (kind === "idle") return () => input;
   if (kind === "spam") {
      const rng = createRng(seed ^ 0x5eed);
      return () => {
         input.moveX = rng() * 2 - 1;
         input.moveY = rng() * 2 - 1;
         input.jumpPressed = rng() < 0.15;
         return input;
      };
   }
   const oracle = kind === "oracle";
   const { grid, free: base } = catGrid(run, oracle ? 0.05 : 0.12);
   const free = new Uint8Array(base.length);
   const dir = { dirX: 0, dirZ: 0 };
   let follower: PathFollower | null = null;
   let key = "";
   let replanIn = 0;
   let fleeIn = 0;
   const flee = { x: 0, z: 0 };
   // a careful player keeps clear of every vacuum (wider for a chaser) and plans round them
   const keep = oracle ? 0.35 : 0.6;
   const stamp = () => {
      free.set(base);
      for (const v of run.vacuums) {
         const r = RADIUS + VAC_R + keep + (v.mode === "chase" ? 0.4 : 0);
         // where it is and where it will be in 0.3 s
         for (const t of [0, 0.3]) {
            const cx = v.agent.x + v.agent.vx * t;
            const cz = v.agent.z + v.agent.vz * t;
            for (let n = 0; n < grid.size; n++) if (free[n] && Math.hypot(grid.x(n) - cx, grid.z(n) - cz) < r) free[n] = 0;
         }
      }
   };
   return (dt: number) => {
      input.jumpPressed = false;
      const cat = run.cat;
      let gx = run.homeSpot.x;
      let gz = run.home.z;
      let k = "home";
      let best = Infinity;
      for (let i = 0; i < run.treats.length; i++) {
         const t = run.treats[i];
         if (t.got) continue;
         const d = Math.hypot(t.x - cat.x, t.z - cat.z) + (oracle ? 0.25 * Math.abs(t.z - cat.z) : 0);
         if (d < best) {
            best = d;
            gx = t.x;
            gz = t.z;
            k = `t${i}`;
         }
      }
      replanIn -= dt;
      if (k !== key || !follower || replanIn <= 0) {
         key = k;
         replanIn = 0.2;
         stamp();
         follower = followPath(grid, free, cat.x, cat.z, gx, gz);
         if (follower.path.length === 0) follower = followPath(grid, base, cat.x, cat.z, gx, gz);
      }
      steer(grid, follower, cat.x, cat.z, dir, 0.3);
      const pace = oracle ? 1 : 0.92;
      input.moveX = dir.dirX * pace;
      input.moveY = dir.dirZ * pace;
      // close to a vacuum: hop through a head-on one, otherwise pick the escape direction (16 tries)
      // that keeps every vacuum furthest away in 0.35 s, on free floor, nearest the planned way
      // a chaser within 2.2 m (oracle 1.2) or any vacuum within 0.8 m (oracle 0.5): get away
      let danger = false;
      for (const v of run.vacuums) {
         if (v.mode === "return") continue;
         const gap = Math.hypot(cat.x - v.agent.x, cat.z - v.agent.z) - (RADIUS + VAC_R);
         if (gap < (v.mode === "chase" ? (oracle ? 1.2 : 2.2) : oracle ? 0.5 : 0.8)) danger = true;
      }
      if (cat.mercy <= 0 && danger) {
         for (const v of run.vacuums) {
            const dx = cat.x - v.agent.x;
            const dz = cat.z - v.agent.z;
            const d = Math.hypot(dx, dz) || 1;
            const closing = (v.agent.vx * dx + v.agent.vz * dz) / d - (cat.vx * dx + cat.vz * dz) / d;
            const gap = d - (RADIUS + VAC_R);
            if (cat.cool <= 0 && cat.hop <= 0 && (gap < 0.12 || (gap < 0.3 && closing > 2.5))) input.jumpPressed = true;
         }
         fleeIn -= dt;
         if (fleeIn <= 0) {
            fleeIn = 0.1;
            let bestScore = -Infinity;
            let bx = input.moveX;
            let bz = input.moveY;
            for (let i = 0; i < 16; i++) {
               const ang = (i / 16) * Math.PI * 2;
               const cx = Math.sin(ang);
               const cz = Math.cos(ang);
               // play it forward 0.6 s: the cat runs this way, a chaser homes on it, the rest keep going
               let clear = Infinity;
               let blocked = false;
               for (let k = 1; k <= 6 && !blocked; k++) {
                  const t = k * 0.1;
                  const px = cat.x + cx * 4.2 * t;
                  const pz = cat.z + cz * 4.2 * t;
                  const node = grid.node(px, pz);
                  if (node < 0 || node >= grid.size || !base[node]) {
                     blocked = k <= 2;
                     break;
                  }
                  for (const v of run.vacuums) {
                     let vx = v.agent.x + v.agent.vx * t;
                     let vz = v.agent.z + v.agent.vz * t;
                     if (v.mode === "chase") {
                        const dx = px - v.agent.x;
                        const dz = pz - v.agent.z;
                        const d = Math.hypot(dx, dz) || 1;
                        const step = Math.min(d, run.level.chaseSpeed * t);
                        vx = v.agent.x + (dx / d) * step;
                        vz = v.agent.z + (dz / d) * step;
                     }
                     if (v.mode !== "return") clear = Math.min(clear, Math.hypot(px - vx, pz - vz));
                  }
               }
               if (blocked) continue;
               const far = grid.node(cat.x + cx * 2.5, cat.z + cz * 2.5);
               const room = far >= 0 && far < grid.size && base[far] ? 0.4 : 0;
               const score = Math.min(clear, 3) + room + 0.15 * (cx * dir.dirX + cz * dir.dirZ);
               if (score > bestScore) {
                  bestScore = score;
                  bx = cx;
                  bz = cz;
               }
            }
            flee.x = bx;
            flee.z = bz;
         }
         input.moveX = flee.x;
         input.moveY = flee.z;
      } else {
         fleeIn = 0;
      }
      return input;
   };
}

const frameOf = (frames: FrameKind, seed: number) => (frames === "random" ? randomFrames(seed) : fixedFrames(1000 / frames));

/** One run of `kind` on level `id` through the store (lives, clock and win all the shell's). */
export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const store = createArcadeStore();
   const run = createRun(seed, level);
   const drive = makeDriver(run, kind, seed);
   const end = simulateRun(store, {
      durationMs: level.durationMs,
      lives: LIVES,
      resultDelayMs: 900,
      frame: frameOf(frames, seed),
      step: (dt, _time, s) => {
         const ev = step(run, drive(dt), dt, s.getState().timeLeftMs ?? 0);
         syncStore(run, ev, s);
      },
   });
   return { store: end, run, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason };
}
