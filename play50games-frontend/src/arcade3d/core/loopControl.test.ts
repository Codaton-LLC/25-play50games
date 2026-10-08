import { describe, expect, it, vi } from "vitest";
import { loopsStopOn, registerLoopStopper, stopShellLoops } from "./loopControl";

describe("loop control", () => {
   it("calls every registered stopper, and none after unregistering", () => {
      const a = vi.fn();
      const b = vi.fn();
      const offA = registerLoopStopper(a);
      const offB = registerLoopStopper(b);
      stopShellLoops();
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
      offA();
      stopShellLoops();
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(2);
      offB();
      stopShellLoops();
      expect(b).toHaveBeenCalledTimes(2);
   });

   it("keeps going when one stopper throws", () => {
      const bad = vi.fn(() => {
         throw new Error("boom");
      });
      const good = vi.fn();
      const offBad = registerLoopStopper(bad);
      const offGood = registerLoopStopper(good);
      expect(() => stopShellLoops()).not.toThrow();
      expect(good).toHaveBeenCalledTimes(1);
      offBad();
      offGood();
   });

   it("stops on pause and at the end of a run, not on start or resume", () => {
      expect(loopsStopOn("playing", "paused")).toBe(true);
      expect(loopsStopOn("countdown", "paused")).toBe(true);
      expect(loopsStopOn("playing", "over")).toBe(true);
      expect(loopsStopOn("paused", "playing")).toBe(false);
      expect(loopsStopOn("countdown", "playing")).toBe(false);
      expect(loopsStopOn("ready", "countdown")).toBe(false);
      expect(loopsStopOn("over", "over")).toBe(false);
   });
});
