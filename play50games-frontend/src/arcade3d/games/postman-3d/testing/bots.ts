// Test-only bots for Postman 3D (never imported by runtime code). They drive the real rules through a
// fresh store exactly like the canvas (core/testing/botHarness simulateRun): world-direction input at
// yaw 0 (the scene's camera yaw), one Deliver press per arrival.
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { CAR_HX, DOG_LEASH, HOUSE_GAP, ZEBRA_X, DOG_RADIUS, OFFICE, RADIUS, REACH, ROAD_HALF, STREET_GAP, createRun, nextItem, solid, step, syncStore, targetFor, type PostInput, type Run } from "../rules";

export type BotKind = "oracle" | "greedy" | "idle" | "spam" | "deliverSpam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   run: Run;
   store: ArcadeStore;
   score: number;
   elapsedMs: number;
   endReason: ArcadeStore["endReason"];
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
   const dx = bx - ax;
   const dz = bz - az;
   const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
   return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

const onRoad = (run: Run, z: number) => {
   for (let s = 0; s < run.level.streets; s++) if (Math.abs(z - s * STREET_GAP) < ROAD_HALF + RADIUS) return s;
   return -1;
};

/** Grid nodes the postman can walk with a margin (solids, the dogs' leash reach). */
export function walkGrid(run: Run, margin: number, crossings = true) {
   const b = run.bounds;
   const grid = createGrid({ cell: 0.75, halfX: (b.max.x - b.min.x) / 2 - RADIUS, halfZ: (b.max.z - b.min.z) / 2 - RADIUS });
   const cx = (b.max.x + b.min.x) / 2;
   const cz = (b.max.z + b.min.z) / 2;
   const free = freeGrid(grid, (gx, gz) => {
      const x = gx + cx;
      const z = gz + cz;
      if (solid(run, x, z)) return false;
      for (let d = -1; d <= 1; d += 2) for (let e = -1; e <= 1; e += 2) if (solid(run, x + d * margin, z + e * margin)) return false;
      // roads: cross only straight over, at the zebra or in line with an alley between houses
      if (crossings && onRoad(run, z) >= 0) {
         const alley = x > 0 && x < run.bounds.max.x && Math.abs((((x - HOUSE_GAP / 2) % HOUSE_GAP) + HOUSE_GAP) % HOUSE_GAP) < 0.8;
         if (!(Math.abs(x - ZEBRA_X) < 1.0 || alley)) return false;
      }
      for (const dog of run.dogs) if (segDist(x, z, dog.homeX, dog.homeZ, dog.homeX, dog.homeZ - dog.side * DOG_LEASH) < RADIUS + DOG_RADIUS + margin) return false;
      return true;
   });
   return { grid, free, cx, cz };
}

/** Is it safe to be on street `s`'s road at x for the next couple of seconds? */
function roadClear(run: Run, s: number, x: number, ahead: number): boolean {
   for (const car of run.cars) {
      if (car.street !== s) continue;
      const rel = (x - car.x) * car.direction; // > 0: the car comes toward x
      if (car.stopped && rel > 0) continue; // it yields at the zebra
      if (rel > -(CAR_HX + RADIUS + 1) && rel < ahead) return false;
   }
   return true;
}

function makeDriver(run: Run, kind: BotKind, seed: number): (dt: number) => PostInput {
   const input: PostInput = { moveX: 0, moveY: 0, yaw: 0, actionPressed: false };
   if (kind === "idle") return () => input;
   if (kind === "spam" || kind === "deliverSpam") {
      const rng = createRng(seed ^ 0x9e37);
      return () => {
         input.moveX = rng() * 2 - 1;
         input.moveY = rng() * 2 - 1;
         input.actionPressed = kind === "deliverSpam" ? rng() < 0.5 : rng() < 0.05;
         return input;
      };
   }
   const oracle = kind === "oracle";
   // the oracle crosses anywhere the lane is clear; the careful bot only straight over at a crossing
   const { grid, free, cx, cz } = walkGrid(run, oracle ? 0.1 : 0.3, !oracle);
   const dir = { dirX: 0, dirZ: 0 };
   const goal = { x: 0, z: 0 };
   let follower: PathFollower | null = null;
   let key = "";
   let replanIn = 0;
   let lastX = Infinity;
   let lastZ = Infinity;
   const spot = { x: 0, z: 0 };
   let pressWait = 0;
   return (dt: number) => {
      input.actionPressed = false;
      input.moveX = 0;
      input.moveY = 0;
      const p = run.hero;
      const item = nextItem(run);
      if (!item) return input;
      let target: string;
      if (!item.loaded) {
         spot.x = goal.x = OFFICE.x;
         spot.z = goal.z = OFFICE.z;
         target = "office";
      } else {
         targetFor(run, item, spot);
         const h = run.houses[item.house - 1];
         // stand on the street side of the mailbox or the door
         goal.x = spot.x;
         goal.z = spot.z - h.side * (item.kind === "letter" ? 0.5 : 0.6);
         target = `${item.house}-${item.kind}`;
      }
      pressWait -= dt;
      if (Math.hypot(spot.x - p.x, spot.z - p.z) < REACH - 0.1) {
         if (pressWait <= 0 && p.stun === 0) {
            input.actionPressed = true;
            pressWait = 0.3;
         }
         return input;
      }
      // plan once per target; replan only when stuck (no progress for 1.5 s)
      if (Math.hypot(p.x - lastX, p.z - lastZ) > 0.5) {
         lastX = p.x;
         lastZ = p.z;
         replanIn = 1.5;
      } else replanIn -= dt;
      if (target !== key || !follower || replanIn <= 0) {
         key = target;
         replanIn = 1.5;
         follower = followPath(grid, free, p.x - cx, p.z - cz, goal.x - cx, goal.z - cz);
      }
      steer(grid, follower, p.x - cx, p.z - cz, dir, 0.45);
      // traffic: wait on the kerb until the lane is clear, then cross
      const nz = p.z + dir.dirZ * 0.9;
      const s = onRoad(run, nz);
      if (s >= 0 && onRoad(run, p.z) < 0 && !roadClear(run, s, p.x + dir.dirX * 0.9, oracle ? 9 : 12)) return input;
      if (p.stun > 0) return input;
      // world direction at yaw 0: moveX = x, moveY = z (inputToWorld)
      input.moveX = dir.dirX;
      input.moveY = dir.dirZ;
      return input;
   };
}

const frameOf = (frames: FrameKind, seed: number) => (frames === "random" ? randomFrames(seed) : fixedFrames(1000 / frames));

export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const store = createArcadeStore();
   const run = createRun(seed, level);
   const drive = makeDriver(run, kind, seed);
   const end = simulateRun(store, {
      durationMs: level.durationMs,
      lives: level.lives,
      resultDelayMs: 900,
      frame: frameOf(frames, seed),
      step: (dt, _time, s) => {
         step(run, drive(dt), dt);
         syncStore(run, s);
      },
   });
   return { run, store: end, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason };
}
