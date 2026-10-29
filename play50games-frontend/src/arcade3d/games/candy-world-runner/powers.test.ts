// The five hero roles (the card) and the gates the proof relies on (maxOrbs: another hero's route orbs
// are out of reach without its power), and every hero against the limits (plain and power mashed).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { BIG, NORMAL, RAIL_Y, laneX } from "./course";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, runTimeMs, step, type CandyRun, type StepInput } from "./rules";

function frames(run: CandyRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

function press(run: CandyRun, f: (i: StepInput) => void): void {
   const i = createStepInput();
   f(i);
   step(run, 1000 / 60, i);
}

function at(run: CandyRun, lane: number, s: number): void {
   run.runner.lane = lane;
   run.runner.x = laneX(lane);
   run.runner.swapAt = -1;
   run.runner.s = s;
}

describe("hero roles", () => {
   it("Riko: a dash at Big breaks the gingerbread wall into the bonus lane; at another size, or without the dash, the wall bounces you back", () => {
      for (const [hero, size] of [["riko", BIG], ["riko", NORMAL], ["zuno", BIG]] as [HeroId, number][]) {
         const run = createRun(1, 1, hero);
         const sl = run.course.sideLanes.find((l) => l.gate === "cracked")!;
         at(run, 0, sl.s0 - 4);
         run.runner.size = size as 0 | 1 | 2;
         press(run, (i) => (i.left = true));
         press(run, (i) => (i.actionPressed = true));
         frames(run, 40);
         const opened = run.gateOpen[run.course.sideLanes.indexOf(sl)] === 1;
         expect(opened, `${hero} ${size}`).toBe(hero === "riko" && size === BIG);
      }
   });

   it("Nami: a second jump in the air reaches the candy-cane rail (one jump never does)", () => {
      for (const hero of ["nami", "zuno"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const r = run.course.rails[0];
         at(run, 1, r.s0 + 1);
         press(run, (i) => (i.jumpPressed = true));
         frames(run, 14);
         press(run, (i) => (i.jumpPressed = true));
         frames(run, 30);
         expect(run.runner.onRail, hero).toBe(hero === "nami");
      }
      expect((9 * 9) / (2 * 30)).toBeLessThan(RAIL_Y);
   });

   it("Kiro: the shield crosses a popping-candy field; anyone else is knocked down a size", () => {
      for (const hero of ["kiro", "zuno"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const f = run.course.fields[0];
         at(run, f.lane, f.s0 - 2);
         run.runner.size = BIG;
         if (hero === "kiro") press(run, (i) => (i.actionPressed = true));
         frames(run, 60);
         expect(run.runner.size, hero).toBe(hero === "kiro" ? BIG : NORMAL);
      }
   });

   it("Zuno: his magnet (on / off) pulls the frosting-wall coins; nobody else takes them", () => {
      for (const hero of ["zuno", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const t = run.course.trails[0];
         at(run, 0, t.s0 - 3);
         if (hero === "zuno") press(run, (i) => (i.actionPressed = true));
         frames(run, 90);
         const got = run.course.orbs.filter((o, i) => o.magnet && run.collected[i]).length;
         expect(got, hero).toBe(hero === "zuno" ? 3 : 0);
      }
   });

   it("Vexa: her phase opens the ghost wall into the hidden fourth lane (the shard); anyone else bounces off", () => {
      for (const hero of ["vexa", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const sl = run.course.sideLanes.find((l) => l.gate === "ghost")!;
         at(run, 2, sl.s0 - 4);
         if (hero === "vexa") press(run, (i) => (i.actionPressed = true));
         press(run, (i) => (i.right = true));
         frames(run, 200);
         expect(!!run.secrets.found[0], hero).toBe(hero === "vexa");
      }
   });
});

const submitted = (run: CandyRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function powerRun(level: LevelId, hero: HeroId, mash: boolean): CandyRun {
   const run = createRun(1, level, hero);
   const bot = createBot(run);
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
      it(`level ${level}: every hero wins with the plain bot; with its power mashed no finish beats the floor`, () => {
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
