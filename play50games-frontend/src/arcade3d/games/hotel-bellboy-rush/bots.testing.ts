// Test bots for Hotel Bellboy Rush (vitest only: no runtime file imports this). They drive the real
// rules through createArcadeStore exactly like the canvas does (advanceRunClock + playedFrameDt).
//
// - oracle: full stick straight at each Use point, Use on the first frame it is in reach;
// - honest: a human pace: 0.9 stick, stops at each point, reads the key card (0.35-0.6 s), waits for
//   the doors to change after a ride (0.3-0.5 s), presses Use 0.2-0.45 s after stopping;
// - idle: never touches anything;
// - spam: a random stick and Use on 30 % of frames (wrong doors included).
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { HotelLevel } from "./levels";
import { DESK_POINT, DOOR_X, LIVES, PAD_POINT, createRun, doorZ, idleInput, step, targetAt, type HotelInput, type Run, type Target } from "./rules";

export type BotStyle = "oracle" | "honest" | "idle" | "spam";

/** The point the bot walks to and the Use target it wants there. */
function goalOf(run: Run): { x: number; z: number; target: Target } | null {
   const bag = run.bags[run.next];
   if (!bag) return null;
   if (!run.carrying) return { x: DESK_POINT.x, z: DESK_POINT.z + 0.5, target: { kind: "desk" } };
   if (run.level.floors > 1 && run.floor !== bag.floor) return { x: PAD_POINT.x - 0.25, z: PAD_POINT.z, target: { kind: "pad" } };
   return { x: DOOR_X - 1.05, z: doorZ(bag.index - 1), target: { kind: "door", index: bag.index - 1 } };
}

const sameTarget = (a: Target | null, b: Target) => !!a && a.kind === b.kind && (a.kind !== "door" || (b.kind === "door" && a.index === b.index));

interface Memory { wait: number; pause: number; lastFloor: number; lastCarry: boolean }

export function drive(run: Run, input: HotelInput, dt: number, style: BotStyle, rng: () => number, mem: Memory): void {
   input.moveX = 0;
   input.moveY = 0;
   input.actionPressed = false;
   input.yaw = 0;
   if (style === "idle" || run.over) return;
   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      input.actionPressed = rng() < 0.3;
      return;
   }
   const goal = goalOf(run);
   if (!goal) return;
   const h = run.hero;
   if (style === "honest") {
      // a short look after something changed: the card was taken, the doors changed floor
      if (run.carrying !== mem.lastCarry || run.floor !== mem.lastFloor) {
         mem.pause = run.carrying !== mem.lastCarry && run.carrying ? 0.35 + rng() * 0.25 : 0.3 + rng() * 0.2;
         mem.lastCarry = run.carrying;
         mem.lastFloor = run.floor;
      }
      if (mem.pause > 0) {
         mem.pause -= dt;
         return;
      }
   }
   if (h.ride > 0 || h.stun > 0) return;
   const reach = sameTarget(targetAt(run, h.x, h.z), goal.target);
   if (style === "oracle" && reach) {
      input.actionPressed = true;
      return;
   }
   const dx = goal.x - h.x;
   const dz = goal.z - h.z;
   const d = Math.hypot(dx, dz);
   if (style === "honest" && reach && d < 0.35) {
      mem.wait += dt;
      if (mem.wait >= 0.2 + (run.seed % 5) * 0.06) {
         input.actionPressed = true;
         mem.wait = 0;
      }
      return;
   }
   mem.wait = 0;
   // yaw 0: screen up (moveY -1) is world -z, so world (dx, dz) is (moveX, moveY) = (dx, dz)
   const stick = style === "honest" ? 0.9 : 1;
   const slow = style === "honest" ? Math.min(1, d / 0.6) : 1;
   input.moveX = (dx / (d || 1)) * stick * Math.max(0.25, slow);
   input.moveY = (dz / (d || 1)) * stick * Math.max(0.25, slow);
}

export interface BotResult { run: Run; score: number; ms: number; reason: string | null; won: boolean }

export function playBot(level: HotelLevel, seed: number, hz: number, style: BotStyle): BotResult {
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: LIVES, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();
   const input = idleInput();
   const mem: Memory = { wait: 0, pause: 0, lastFloor: 1, lastCarry: false };
   const rng = createRng((seed + 1) * 7919 + hz * 31 + (style === "spam" ? 5 : 0));
   const cap = Math.ceil((level.durationMs / 1000 + 5) * hz);
   for (let i = 0; i < cap; i++) {
      advanceRunClock(store, 1 / hz);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;
      drive(run, input, dt, style, rng, mem);
      const before = run.score;
      const ev = step(run, input, dt, state.timeLeftMs ?? 0);
      if (run.score !== before + ev.score) throw new Error("score delta");
      if (ev.score) state.addScore(ev.score);
      if (ev.lifeLost) state.loseLife();
      if (ev.won) state.end("win");
      if (run.over) break;
   }
   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over, won: final.endReason === "win" };
}
