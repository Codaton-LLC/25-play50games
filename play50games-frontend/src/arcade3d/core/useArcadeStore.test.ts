import { beforeEach, describe, expect, it } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { COUNTDOWN_MS, MAX_TICK_MS, createArcadeStore, type ArcadeStore } from "./useArcadeStore";

let store: StoreApi<ArcadeStore>;
const s = () => store.getState();

/** ticks in 50 ms steps (the frame clamp) until `ms` have passed */
function advance(ms: number) {
   let left = ms;
   while (left > 0) {
      const step = Math.min(50, left);
      s().tick(step);
      left -= step;
   }
}

function toPlaying(config: { durationMs?: number; lives?: number } = {}) {
   s().configure(config);
   s().markReady();
   s().start();
   advance(COUNTDOWN_MS);
}

beforeEach(() => {
   store = createArcadeStore();
});

describe("phases", () => {
   it("starts in loading and becomes ready once the scene is up", () => {
      expect(s().phase).toBe("loading");
      s().start();
      expect(s().phase).toBe("loading");
      s().markReady();
      expect(s().phase).toBe("ready");
   });

   it("configure sets timer and lives and goes back to loading", () => {
      s().configure({ durationMs: 60000, lives: 3 });
      expect(s()).toMatchObject({ phase: "loading", timeLeftMs: 60000, lives: 3, config: { durationMs: 60000, lives: 3 } });
      s().configure({});
      expect(s()).toMatchObject({ timeLeftMs: null, lives: null });
   });

   it("start runs a 3 s countdown, then plays", () => {
      s().configure({ durationMs: 10000 });
      s().markReady();
      const runId = s().runId;
      s().start();
      expect(s().phase).toBe("countdown");
      expect(s().countdownMs).toBe(COUNTDOWN_MS);
      expect(s().runId).toBe(runId + 1);

      advance(COUNTDOWN_MS - 50);
      expect(s().phase).toBe("countdown");
      expect(s().elapsedMs).toBe(0);
      expect(s().timeLeftMs).toBe(10000);

      s().tick(50);
      expect(s().phase).toBe("playing");
      expect(s().countdownMs).toBe(0);
   });

   it("start is ignored while loading and while playing", () => {
      toPlaying();
      const runId = s().runId;
      s().start();
      expect(s().phase).toBe("playing");
      expect(s().runId).toBe(runId);
   });
});

describe("pause / resume", () => {
   it("pauses and resumes a running game, the clock stops while paused", () => {
      toPlaying({ durationMs: 30000 });
      advance(1000);
      s().pause();
      expect(s().phase).toBe("paused");
      advance(5000);
      expect(s().elapsedMs).toBe(1000);
      expect(s().timeLeftMs).toBe(29000);
      s().resume();
      expect(s().phase).toBe("playing");
      advance(500);
      expect(s().elapsedMs).toBe(1500);
   });

   it("pausing during the countdown resumes into the countdown", () => {
      s().markReady();
      s().start();
      advance(1000);
      s().pause();
      expect(s().pausedFrom).toBe("countdown");
      s().resume();
      expect(s().phase).toBe("countdown");
      expect(s().countdownMs).toBe(COUNTDOWN_MS - 1000);
   });

   it("pause and resume are no-ops in other phases", () => {
      s().pause();
      expect(s().phase).toBe("loading");
      s().markReady();
      s().resume();
      expect(s().phase).toBe("ready");
   });
});

describe("tick", () => {
   it("counts elapsed time for untimed games", () => {
      toPlaying();
      advance(2500);
      expect(s().elapsedMs).toBe(2500);
      expect(s().timeLeftMs).toBeNull();
      expect(s().phase).toBe("playing");
   });

   it("ends with timeup at 0 and never counts past the timer", () => {
      toPlaying({ durationMs: 1000 });
      advance(980);
      expect(s().timeLeftMs).toBe(20);
      s().tick(50);
      expect(s()).toMatchObject({ phase: "over", endReason: "timeup", timeLeftMs: 0, elapsedMs: 1000 });
      s().tick(50);
      expect(s().elapsedMs).toBe(1000);
   });

   it("clamps huge and invalid ticks", () => {
      toPlaying();
      s().tick(10000);
      expect(s().elapsedMs).toBe(MAX_TICK_MS);
      s().tick(-5);
      s().tick(Number.NaN);
      expect(s().elapsedMs).toBe(MAX_TICK_MS);
   });

   it("does nothing outside countdown and playing", () => {
      s().tick(100);
      expect(s().elapsedMs).toBe(0);
      s().markReady();
      s().tick(100);
      expect(s().elapsedMs).toBe(0);
   });
});

describe("end", () => {
   it("is idempotent: the first reason wins", () => {
      toPlaying();
      s().end("win");
      s().end("lose");
      s().end("timeup");
      expect(s()).toMatchObject({ phase: "over", endReason: "win" });
   });

   it("is ignored before a run started", () => {
      s().end("win");
      expect(s().phase).toBe("loading");
      s().markReady();
      s().end("win");
      expect(s()).toMatchObject({ phase: "ready", endReason: null });
   });

   it("freezes score and stats once over", () => {
      toPlaying();
      s().addScore(100);
      s().setStat("batteries", 3);
      s().end("win");
      s().addScore(50);
      s().setScore(999);
      s().incStat("batteries");
      s().setLevel(4);
      expect(s()).toMatchObject({ score: 100, stats: { batteries: 3 }, level: 1 });
   });

   it("losing the last life ends the run", () => {
      toPlaying({ lives: 2 });
      s().loseLife();
      expect(s()).toMatchObject({ lives: 1, phase: "playing" });
      s().loseLife();
      expect(s()).toMatchObject({ lives: 0, phase: "over", endReason: "lose" });
      s().loseLife();
      expect(s().lives).toBe(0);
   });

   it("loseLife is a no-op for games without lives", () => {
      toPlaying();
      s().loseLife();
      expect(s()).toMatchObject({ lives: null, phase: "playing" });
   });
});

describe("score and stats", () => {
   it("adds, sets and never goes below zero", () => {
      toPlaying();
      s().addScore(30);
      s().addScore(-50);
      expect(s().score).toBe(0);
      s().setScore(120);
      s().addScore(Number.NaN);
      expect(s().score).toBe(120);
   });

   it("sets and increments stats", () => {
      toPlaying();
      s().incStat("coins");
      s().incStat("coins", 4);
      s().setStat("level", 2);
      expect(s().stats).toEqual({ coins: 5, level: 2 });
   });

   it("setStat with the same value keeps the same stats object (no re-render)", () => {
      toPlaying();
      s().setStat("coins", 1);
      const before = s().stats;
      s().setStat("coins", 1);
      expect(s().stats).toBe(before);
   });
});

describe("restart / reset", () => {
   it("restart increments runId and starts a clean run", () => {
      toPlaying({ durationMs: 5000, lives: 3 });
      s().addScore(40);
      s().incStat("coins");
      s().loseLife();
      advance(1000);
      s().end("lose");
      const runId = s().runId;

      s().restart();
      expect(s()).toMatchObject({
         phase: "countdown",
         runId: runId + 1,
         score: 0,
         stats: {},
         lives: 3,
         elapsedMs: 0,
         timeLeftMs: 5000,
         endReason: null,
         countdownMs: COUNTDOWN_MS,
      });
   });

   it("restart works from pause and lets the new run end again", () => {
      toPlaying();
      s().end("win");
      s().restart();
      advance(COUNTDOWN_MS);
      s().pause();
      s().restart();
      expect(s().phase).toBe("countdown");
      advance(COUNTDOWN_MS);
      s().end("lose");
      expect(s()).toMatchObject({ phase: "over", endReason: "lose" });
   });

   it("start after a finished run behaves like restart", () => {
      toPlaying();
      s().end("win");
      const runId = s().runId;
      s().start();
      expect(s()).toMatchObject({ phase: "countdown", runId: runId + 1 });
   });

   it("restart is ignored while loading", () => {
      s().restart();
      expect(s()).toMatchObject({ phase: "loading", runId: 0 });
   });

   it("reset is safe to call twice and restores the initial state", () => {
      toPlaying({ durationMs: 5000, lives: 2 });
      s().addScore(10);
      s().reset();
      const once = { ...s() };
      s().reset();
      expect(s()).toMatchObject({
         phase: "loading",
         score: 0,
         runId: 0,
         lives: null,
         timeLeftMs: null,
         endReason: null,
         config: { durationMs: null, lives: null },
      });
      expect({ ...s() }).toEqual(once);
   });

   it("stores are independent", () => {
      const other = createArcadeStore();
      toPlaying();
      expect(other.getState().phase).toBe("loading");
   });
});
