// The five hero roles (the card) and the gates the proof relies on (maxOrbs / ROUTES: another hero's
// route orbs are out of reach without its power).
import { describe, expect, it } from "vitest";
import { type HeroId } from "./heroes";
import { HIGH_Y } from "./course";
import { SPEED, createRun, createStepInput, step, type CoreRun, type StepInput } from "./rules";

function frames(run: CoreRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

describe("hero roles", () => {
   it("Nyla: a second jump in the air reaches the high orbs; one jump never does", () => {
      for (const twice of [true, false]) {
         const run = createRun(1, 1, "nami");
         run.hero.x = 0;
         run.hero.z = 4;
         step(run, 1000 / 60, { ...createStepInput(), jumpPressed: true });
         let top = 0;
         for (let k = 0; k < 80; k++) {
            const i = createStepInput();
            if (twice && run.hero.vy < 0.5 && run.hero.airHops === 0 && run.hero.h > 0.5) i.jumpPressed = true;
            step(run, 1000 / 60, i);
            top = Math.max(top, run.hero.h);
         }
         if (twice) expect(top + 0.8 + 1.0).toBeGreaterThan(HIGH_Y);
         else expect(top + 0.8 + 1.0).toBeLessThan(HIGH_Y);
      }
   });

   it("Vexa: the phase walks through the crate ring to its shard; anyone else is stopped by the crates", () => {
      for (const hero of ["vexa", "kiro"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const sh = run.course.secrets[0];
         run.hero.x = sh.x - 2.6 * Math.sign(sh.x);
         run.hero.z = sh.z - 0.4;
         step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
         // walk across the ring towards the shard
         const toward = { ...createStepInput(), moveX: Math.sign(sh.x) };
         frames(run, 30, toward);
         expect(!!run.secrets.found[0], hero).toBe(hero === "vexa");
      }
   });

   it("Zuno: the magnet pulls the ring's orbs from outside the crates (never the cores)", () => {
      for (const hero of ["zuno", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const ring = run.course.orbs.map((o, i) => ({ o, i })).filter(({ o }) => o.bonus === "ring");
         run.hero.x = ring[0].o.x - 2.6 * Math.sign(ring[0].o.x);
         run.hero.z = ring[0].o.z;
         step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
         frames(run, 10);
         expect(ring.filter(({ i }) => run.collected[i]).length, hero).toBe(hero === "zuno" ? ring.length : 0);
         expect(run.count.reduce((a, b) => a + b, 0)).toBe(0);
      }
   });

   it("Riko: the dash is x1.6 for 0.6 s, once per 5 s", () => {
      const run = createRun(1, 1, "riko");
      run.hero.x = 0;
      run.hero.z = 2;
      step(run, 1000 / 60, { ...createStepInput(), moveX: 1, actionPressed: true });
      const x0 = run.hero.x;
      frames(run, 6, { ...createStepInput(), moveX: 1 });
      expect((run.hero.x - x0) / 0.1).toBeCloseTo(SPEED * 1.6, 0);
      const ready = run.powerReadyAt;
      step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
      expect(run.powerReadyAt).toBe(ready);
   });
});
