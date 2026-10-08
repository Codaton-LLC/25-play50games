import { describe, expect, it } from "vitest";
import { contactStride, walkStride, wrapPhase } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_SCALE } from "./assets";
import { MOVING, NONE, X_BOUND, createRun, fillPools, slabX, step, type StepInput, type TowerRun } from "./rules";
import { CHEER_MS, RUNNER_MAX_CADENCE, createRunnerGait, stepRunnerGait, type RunnerGait } from "./runnerGait";

const DT = 1 / 60, FRAME_MS = 1000 / 60;
const idle: StepInput = { moveX: 0, jumpEdge: false };
const phaseDelta = (a: number, b: number) => Math.abs(wrapPhase(b - a + Math.PI) - Math.PI);

/** One real frame: the rules step, then the gait (as the Scene's pose driver does after useRunFrame). */
function frame(run: TowerRun, gait: RunnerGait, input: StepInput, checkpointMs = NONE): void {
   step(run, FRAME_MS, input);
   stepRunnerGait(gait, run, true, DT, checkpointMs);
}

/** The runner standing still on a generated moving slab (test placement; every later frame goes through step). */
function onMovingSlab(): { run: TowerRun; index: number } {
   const run = createRun(5050);
   const index = run.slabs.find(s => s.active && s.kind === MOVING && s.index > 0)!.index;
   const y = run.tower.heights[index] / 1000;
   run.maxHeight = y; run.viewBottomY = y - 2; run.cameraTarget.y = y + 1;
   run.timeMs = 4000; run.holdUnlocked = true; fillPools(run);
   const slot = run.slabs[index % 32];
   run.player.x = slabX(slot, run.timeMs); run.player.y = y; run.player.grounded = true; run.player.groundIndex = index;
   run.permission = true; run.contactA = slot.id; run.contactB = NONE;
   return { run, index };
}

describe("tower-climb runner gait (looks only)", () => {
   it("eases into a run and out of it instead of switching poses in one frame", () => {
      const run = createRun(5050), gait = createRunnerGait(), right = { moveX: 1, jumpEdge: false };
      frame(run, gait, right);
      expect(gait.amount).toBeGreaterThan(0.1); expect(gait.amount).toBeLessThan(0.3);
      for (let i = 0; i < 30; i++) frame(run, gait, right);               // 0.52 s: x 1.55, short of the bound
      expect(gait.amount).toBeGreaterThan(0.99);
      // at a full run the phase moves exactly the ground covered over the contact stride (the planted foot stays put):
      // 0.63 m, 4.8 strides a second (the walk's own 0.45 m stride would need 6.7 and slide the foot 45 %)
      const before = gait.phase, x = run.player.x;
      frame(run, gait, right);
      const stride = contactStride(gait.amount, RUNNER_LANDMARKS) * RUNNER_SCALE;
      expect(stride).toBeCloseTo(0.63, 2);
      expect(stride / (walkStride(gait.amount, RUNNER_LANDMARKS) * RUNNER_SCALE)).toBeGreaterThan(1.4);
      expect(3 / stride).toBeLessThan(RUNNER_MAX_CADENCE);
      expect(phaseDelta(before, gait.phase)).toBeCloseTo((run.player.x - x) / stride * Math.PI * 2, 9);
      frame(run, gait, idle);
      expect(gait.amount).toBeGreaterThan(0.7);
      for (let i = 0; i < 40; i++) frame(run, gait, idle);
      expect(gait.amount).toBeLessThan(0.01);
      // the legs never beat faster than the cap, even while the amount is still easing up
      const fresh = createRunnerGait(), again = createRun(5050);
      for (let i = 0; i < 20; i++) {
         const from = fresh.phase; frame(again, fresh, right);
         expect(phaseDelta(from, fresh.phase)).toBeLessThanOrEqual(RUNNER_MAX_CADENCE * 2 * Math.PI * (again.stepMs / 1000) + 1e-9);
      }
   });

   it("stops stepping when the runner pushes against the x bound (the rules keep vx at -3 there)", () => {
      const run = createRun(5050), gait = createRunnerGait(), left = { moveX: -1, jumpEdge: false };
      for (let i = 0; i < 60 && run.player.x > -X_BOUND; i++) frame(run, gait, left);
      expect(run.player.x).toBe(-X_BOUND);
      frame(run, gait, left);
      const held = gait.phase;
      for (let i = 0; i < 40; i++) frame(run, gait, left);
      expect(run.player.vx).toBe(-3); expect(run.player.x).toBe(-X_BOUND);
      expect(gait.phase).toBe(held);
      expect(gait.amount).toBeLessThan(0.01);
      expect(gait.heading).toBeCloseTo(-Math.PI / 2, 3);
   });

   it("a moving slab carries a still runner without walking it, and walking on it steps by its own motion only", () => {
      const { run, index } = onMovingSlab(), gait = createRunnerGait();
      gait.lastX = run.player.x; gait.lastMs = run.timeMs;
      const startX = run.player.x;
      let carried = 0;
      for (let i = 0; i < 60; i++) {
         const x = run.player.x; frame(run, gait, idle); carried = Math.max(carried, Math.abs(run.player.x - x));
      }
      expect(run.player.grounded).toBe(true); expect(run.player.groundIndex).toBe(index);
      expect(carried).toBeGreaterThan(0.005); expect(Math.abs(run.player.x - startX) + carried).toBeGreaterThan(0.05);
      expect(gait.phase).toBe(0); expect(gait.amount).toBe(0);
   });

   it("a walk-off eases into the air pose and the tuck instead of starting fully tucked; a landing eases out", () => {
      const { run } = onMovingSlab(), gait = createRunnerGait(), left = { moveX: -1, jumpEdge: false };
      gait.lastX = run.player.x; gait.lastMs = run.timeMs;
      for (let i = 0; i < 120 && run.player.grounded; i++) frame(run, gait, left);
      expect(run.player.grounded).toBe(false);
      expect(Math.abs(run.player.vy)).toBeLessThan(0.5);                // a walk-off: the tuck's target is nearly 1
      expect(gait.air).toBeLessThan(0.35); expect(gait.tuck).toBeLessThan(0.2);
      const amount = gait.amount;
      frame(run, gait, left);
      expect(gait.amount).toBe(amount);                                    // it lands running
      for (let i = 0; i < 12; i++) frame(run, gait, left);
      expect(gait.air).toBeGreaterThan(0.95);
      // a landing: one grounded frame does not drop the air pose at once
      const landed = createRunnerGait();
      landed.air = 1; landed.tuck = 0.8; landed.grounded = false;
      const grounded = createRun(5050);
      stepRunnerGait(landed, grounded, true, DT, NONE);
      expect(landed.air).toBeGreaterThan(0.5); expect(landed.air).toBeLessThan(1);
   });

   it("cheers on a new checkpoint for CHEER_MS with a smooth envelope, and turns through facing the camera", () => {
      const run = createRun(5050), gait = createRunnerGait();
      run.timeMs = 10000;
      stepRunnerGait(gait, run, true, DT, 10000 - CHEER_MS / 2);
      expect(gait.cheer).toBeCloseTo(1, 9);
      stepRunnerGait(gait, run, true, DT, 10000 - CHEER_MS);
      expect(gait.cheer).toBe(0);
      stepRunnerGait(gait, run, true, DT, NONE);
      expect(gait.cheer).toBe(0);
      run.player.vx = 3; stepRunnerGait(gait, run, true, DT, NONE);
      expect(gait.heading).toBeGreaterThan(0.3); expect(gait.heading).toBeLessThan(Math.PI / 2);
      for (let i = 0; i < 30; i++) stepRunnerGait(gait, run, true, DT, NONE);
      run.player.vx = -3;
      const headings: number[] = [];
      for (let i = 0; i < 30; i++) { stepRunnerGait(gait, run, true, DT, NONE); headings.push(gait.heading); }
      expect(headings[0]).toBeGreaterThan(0); expect(headings.some(h => Math.abs(h) < 0.3)).toBe(true);
      expect(headings[29]).toBeCloseTo(-Math.PI / 2, 2);
   });
});
