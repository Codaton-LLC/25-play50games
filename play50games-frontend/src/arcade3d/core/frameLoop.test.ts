import { describe, expect, it } from "vitest";
import {
   DEFAULT_RESULT_DELAY_MS,
   FRAME_PRIORITY,
   MAX_ANIM_DT,
   MAX_FRAME_DT,
   RESULT_DELAY_MAX_MS,
   advanceGameTime,
   advanceRunClock,
   clampFrameDt,
   createGameTime,
   isResultShown,
   playedFrameDt,
   resultDelayFor,
   runFramePriority,
} from "./frameLoop";
import { COUNTDOWN_MS, createArcadeStore, type ArcadeStore } from "./useArcadeStore";
import type { StoreApi } from "zustand/vanilla";

describe("frame order", () => {
   it("input, run clock, game time, simulation, camera, visuals; all <= 0 so R3F keeps rendering", () => {
      const order = [
         FRAME_PRIORITY.input,
         FRAME_PRIORITY.clock,
         FRAME_PRIORITY.gameTime,
         FRAME_PRIORITY.simulation,
         FRAME_PRIORITY.camera,
         FRAME_PRIORITY.visuals,
      ];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(new Set(order).size).toBe(order.length);
      expect(Math.max(...order)).toBeLessThanOrEqual(0);
   });

   it("useRunFrame priorities: default simulation, custom ones only in (gameTime, visuals]", () => {
      expect(runFramePriority()).toBe(FRAME_PRIORITY.simulation);
      for (const ok of [-0.7, -0.5, FRAME_PRIORITY.camera, -0.1, 0]) expect(runFramePriority(ok)).toBe(ok);
      // at or before the game time it would read last frame's values; above 0 R3F stops rendering
      for (const bad of [FRAME_PRIORITY.gameTime, -0.9, FRAME_PRIORITY.clock, -5, 0.5, 1, Number.NaN]) {
         expect(() => runFramePriority(bad)).toThrow(RangeError);
      }
   });

   it("an out-of-range priority falls back to the default in production", () => {
      const env = process.env.NODE_ENV;
      try {
         (process.env as Record<string, string | undefined>).NODE_ENV = "production";
         expect(runFramePriority(1)).toBe(FRAME_PRIORITY.simulation);
         expect(runFramePriority(-1)).toBe(FRAME_PRIORITY.simulation);
      } finally {
         (process.env as Record<string, string | undefined>).NODE_ENV = env;
      }
   });
});

describe("run clock -> useRunFrame dt", () => {
   it("clamps frame deltas", () => {
      expect(clampFrameDt(0.016)).toBe(0.016);
      expect(clampFrameDt(3)).toBe(MAX_FRAME_DT);
      expect(clampFrameDt(-1)).toBe(0);
      expect(clampFrameDt(Number.NaN)).toBe(0);
   });

   it("the game gets exactly the time the clock counted, from the countdown's last frame on", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 5000 });
      store.getState().markReady();
      store.getState().start();
      const frame = 0.023; // does not divide the 3 s countdown
      let driven = 0;
      let frames = 0;
      while (store.getState().phase !== "over") {
         const before = store.getState().elapsedMs;
         advanceRunClock(store, frame);
         const dt = playedFrameDt(store.getState());
         if (store.getState().phase === "playing") {
            // the same time on both sides, frame by frame
            expect(dt * 1000).toBeCloseTo(store.getState().elapsedMs - before, 9);
         }
         driven += dt;
         frames += 1;
      }
      expect(frames).toBeGreaterThan(COUNTDOWN_MS / 23);
      // the last frame (time up) is counted but not played
      expect(store.getState().elapsedMs).toBe(5000);
      expect(5 - driven).toBeGreaterThanOrEqual(-1e-9);
      expect(5 - driven).toBeLessThanOrEqual(frame + 1e-9);
   });

   it("is 0 outside playing and on frames with no play time", () => {
      expect(playedFrameDt({ phase: "countdown", frameMs: 0 })).toBe(0);
      expect(playedFrameDt({ phase: "paused", frameMs: 16 })).toBe(0);
      expect(playedFrameDt({ phase: "over", frameMs: 16 })).toBe(0);
      expect(playedFrameDt({ phase: "playing", frameMs: 0 })).toBe(0);
      expect(playedFrameDt({ phase: "playing", frameMs: 16 })).toBeCloseTo(0.016, 12);
   });

   it("a pause between frames stops both the clock and the game", () => {
      const store = createArcadeStore();
      store.getState().markReady();
      store.getState().start();
      for (let i = 0; i < 70; i++) advanceRunClock(store, 0.05);
      expect(store.getState().phase).toBe("playing");
      store.getState().pause();
      advanceRunClock(store, 0.05);
      expect(playedFrameDt(store.getState())).toBe(0);
      const elapsed = store.getState().elapsedMs;
      store.getState().resume();
      advanceRunClock(store, 0.02);
      expect(playedFrameDt(store.getState())).toBeCloseTo(0.02, 12);
      expect(store.getState().elapsedMs - elapsed).toBeCloseTo(20, 9);
   });
});

describe("game time", () => {
   it("advances in every phase but paused, by at most MAX_ANIM_DT per frame", () => {
      const time = createGameTime();
      advanceGameTime(time, "ready", 0.016, 0);
      advanceGameTime(time, "countdown", 0.5, 0);
      expect(time.now).toBeCloseTo(0.016 + MAX_ANIM_DT, 12);
      expect(time.delta).toBe(MAX_ANIM_DT);
      const before = time.now;
      advanceGameTime(time, "paused", 2, 1500);
      expect(time.now).toBe(before);
      expect(time.delta).toBe(0);
      advanceGameTime(time, "over", 0.02, 1500);
      expect(time.now).toBeCloseTo(before + 0.02, 12);
      advanceGameTime(time, "playing", -1, 1500);
      advanceGameTime(time, "playing", Number.NaN, 1500);
      expect(time.now).toBeCloseTo(before + 0.02, 12);
   });

   it("play time follows the store's elapsedMs", () => {
      const time = createGameTime();
      advanceGameTime(time, "playing", 0.016, 2500);
      expect(time.play).toBe(2.5);
   });
});

describe("result delay", () => {
   /** A store in "playing", like ShellStage drives it. */
   function playing(config: { durationMs?: number } = {}): StoreApi<ArcadeStore> {
      const store = createArcadeStore();
      store.getState().configure(config);
      store.getState().markReady();
      store.getState().start();
      while (store.getState().phase === "countdown") advanceRunClock(store, 0.05);
      advanceRunClock(store, 0.016);
      return store;
   }
   /** Frames (of `delta` s) until the result panel is shown, at most `limit`. */
   function framesUntilShown(store: StoreApi<ArcadeStore>, delayMs: number, delta: number, limit = 1000): number {
      let frames = 0;
      while (!isResultShown(store.getState(), delayMs) && frames < limit) {
         advanceRunClock(store, delta);
         frames += 1;
      }
      return frames;
   }

   it("resultDelayFor: 800 ms by default, 0 = at once, clamped to [0, RESULT_DELAY_MAX_MS]", () => {
      expect(DEFAULT_RESULT_DELAY_MS).toBe(800);
      expect(resultDelayFor({})).toBe(DEFAULT_RESULT_DELAY_MS);
      expect(resultDelayFor({ resultDelayMs: 0 })).toBe(0);
      expect(resultDelayFor({ resultDelayMs: 650 })).toBe(650);
      expect(resultDelayFor({ resultDelayMs: -5 })).toBe(0);
      expect(resultDelayFor({ resultDelayMs: Number.NaN })).toBe(0);
      expect(resultDelayFor({ resultDelayMs: 60_000 })).toBe(RESULT_DELAY_MAX_MS);
   });

   it("the scene stays on screen for the delay after end(), counted in rendered frames", () => {
      const store = playing();
      store.getState().addScore(40);
      store.getState().end("lose");
      // the run is over (GameShell submits now), but the panel waits
      expect(store.getState()).toMatchObject({ phase: "over", endReason: "lose", score: 40, overMs: 0 });
      expect(isResultShown(store.getState(), 800)).toBe(false);
      // 16 ms frames: 49 frames = 784 ms is not enough, the 50th (800 ms) shows it
      for (let i = 0; i < 49; i++) advanceRunClock(store, 0.016);
      expect(isResultShown(store.getState(), 800)).toBe(false);
      advanceRunClock(store, 0.016);
      expect(store.getState().overMs).toBeCloseTo(800, 9);
      expect(isResultShown(store.getState(), 800)).toBe(true);
      // the result is frozen meanwhile: no score changes after the end
      expect(store.getState().score).toBe(40);
   });

   it("a delay of 0 shows the result on the frame the run ends, and quit never waits", () => {
      const store = playing();
      store.getState().end("win");
      expect(isResultShown(store.getState(), 0)).toBe(true);
      const quit = playing();
      quit.getState().end("quit");
      expect(isResultShown(quit.getState(), 800)).toBe(true);
      // never outside "over"
      expect(isResultShown({ phase: "playing", overMs: 5000, endReason: null }, 0)).toBe(false);
      expect(isResultShown({ phase: "paused", overMs: 5000, endReason: null }, 800)).toBe(false);
   });

   it("works for a time-up end from the run clock too", () => {
      const store = playing({ durationMs: 1000 });
      while (store.getState().phase === "playing") advanceRunClock(store, 0.016);
      expect(store.getState()).toMatchObject({ phase: "over", endReason: "timeup", overMs: 0 });
      expect(framesUntilShown(store, 800, 0.016)).toBe(50);
   });

   it("pause and a hidden tab cannot break it: no pause after the end, no frames = no progress, long frames are clamped", () => {
      const store = playing();
      store.getState().end("lose");
      advanceRunClock(store, 0.1);
      // Esc / blur / visibilitychange call pause(): an ended run stays "over" and keeps counting
      store.getState().pause();
      expect(store.getState().phase).toBe("over");
      expect(store.getState().pausedFrom).toBeNull();
      // a hidden tab renders no frames: nothing advances, the panel waits for the player
      const waiting = store.getState().overMs;
      expect(isResultShown(store.getState(), 800)).toBe(false);
      // coming back: the first frame's huge delta counts as one clamped frame, so the rest plays
      advanceRunClock(store, 30);
      expect(store.getState().overMs).toBeCloseTo(waiting + MAX_FRAME_DT * 1000, 9);
      expect(isResultShown(store.getState(), 800)).toBe(false);
      expect(framesUntilShown(store, 800, 0.016)).toBeGreaterThan(30);
      expect(isResultShown(store.getState(), 800)).toBe(true);
   });

   it("restart during the delay starts clean; the next run waits again", () => {
      const store = playing();
      store.getState().end("lose");
      for (let i = 0; i < 10; i++) advanceRunClock(store, 0.016);
      store.getState().restart();
      expect(store.getState()).toMatchObject({ phase: "countdown", overMs: 0, endReason: null });
      expect(isResultShown(store.getState(), 800)).toBe(false);
      while (store.getState().phase === "countdown") advanceRunClock(store, 0.05);
      store.getState().end("lose");
      expect(store.getState().overMs).toBe(0);
      expect(framesUntilShown(store, 800, 0.02)).toBe(40);
      // configure() (a stage retry) and reset() clear it too
      store.getState().configure({});
      expect(store.getState().overMs).toBe(0);
      store.getState().reset();
      expect(store.getState().overMs).toBe(0);
   });

   it("stops counting at RESULT_DELAY_MAX_MS: no store update per frame on the result screen", () => {
      const store = playing();
      store.getState().end("lose");
      let updates = 0;
      const unsubscribe = store.subscribe(() => {
         updates += 1;
      });
      for (let i = 0; i < 200; i++) advanceRunClock(store, 0.05);
      expect(store.getState().overMs).toBe(RESULT_DELAY_MAX_MS);
      expect(updates).toBe(RESULT_DELAY_MAX_MS / 50);
      expect(isResultShown(store.getState(), 60_000)).toBe(true);
      unsubscribe();
   });

   it("the game itself never runs during the delay", () => {
      const store = playing();
      store.getState().end("win");
      for (let i = 0; i < 60; i++) {
         advanceRunClock(store, 0.016);
         expect(playedFrameDt(store.getState())).toBe(0);
      }
   });
});
