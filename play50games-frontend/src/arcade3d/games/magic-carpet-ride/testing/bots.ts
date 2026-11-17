// Test-only bots for Magic Carpet Ride (never imported by runtime code). They drive the real rules and
// the Scene's store calls (step + syncStore) through a fresh store (botHarness simulateRun), or the same
// rules with the shell clock's arithmetic only (playPure, for the 200-seed sweeps).
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { LAT_SPEED, LIVES, VERT_SPEED, createRun, gapAt, isGemGap, lineAt, step, syncStore, type CarpetInput, type Run } from "../rules";

export type BotKind = "oracle" | "greedy" | "idle" | "spam";
export type FrameKind = 30 | 60 | 144 | "random";

export interface BotResult {
   end: ArcadeStore;
   run: Run;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const T = { lat: 0, vert: 0 };

/**
 * The racing-line pilot: aims at the line a little ahead and steers there with a proportional drift.
 * The oracle also detours to every gem (each sits alone in its gap, no obstacle there); the greedy
 * (honest) bot only follows the line, with a softer stick.
 */
function makeDriver(run: Run, kind: BotKind, seed: number): (input: CarpetInput) => void {
   if (kind === "idle") return (input) => {
      input.moveX = input.moveY = 0;
   };
   if (kind === "spam") {
      const rng = createRng(seed ^ 0x5eed);
      return (input) => {
         input.moveX = rng() * 2 - 1;
         input.moveY = rng() * 2 - 1;
      };
   }
   const oracle = kind === "oracle";
   const gain = oracle ? 5 : 4;
   const cap = oracle ? 1 : 0.9;
   return (input) => {
      const speed = run.level.speed * (run.boostT > 0 ? 1.6 : 1);
      const ahead = run.s + speed * 0.12;
      lineAt(run, ahead, T);
      if (oracle) {
         // a gem detour: blend towards the gem over 14 m either side of it
         const g = gapAt(run, ahead);
         if (g >= 0 && isGemGap(g)) {
            for (const gem of run.gems) {
               if (gem.taken || gem.gap !== g) continue;
               const w = clamp(1 - Math.abs(gem.s - ahead) / 14, 0, 1);
               T.lat += (gem.lat - T.lat) * Math.min(1, w * 1.6);
               T.vert += (gem.vert - T.vert) * Math.min(1, w * 1.6);
            }
         }
      }
      const wantLat = clamp((T.lat - run.lat) * gain, -LAT_SPEED, LAT_SPEED) / LAT_SPEED;
      const wantVert = clamp((T.vert - run.vert) * gain, -VERT_SPEED, VERT_SPEED) / VERT_SPEED;
      input.moveX = clamp(wantLat, -cap, cap);
      // up on the stick is up: moveY -1
      input.moveY = clamp(-wantVert, -cap, cap);
   };
}

const frameOf = (frames: FrameKind, seed: number) => (frames === "random" ? randomFrames(seed) : fixedFrames(1000 / frames));

/** One run of `kind` on level `id`: the rules + the Scene's store calls through a fresh store. */
export function playBot(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): BotResult {
   const level = LEVELS[id];
   const run = createRun(seed, level, id);
   const drive = makeDriver(run, kind, seed);
   const input: CarpetInput = { moveX: 0, moveY: 0 };
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      lives: LIVES,
      resultDelayMs: 900,
      frame: frameOf(frames, seed),
      step: (dt, _time, store) => {
         drive(input);
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

/** The same run without the store: the rules plus the shell clock's arithmetic (elapsed += dt, timeup at D). */
export function playPure(id: LevelId, seed: number, kind: BotKind, frames: FrameKind = 60): PureResult {
   const level = LEVELS[id];
   const run = createRun(seed, level, id);
   const drive = makeDriver(run, kind, seed);
   const frame = frameOf(frames, seed);
   const input: CarpetInput = { moveX: 0, moveY: 0 };
   let elapsedMs = 0;
   for (;;) {
      const dt = Math.min(frame(), 0.05);
      const dtMs = Math.min(dt * 1000, level.durationMs - elapsedMs);
      elapsedMs += dtMs;
      if (elapsedMs >= level.durationMs) return { run, endReason: "timeup", elapsedMs: level.durationMs, score: run.score };
      drive(input);
      step(run, input, dtMs / 1000, level.durationMs - elapsedMs);
      if (run.over) return { run, endReason: run.over, elapsedMs, score: run.score };
   }
}
