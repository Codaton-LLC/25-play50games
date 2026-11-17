// Bot proofs per level (docs/arcade-levels.md §5, §6.3 step 6). The honest human-paced bot clears
// levels 1–4 on >= 90% of seeds and, on level 5, scores at least level 4's clear on >= 90%
// (level 5 has nothing to unlock). Idle never clears. Every run stays inside that level's limits.
// The straight-line ceiling, not this bot, is what sets maxScore (levels.test.ts); a lucky painter
// shows the playing gap the README records. Level 1's own proof stays in rules.test.ts.
import { describe, expect, it } from "vitest";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { isLevelCleared } from "@/arcade3d/core/levels";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { warehouseRushMeta as meta } from "./meta";
import {
   ARENA,
   BOUNDS,
   EXTRA_RACK_AABBS,
   NONE,
   PICK_GAP,
   PROPOSED_LEVEL_LIMITS,
   RACKS,
   ROBOT,
   cornerSignX,
   cornerSignZ,
   createRun,
   createStepInput,
   inReach,
   step,
   zoneAt,
   type Pallet,
   type StepInput,
   type WarehouseRun,
} from "./rules";

type Profile = "human" | "oracle" | "spam" | "idle";
const REACTION_MS = 350;
const APPROACH = 0.55 + PICK_GAP;

const grid = createGrid({ cell: 0.5, halfX: ARENA.halfX - 0.4, halfZ: ARENA.halfZ - 0.4 });

function baseGrid(run: WarehouseRun): Uint8Array {
   const racks = run.config.extraRacks;
   return freeGrid(grid, (x, z) => {
      if (Math.abs(x) > BOUNDS.max.x - ROBOT.radius || Math.abs(z) > BOUNDS.max.z - ROBOT.radius) return false;
      for (let i = 0; i < RACKS.length; i++) if (distanceToBoxXZ(x, z, RACKS[i]) < ROBOT.radius) return false;
      for (let i = 0; i < racks; i++) if (distanceToBoxXZ(x, z, EXTRA_RACK_AABBS[i]) < ROBOT.radius) return false;
      for (let i = 0; i < run.pallets.length; i++) if (distanceToBoxXZ(x, z, run.pallets[i].bounds) < ROBOT.radius) return false;
      return true;
   });
}

/** Static aisles, with the forklifts' current footprints punched out (a human walks around them). */
function gridAround(base: Uint8Array, run: WarehouseRun): Uint8Array {
   if (run.forklifts.length === 0) return base;
   const free = base.slice();
   const margin = ROBOT.radius + 0.2;
   for (let i = 0; i < run.forklifts.length; i++) {
      const f = run.forklifts[i];
      const x0 = f.x - f.hx - margin;
      const x1 = f.x + f.hx + margin;
      const z0 = f.z - f.hz - margin;
      const z1 = f.z + f.hz + margin;
      for (let x = x0; x <= x1; x += grid.cell) {
         for (let z = z0; z <= z1; z += grid.cell) {
            const n = grid.node(x, z);
            if (n >= 0 && n < free.length && distanceToBoxXZ(x, z, f.bounds) < margin) free[n] = 0;
         }
      }
   }
   return free;
}

function approachOf(pallet: Pallet): { x: number; z: number } {
   return { x: pallet.x, z: pallet.z > 0 ? pallet.z - APPROACH : pallet.z + APPROACH };
}

/** Forced luck: the nearest occupied pallet's nearest zone becomes the order, and that pallet holds it. */
function paintGreedy(run: WarehouseRun): void {
   let best = Infinity;
   let pick = -1;
   let corner = 0;
   for (let i = 0; i < run.pallets.length; i++) {
      if (run.pallets[i].box === NONE) continue;
      const pallet = run.pallets[i];
      for (let c = 0; c < 4; c++) {
         const zx = cornerSignX(c) * 8.2;
         const zz = cornerSignZ(c) * 4.2;
         const cost = Math.hypot(pallet.x - run.robot.x, pallet.z - run.robot.z) + Math.hypot(zx - pallet.x, zz - pallet.z) * (ROBOT.speed / ROBOT.carrySpeed);
         if (cost < best) {
            best = cost;
            pick = i;
            corner = c;
         }
      }
   }
   if (pick < 0) return;
   const colour = run.layout.zoneColours[corner];
   run.order = colour;
   for (let i = 0; i < run.pallets.length; i++) {
      if (run.pallets[i].box === NONE) continue;
      run.pallets[i].box = i === pick ? colour : (colour + 1) % 4;
   }
}

function createBot(seed: number, profile: Profile, id: LevelId) {
   const run = createRun(seed, LEVELS[id]);
   const base = baseGrid(run);
   const rng = createRng(seed ^ 0x5eed);
   const input = createStepInput();
   const dir = { dirX: 0, dirZ: 0 };
   let free = base;
   let follower: PathFollower | null = null;
   let goalKey = "";
   let waitUntil = 0;
   let painted = -1;
   let stuckMs = 0;
   const level = meta.levels![id - 1];

   function aim(): StepInput {
      input.moveX = 0;
      input.moveY = 0;
      input.actionPressed = false;
      if (run.ended !== null || run.lockMs > 0) return input;
      if (profile === "idle") return input;
      if (profile === "spam") {
         const a = rng() * Math.PI * 2;
         input.moveX = Math.cos(a);
         input.moveY = Math.sin(a);
         input.actionPressed = rng() < 0.08;
         return input;
      }
      if (profile === "oracle" && run.carrying === NONE && painted !== run.orders) {
         paintGreedy(run);
         painted = run.orders;
      }
      let key = "";
      let gx = 0;
      let gz = 0;
      let press = false;
      if (run.carrying === NONE) {
         let best = -1;
         let bestD = Infinity;
         for (let i = 0; i < run.pallets.length; i++) {
            if (run.pallets[i].box !== run.order) continue;
            const d = Math.hypot(run.pallets[i].x - run.robot.x, run.pallets[i].z - run.robot.z);
            if (d < bestD) {
               bestD = d;
               best = i;
            }
         }
         if (best < 0) return input;
         const at = approachOf(run.pallets[best]);
         gx = at.x;
         gz = at.z;
         key = `p${best}:${run.order}:${run.orders}`;
         press = inReach(run.robot.x, run.robot.z, run.pallets[best].bounds);
      } else {
         const corner = run.layout.zoneColours.indexOf(run.carrying);
         gx = cornerSignX(corner) * 8.2;
         gz = cornerSignZ(corner) * 4.2;
         key = `z${corner}`;
         press = zoneAt(run.robot.x, run.robot.z) === corner;
      }
      const stuck = stuckMs > 280 && run.forklifts.length > 0;
      if (key !== goalKey || stuck) {
         const fresh = key !== goalKey;
         goalKey = key;
         stuckMs = 0;
         if (run.forklifts.length > 0) free = gridAround(base, run);
         follower = followPath(grid, free, run.robot.x, run.robot.z, gx, gz);
         if (fresh && profile === "human") waitUntil = run.simMs + REACTION_MS;
      }
      if (run.simMs + 1e-9 < waitUntil) return input;
      if (press) input.actionPressed = true;
      if (follower) {
         steer(grid, follower, run.robot.x, run.robot.z, dir);
         input.moveX = dir.dirX;
         input.moveY = dir.dirZ;
      }
      return input;
   }

   function play(dtMs: number): void {
      const beforeX = run.robot.x;
      const beforeZ = run.robot.z;
      step(run, dtMs, aim());
      const moved = Math.hypot(run.robot.x - beforeX, run.robot.z - beforeZ);
      const pushed = Math.hypot(input.moveX, input.moveY) > 0.2;
      if (pushed && moved < 0.015 && run.lockMs === 0) stuckMs += dtMs;
      else stuckMs = 0;
   }

   return { run, play, level };
}

function rulesRun(seed: number, profile: Profile, id: LevelId) {
   const bot = createBot(seed, profile, id);
   const dt = 1000 / 30;
   while (bot.run.ended === null) bot.play(dt);
   return bot;
}

const SWEEP: Record<Profile, number> = { human: 200, oracle: 12, spam: 8, idle: 4 };

describe("warehouse-rush levels: bots", () => {
   for (const id of LEVEL_IDS) {
      const limits = PROPOSED_LEVEL_LIMITS[id];

      it(`L${id}: human clears, idle never does, every score fits the level limits`, () => {
         const stats: Record<string, { clears: number; best: number; mean: number; p10: number }> = {};
         for (const profile of Object.keys(SWEEP) as Profile[]) {
            const scores: number[] = [];
            let clears = 0;
            let best = 0;
            for (let seed = 0; seed < SWEEP[profile]; seed++) {
               const { run, level } = rulesRun(seed, profile, id);
               expect(run.ended).toBe("timeup");
               expect(fitsLimits(run.score, run.simMs, limits)).toBe(true);
               expect(capToLimits(run.score, run.simMs, limits)).toBe(run.score);
               const cleared = id === 5
                  ? run.score >= (meta.levels![3].clearScore ?? 0)
                  : isLevelCleared("timeup", run.score, level);
               if (cleared) clears += 1;
               best = Math.max(best, run.score);
               scores.push(run.score);
            }
            scores.sort((a, b) => a - b);
            const sum = scores.reduce((s, n) => s + n, 0);
            stats[profile] = {
               clears,
               best,
               mean: Math.round(sum / scores.length),
               p10: scores[Math.floor(scores.length * 0.1)] ?? 0,
            };
         }
         console.info("warehouse-rush levels", id, JSON.stringify(stats));
         expect(stats.human.clears).toBeGreaterThanOrEqual(0.9 * SWEEP.human);
         expect(stats.idle.clears).toBe(0);
         expect(stats.spam.clears).toBe(0);
         expect(stats.oracle.best).toBeGreaterThan(stats.human.best);
      }, 90_000);

      it(`L${id}: one human run through the real store stays inside the limits`, () => {
         const bot = createBot(100 + id, "human", id);
         const final = simulateRun(createArcadeStore(), {
            durationMs: LEVELS[id].durationMs,
            frame: fixedFrames(1000 / 30),
            step(dt, _time, store) {
               bot.play(dt * 1000);
               store.getState().setScore(bot.run.score);
            },
         });
         expect(final.phase).toBe("over");
         expect(final.endReason).toBe("timeup");
         expect(fitsLimits(final.score, final.elapsedMs, limits)).toBe(true);
         expect(capToLimits(final.score, final.elapsedMs, limits)).toBe(final.score);
      }, 30_000);
   }
});
