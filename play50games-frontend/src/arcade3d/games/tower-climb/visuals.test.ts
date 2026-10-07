import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { createRun, landingTime, slabX, step, createStepInput, HOLD_MS, INTACT, WARNING, FALLING, MOVING, MOVING_SLAB, SPUR, type StepInput, type TowerRun } from "./rules";
import { createVisualState, writeSlab, writeSpur, writeCoin, writeFlag, writeSection, runnerFootY } from "./visuals";

/** The rules tests' climbing bot (no coin detour): aims at the next required slab's future centre. */
function climbInput(run: TowerRun, out: StepInput): void {
   const p = run.player, index = p.groundIndex + 1;
   out.jumpEdge = false; out.moveX = 0;
   if (!run.holdUnlocked || run.pendingLose) return;
   const slab = run.slabs[index % 32], rise = slab.y - (p.grounded ? p.y : run.flight.y);
   const arrival = p.grounded ? run.timeMs + 1000 * landingTime(rise) : run.flight.atMs + 1000 * landingTime(rise, run.flight.vy);
   const distance = slabX(slab, arrival) - p.x;
   if (p.grounded) {
      if (Math.abs(distance) <= 1.5) out.jumpEdge = true;
      else { out.moveX = Math.sign(distance); return; }
   }
   out.moveX = Math.max(-1, Math.min(1, distance / (3 * Math.max(0.001, (arrival - run.timeMs) / 1000))));
}

const rockAngle = (matrix: Matrix4) => {
   const q = new Quaternion(); matrix.decompose(new Vector3(), q, new Vector3());
   return 2 * Math.asin(Math.min(1, Math.abs(q.x)));
};

describe("tower-climb pool placement and end poses", () => {
   it("slab origins are the collision tops; a slab is shown while its top is in the column (the body below is clipped)", () => {
      const run = createRun(5050), matrix = new Matrix4(), slot = run.slabs[0];
      expect(writeSlab(run, slot, matrix)).not.toBe(false); expect(matrix.elements[13]).toBe(slot.y);
      slot.y = 4.001; expect(writeSlab(run, slot, matrix)).toBe(false);
      slot.y = 4; expect(writeSlab(run, slot, matrix)).not.toBe(false);
      slot.y = -1.9; expect(writeSlab(run, slot, matrix)).not.toBe(false); // top above -2, body crossing it
      slot.y = -2; expect(writeSlab(run, slot, matrix)).not.toBe(false);
      slot.y = -2.001; expect(writeSlab(run, slot, matrix)).toBe(false);
      expect(run.slabs[0]).toBe(slot);
   });

   it("draws a slab the runner stands on just above the loss line (seed 5: a walk-off lands two steps down)", () => {
      const run = createRun(5), input = createStepInput(), still = createStepInput(), matrix = new Matrix4();
      for (let guard = 0; !(run.player.grounded && run.player.groundIndex === 9); guard++) {
         if (guard > 2000) throw new Error("bot did not reach step 9");
         climbInput(run, input); step(run, 16, input);
      }
      for (let i = 0; i < 20; i++) step(run, 16, still);
      step(run, 16, { moveX: 0, jumpEdge: true });            // a jump in place raises the loss line
      while (!run.player.grounded) step(run, 16, still);
      const left = { moveX: -1, jumpEdge: false };
      while (run.player.grounded) step(run, 16, left);          // walk off the left edge, then let go
      while (!run.player.grounded && !run.pendingLose) step(run, 16, still);
      expect(run.pendingLose).toBe(false);
      expect(run.player.groundIndex).toBe(7);
      const slab = run.slabs[7];
      expect(run.contactA).toBe(slab.id);
      expect(slab.y - 0.16).toBeLessThan(run.viewBottomY);   // its body crosses the danger line
      expect(writeSlab(run, slab, matrix)).not.toBe(false);   // ...but the top it stands on is drawn
      expect(matrix.elements[13]).toBe(run.player.y);
   });

   it("moving slabs are drawn where the rules collide them (slabX), 2 x travel apart at the extremes", () => {
      const run = createRun(5050), matrix = new Matrix4(), slot = run.slabs.find(s => s.active && s.kind === MOVING)!;
      expect(slot).toBeDefined();
      slot.y = 1;
      const start = (MOVING_SLAB.periodMs - (slot.phaseMs % MOVING_SLAB.periodMs)) % MOVING_SLAB.periodMs;
      const xs: number[] = [];
      for (const ms of [start, start + MOVING_SLAB.periodMs / 2, start + MOVING_SLAB.periodMs / 4]) {
         run.timeMs = ms;
         expect(writeSlab(run, slot, matrix)).not.toBe(false);
         expect(matrix.elements[12]).toBeCloseTo(slabX(slot, ms), 12);
         xs.push(matrix.elements[12]);
      }
      expect(xs[0]).toBeCloseTo(slot.baseX - MOVING_SLAB.travel, 9);
      expect(xs[1] - xs[0]).toBeCloseTo(2 * MOVING_SLAB.travel, 9);
      expect(xs[2]).toBeCloseTo(slot.baseX, 9);
   });

   it("the warning rocks about x only, changes pool in the same frame, and reduced motion retains cracks", () => {
      const run = createRun(5050), visual = createVisualState(), slot = run.spurs.find(s => s.active)!;
      const matrix = new Matrix4(), position = new Vector3(), scale = new Vector3(), rotation = new Quaternion();
      slot.y = 0; slot.state = INTACT;
      expect(writeSpur(run, slot, false, visual, 0, false, matrix)).not.toBe(false);
      expect(writeSpur(run, slot, true, visual, 0, false, matrix)).toBe(false);
      slot.state = WARNING; slot.warnStartMs = 1000; run.timeMs = 1525;
      expect(writeSpur(run, slot, false, visual, 0, false, matrix)).toBe(false);
      expect(writeSpur(run, slot, true, visual, 0, false, matrix)).not.toBe(false);
      matrix.decompose(position, rotation, scale);
      expect(position.x).toBe(slot.baseX); expect(position.y).toBe(0); expect(rotation.y).toBe(0); expect(rotation.z).toBe(0);
      expect(Math.abs(rotation.x)).toBeGreaterThan(0.01);
      expect(writeSpur(run, slot, true, visual, 0, true, matrix)).not.toBe(false);
      matrix.decompose(position, rotation, scale); expect(rotation.angleTo(new Quaternion())).toBe(0);
   });

   it("the warning rock grows with its age over SPUR.warningMs at 6 Hz, capped at 3 degrees", () => {
      const run = createRun(5050), visual = createVisualState(), slot = run.spurs.find(s => s.active)!, matrix = new Matrix4();
      slot.y = 0; slot.state = WARNING; slot.warnStartMs = 1000;
      const cap = Math.PI / 60;
      // ages at the sine's peaks (6 Hz: every 1000 / 12 ms from 1000 / 24)
      for (const age of [125, 625, 875]) {
         run.timeMs = slot.warnStartMs + age;
         expect(writeSpur(run, slot, true, visual, 0, false, matrix)).not.toBe(false);
         expect(rockAngle(matrix)).toBeCloseTo(cap * Math.min(1, age / SPUR.warningMs), 6);
      }
      // a zero of the sine: level, whatever the age
      run.timeMs = slot.warnStartMs + 500;
      writeSpur(run, slot, true, visual, 0, false, matrix);
      expect(rockAngle(matrix)).toBeLessThan(1e-9);
   });

   it("debris and the runner fall continue through the 800 ms delay with no x drift or rules mutation", () => {
      const run = createRun(5050), visual = createVisualState(), matrix = new Matrix4(), slot = run.spurs.find(s => s.active)!;
      run.timeMs = HOLD_MS + 1000; run.pendingLose = true;
      run.loss.atMs = run.timeMs; run.loss.footY = -2; run.loss.vy = -1; run.loss.x = 0.7;
      slot.y = 0; slot.state = FALLING; slot.collapseMs = run.timeMs;
      expect(runnerFootY(run, visual, "over", 50)).toBe(-2);
      expect(runnerFootY(run, visual, "over", 50.557)).toBeLessThan(-3.55);
      expect(writeSpur(run, slot, true, visual, 50.5, false, matrix, "over")).not.toBe(false);
      expect(matrix.elements[12]).toBe(slot.baseX); expect(matrix.elements[13]).toBeCloseTo(-0.75);
      expect(run.timeMs).toBe(HOLD_MS + 1000); expect(run.player.x).toBe(0);
      // the top (-1.92) is still above the danger line: shown, its body clipped below the line
      expect(writeSpur(run, slot, true, visual, 50.8, false, matrix, "over")).not.toBe(false);
      expect(matrix.elements[13]).toBeCloseTo(-1.92);
      expect(writeSpur(run, slot, true, visual, 50.82, false, matrix, "over")).toBe(false);
   });

   it("coins/flags are hidden until their full extent fits; coins keep their rule position for pickup", () => {
      const run = createRun(5050), matrix = new Matrix4(), coin = run.coins[0], flag = run.flags[0];
      coin.active = true; coin.y = 3.7; coin.x = -1.5;
      expect(writeCoin(run, coin, 0, true, matrix)).not.toBe(false); expect(matrix.elements[13]).toBe(3.7);
      coin.y = 3.701; expect(writeCoin(run, coin, 0, false, matrix)).toBe(false);
      flag.active = true; flag.y = 3.201; expect(writeFlag(run, flag, matrix)).toBe(false);
      flag.y = 3.2; expect(writeFlag(run, flag, matrix)).not.toBe(false);
   });

   it("coins spin about y only and bob by at most 0.03 m", () => {
      const run = createRun(5050), matrix = new Matrix4(), coin = run.coins[0];
      const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
      coin.active = true; coin.collected = false; coin.y = 1; coin.x = 0.8;
      expect(writeCoin(run, coin, 0.5, false, matrix)).not.toBe(false);
      matrix.decompose(position, rotation, scale);
      expect(Math.abs(rotation.x)).toBeLessThan(1e-12); expect(Math.abs(rotation.z)).toBeLessThan(1e-12);
      expect(Math.abs(rotation.y)).toBeGreaterThan(0.1);
      expect(position.x).toBe(0.8);
      let peak = 0;
      for (let now = 0; now < 3; now += 0.01) {
         writeCoin(run, coin, now, false, matrix);
         peak = Math.max(peak, Math.abs(matrix.elements[13] - coin.y));
      }
      expect(peak).toBeLessThanOrEqual(0.03 + 1e-12); expect(peak).toBeGreaterThan(0.029);
      writeCoin(run, coin, 0.5, true, matrix); expect(matrix.elements[13]).toBe(coin.y);
   });

   it("tower sections sit behind the column and are hidden once they leave it", () => {
      const run = createRun(5050), matrix = new Matrix4(), section = run.sections.find(s => s.active)!;
      expect(writeSection(run, section, matrix)).not.toBe(false);
      expect(matrix.elements[12]).toBe(0); expect(matrix.elements[13]).toBe(section.y); expect(matrix.elements[14]).toBe(-0.52);
      section.y = run.viewBottomY - 8.001; expect(writeSection(run, section, matrix)).toBe(false);
      section.y = run.viewBottomY - 8; expect(writeSection(run, section, matrix)).not.toBe(false);
      section.y = run.maxHeight + 4.001; expect(writeSection(run, section, matrix)).toBe(false);
      section.y = run.maxHeight + 4; expect(writeSection(run, section, matrix)).not.toBe(false);
   });
});
