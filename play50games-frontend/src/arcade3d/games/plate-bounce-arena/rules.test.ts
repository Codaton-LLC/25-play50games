// The pinball rules: the plunger, gravity and the drain, the flippers, bumpers, ramps, the ball save,
// three balls, the objectives in order, the exit hole, the speed cap and determinism.
import { describe, expect, it } from "vitest";
import {
   BALL_SAVE_MS, BALLS, FLIP_UP, PLUNGE_MAX, PLUNGE_MIN, V_BUMPER, V_MAX, createRun, createStepInput, currentObjective, exitOpen, step, type PinRun,
} from "./rules";
import { LANE_X, PLUNGER } from "./table";

function run60(run: PinRun, ms: number, set?: (input: ReturnType<typeof createStepInput>, r: PinRun) => void) {
   const input = createStepInput();
   for (let t = 0; t < ms && run.ended === null; t += 1000 / 60) {
      if (set) set(input, run);
      step(run, 1000 / 60, input);
   }
}

function placeBall(run: PinRun, x: number, z: number, vx = 0, vz = 0) {
   const b = run.ball;
   b.mode = "roll";
   b.x = x;
   b.z = z;
   b.vx = vx;
   b.vz = vz;
   run.saveUsed = true;
}

describe("the plunger and the drain", () => {
   it("the ball sits on the plunger until Jump is held and let go; a full charge launches at PLUNGE_MAX", () => {
      const run = createRun(1, 1, "zuno");
      run60(run, 2000);
      expect(run.ball.mode).toBe("plunger");
      expect(run.ball.x).toBe(PLUNGER.x);
      const input = createStepInput();
      input.jumpHeld = true;
      for (let i = 0; i < 80; i++) step(run, 16, input);
      expect(run.ball.charge).toBe(1);
      input.jumpHeld = false;
      const ev = step(run, 16, input);
      expect(ev.plunged).toBe(true);
      expect(run.ball.mode).toBe("roll");
      expect(-run.ball.vz).toBeLessThanOrEqual(PLUNGE_MAX);
      expect(-run.ball.vz).toBeGreaterThan(PLUNGE_MIN);
   });

   it("a ball left alone on the field rolls down and drains; three drains end the run lost (no ball save)", () => {
      const run = createRun(1, 2, "zuno");
      let lost = 0;
      for (let k = 0; k < BALLS && run.ended === null; k++) {
         placeBall(run, 0, -10);
         const input = createStepInput();
         for (let f = 0; f < 600 && run.ended === null; f++) {
            const ev = step(run, 16, input);
            if (ev.lost) lost++;
            if (run.ball.mode === "plunger") break;
         }
      }
      expect(lost).toBe(BALLS);
      expect(run.ended).toBe("lose");
      expect(run.hits).toBe(BALLS);
   });

   it("the ball save: a drain in the first seconds after the plunge puts the ball back on the plunger, once", () => {
      const run = createRun(1, 2, "zuno");
      const input = createStepInput();
      input.jumpHeld = true;
      for (let i = 0; i < 40; i++) step(run, 16, input);
      input.jumpHeld = false;
      step(run, 16, input);
      expect(run.saveUntil).toBeGreaterThan(run.simMs);
      expect(run.saveUntil - run.simMs).toBeLessThanOrEqual(BALL_SAVE_MS);
      const b = run.ball;
      b.x = 0;
      b.z = -0.6;
      b.vx = 0;
      b.vz = 6;
      let saved = false;
      for (let i = 0; i < 20 && !saved; i++) saved = step(run, 16, createStepInput()).saved;
      expect(saved).toBe(true);
      expect(run.ballsLeft).toBe(BALLS);
      expect(run.ball.mode).toBe("plunger");
      expect(run.saveUsed).toBe(true);
   });

   it("a weak launch rolls back down the lane onto the plunger", () => {
      const run = createRun(1, 1, "zuno");
      const input = createStepInput();
      input.jumpHeld = true;
      step(run, 16, input);
      input.jumpHeld = false;
      step(run, 16, input);
      run.ball.vz = -6;
      run60(run, 4000);
      expect(run.ball.mode).toBe("plunger");
      expect(run.ball.x).toBeGreaterThan(LANE_X);
   });
});

describe("flippers and the toys", () => {
   it("a flipper rises to its up angle while held and throws a ball resting on it up the table", () => {
      const run = createRun(1, 2, "zuno");
      placeBall(run, -2.2, -2.3);
      const input = createStepInput();
      step(run, 16, input);
      input.left = true;
      let ev = step(run, 16, input);
      expect(ev.flipped & 1).toBe(1);
      for (let i = 0; i < 5; i++) ev = step(run, 16, input);
      expect(run.flip[0]).toBeCloseTo(FLIP_UP, 5);
      expect(run.ball.vz).toBeLessThan(-6);
   });

   it("Space flips both in play but only charges the plunger while the ball sits on it", () => {
      const run = createRun(1, 1, "zuno");
      const input = createStepInput();
      input.jumpHeld = true;
      for (let i = 0; i < 6; i++) step(run, 16, input);
      expect(run.flip[0]).toBeGreaterThan(0.5);
      placeBall(run, 0, -14);
      for (let i = 0; i < 6; i++) step(run, 16, input);
      expect(run.flip[0]).toBeCloseTo(FLIP_UP, 5);
      expect(run.flip[1]).toBeCloseTo(FLIP_UP, 5);
   });

   it("a bumper kicks the ball away at V_BUMPER and counts for the bumper section", () => {
      const run = createRun(1, 1, "zuno");
      const c = run.table.bumpers.find((x) => x.layer === 0)!;
      placeBall(run, c.x, c.z + c.r + 0.6, 0, -4);
      let hit = 0;
      for (let i = 0; i < 20 && hit === 0; i++) hit = step(run, 16, createStepInput()).bumpers;
      expect(hit).toBeGreaterThan(0);
      expect(Math.hypot(run.ball.vx, run.ball.vz)).toBeGreaterThan(V_BUMPER - 1.5);
      expect(run.prog.count).toBe(1);
   });

   it("a fast ball takes the ramp and comes out at its end; a slow one is turned back", () => {
      const run = createRun(1, 1, "zuno");
      run.prog.stage = 1;
      const r = run.table.ramps[0];
      placeBall(run, r.ex - r.dx * 1.2, r.ez - r.dz * 1.2, r.dx * 12, r.dz * 12);
      let done = false;
      for (let i = 0; i < 400 && !done; i++) done = step(run, 16, createStepInput()).rampDone;
      expect(done).toBe(true);
      const end = r.path[r.path.length - 1];
      expect(Math.hypot(run.ball.x - end.x, run.ball.z - end.z)).toBeLessThan(1.2);
      expect(run.prog.stage).toBe(2);
      const slow = createRun(1, 1, "zuno");
      placeBall(slow, r.ex - r.dx * 1.0, r.ez - r.dz * 1.0, r.dx * 4, r.dz * 4);
      for (let i = 0; i < 30; i++) step(slow, 16, createStepInput());
      expect(slow.ball.mode).toBe("roll");
   });
});

describe("sections and the exit", () => {
   it("pieces of a later section do not count early; the exit opens only after the last one and sinks the ball", () => {
      const run = createRun(1, 1, "zuno");
      const l = run.table.lanterns[0];
      placeBall(run, l.x, l.z, 0, 0);
      step(run, 16, createStepInput());
      expect(run.prog.lit[0]).toBe(0);
      expect(exitOpen(run)).toBe(false);
      run.prog.stage = run.table.objectives.length;
      expect(currentObjective(run)).toBeNull();
      expect(exitOpen(run)).toBe(true);
      const h = run.table.hole;
      placeBall(run, h.x + 1.4, h.z, -1, 0);
      run60(run, 2000);
      expect(run.ended).toBe("win");
      expect(run.finishMs).toBeGreaterThan(0);
   });

   it("idle on the plunger never ends but by the clock", () => {
      const run = createRun(1, 3, "zuno");
      for (let f = 0; f < 20_000 && run.ended === null; f++) step(run, 50, createStepInput());
      expect(run.ended).toBe("timeup");
   });
});

describe("the cap and determinism", () => {
   it("no ball ever goes faster than V_MAX, and the same inputs give the same run", () => {
      const go = () => {
         const run = createRun(7, 4, "riko");
         let top = 0;
         let s = 1;
         const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
         run60(run, 60_000, (i, r) => {
            i.jumpHeld = r.ball.mode === "plunger" ? rnd() < 0.9 : rnd() < 0.3;
            i.left = rnd() < 0.4;
            i.right = rnd() < 0.4;
            i.moveX = rnd() * 2 - 1;
            i.actionPressed = rnd() < 0.05;
            top = Math.max(top, Math.hypot(r.ball.vx, r.ball.vz));
         });
         return { top, x: run.ball.x, z: run.ball.z, ms: run.simMs, pts: run.points };
      };
      const a = go();
      const b = go();
      expect(a.top).toBeLessThanOrEqual(V_MAX + 1e-9);
      expect(b).toEqual(a);
   });
});
