// Each hero's role (the card) and the secrets: Riko's dash cracks the block, Nami's double hop lands on
// the deck, Kiro's shield saves a drain once per ball, Zuno sticks to a magnet pad, aims and pulls the
// coins, Vexa phases into the attic for the shard; the skill shot and the penguin sticker.
import { describe, expect, it } from "vitest";
import { MAGNET_HOLD_MS, V_MAGNET } from "./heroes";
import { SKILL_HI, SKILL_LO, createRun, createStepInput, step, type PinRun } from "./rules";
import { ATTIC, DECK } from "./table";

function placeBall(run: PinRun, x: number, z: number, vx = 0, vz = 0) {
   const b = run.ball;
   b.mode = "roll";
   b.x = x;
   b.z = z;
   b.vx = vx;
   b.vz = vz;
   run.saveUsed = true;
}

describe("hero powers", () => {
   it("Riko: the dash cracks the block in front of the skill lane; without it the block holds", () => {
      const plain = createRun(1, 1, "zuno");
      placeBall(plain, -3, -20.4, 0, -10);
      for (let i = 0; i < 20; i++) step(plain, 16, createStepInput());
      expect(plain.prog.cracked).toBe(0);
      const run = createRun(1, 1, "riko");
      placeBall(run, -3, -20.0, 0, -4);
      const input = createStepInput();
      input.actionPressed = true;
      input.moveZ = -1;
      const ev = step(run, 16, input);
      expect(ev.powered).toBe(true);
      expect(run.powerUsed).toBe(true);
      let cracked = false;
      for (let i = 0; i < 30 && !cracked; i++) cracked = step(run, 16, createStepInput()).cracked;
      expect(cracked).toBe(true);
      // once per ball
      const again = createStepInput();
      again.actionPressed = true;
      expect(step(run, 16, again).powered).toBe(false);
   });

   it("Nami: a hop, then a double hop under the deck lands her on it (layer 1)", () => {
      const run = createRun(1, 1, "nami");
      placeBall(run, 2.9, -20.5, 0, 0);
      const hop = createStepInput();
      hop.actionPressed = true;
      expect(step(run, 16, hop).hop).toBe(true);
      for (let i = 0; i < 8; i++) step(run, 16, createStepInput());
      expect(run.ball.h).toBeGreaterThan(0);
      expect(step(run, 16, hop).deck).toBe(true);
      for (let i = 0; i < 80 && run.ball.mode !== "roll"; i++) step(run, 16, createStepInput());
      expect(run.ball.layer).toBe(1);
      expect(run.ball.h).toBe(DECK.h);
   });

   it("Kiro: under the shield a drain bounces back up, once per ball", () => {
      const run = createRun(1, 2, "kiro");
      placeBall(run, 0, -2, 0, 4);
      const s = createStepInput();
      s.actionPressed = true;
      step(run, 16, s);
      let saved = false;
      for (let i = 0; i < 60 && !saved; i++) saved = step(run, 16, createStepInput()).shieldSave;
      expect(saved).toBe(true);
      expect(run.ballsLeft).toBe(3);
      expect(run.ball.vz).toBeLessThan(0);
   });

   it("Zuno: holding Action on a magnet pad sticks the ball, pulls the coins, and fires it along the stick", () => {
      const run = createRun(1, 1, "zuno");
      const m = run.table.magnets[0];
      placeBall(run, m.x, m.z - 0.3, 0, 1);
      const hold = createStepInput();
      hold.actionHeld = true;
      let held = false;
      for (let i = 0; i < 10 && !held; i++) held = step(run, 16, hold).held;
      expect(held).toBe(true);
      expect(run.ball.mode).toBe("held");
      for (let i = 0; i < 10; i++) step(run, 16, hold);
      expect(run.coins).toBeGreaterThan(0);
      const aim = createStepInput();
      aim.moveX = 1;
      const ev = step(run, 16, aim);
      expect(ev.released).toBe(true);
      expect(run.ball.vx).toBeCloseTo(V_MAGNET, 0);
      // held at most MAGNET_HOLD_MS
      const r2 = createRun(1, 1, "zuno");
      placeBall(r2, run.table.magnets[1].x, run.table.magnets[1].z, 0, 0);
      let ms = 0;
      for (let i = 0; i < 300 && ms < MAGNET_HOLD_MS + 200; i++) {
         step(r2, 16, hold);
         if (r2.ball.mode === "held") ms += 16;
      }
      expect(ms).toBeLessThanOrEqual(MAGNET_HOLD_MS + 32);
      // other heroes never stick
      const r3 = createRun(1, 1, "riko");
      placeBall(r3, m.x, m.z, 0, 0);
      for (let i = 0; i < 10; i++) step(r3, 16, hold);
      expect(r3.ball.mode).not.toBe("held");
   });

   it("Vexa: the ghost gate is solid to the others, she phases through into the attic and finds the shard", () => {
      const wall = createRun(1, 1, "zuno");
      placeBall(wall, -6.2, -14.5, -9, 0);
      for (let i = 0; i < 20; i++) step(wall, 16, createStepInput());
      expect(wall.ball.x).toBeGreaterThan(-7);
      const run = createRun(1, 1, "vexa");
      placeBall(run, -5.6, -14.5, 0, 0);
      const p = createStepInput();
      p.actionPressed = true;
      expect(step(run, 16, p).powered).toBe(true);
      run.ball.vx = -9;
      run.ball.vz = 0;
      let inside = false;
      for (let i = 0; i < 40; i++) {
         step(run, 16, createStepInput());
         if (run.ball.x < ATTIC.x1) inside = true;
      }
      expect(inside).toBe(true);
      expect(run.secrets.found[2]).toBe(1);
   });
});

describe("secrets", () => {
   it("the skill shot: a launch with the gauge in the gold band", () => {
      const run = createRun(1, 2, "zuno");
      const input = createStepInput();
      input.jumpHeld = true;
      const target = (SKILL_LO + SKILL_HI) / 2;
      while (run.ball.charge < target) step(run, 8, input);
      input.jumpHeld = false;
      const ev = step(run, 8, input);
      expect(ev.skill).toBe(true);
      expect(run.secrets.found[0]).toBe(1);
   });

   it("the penguin sticker sits behind the lone penguin: reachable once it is knocked down", () => {
      const run = createRun(1, 1, "zuno");
      const lone = run.table.targets.findIndex((t) => t.bank < 0);
      const t = run.table.targets[lone];
      placeBall(run, t.x, t.z + 1.4, 0, -7);
      for (let i = 0; i < 10; i++) step(run, 16, createStepInput());
      expect(run.prog.down[lone]).toBe(1);
      placeBall(run, run.table.sticker.x, run.table.sticker.z + 0.3, 0, 0);
      step(run, 16, createStepInput());
      expect(run.secrets.found[1]).toBe(1);
   });
});
