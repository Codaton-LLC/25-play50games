import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { createRun, HOLD_MS, INTACT, WARNING, FALLING } from "./rules";
import { createVisualState, writeSlab, writeSpur, writeCoin, writeFlag, writeSection, runnerFootY } from "./visuals";

describe("tower-climb pool placement and end poses", () => {
   it("slab origins are the collision tops; window hiding does not alter pool/state identities", () => {
      const run = createRun(5050), matrix = new Matrix4(), slot = run.slabs[0];
      expect(writeSlab(run, slot, matrix)).not.toBe(false); expect(matrix.elements[13]).toBe(slot.y);
      slot.y = 4.001; expect(writeSlab(run, slot, matrix)).toBe(false);
      slot.y = -1.9; expect(writeSlab(run, slot, matrix)).toBe(false); // body thickness must fit too
      slot.y = -1.8; expect(writeSlab(run, slot, matrix)).not.toBe(false);
      expect(run.slabs[0]).toBe(slot);
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
      expect(writeSpur(run, slot, true, visual, 50.8, false, matrix, "over")).toBe(false);
   });

   it("coins/flags are hidden until their full extent fits; coins keep their rule position for pickup", () => {
      const run = createRun(5050), matrix = new Matrix4(), coin = run.coins[0], flag = run.flags[0];
      coin.active = true; coin.y = 3.7; coin.x = -1.5;
      expect(writeCoin(run, coin, 0, true, matrix)).not.toBe(false); expect(matrix.elements[13]).toBe(3.7);
      coin.y = 3.701; expect(writeCoin(run, coin, 0, false, matrix)).toBe(false);
      flag.active = true; flag.y = 3.201; expect(writeFlag(run, flag, matrix)).toBe(false);
      flag.y = 3.2; expect(writeFlag(run, flag, matrix)).not.toBe(false);
      const section = run.sections[0]; expect(writeSection(run, section, matrix)).not.toBe(false);
   });
});
