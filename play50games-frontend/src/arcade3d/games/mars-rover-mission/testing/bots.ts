// Test-only bots for Mars Rover Mission (never imported by runtime code). They drive the real rules
// through a fresh store exactly like the canvas (core/testing/botHarness simulateRun + rules frame()).
import { createRng } from "@/arcade3d/core/math";
import { createGrid, fixedFrames, followPath, freeGrid, randomFrames, simulateRun, type Grid, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { RESULT_DELAY_MS } from "../resultDelay";
import {
   BOULDER_RADIUS,
   CHARGER_PAD_RADIUS,
   CREVASSE,
   crevasseDistance,
   LIVES,
   ROVER,
   SCAN_SPEED_MAX,
   createRun,
   createStoreSync,
   drainPerMetre,
   frame,
   type MarsInput,
   type Run,
} from "../rules";

export type BotKind = "oracle" | "careful" | "idle" | "spam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   store: ArcadeStore;
   run: Run;
   score: number;
   elapsedMs: number;
   endReason: ArcadeStore["endReason"];
   /** the win score before the rules' safety cap */
   uncapped: number;
   charges: number;
   /** lives spent, by cause */
   hits: { rock: number; boulder: number; fell: number };
}

const wrap = (a: number) => {
   while (a > Math.PI) a -= 2 * Math.PI;
   while (a < -Math.PI) a += 2 * Math.PI;
   return a;
};

/** Grid nodes the rover can drive through (rocks, props and crevasses inflated by the rover and a margin, the walls). */
export function driveGrid(run: Run, margin: number): { grid: Grid; free: Uint8Array } {
   const halfX = run.level.width / 2 - ROVER.radius - 0.2;
   const halfZ = run.level.depth / 2 - ROVER.radius - 0.2;
   const grid = createGrid({ cell: 0.5, halfX, halfZ });
   const free = freeGrid(
      grid,
      (x, z) =>
         run.rocks.every((r) => Math.hypot(x - r.x, z - r.z) >= r.radius + ROVER.radius + margin) &&
         run.props.every((p) => Math.hypot(x - p.x, z - p.z) >= p.radius + ROVER.radius + margin) &&
         run.crevasses.every((c) => crevasseDistance(c, x, z) >= c.halfWidth + CREVASSE.fallMargin + margin + 0.8)
   );
   return { grid, free };
}

export function makeDriver(run: Run, kind: BotKind, seed: number): (dt: number) => MarsInput {
   const input: MarsInput = { moveX: 0, moveY: 0 };
   if (kind === "idle") return () => input;
   if (kind === "spam") {
      const rng = createRng(seed ^ 0x5eed);
      return () => {
         input.moveX = rng() * 2 - 1;
         input.moveY = rng() * 2 - 1;
         return input;
      };
   }
   const oracle = kind === "oracle";
   const margin = oracle ? 0.3 : 0.4;
   const { grid, free } = driveGrid(run, margin);
   /** a point the rover can stand on: inside the walls, clear of rocks, props and crevasses */
   const clearAt = (x: number, z: number) =>
      Math.abs(x) <= run.level.width / 2 - ROVER.radius - 0.2 &&
      Math.abs(z) <= run.level.depth / 2 - ROVER.radius - 0.2 &&
      run.rocks.every((o) => Math.hypot(x - o.x, z - o.z) >= o.radius + ROVER.radius + margin) &&
      run.props.every((o) => Math.hypot(x - o.x, z - o.z) >= o.radius + ROVER.radius + margin) &&
      run.crevasses.every((c) => crevasseDistance(c, x, z) >= c.halfWidth + CREVASSE.fallMargin + margin + 0.8);
   const brakeShare = oracle ? 0.85 : 0.6;
   const reserve = oracle ? 6 : 14;
   let goal = -99;
   let follower: PathFollower | null = null;
   let replan = 0;
   let chargeAt = -1;
   const perMetre = drainPerMetre(run.level);
   const nearestCharger = (x: number, z: number) => {
      let best = run.chargers[0];
      for (const ch of run.chargers) if (Math.hypot(ch.x - x, ch.z - z) < Math.hypot(best.x - x, best.z - z)) best = ch;
      return best;
   };
   return (dt: number) => {
      const r = run.rover;
      // pick the goal: the next site (nearest), then the base; detour to a charger when the battery would not cover it
      let gx = run.basePad.x;
      let gz = run.basePad.z;
      let id = -1;
      if (run.samplesScanned < run.sites.length) {
         let best = Infinity;
         for (const s of run.sites) {
            if (s.scanned) continue;
            const d = Math.hypot(s.x - r.x, s.z - r.z);
            if (d < best) {
               best = d;
               gx = s.x;
               gz = s.z;
               id = s.index;
            }
         }
      }
      const ch = nearestCharger(gx, gz);
      const last = id >= 0 && run.samplesScanned === run.sites.length - 1;
      const onward = id < 0 ? 0 : last ? Math.min(Math.hypot(run.basePad.x - gx, run.basePad.z - gz), Math.hypot(ch.x - gx, ch.z - gz)) : Math.hypot(ch.x - gx, ch.z - gz);
      const cost = (d: number) => d * 1.2 * perMetre;
      const need = cost(Math.hypot(gx - r.x, gz - r.z) + onward) + (id >= 0 ? 2 : 0) + reserve;
      if (chargeAt >= 0) {
         const c = run.chargers[chargeAt];
         const onPad = Math.hypot(c.x - r.x, c.z - r.z) <= CHARGER_PAD_RADIUS - 0.8;
         const full = r.battery >= 99.5 || (oracle && onPad && r.battery >= need + 6);
         if (full) chargeAt = -1;
      } else if (r.battery < need && r.battery < 90) {
         // charge where the detour is shortest among the chargers still in reach
         let best = -1;
         let bestTrip = Infinity;
         for (const o of run.chargers) {
            const toCh = Math.hypot(o.x - r.x, o.z - r.z);
            const trip = toCh + Math.hypot(gx - o.x, gz - o.z);
            if (cost(toCh) + 2 < r.battery && trip < bestTrip) {
               best = o.index;
               bestTrip = trip;
            }
         }
         chargeAt = best >= 0 ? best : nearestCharger(r.x, r.z).index;
         // already on it and full: go anyway
         if (r.battery >= 99) chargeAt = -1;
      }
      if (chargeAt >= 0) {
         gx = run.chargers[chargeAt].x;
         gz = run.chargers[chargeAt].z;
         id = 100 + chargeAt;
      }
      replan -= dt;
      if (id !== goal || !follower || replan <= 0) {
         goal = id;
         replan = 0.8;
         follower = followPath(grid, free, r.x, r.z, gx, gz);
      }
      // the aim point: a node about 3 m ahead on the path, then the goal itself
      const path = follower.path;
      while (follower.k < path.length - 1 && Math.hypot(grid.x(path[follower.k]) - r.x, grid.z(path[follower.k]) - r.z) < 1.2) follower.k++;
      let ax = gx;
      let az = gz;
      let bendAt = Math.hypot(gx - r.x, gz - r.z);
      if (follower.k < path.length - 1) {
         let k = follower.k;
         while (k < path.length - 1 && Math.hypot(grid.x(path[k]) - r.x, grid.z(path[k]) - r.z) < 3) k++;
         ax = grid.x(path[k]);
         az = grid.z(path[k]);
      }
      for (const b of run.boulders) {
         const band = ROVER.boxHalf + BOULDER_RADIUS + 0.5;
         const ahead = r.z - b.z;
         if (Math.abs(r.x - b.x) < band && ahead > -1.5 && ahead < 9) {
            // in a lane with a boulder coming: step out sideways first, to the side that is clear
            const pref = r.x >= b.x ? 1 : -1;
            const sz = r.z + Math.cos(r.yaw) * 1.5;
            const side = clearAt(b.x + pref * (band + 1.2), sz) || !clearAt(b.x - pref * (band + 1.2), sz) ? pref : -pref;
            ax = b.x + side * (band + 1.2);
            az = sz;
         }
      }
      const want = Math.atan2(ax - r.x, az - r.z);
      const diff = wrap(want - r.yaw);
      const left = Math.hypot(gx - r.x, gz - r.z);
      // slow for the stop at the goal and for sharp turns
      let vt = Math.min(ROVER.topSpeed, Math.sqrt(2 * ROVER.brake * brakeShare * Math.max(0, left - 0.15)));
      if (Math.abs(diff) > 0.5) vt = Math.min(vt, oracle ? 3 : 2.2);
      if (Math.abs(diff) > 1.6) vt = Math.min(vt, 1.2);
      void bendAt;
      // never ram a boulder from behind: following one down its lane, stay slower than it
      for (const b of run.boulders) {
         const behind = b.z - r.z;
         if (Math.abs(r.x - b.x) < ROVER.boxHalf + BOULDER_RADIUS + 0.6 && behind > 0 && behind < 6 && r.vz > 0) vt = Math.min(vt, b.speed * 0.5);
      }
      // boulders roll south: wait outside a lane while one is about to cross our row
      for (const b of run.boulders) {
         const inLane = Math.abs(r.x - b.x) < ROVER.boxHalf + BOULDER_RADIUS + 0.4;
         const willEnter = Math.abs(r.x + r.vx * 1.2 - b.x) < ROVER.boxHalf + BOULDER_RADIUS + 0.6 || Math.abs(ax - b.x) < ROVER.boxHalf + BOULDER_RADIUS + 0.6;
         const ahead = r.z - b.z; // > 0: the boulder is north of us and coming
         const eta = ahead / Math.max(0.1, b.speed);
         if (!inLane && willEnter && ahead > -2.2 && eta < (oracle ? 1.6 : 2.4)) vt = 0;
      }
      const reverse = Math.abs(diff) > 2.6 && left < 4;
      input.moveX = Math.max(-1, Math.min(1, -diff * 3 * (reverse ? -1 : 1)));
      if (left < 0.35 && Math.abs(r.speed) < SCAN_SPEED_MAX) input.moveY = 0;
      else if (reverse) input.moveY = r.speed > -1 ? 1 : 0;
      else if (r.speed < vt - 0.25) input.moveY = -1;
      else if (r.speed > vt + 0.25) input.moveY = 1;
      else input.moveY = 0;
      // never brake through zero into reverse while stopping
      if (input.moveY === 1 && !reverse && r.speed <= 0.3) input.moveY = 0;
      return input;
   };
}

const frameOf = (frames: FrameKind, seed: number) => (frames === "random" ? randomFrames(seed) : fixedFrames(1000 / frames));

export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const store = createArcadeStore();
   const run = createRun(seed, level, id);
   const drive = makeDriver(run, kind, seed);
   const sync = createStoreSync();
   let uncapped = 0;
   let charges = 0;
   let wasCharging = false;
   const hits = { rock: 0, boulder: 0, fell: 0 };
   const end = simulateRun(store, {
      durationMs: level.durationMs,
      lives: LIVES,
      resultDelayMs: RESULT_DELAY_MS,
      frame: frameOf(frames, seed),
      step: (dt, _time, s) => {
         const before = run.score;
         const ev = frame(run, drive(dt), dt, s, sync);
         if (ev.won) uncapped = before + (ev.score - ev.timeBonus) + Math.floor(Math.max(0, level.durationMs / 1000 - run.time)) * 5;
         if (run.charging && !wasCharging) charges++;
         if (ev.lifeLost) {
            if (ev.fell) hits.fell++;
            else if (ev.boulderHit) hits.boulder++;
            else hits.rock++;
         }
         wasCharging = run.charging;
      },
   });
   return { store: end, run, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason, uncapped: end.endReason === "win" ? uncapped : end.score, charges, hits };
}
