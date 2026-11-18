// The swing itself: a hook, a reel, a release, a fall, a broken chain, and a secret that does not score.
import { describe, expect, it } from "vitest";
import { FALL_Y, ORB, createRun, createStepInput, step } from "./rules";

function place(run: ReturnType<typeof createRun>, x: number, y: number, z: number, mode: "ground" | "air" | "swing" = "air"): void {
   const h = run.hero;
   run.simMs = Math.max(run.simMs, 60_000);
   h.x = x;
   h.y = y;
   h.z = z;
   h.vx = h.vy = h.vz = 0;
   h.mode = mode;
   h.grounded = mode === "ground";
}

describe("sky hook swing rules", () => {
   it("repeats a run from the same seed and the same stick", () => {
      const a = createRun(7, 1, "nami");
      const b = createRun(7, 1, "nami");
      const input = createStepInput();
      input.moveX = 1;
      for (let i = 0; i < 40; i++) {
         step(a, 16, input);
         step(b, 16, input);
      }
      expect(a.hero.x).toBe(b.hero.x);
      expect(a.hero.y).toBe(b.hero.y);
      expect(a.hero.mode).toBe(b.hero.mode);
   });

   it("hooks the first ring when the stick points at it, reels in, then releases into the air", () => {
      const run = createRun(1);
      const hook = createStepInput();
      hook.moveX = 1;
      hook.actionPressed = true;
      const ev = step(run, 16, hook);
      expect(ev.hooked).toBe(0);
      expect(run.hero.mode).toBe("swing");
      const before = run.hero.L;
      const reel = createStepInput();
      reel.moveZ = -1;
      for (let i = 0; i < 20; i++) step(run, 16, reel);
      expect(run.hero.L).toBeLessThan(before);
      const release = createStepInput();
      release.actionPressed = true;
      const out = step(run, 16, release);
      expect(out.released).toBe(true);
      expect(run.hero.mode).toBe("air");
   });

   it("a body under the docks is a fall, and the clock ends the run", () => {
      const fallen = createRun(1);
      place(fallen, 0, FALL_Y - 1, 0, "air");
      expect(step(fallen, 16, createStepInput()).lost).toBe(true);
      const late = createRun(1);
      late.simMs = 100_000 - 1;
      expect(step(late, 16, createStepInput()).timeup).toBe(true);
      expect(late.ended).toBe("timeup");
   });

   it("landing breaks a chain, and a secret does not add an orb", () => {
      const run = createRun(1);
      run.hero.chaining = true;
      run.combo.chain = 3;
      run.combo.multiplier = 2;
      const deck = run.course.islands.find((s) => s.kind === "deck")!;
      place(run, deck.x, deck.y + 2, deck.z, "air");
      run.hero.vy = -80;
      let landed = false;
      for (let i = 0; i < 8 && !landed; i++) landed = step(run, 16, createStepInput()).landed;
      expect(landed).toBe(true);
      expect(run.combo.chain).toBe(0);
      expect(run.hits).toBeGreaterThan(0);

      const quiet = createRun(1);
      const spot = quiet.course.secrets[0];
      place(quiet, spot.x, spot.y, spot.z, "air");
      const ev = step(quiet, 16, createStepInput());
      expect(ev.secretCount).toBe(1);
      expect(quiet.orbs).toBe(0);
      expect(quiet.secrets.found[0]).toBe(1);
      expect(ORB.bonusMs).toBe(80);
   });
});
