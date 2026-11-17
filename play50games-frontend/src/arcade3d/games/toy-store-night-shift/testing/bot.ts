// Bots for rules.test.ts and levels.test.ts (vitest only; the folder name keeps the core's
// "tests import botHarness only" guard happy). "oracle" is the fastest honest run (it carries
// pairs where the cap allows), "human" is paced like a player (stick 0.9, 0.15 s before each Use),
// "idle" does nothing, "spam" mashes every control.
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, followPath, freeGrid, steer, type Grid, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { RADIUS, SHELF_DEPTH, createRun, distanceToShelf, idleInput, shelfInReach, standable, step, type Run, type Shelf, type ToyInput } from "../rules";

export type Style = "oracle" | "human" | "idle" | "spam";

interface Goal { kind: "toy" | "shelf"; index: number; x: number; z: number }

export interface Bot {
   drive(run: Run, input: ToyInput, dt: number): void;
}

export function createBot(run: Run, style: Style, seed: number): Bot {
   const rng = createRng(seed * 29 + 5);
   if (style === "idle") return { drive: (_r, input) => void Object.assign(input, idleInput()) };
   if (style === "spam") {
      return {
         drive(_r, input) {
            input.moveX = rng() * 2 - 1;
            input.moveY = rng() * 2 - 1;
            input.use = rng() > 0.6;
            input.yaw = 0;
         },
      };
   }
   const grid: Grid = createGrid({ cell: 0.3, halfX: run.hx, halfZ: run.hz });
   const free = freeGrid(grid, (x, z) => standable(run, x, z, RADIUS + 0.12));
   const stick = style === "human" ? 0.9 : 1;
   const reaction = style === "human" ? 0.15 : 0;
   let goal: Goal | null = null;
   let follower: PathFollower | null = null;
   let wait = 0;
   const dir = { dirX: 0, dirZ: 0 };

   const standPoint = (r: Run, s: Shelf): { x: number; z: number } => {
      let best: { x: number; z: number } | null = null;
      let bestD = Infinity;
      for (const side of [-1, 1]) {
         for (let k = -3; k <= 3; k++) {
            const x = s.x + k * 0.5;
            const z = s.z + side * (SHELF_DEPTH / 2 + 0.78);
            if (!standable(r, x, z, RADIUS + 0.06)) continue;
            const d = Math.hypot(x - r.hero.x, z - r.hero.z);
            if (d < bestD) { bestD = d; best = { x, z }; }
         }
      }
      return best ?? { x: s.x, z: s.z + SHELF_DEPTH / 2 + 0.8 };
   };

   function nearestToy(r: Run): Goal | null {
      let best: Goal | null = null;
      let bestD = Infinity;
      r.toys.forEach((t, index) => {
         if (t.state !== 0) return;
         const d = Math.hypot(t.x - r.hero.x, t.z - r.hero.z);
         if (d < bestD) { bestD = d; best = { kind: "toy", index, x: t.x, z: t.z }; }
      });
      return best;
   }

   function shelfGoal(r: Run): Goal | null {
      const top = r.toys[r.carried[r.carried.length - 1]];
      let best: Goal | null = null;
      let bestD = Infinity;
      r.shelves.forEach((s, index) => {
         if (s.cat !== top.cat) return;
         const p = standPoint(r, s);
         const d = Math.hypot(p.x - r.hero.x, p.z - r.hero.z);
         if (d < bestD) { bestD = d; best = { kind: "shelf", index, x: p.x, z: p.z }; }
      });
      return best;
   }

   function choose(r: Run): Goal | null {
      if (r.carried.length === 0) return nearestToy(r);
      const shelf = shelfGoal(r);
      if (style === "oracle" && r.carried.length < r.level.carry) {
         const toy = nearestToy(r);
         if (toy && shelf) {
            const dToy = Math.hypot(toy.x - r.hero.x, toy.z - r.hero.z);
            const dShelf = Math.hypot(shelf.x - r.hero.x, shelf.z - r.hero.z);
            if (dToy < dShelf * 0.8) return toy;
         }
      }
      return shelf;
   }

   return {
      drive(r, input, dt) {
         input.moveX = 0;
         input.moveY = 0;
         input.use = false;
         input.yaw = 0;
         if (r.over) return;
         const h = r.hero;
         if (h.stun > 0) return;
         let stale = !goal;
         if (goal) {
            if (goal.kind === "toy" && r.toys[goal.index].state !== 0) stale = true;
            if (goal.kind === "shelf" && r.carried.length === 0) stale = true;
            // a carried toy of another kind than the goal's shelf (after a wind-up knock or a new pick)
            if (goal.kind === "shelf" && r.carried.length > 0 && r.shelves[goal.index].cat !== r.toys[r.carried[r.carried.length - 1]].cat) stale = true;
            if (goal.kind === "toy" && r.carried.length > 0 && r.carried.length >= r.level.carry) stale = true;
         }
         if (stale) { goal = choose(r); follower = null; wait = 0; }
         if (!goal) return;
         const dx = goal.x - h.x;
         const dz = goal.z - h.z;
         const d = Math.hypot(dx, dz);
         const there = goal.kind === "toy"
            ? Math.hypot(r.toys[goal.index].x - h.x, r.toys[goal.index].z - h.z) <= 0.85
            : shelfInReach(r) === goal.index && distanceToShelf(r.shelves[goal.index], h.x, h.z) <= 1.0;
         if (there) {
            wait += dt;
            if (wait >= reaction) {
               input.use = true;
               goal = null;
               follower = null;
            }
            return;
         }
         if (!follower) follower = followPath(grid, free, h.x, h.z, goal.x, goal.z);
         steer(grid, follower, h.x, h.z, dir);
         input.moveX = dir.dirX * stick;
         input.moveY = dir.dirZ * stick;
         if (d < 1.0) {
            input.moveX = (dx / (d || 1)) * Math.max(0.5, Math.min(1, d)) * stick;
            input.moveY = (dz / (d || 1)) * Math.max(0.5, Math.min(1, d)) * stick;
         }
      },
   };
}

export interface Played { run: Run; score: number; ms: number; reason: string | null }

export function play(id: LevelId, seed: number, hz: number, style: Style): Played {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();
   const input = idleInput();
   const bot = createBot(run, style, seed + id * 101);
   const cap = Math.ceil((level.durationMs / 1000 + 4) * hz);
   for (let i = 0; i < cap; i++) {
      advanceRunClock(store, 1 / hz);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;
      bot.drive(run, input, dt);
      const before = run.score;
      const ev = step(run, input, dt, state.timeLeftMs ?? 0);
      if (ev.score) state.addScore(ev.score);
      if (run.score !== before + ev.score) throw new Error("score delta");
      if (ev.won) state.end("win");
      if (run.over) break;
   }
   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over };
}
