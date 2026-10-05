import { describe, expect, it } from "vitest";
import {
   FRAME_PRIORITY,
   MAX_ANIM_DT,
   MAX_FRAME_DT,
   advanceGameTime,
   advanceRunClock,
   clampFrameDt,
   createGameTime,
   playedFrameDt,
} from "./frameLoop";
import { COUNTDOWN_MS, createArcadeStore } from "./useArcadeStore";

describe("frame order", () => {
   it("input, run clock, game time, simulation, visuals; all <= 0 so R3F keeps rendering", () => {
      const order = [FRAME_PRIORITY.input, FRAME_PRIORITY.clock, FRAME_PRIORITY.gameTime, FRAME_PRIORITY.simulation, FRAME_PRIORITY.visuals];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(new Set(order).size).toBe(order.length);
      expect(Math.max(...order)).toBeLessThanOrEqual(0);
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
