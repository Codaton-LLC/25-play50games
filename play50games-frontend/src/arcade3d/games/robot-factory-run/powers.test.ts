import { describe, it, expect } from "vitest";
import { createRun, createStepInput, step, rotateSwitch } from "./rules";
function hold(r: ReturnType<typeof createRun>, ms: number, i = createStepInput()) { for (let t = 0; t < ms; t += 10)
   step(r, Math.min(10, ms - t), i); }
describe("hero routes and deterministic factory hazards", () => {
   it("Riko permanently breaks the cracked crate and unjams a nearby table", () => {
      const r = createRun(1, 5, "riko");
      r.hero.x = -6;
      r.hero.z = -3;
      r.board.jamUntil[0] = 5000;
      const i = createStepInput();
      i.moveZ = -1;
      i.actionPressed = true;
      step(r, 10, i);
      i.actionPressed = false;
      hold(r, 300, i);
      expect(r.crateBroken).toBe(true);
      expect(r.board.jamUntil[0]).toBe(0);
   });
   it("Nami's second jump reaches the catwalk; any hero has a ramp", () => {
      const r = createRun(1, 1, "nami"), i = createStepInput();
      i.jumpPressed = true;
      step(r, 10, i);
      i.jumpPressed = false;
      hold(r, 250, i);
      i.jumpPressed = true;
      step(r, 10, i);
      i.jumpPressed = false;
      hold(r, 300, i);
      expect(r.hero.y).toBeGreaterThan(2);
      expect(r.hero.airJump).toBe(false);
   });
   it("Kiro's shield prevents laser damage; Vexa alone can enter maintenance", () => {
      const shield = createRun(1, 4, "kiro");
      shield.hero.x = 4.9;
      shield.hero.z = 0;
      const i = createStepInput();
      i.actionPressed = true;
      step(shield, 10, i);
      expect(shield.hits).toBe(0);
      const r = createRun(1, 1, "vexa");
      r.hero.x = -4;
      r.hero.z = -3;
      const v = createStepInput();
      v.actionPressed = true;
      v.moveZ = -1;
      step(r, 10, v);
      v.actionPressed = false;
      hold(r, 300, v);
      expect(r.secrets.found[1]).toBe(1);
   });
   it("Zuno pulls a moving cell within 4m onto a neighbour belt", () => {
      const r = createRun(1, 1, "zuno");
      hold(r, 2100);
      r.hero.x = -5;
      r.hero.z = 2;
      const i = createStepInput();
      i.actionPressed = true;
      step(r, 10, i);
      expect(r.board.cells[0].nodeZ).toBe(2);
      expect(r.board.cells[0].nodeX).toBe(-4);
   });
   it("the secret turntable really routes a cell into its hidden charger", () => {
      const r = createRun(1, 1);
      r.board.turns.fill(0);
      r.board.secretTurn = 1;
      hold(r, 15000);
      expect(r.secrets.found[0]).toBe(1);
   });
   it("repeated switches have a finite once-only flow budget", () => {
      const r = createRun(1, 1);
      for (let n = 0; n < 100; n++) {
         r.simMs += 400;
         rotateSwitch(r, n % 2);
      }
      expect(r.combo.events).toBeLessThanOrEqual(2);
   });
});
