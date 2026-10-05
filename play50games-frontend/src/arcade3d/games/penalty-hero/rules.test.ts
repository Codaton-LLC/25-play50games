import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import {
   AIM_TIMEOUT_MS,
   BALL_SPOT,
   CYCLE_MS,
   FIRST_GOAL_POINTS,
   FLIGHT_MS,
   HOLD_MS,
   INITIAL_WEIGHT,
   MAX_POINTS_PER_SEC,
   NEXT_GOAL_POINTS,
   RETICLE_BAND,
   RUNUP_MS,
   SHOTS,
   WIDE_X,
   ZONES,
   axisClass,
   capScore,
   createRng,
   createRun,
   drawWeightedIndex,
   finalScore,
   isAccurate,
   pointsForGoal,
   reticleOffset,
   reticleSeed,
   step,
   withinServerLimits,
   type RunState,
   type StepInput,
   type ZoneId,
} from "./rules";

const DT = 50;
const DTS = [8.3, 16.7, 50];

function play(state: RunState, dt: number, inputFor: (state: RunState) => StepInput, stop?: (state: RunState) => boolean): void {
   let guard = 0;
   while (!state.ended && guard++ < 200_000) {
      if (stop && stop(state)) break;
      step(state, dt, inputFor(state));
   }
}

function spam(seed: number, dt: number): RunState {
   const state = createRun(seed);
   play(state, dt, (s) => (s.phase === "aim" ? { jumpPressed: true } : {}));
   return state;
}

describe("schedule and determinism", () => {
   it("repeats a seed and keeps the reticle stream off the keeper stream", () => {
      const once = spam(11, 16.7);
      const twice = spam(11, 16.7);
      expect(twice.score).toBe(once.score);
      expect(twice.goals).toBe(once.goals);
      expect(twice.shotsDone).toBe(SHOTS);
      expect(twice.weights).toEqual(once.weights);
      expect(twice.elapsedMs).toBe(once.elapsedMs);
      expect(reticleSeed(11)).not.toBe(11);
      const phase = createRng(reticleSeed(5))();
      expect(createRun(5).reticlePhase).toBeCloseTo(phase * Math.PI * 2, 10);
      expect(createRun(0).ended).toBeNull();
      expect(createRun(0xffffffff).shotsDone).toBe(0);
   });

   it("draws keeper indexes from integer weights and can reach every zone", () => {
      expect(drawWeightedIndex([2, 2, 2, 2, 2, 2], 0)).toBe(0);
      expect(drawWeightedIndex([2, 2, 2, 2, 2, 2], 2 / 12)).toBe(1);
      expect(drawWeightedIndex([2, 2, 2, 2, 2, 2], 0.999999)).toBe(5);
      expect(drawWeightedIndex([0, 0, 0, 0, 0, 5], 0.5)).toBe(5);
      const seen = new Set<number>();
      for (let seed = 1; seed <= 300 && seen.size < 6; seed++) {
         const state = createRun(seed);
         step(state, DT, { jumpPressed: true });
         seen.add(state.keeperIndex);
      }
      expect(seen.size).toBe(6);
   });

   it("does not let the current shot choose the dive", () => {
      const left = createRun(4242);
      const right = createRun(4242);
      step(left, DT, { zoneId: "top-left" });
      step(right, DT, { zoneId: "bottom-right" });
      expect(left.keeperIndex).toBe(right.keeperIndex);
      expect(left.keeperIndex).toBeGreaterThanOrEqual(0);
      expect(left.weights[0]).toBe(INITIAL_WEIGHT + 1);
      expect(right.weights[5]).toBe(INITIAL_WEIGHT + 1);
      expect(left.weights[5]).toBe(INITIAL_WEIGHT);
      expect(right.weights[0]).toBe(INITIAL_WEIGHT);
   });
});

describe("aiming", () => {
   it("moves one zone on a threshold crossing and does not repeat while held", () => {
      const state = createRun(1);
      expect(ZONES[4]).toBe("bottom-centre");
      expect(state.col).toBe(1);
      expect(state.row).toBe(0);
      expect(axisClass(0.5)).toBe(0);
      expect(axisClass(-0.5)).toBe(0);
      expect(axisClass(0.51)).toBe(1);

      let ev = step(state, DT, { moveX: 1 });
      expect(ev.aimMoved).toBe(true);
      expect(state.col).toBe(2);
      expect(state.row).toBe(0);
      ev = step(state, DT, { moveX: 1 });
      expect(ev.aimMoved).toBe(false);
      expect(state.col).toBe(2);
      ev = step(state, DT, { moveX: 1 });
      expect(ev.aimMoved).toBe(false);
      expect(state.col).toBe(2);

      step(state, DT, { moveX: 0 });
      ev = step(state, DT, { moveX: -1 });
      expect(ev.aimMoved).toBe(true);
      expect(state.col).toBe(1);

      ev = step(state, DT, { moveY: -1 });
      expect(ev.aimMoved).toBe(true);
      expect(state.row).toBe(1);
      expect(state.col).toBe(1);
      ev = step(state, DT, { moveY: -1 });
      expect(ev.aimMoved).toBe(false);
      expect(state.row).toBe(1);
   });

   it("lets horizontal win a diagonal and rearms in the dead zone", () => {
      const state = createRun(1);
      const ev = step(state, DT, { moveX: 1, moveY: -1 });
      expect(ev.aimMoved).toBe(true);
      expect(state.col).toBe(2);
      expect(state.row).toBe(0);
      step(state, DT, { moveX: 0.2, moveY: 0.2 });
      const again = step(state, DT, { moveX: -1, moveY: -1 });
      expect(again.aimMoved).toBe(true);
      expect(state.col).toBe(1);
      expect(state.row).toBe(0);
   });

   it("ignores a held key when the next shot begins", () => {
      const state = createRun(1);
      state.reticlePhase = 0;
      step(state, DT, { moveX: 1, jumpPressed: true });
      expect(state.col).toBe(2);
      expect(state.phase).toBe("runup");
      play(state, DT, () => ({ moveX: 1 }), (s) => s.phase === "aim" && s.shotsDone === 1);
      expect(state.phase).toBe("aim");
      expect(state.col).toBe(2);
      const ev = step(state, DT, { moveX: 1 });
      expect(ev.aimMoved).toBe(false);
      expect(ev.shot).toBe(false);
      expect(state.col).toBe(2);
   });

   it("shoots on Space or E, and a tap uses the projected zone", () => {
      const keyed = createRun(3);
      keyed.reticlePhase = 0;
      const shot = step(keyed, DT, { actionPressed: true });
      expect(shot.shot).toBe(true);
      expect(keyed.pending.zone).toBe(4);

      const tapped = createRun(3);
      tapped.reticlePhase = 0;
      step(tapped, DT, { zoneId: "top-right" as ZoneId });
      expect(tapped.events.shot).toBe(true);
      expect(tapped.col).toBe(2);
      expect(tapped.row).toBe(1);
      expect(tapped.pending.zone).toBe(2);
   });
});

describe("outcomes", () => {
   it("treats the centre band as accurate and an off-centre shot as a wide miss", () => {
      expect(isAccurate(RETICLE_BAND)).toBe(true);
      expect(isAccurate(-RETICLE_BAND)).toBe(true);
      expect(isAccurate(RETICLE_BAND + 0.001)).toBe(false);
      expect(reticleOffset(0, 0)).toBeCloseTo(0, 10);
      expect(isAccurate(reticleOffset(0, Math.PI / 2))).toBe(false);

      const wide = createRun(1);
      wide.reticlePhase = Math.PI / 2;
      step(wide, DT, { jumpPressed: true });
      expect(wide.pending.accurate).toBe(false);
      expect(Math.abs(wide.targetX)).toBeCloseTo(WIDE_X, 10);
      play(wide, DT, () => ({}), (s) => s.lastResult !== "none");
      expect(wide.lastResult).toBe("wide");
      expect(wide.score).toBe(0);
      expect(wide.streak).toBe(0);
      expect(wide.weights[4]).toBe(INITIAL_WEIGHT + 1);
   });

   it("saves an accurate shot the keeper dives into, and scores a goal otherwise", () => {
      const saved = createRun(1);
      saved.reticlePhase = 0;
      for (let i = 0; i < 6; i++) saved.weights[i] = i === 4 ? 5 : 0;
      step(saved, DT, { jumpPressed: true });
      expect(saved.keeperIndex).toBe(4);
      play(saved, DT, () => ({}), (s) => s.lastResult !== "none");
      expect(saved.lastResult).toBe("saved");
      expect(saved.score).toBe(0);
      expect(saved.streak).toBe(0);

      const goal = createRun(1);
      goal.reticlePhase = 0;
      for (let i = 0; i < 6; i++) goal.weights[i] = i === 0 ? 5 : 0;
      step(goal, DT, { jumpPressed: true });
      expect(goal.keeperIndex).toBe(0);
      expect(goal.pending.zone).toBe(4);
      play(goal, DT, () => ({}), (s) => s.lastResult !== "none");
      expect(goal.lastResult).toBe("goal");
      expect(goal.score).toBe(FIRST_GOAL_POINTS);
      expect(goal.streak).toBe(1);
      expect(goal.goals).toBe(1);
   });

   it("pays 150 from the second goal in a row and resets on a miss", () => {
      expect(pointsForGoal(0)).toBe(FIRST_GOAL_POINTS);
      expect(pointsForGoal(1)).toBe(NEXT_GOAL_POINTS);
      expect(FIRST_GOAL_POINTS + 9 * NEXT_GOAL_POINTS).toBe(1450);

      const state = createRun(1);
      state.reticlePhase = 0;
      for (let i = 0; i < 6; i++) state.weights[i] = i === 0 ? 5 : 0;
      step(state, DT, { jumpPressed: true });
      play(state, DT, () => ({}), (s) => s.phase === "aim");
      expect(state.score).toBe(100);
      state.reticlePhase = 0;
      for (let i = 0; i < 6; i++) state.weights[i] = i === 0 ? 5 : 0;
      step(state, DT, { jumpPressed: true });
      play(state, DT, () => ({}), (s) => s.phase === "aim");
      expect(state.score).toBe(250);
      expect(state.streak).toBe(2);
      state.reticlePhase = Math.PI / 2;
      step(state, DT, { jumpPressed: true });
      play(state, DT, () => ({}), (s) => s.lastResult === "wide");
      expect(state.streak).toBe(0);
      expect(state.score).toBe(250);
   });

   it("times out as a miss and ignores a shot on that frame", () => {
      const state = createRun(8);
      state.aimMs = AIM_TIMEOUT_MS - DT;
      const ev = step(state, DT, { jumpPressed: true, zoneId: "top-left", moveX: 1 });
      expect(ev.shot).toBe(false);
      expect(ev.timeout).toBe(false);
      expect(state.pending.kind).toBe("timeout");
      expect(state.col).toBe(2);
      expect(state.weights.every((w) => w === INITIAL_WEIGHT)).toBe(true);
      let timed = false;
      play(state, DT, () => ({ jumpPressed: true }), (s) => {
         if (s.lastResult === "timeout") timed = true;
         return timed;
      });
      expect(state.lastResult).toBe("timeout");
      expect(state.score).toBe(0);
      expect(state.streak).toBe(0);
      expect(state.goals).toBe(0);
      expect(state.weights.every((w) => w === INITIAL_WEIGHT)).toBe(true);
   });

   it("scores 0 for ten idle timeouts and 1450 when every shot is a goal", () => {
      const idle = createRun(3);
      play(idle, DT, () => {
         return {};
      });
      expect(idle.ended).toBe("win");
      expect(idle.score).toBe(0);
      expect(idle.goals).toBe(0);
      expect(idle.streak).toBe(0);
      expect(idle.shotsDone).toBe(SHOTS);
      expect(idle.weights.every((w) => w === INITIAL_WEIGHT)).toBe(true);
      expect(idle.elapsedMs).toBe(SHOTS * (AIM_TIMEOUT_MS + CYCLE_MS));
      expect(capScore(idle.score, idle.elapsedMs)).toBe(0);

      let perfect: RunState | null = null;
      for (let seed = 1; seed <= 400 && !perfect; seed++) {
         const state = createRun(seed);
         let zone = 0;
         play(state, DT, (s) => {
            if (s.phase !== "aim") return {};
            if (!isAccurate(reticleOffset(s.aimMs, s.reticlePhase))) return {};
            const id = ZONES[zone % ZONES.length];
            zone += 1;
            return { zoneId: id };
         });
         if (state.goals === SHOTS) perfect = state;
      }
      expect(perfect).not.toBeNull();
      expect(perfect?.score).toBe(1450);
      expect(perfect && capScore(perfect.score, perfect.elapsedMs)).toBe(1450);
      expect(perfect && finalScore(perfect.score, perfect.elapsedMs).score).toBe(1450);
   });
});

describe("timing and the server cap", () => {
   it("needs at least 16000 ms for ten immediate shots", () => {
      // 15950 ms is only slack under this floor. The clock itself does not drop a frame.
      for (let d = 0; d < DTS.length; d++) {
         const state = spam(1, DTS[d]);
         expect(state.shotsDone).toBe(SHOTS);
         expect(state.ended).toBe("win");
         expect(state.elapsedMs).toBeGreaterThanOrEqual(SHOTS * CYCLE_MS - 1);
      }
      const exact = spam(1, DT);
      expect(exact.elapsedMs).toBe(SHOTS * CYCLE_MS);
      expect(spam(1, 8.3).elapsedMs).toBeGreaterThanOrEqual(SHOTS * CYCLE_MS);
      expect(spam(1, 16.7).elapsedMs).toBeGreaterThanOrEqual(SHOTS * CYCLE_MS);
   });

   it("spends 700, 500 and 400 ms in order", () => {
      const state = createRun(1);
      state.reticlePhase = 0;
      step(state, DT, { jumpPressed: true });
      expect(state.phase).toBe("runup");
      expect(state.phaseMs).toBe(DT);
      step(state, RUNUP_MS - DT);
      expect(state.phase).toBe("flight");
      expect(state.phaseMs).toBe(0);
      const resolved = step(state, FLIGHT_MS);
      expect(state.phase).toBe("hold");
      expect(state.phaseMs).toBe(0);
      expect(resolved.goal || resolved.saved || resolved.wide).toBe(true);
      step(state, HOLD_MS);
      expect(state.phase).toBe("aim");
      expect(state.shotsDone).toBe(1);
      expect(state.aimMs).toBe(0);
   });

   it("carries a 50 ms remainder from run-up into flight and does not reuse the shooting edge", () => {
      const state = createRun(1);
      state.reticlePhase = 0;
      const ev = step(state, RUNUP_MS + 50, { jumpPressed: true });
      expect(ev.shot).toBe(true);
      expect(state.phase).toBe("flight");
      expect(state.phaseMs).toBe(50);
      const whole = createRun(2);
      whole.reticlePhase = 0;
      step(whole, CYCLE_MS + 80, { jumpPressed: true });
      expect(whole.shotsDone).toBe(1);
      expect(whole.phase).toBe("aim");
      expect(whole.aimMs).toBe(80);
      expect(whole.pending.kind).toBe("none");
      const next = step(whole, DT, {});
      expect(next.shot).toBe(false);
      expect(whole.phase).toBe("aim");
   });

   it("stays under 150 points per second for many seeds and frame steps", () => {
      for (let s = 0; s < 20; s++) {
         for (let d = 0; d < DTS.length; d++) {
            const state = spam(1000 + s * 13, DTS[d]);
            expect(state.ended).toBe("win");
            expect(state.score).toBeLessThanOrEqual(1450);
            expect(state.score * 1000).toBeLessThanOrEqual(MAX_POINTS_PER_SEC * state.elapsedMs + 1e-6);
            expect(capScore(state.score, state.elapsedMs)).toBe(state.score);
            expect(withinServerLimits(state.score, Math.round(state.elapsedMs))).toBe(true);
         }
      }
      expect(finalScore(9000, 16_000)).toEqual({ score: 1500, durationMs: 16_000 });
      expect(finalScore(1450, 16_000).score).toBe(1450);
   });

   it("ignores a non-positive dt and ends only once", () => {
      const state = spam(4, DT);
      expect(state.ended).toBe("win");
      const elapsed = state.elapsedMs;
      const again = step(state, DT, { jumpPressed: true });
      expect(again.ended).toBeNull();
      expect(again.shot).toBe(false);
      expect(state.elapsedMs).toBe(elapsed);
      const fresh = createRun(4);
      step(fresh, 0, { jumpPressed: true });
      step(fresh, -10, { jumpPressed: true });
      expect(fresh.elapsedMs).toBe(0);
      expect(fresh.phase).toBe("aim");
      expect(fresh.score).toBe(0);
   });
});

function backToAim(state: RunState): void {
   if (state.phase === "aim" && state.pending.kind === "none") return;
   play(state, DT, () => ({}), (s) => s.phase === "aim" && s.pending.kind === "none");
}

describe("pinned rules", () => {
   it("follows the keeper golden sequence for seed 0xdeadbeef", () => {
      expect(drawWeightedIndex([2, 2, 2, 2, 2, 2], 1.6 / 12)).toBe(0);
      expect(drawWeightedIndex([2, 2, 2, 2, 2, 2], 3.9 / 12)).toBe(1);
      expect(createRun(1).weights).toEqual([2, 2, 2, 2, 2, 2]);

      const seed = 0xdeadbeef;
      const state = createRun(seed);
      const ref = createRng(seed);
      const w = [2, 2, 2, 2, 2, 2];
      const taps = [0, 1, 2, 3, 4, 5, 0, 1, 2];
      for (let t = 0; t < 8; t++) {
         expect(state.phase).toBe("aim");
         step(state, 10, { zoneId: ZONES[taps[t]] });
         expect(state.keeperIndex).toBe(drawWeightedIndex(w, ref()));
         w[taps[t]] += 1;
         expect(state.weights).toEqual(w);
         backToAim(state);
      }
      const weightsAtTimeout = w.slice();
      play(state, DT, () => ({}), (s) => s.phase === "aim" && s.shotsDone === 9);
      expect(state.lastResult).toBe("timeout");
      expect(state.weights).toEqual(weightsAtTimeout);
      step(state, 10, { zoneId: ZONES[taps[8]] });
      expect(state.keeperIndex).toBe(drawWeightedIndex(w, ref()));
      w[taps[8]] += 1;
      expect(state.weights).toEqual(w);
   });

   it("moves once per key press and ignores a key held through the run-up", () => {
      expect(axisClass(-0.51)).toBe(-1);
      const state = createRun(1);
      expect(state.col).toBe(1);
      step(state, DT, { moveX: -1 });
      expect(state.col).toBe(0);
      step(state, DT, { moveX: 0 });
      step(state, DT, { moveX: 1 });
      step(state, DT, { moveX: 1 });
      step(state, DT, { moveX: 1 });
      expect(state.col).toBe(1);

      const held = createRun(2);
      held.reticlePhase = 0;
      step(held, DT, { jumpPressed: true });
      expect(held.col).toBe(1);
      expect(held.phase).toBe("runup");
      play(held, DT, () => ({ moveX: 1 }), (s) => s.phase === "aim" && s.shotsDone === 1);
      expect(held.col).toBe(1);
      step(held, DT, { moveX: 1 });
      expect(held.col).toBe(1);
   });

   it("resets the streak on a save and on a timeout", () => {
      const state = createRun(4);
      const shoot = (keeperZone: number) => {
         state.reticlePhase = 0;
         for (let i = 0; i < 6; i++) state.weights[i] = i === keeperZone ? 5 : 0;
         step(state, DT, { jumpPressed: true });
         backToAim(state);
      };
      shoot(0);
      expect(state.score).toBe(100);
      expect(state.streak).toBe(1);
      shoot(0);
      expect(state.score).toBe(250);
      expect(state.streak).toBe(2);
      shoot(4);
      expect(state.lastResult).toBe("saved");
      expect(state.streak).toBe(0);
      expect(state.score).toBe(250);
      shoot(0);
      expect(state.score).toBe(350);
      expect(state.streak).toBe(1);
      step(state, AIM_TIMEOUT_MS, {});
      backToAim(state);
      expect(state.lastResult).toBe("timeout");
      expect(state.streak).toBe(0);
      expect(state.score).toBe(350);
      shoot(0);
      expect(state.score).toBe(450);
      expect(state.streak).toBe(1);
   });

   it("pins the phase lengths and the idle clock", () => {
      expect([RUNUP_MS, FLIGHT_MS, HOLD_MS, AIM_TIMEOUT_MS]).toEqual([700, 500, 400, 20_000]);
      const idle = createRun(9);
      play(idle, DT, () => ({}));
      expect(idle.elapsedMs).toBe(216_000);
      expect(idle.score).toBe(0);

      const carry = createRun(9);
      step(carry, 19_990, {});
      expect(carry.phase).toBe("aim");
      expect(carry.aimMs).toBe(19_990);
      step(carry, 30, {});
      expect(carry.phase).toBe("runup");
      expect(carry.pending.kind).toBe("timeout");
      expect(carry.phaseMs).toBe(20);
   });

   it("redraws the reticle from its own stream", () => {
      expect(reticleSeed(0)).toBe(0x9e3779b9);
      expect(reticleSeed(0xffffffff)).toBe(0x61c88646);
      expect(reticleOffset(300, 0)).toBeCloseTo(0.6, 6);
      expect(reticleOffset(600, 0)).toBeCloseTo(0, 8);
      expect(isAccurate(0.25)).toBe(true);
      expect(isAccurate(0.2501)).toBe(false);
      expect(isAccurate(RETICLE_BAND)).toBe(true);

      const seed = 77;
      const state = createRun(seed);
      const rng = createRng(reticleSeed(seed));
      expect(state.reticlePhase).toBeCloseTo(rng() * Math.PI * 2, 10);
      state.reticlePhase = 0;
      step(state, DT, { jumpPressed: true });
      backToAim(state);
      expect(state.reticlePhase).toBeCloseTo(rng() * Math.PI * 2, 10);
   });

   it("sends a wide ball outside the top row and parks a timeout on the ball spot", () => {
      const right = createRun(1);
      right.reticlePhase = Math.PI / 2;
      step(right, DT, { moveY: -1 });
      step(right, DT, { jumpPressed: true });
      expect(right.targetX).toBeCloseTo(WIDE_X, 10);
      expect(right.targetY).toBeCloseTo(1.83, 10);

      const left = createRun(1);
      left.reticlePhase = -Math.PI / 2;
      step(left, DT, { moveY: -1 });
      step(left, DT, { jumpPressed: true });
      expect(left.targetX).toBeCloseTo(-WIDE_X, 10);
      expect(left.targetY).toBeCloseTo(1.83, 10);

      backToAim(left);
      step(left, AIM_TIMEOUT_MS, {});
      expect(left.pending.kind).toBe("timeout");
      expect(left.targetX).toBe(BALL_SPOT.x);
      expect(left.targetY).toBe(BALL_SPOT.y);
   });

   it("does not shoot an unknown zone, and a null tap leaves the aim clock running", () => {
      const unknown = createRun(1);
      const ev = step(unknown, DT, { zoneId: "nope" });
      expect(ev.shot).toBe(false);
      expect(unknown.phase).toBe("aim");
      expect(unknown.pending.kind).toBe("none");
      expect(unknown.aimMs).toBe(DT);

      const missed = createRun(1);
      const none = step(missed, DT, { zoneId: null });
      expect(none.shot).toBe(false);
      expect(missed.phase).toBe("aim");
      expect(missed.aimMs).toBe(DT);
   });

   it("matches the store clock through countdown, pause and resume", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: null, lives: null });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5);
      let pausedPlay = false;
      let pausedCountdown = false;
      let guard = 0;
      while (!run.ended && guard++ < 20_000) {
         if (!pausedCountdown && store.getState().phase === "countdown") {
            const left = store.getState().countdownMs;
            store.getState().pause();
            advanceRunClock(store, 0.05);
            expect(playedFrameDt(store.getState())).toBe(0);
            expect(store.getState().countdownMs).toBe(left);
            store.getState().resume();
            pausedCountdown = true;
         }
         advanceRunClock(store, 0.02);
         const dt = playedFrameDt(store.getState());
         if (dt > 0) step(run, store.getState().frameMs, run.phase === "aim" ? { jumpPressed: true } : {});
         if (!pausedPlay && run.shotsDone === 2 && run.phase === "aim") {
            const before = run.elapsedMs;
            store.getState().pause();
            for (let i = 0; i < 4; i++) {
               advanceRunClock(store, 0.05);
               expect(playedFrameDt(store.getState())).toBe(0);
            }
            expect(run.elapsedMs).toBe(before);
            store.getState().resume();
            pausedPlay = true;
         }
      }
      expect(run.ended).toBe("win");
      expect(Math.abs(store.getState().elapsedMs - run.elapsedMs)).toBeLessThanOrEqual(1e-6);
      expect(Math.round(run.elapsedMs)).toBeGreaterThanOrEqual(16_000);
      expect(withinServerLimits(run.score, run.elapsedMs)).toBe(true);
      expect(capScore(run.score, run.elapsedMs)).toBe(run.score);
   });

   it("stays inside the scoring rules for a seeded fuzz of frames", () => {
      for (let seed = 1; seed <= 8; seed++) {
         const rng = createRng(seed + 50);
         const state = createRun(seed);
         let streak = 0;
         let expectScore = 0;
         let resolutions = 0;
         let ends = 0;
         let guard = 0;
         while (!state.ended && guard++ < 80_000) {
            const dt = rng() * 49 + 1;
            const roll = rng();
            const input: StepInput = {
               moveX: rng() < 0.15 ? Number.NaN : rng() * 2 - 1,
               moveY: rng() * 2 - 1,
               jumpPressed: roll < 0.35,
               actionPressed: roll > 0.85,
               zoneId: roll < 0.2 ? ZONES[Math.floor(rng() * ZONES.length)] : roll < 0.3 ? "nope" : roll < 0.4 ? null : undefined,
            };
            const ev = step(state, dt, input);
            if (ev.goal) {
               expectScore += pointsForGoal(streak);
               streak += 1;
               resolutions += 1;
            }
            if (ev.saved || ev.wide || ev.timeout) {
               streak = 0;
               resolutions += 1;
            }
            if (ev.ended === "win") ends += 1;
            expect(state.score).toBe(expectScore);
            expect(state.score).toBeLessThanOrEqual(1450);
            expect(state.score * 1000).toBeLessThanOrEqual(MAX_POINTS_PER_SEC * state.elapsedMs + 1e-6);
         }
         expect(state.ended).toBe("win");
         expect(resolutions).toBe(10);
         expect(ends).toBe(1);
         expect(state.score).toBe(expectScore);
         expect(Math.round(state.elapsedMs)).toBeGreaterThanOrEqual(16_000);
         expect(Math.round(state.elapsedMs)).toBeLessThanOrEqual(216_050);
      }
   });
});
