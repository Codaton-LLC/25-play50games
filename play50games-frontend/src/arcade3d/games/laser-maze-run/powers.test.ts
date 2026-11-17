// The five hero roles (the card) and the gates the proof relies on (maxOrbs / ROUTES: another hero's
// route orbs are out of reach without its power), and every hero against the limits (power mashed).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { FULL, HIGH_Y } from "./course";
import { PROPOSED_LEVEL_LIMITS, SPEED, createRun, createStepInput, runTimeMs, step, type LaserRun, type StepInput } from "./rules";

function frames(run: LaserRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

function place(run: LaserRun, x: number, s: number): void {
   run.runner.x = x;
   run.runner.s = s;
   run.zone = run.course.zones.findIndex((z) => s >= z.s0 && s < z.s1);
   run.cp = run.course.zones[run.zone].cp;
}

const forward = (): StepInput => ({ ...createStepInput(), moveY: -1 });

describe("hero roles", () => {
   it("Nami: a second jump in the air clears a full wall (2.25 m) and reaches the high orbs; one jump never does", () => {
      for (const twice of [true, false]) {
         const run = createRun(1, 1, "nami");
         place(run, 0, 6);
         step(run, 1000 / 60, { ...createStepInput(), jumpPressed: true });
         let top = 0;
         for (let k = 0; k < 80; k++) {
            const i = createStepInput();
            if (twice && run.runner.vy < 0.5 && run.runner.airHops === 0 && run.runner.h > 0.5) i.jumpPressed = true;
            step(run, 1000 / 60, i);
            top = Math.max(top, run.runner.h);
         }
         if (twice) expect(top).toBeGreaterThan(FULL[1]);
         else expect(top + 0.8 + 1.0).toBeLessThan(HIGH_Y);
      }
   });

   it("Kiro: the shield soaks a laser touch; anyone else is zapped back", () => {
      for (const hero of ["kiro", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const beam = run.course.lasers[0];
         place(run, 0, beam.s - 1.2);
         step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
         frames(run, 25, forward());
         expect(run.hits, hero).toBe(hero === "kiro" ? 0 : 1);
      }
   });

   it("Vexa: the phase walks through a cage wall (the cage shard); Kiro's shield does not", () => {
      for (const hero of ["vexa", "kiro"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const cage = run.course.lasers.find((l) => l.kind === "cage" && !l.along)!;
         const cx = (cage.x0 + cage.x1) / 2;
         place(run, cx, cage.s - 1);
         step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
         frames(run, 90, forward());
         expect(!!run.secrets.found[0], hero).toBe(hero === "vexa");
      }
   });

   it("Zuno: the magnet pulls the caged orbs from outside the cage; nobody else takes them", () => {
      for (const hero of ["zuno", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const caged = run.course.orbs.map((o, i) => ({ o, i })).filter(({ o }) => o.magnet);
         const mid = caged[0].o;
         place(run, mid.x < 0 ? -1 : 1, mid.s);
         step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
         frames(run, 30);
         const got = caged.filter(({ i }) => run.collected[i]).length;
         expect(got, hero).toBe(hero === "zuno" ? caged.length : 0);
      }
   });

   it("Riko: the dash is x1.6 for 0.6 s, once per 5 s", () => {
      const run = createRun(1, 1, "riko");
      place(run, 0, 6);
      step(run, 1000 / 60, { ...forward(), actionPressed: true });
      const s0 = run.runner.s;
      frames(run, 6, forward());
      expect((run.runner.s - s0) / 0.1).toBeCloseTo(SPEED * 1.6, 0);
      const ready = run.powerReadyAt;
      step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
      expect(run.powerReadyAt).toBe(ready);
   });
});

const submitted = (run: LaserRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function mashRun(level: LevelId, hero: HeroId): LaserRun {
   const run = createRun(1, level, hero);
   const bot = createBot(run, 1000 / 60, false);
   const input = createStepInput();
   for (let f = 0; f < 60 * 160 && run.ended === null; f++) {
      botInput(bot, run, input);
      if (f % 9 === 0 && !input.actionPressed) input.actionPressed = run.ms >= run.powerReadyAt;
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("every hero against the limits", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: with its power mashed no hero's finish beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const mashed = mashRun(level, hero.id);
            if (mashed.ended === "win") expect(submitted(mashed), `${hero.id}`).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 180_000);
   }
});
