// Bots for rules.test.ts and levels.test.ts (vitest only; the folder name keeps the core's
// "tests import botHarness only" guard happy). "oracle" is the fastest honest run, "human" is
// paced like a player (stick 0.9, a 0.18 s reaction before each hold or float), "idle" does
// nothing, "spam" mashes every control.
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, followPath, freeGrid, steer, type Grid, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import {
   AIR_BONUS_ABOVE, CARRY_MAX, CURRENT_ACCEL, CURRENT_SETTLE_S, HIGH_MIN_Y, LIVES, MAX_SPEED, RADIUS,
   createRun, idleInput, standable, step, type AquariumInput, type Run,
} from "../rules";

export type Style = "oracle" | "human" | "idle" | "spam";

interface Goal { kind: "algae" | "filter" | "trash" | "basket" | "column" | "hatch"; index: number; x: number; z: number }

export interface Bot {
   drive(run: Run, input: AquariumInput, dt: number): void;
}

export function createBot(run: Run, style: Style, seed: number): Bot {
   const rng = createRng(seed * 31 + 7);
   if (style === "idle") return { drive: (_r, input) => void Object.assign(input, idleInput()) };
   if (style === "spam") {
      return {
         drive(_r, input) {
            input.moveX = rng() * 2 - 1;
            input.moveY = rng() * 2 - 1;
            input.action = rng() > 0.35;
            input.jumpPressed = rng() > 0.9;
            input.yaw = 0;
         },
      };
   }
   const grid: Grid = createGrid({ cell: 0.3, halfX: run.hx, halfZ: run.hz });
   const free = freeGrid(grid, (x, z) => standable(run, x, z, RADIUS + 0.12));
   const stick = style === "human" ? 0.9 : 1;
   const reaction = style === "human" ? 0.18 : 0;
   const margin = style === "human" ? 9 : 4;
   let goal: Goal | null = null;
   let follower: PathFollower | null = null;
   let refilling = false;
   let wait = 0;
   const dir = { dirX: 0, dirZ: 0 };

   const workPoint = (x: number, z: number, r: Run): { x: number; z: number } => {
      let best: { x: number; z: number } | null = null;
      let bestD = Infinity;
      for (let k = 0; k < 16; k++) {
         const a = (k / 16) * Math.PI * 2;
         const px = x + Math.cos(a) * 1.1;
         const pz = z + Math.sin(a) * 1.1;
         if (!standable(r, px, pz, RADIUS + 0.06)) continue;
         const d = Math.hypot(px - r.hero.x, pz - r.hero.z);
         if (d < bestD) { bestD = d; best = { x: px, z: pz }; }
      }
      return best ?? { x, z };
   };

   function choose(r: Run): Goal {
      const h = r.hero;
      if (r.done === r.tasks) return { kind: "hatch", index: 0, x: r.hatch.x, z: r.hatch.z };
      const open: Goal[] = [];
      r.algae.forEach((a, index) => { if (!a.done) open.push({ kind: "algae", index, x: a.stand.x, z: a.stand.z }); });
      r.filters.forEach((f, index) => { if (!f.done) { const p = workPoint(f.x, f.z, r); open.push({ kind: "filter", index, x: p.x, z: p.z }); } });
      const floor: Goal[] = [];
      r.trash.forEach((t, index) => { if (t.state === 0) floor.push({ kind: "trash", index, x: t.x, z: t.z }); });
      if (r.carried.length > 0 && (r.carried.length >= CARRY_MAX || floor.length === 0)) return { kind: "basket", index: 0, x: r.basket.x, z: r.basket.z };
      const pool = r.carried.length < CARRY_MAX ? [...open, ...floor] : open;
      let best = pool[0];
      let bestD = Infinity;
      for (const g of pool) {
         const d = Math.hypot(g.x - h.x, g.z - h.z);
         if (d < bestD) { bestD = d; best = g; }
      }
      return best;
   }

   return {
      drive(r, input, dt) {
         input.moveX = 0;
         input.moveY = 0;
         input.action = false;
         input.jumpPressed = false;
         input.yaw = 0;
         if (r.over) return;
         const h = r.hero;
         if (refilling && h.air >= (style === "human" ? 96 : 90)) { refilling = false; goal = null; follower = null; }
         let stale = !goal;
         if (goal && !refilling) {
            if (goal.kind === "algae" && r.algae[goal.index].done) stale = true;
            if (goal.kind === "filter" && r.filters[goal.index].done) stale = true;
            if (goal.kind === "trash" && r.trash[goal.index].state !== 0) stale = true;
            if (goal.kind === "basket" && r.carried.length === 0) stale = true;
            if (goal.kind === "hatch" && r.done !== r.tasks) stale = true;
         }
         if (stale && !refilling) { goal = choose(r); follower = null; wait = 0; }
         if (!refilling && goal && goal.kind !== "hatch") {
            const dist = Math.hypot(goal.x - h.x, goal.z - h.z) * 1.3;
            const need = AIR_BONUS_ABOVE + r.level.airDrain * 1.5 * (dist / 2.6 + 1.6) + margin;
            if ((h.air < need && need < 92) || h.air < 22) {
               refilling = true;
               goal = { kind: "column", index: 0, x: r.column.x, z: r.column.z };
               follower = null;
            }
         }
         if (!goal) return;
         const dx = goal.x - h.x;
         const dz = goal.z - h.z;
         const d = Math.hypot(dx, dz);
         const working = goal.kind === "algae" || goal.kind === "filter";
         const reach = goal.kind === "algae" ? Math.hypot(r.algae[goal.index].x - h.x, r.algae[goal.index].z - h.z) : goal.kind === "filter" ? Math.hypot(r.filters[goal.index].x - h.x, r.filters[goal.index].z - h.z) : Infinity;
         const inReach = reach <= (goal.kind === "algae" ? 1.05 : 1.13) || (wait > 0 && reach <= 1.17);
         if (working && inReach) {
            wait += dt;
            if (wait >= reaction) {
               input.action = true;
               const a = goal.kind === "algae" ? r.algae[goal.index] : null;
               if (a?.high && h.y <= HIGH_MIN_Y && h.float <= 0) input.jumpPressed = true;
            }
            let hx = dx;
            let hz = dz;
            if (goal.kind === "filter") {
               const fl = r.filters[goal.index];
               const ux = (h.x - fl.x) / (reach || 1);
               const uz = (h.z - fl.z) / (reach || 1);
               hx = fl.x + ux * 1.06 - h.x;
               hz = fl.z + uz * 1.06 - h.z;
            }
            // hold the work point: a wanted velocity toward it (at most 1.5 m/s), minus the L5 current's drift
            const drift = r.level.current ? CURRENT_ACCEL * CURRENT_SETTLE_S : 0;
            const wvx = Math.max(-1.5, Math.min(1.5, hx * 3));
            const wvz = Math.max(-1.5, Math.min(1.5, hz * 3));
            input.moveX = Math.max(-1, Math.min(1, (wvx - drift) / MAX_SPEED));
            input.moveY = Math.max(-1, Math.min(1, wvz / MAX_SPEED));
            return;
         }
         if (goal.kind === "column" && d < 0.5) return;
         if (!follower) follower = followPath(grid, free, h.x, h.z, goal.x, goal.z);
         steer(grid, follower, h.x, h.z, dir);
         // keep clear of a shark (a player sees it coming): bend away from any shark within 3 m
         let ax = dir.dirX;
         let az = dir.dirZ;
         for (const sh of r.sharks) {
            const sx = h.x - sh.x;
            const sz = h.z - sh.z;
            const sd = Math.hypot(sx, sz);
            if (sd < 3 && sd > 1e-6) {
               const w = ((3 - sd) / 3) * 2.2;
               ax += (sx / sd) * w;
               az += (sz / sd) * w;
            }
         }
         const al = Math.hypot(ax, az) || 1;
         input.moveX = (ax / al) * stick;
         input.moveY = (az / al) * stick;
         if (d < 1.2) {
            const k = Math.max(0.6, Math.min(1, d / 0.8)) * stick;
            input.moveX = (dx / (d || 1)) * k;
            input.moveY = (dz / (d || 1)) * k;
         }
      },
   };
}

export interface Played { run: Run; score: number; ms: number; reason: string | null }

export function play(id: LevelId, seed: number, hz: number, style: Style): Played {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: LIVES, resultDelayMs: 900 });
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
      if (ev.lifeLost) state.loseLife();
      if (ev.won) state.end("win");
      if (run.over) break;
   }
   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over };
}
