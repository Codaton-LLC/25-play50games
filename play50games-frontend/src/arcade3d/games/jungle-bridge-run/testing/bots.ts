// Test-only bots for Jungle Bridge Run (never imported by runtime code). They drive the real rules and
// the real store exactly like the Scene (core/testing/botHarness simulateRun + rules.syncStore).
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import {
   AIRBORNE_Y,
   GAP_EDGE,
   INITIAL_LIVES,
   JUMP_ARC,
   JUMP_S,
   LOG_CLEAR_Y,
   LOG_HALF_Z,
   SLIDE_S,
   VINE_HALF_Z,
   createRun,
   obstacleEnd,
   step,
   syncStore,
   type Obstacle,
   type Run,
   type RunnerInput,
} from "../rules";

export type BotKind = "oracle" | "honest" | "idle" | "spam";
export type FrameKind = 30 | 60 | 144 | "random";

/** Seconds into a jump at which the runner's height first reaches h (and leaves it at JUMP_S - that). */
const riseTime = (h: number) => (Math.asin(h / JUMP_ARC) / Math.PI) * JUMP_S;

/**
 * The jump / slide start (z of the runner) that centres the obstacle in the safe part of the move:
 * the gap's inner hole under the airborne span, the log's depth under the part above LOG_CLEAR_Y,
 * the vine's depth inside the slide.
 */
export function actionZ(o: Obstacle, speed: number): number | null {
   if (o.kind === "gap") {
      const a = riseTime(AIRBORNE_Y);
      const lo = o.z + o.length - GAP_EDGE - (JUMP_S - a) * speed;
      const hi = o.z + GAP_EDGE - a * speed;
      return (lo + hi) / 2;
   }
   if (o.kind === "log") {
      const a = riseTime(LOG_CLEAR_Y);
      return (o.z + LOG_HALF_Z - (JUMP_S - a) * speed + (o.z - LOG_HALF_Z - a * speed)) / 2;
   }
   if (o.kind === "vine") return (o.z + VINE_HALF_Z - SLIDE_S * speed + (o.z - VINE_HALF_Z)) / 2;
   return null;
}

function laneBlocked(o: Obstacle, lane: number, z0: number, z1: number): boolean {
   if (o.kind === "pillar" || o.kind === "lava") return o.lane === lane && o.z + 1.2 >= z0 && o.z - 1.2 <= z1;
   if (o.kind === "bridge") return o.plankLane !== lane && o.z + o.length + 0.8 >= z0 && o.z - 0.8 <= z1;
   return false;
}

function makeDriver(run: Run, kind: BotKind, seed: number): () => RunnerInput {
   const input: RunnerInput = { left: false, right: false, jump: false, slide: false };
   const rng = createRng(seed ^ 0x9e3779b9);
   const done = new Set<Obstacle>();
   // honest: every jump / slide lands up to ±60 ms off the centre of its window (a human's spread)
   const jitter = new Map<Obstacle, number>();
   return () => {
      input.left = input.right = input.jump = input.slide = false;
      if (kind === "idle" || run.over || run.respawning) {
         if (run.respawning) done.clear();
         return input;
      }
      if (kind === "spam") {
         input.left = rng() < 0.15;
         input.right = rng() < 0.15;
         input.jump = rng() < 0.2;
         input.slide = rng() < 0.2;
         return input;
      }
      const v = run.speed;
      const ahead: Obstacle[] = [];
      for (let s = run.currentSection; s < Math.min(run.sections.length, run.currentSection + 2); s++) {
         for (const o of run.sections[s].obstacles) if (obstacleEnd(o) > run.z - 0.5) ahead.push(o);
      }
      // the lane: the clear lane of the next obstacle's section; the oracle detours for a gem when safe
      const nextSec = run.sections.find((s) => s.obstacles.some((o) => obstacleEnd(o) > run.z - 0.5)) ?? run.sections[run.currentSection];
      let target = nextSec.clearLane;
      if (kind === "oracle") {
         const gem = run.gems.find((g) => !g.collected && g.z > run.z - 0.3);
         if (gem && gem.z - run.z < 9) {
            const z1 = Math.max(gem.z + 1, run.z + 7);
            if (!ahead.some((o) => laneBlocked(o, gem.lane, run.z, z1))) target = gem.lane;
         }
      }
      if (run.laneTimer <= 0 && run.lane !== target) {
         if (run.lane > target) input.left = true;
         else input.right = true;
      }
      for (const o of ahead) {
         if (done.has(o)) continue;
         const at = actionZ(o, v);
         if (at === null) continue;
         if (!jitter.has(o)) jitter.set(o, kind === "honest" ? (rng() * 2 - 1) * 0.06 * v : 0);
         if (run.z >= at + jitter.get(o)!) {
            done.add(o);
            if (o.kind === "vine") {
               // a slide only helps on a vine lane; elsewhere it is harmless
               input.slide = true;
            } else if (run.jumpTimer <= 0 && run.y < AIRBORNE_Y) input.jump = true;
         }
      }
      return input;
   };
}

export interface BotResult {
   end: ArcadeStore;
   run: Run;
   score: number;
   elapsedMs: number;
   endReason: ArcadeStore["endReason"];
   livesLost: number;
}

const frameOf = (f: FrameKind, seed: number) => (f === "random" ? randomFrames(seed) : fixedFrames(1000 / f));

export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const run = createRun(seed, level, id);
   const drive = makeDriver(run, kind, seed);
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      lives: INITIAL_LIVES,
      resultDelayMs: 900,
      frame: frameOf(frames, seed),
      step: (dt, _t, store) => {
         const ev = step(run, drive(), dt, store.getState().timeLeftMs ?? 0);
         syncStore(run, ev, store);
      },
   });
   return { end, run, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason, livesLost: INITIAL_LIVES - run.lives };
}
