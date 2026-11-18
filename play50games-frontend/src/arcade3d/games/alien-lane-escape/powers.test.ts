// The five hero roles (the card) and the gates the proof relies on (maxOrbs: another hero's route orbs
// are out of reach without its power), and every hero against the limits (plain and power mashed).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { MESA_Y, laneX } from "./course";
import { GOO_SLOW, PROPOSED_LEVEL_LIMITS, createRun, createStepInput, runTimeMs, speedNow, step, type AlienRun, type StepInput } from "./rules";

function frames(run: AlienRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

function press(run: AlienRun, f: (i: StepInput) => void): void {
   const i = createStepInput();
   f(i);
   step(run, 1000 / 60, i);
}

function at(run: AlienRun, lane: number, s: number): void {
   run.runner.lane = lane;
   run.runner.x = laneX(lane);
   run.runner.swapAt = -1;
   run.runner.s = s;
}

describe("hero roles", () => {
   it("Nyla: a second jump in the air lands on the high mesa (one jump never does)", () => {
      for (const [hero, twice] of [["nami", true], ["nami", false], ["riko", true]] as [HeroId, boolean][]) {
         const run = createRun(1, 1, hero);
         const m = run.course.mesas[0];
         at(run, 1, m.s0 - 4.5);
         press(run, (i) => (i.jumpPressed = true));
         frames(run, 16);
         if (twice) press(run, (i) => (i.jumpPressed = true));
         let on = false;
         for (let k = 0; k < 60; k++) {
            frames(run, 1);
            if (run.runner.onMesa) on = true;
         }
         expect(on, `${hero} ${twice}`).toBe(hero === "nami" && twice);
         if (on) expect(run.runner.h).toBeCloseTo(MESA_Y, 1);
      }
   });

   it("Kiro: his bubble carries him through goo at full speed; anyone else is slowed", () => {
      for (const hero of ["kiro", "nami"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const g = run.course.goo[0];
         at(run, g.lane, g.s0 - 0.5);
         press(run, (i) => (i.actionPressed = true));
         frames(run, 6);
         const v = speedNow(run);
         if (hero === "kiro") expect(v).toBeCloseTo(run.course.config.speed, 6);
         else expect(v).toBeCloseTo(run.course.config.speed * GOO_SLOW, 6);
      }
   });

   it("Zuno: his magnet pulls the orbs out of the goo from the next lane; nobody else takes them", () => {
      for (const hero of ["zuno", "vexa"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const g = run.course.goo[0];
         const side = g.lane === 1 ? 0 : 1;
         at(run, side, g.s0 - 2);
         press(run, (i) => (i.actionPressed = true));
         frames(run, 160);
         const got = run.course.orbs.filter((o, i) => o.magnet && run.collected[i]).length;
         if (hero === "zuno") expect(got).toBeGreaterThanOrEqual(3);
         else expect(got).toBe(0);
      }
   });

   it("Vexa: her phase opens the ghost-crystal wall into the cave (the shard); anyone else bounces off", () => {
      for (const hero of ["vexa", "kiro"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const cv = run.course.caves[0];
         at(run, 2, cv.s0 - 4);
         press(run, (i) => (i.actionPressed = true));
         press(run, (i) => (i.right = true));
         frames(run, 400);
         expect(!!run.secrets.found[0], hero).toBe(hero === "vexa");
         expect(run.caveOpen[0], hero).toBe(hero === "vexa" ? 1 : 0);
      }
   });

   it("Riko: the dash is x1.6 for 0.75 s, once per 5 s", () => {
      const run = createRun(1, 1, "riko");
      at(run, 1, 1);
      press(run, (i) => (i.actionPressed = true));
      expect(speedNow(run)).toBeCloseTo(run.course.config.speed * 1.6, 6);
      frames(run, 50);
      expect(speedNow(run)).toBeCloseTo(run.course.config.speed, 6);
      const ready = run.powerReadyAt;
      press(run, (i) => (i.actionPressed = true));
      expect(run.powerReadyAt).toBe(ready);
   });
});

const submitted = (run: AlienRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function powerRun(level: LevelId, hero: HeroId, mash: boolean): AlienRun {
   const run = createRun(1, level, hero);
   const bot = createBot(run, 1000 / 60, !mash);
   const input = createStepInput();
   for (let f = 0; f < 60 * 240 && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash && f % 9 === 0) input.actionPressed = true;
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("every hero against the limits", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero wins with its route; with its power mashed no finish beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(submitted(plain)).toBeGreaterThanOrEqual(lim.minDurationMs);
            const mashed = powerRun(level, hero.id, true);
            if (mashed.ended === "win") expect(submitted(mashed), `${hero.id} mashed`).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 180_000);
   }
});
