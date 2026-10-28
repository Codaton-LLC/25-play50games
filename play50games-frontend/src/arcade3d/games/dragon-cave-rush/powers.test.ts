// The five hero roles (the card) on their side tracks, the secrets, and every hero against the limits
// (plain and with the power mashed), with mutation probes that show the limits read the level they claim.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { SECRETS } from "./progression";
import { buildCourse, SCAFFOLD_Y } from "./track";
import { METER, PROPOSED_LEVEL_LIMITS, courseFor, createRun, createStepInput, minDurationMsOf, proposeLimits, runTimeMs, step, type CaveRun, type StepInput } from "./rules";
import { dragonCaveRushMeta } from "./meta";

function frames(run: CaveRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

const bonus = (run: CaveRun, hero: HeroId) => run.course.orbs.map((o, i) => (o.bonus === hero ? i : -1)).filter((i) => i >= 0);
const got = (run: CaveRun, list: number[]) => list.filter((i) => run.collected[i]).length;

function press(run: CaveRun, f: (i: StepInput) => void): void {
   const i = createStepInput();
   f(i);
   step(run, 1000 / 60, i);
}

describe("hero roles (level 1's side tracks)", () => {
   it("Riko's boost smashes the cracked barricade onto the shortcut (+20 distance, its orbs); nobody else gets in", () => {
      for (const hero of ["riko", "kiro"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const b = run.course.barricades[0];
         run.awake = true;
         run.meter = 50;
         run.cart.s = b.s - 8;
         press(run, (i) => (i.actionPressed = true));
         const after = run.meter;
         if (hero === "kiro") press(run, (i) => (i.swapLeft = true));
         frames(run, 200);
         if (hero === "riko") {
            expect(run.broken[0]).toBe(1);
            expect(after).toBeGreaterThan(50 + METER.barricade - 1);
            expect(got(run, bonus(run, "riko"))).toBe(2);
         } else {
            expect(run.broken[0]).toBe(0);
            expect(got(run, bonus(run, "riko"))).toBe(0);
         }
      }
   });

   it("Nami's second hop at the scaffold ramp lifts the cart onto the upper track: its orbs and the ember shard", () => {
      for (const hero of ["nami", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const r = run.course.ramps[0];
         run.cart.s = r.s - 9;
         press(run, (i) => (i.jumpPressed = true));
         frames(run, 12);
         press(run, (i) => (i.jumpPressed = true));
         if (hero === "nami") press(run, (i) => (i.actionPressed = true));
         frames(run, 220);
         const shard = SECRETS[1].findIndex((s) => s.id === "scaffold");
         if (hero === "nami") {
            expect(got(run, bonus(run, "nami"))).toBe(3);
            expect(run.secrets.found[shard]).toBeTruthy();
         } else {
            expect(got(run, bonus(run, "nami"))).toBe(0);
         }
      }
      expect(SCAFFOLD_Y).toBeGreaterThan(2.2);
   });

   it("Kiro's shield absorbs the lavafall on the side fork and he takes its orbs; anyone else is hit", () => {
      for (const hero of ["kiro", "zuno"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const lava = run.course.hazards.find((h) => h.kind === "lavafall")!;
         run.cart.s = lava.s - 8;
         run.cart.lane = lava.lane;
         run.cart.d = run.course.lanes[lava.lane].d;
         if (hero === "kiro") press(run, (i) => (i.actionPressed = true));
         frames(run, 90);
         if (hero === "kiro") {
            expect(run.hits).toBe(0);
            expect(got(run, bonus(run, "kiro"))).toBe(2);
         } else expect(run.hits).toBe(1);
      }
   });

   it("Zuno's magnet pulls the crystal trail off the cave wall; without it the trail stays", () => {
      for (const magnet of [true, false]) {
         const run = createRun(1, 1, "zuno");
         const trail = bonus(run, "zuno");
         run.cart.s = run.course.orbs[trail[0]].s - 6;
         if (magnet) press(run, (i) => (i.actionPressed = true));
         frames(run, 60);
         expect(got(run, trail)).toBe(magnet ? 3 : 0);
      }
   });

   it("Vexa's phase makes the ghost rail solid: her orbs and the sticker; anyone else falls through it", () => {
      for (const hero of ["vexa", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const gl = run.course.lanes.findIndex((l) => l.kind === "ghost");
         const g = run.course.lanes[gl];
         run.cart.s = g.s0 + 1;
         if (hero === "vexa") press(run, (i) => (i.actionPressed = true));
         press(run, (i) => (g.d > 0 ? (i.swapRight = true) : (i.swapLeft = true)));
         frames(run, 100);
         const sticker = SECRETS[1].findIndex((s) => s.id === "ghost");
         if (hero === "vexa") {
            expect(got(run, bonus(run, "vexa"))).toBe(2);
            expect(run.secrets.found[sticker]).toBeTruthy();
         } else expect(run.respawns).toBe(1);
      }
   });

   it("level 4's hoard shard sits on Riko's shortcut", () => {
      const run = createRun(1, 4, "riko");
      const hoard = SECRETS[4].findIndex((s) => s.id === "hoard");
      const lane = run.course.secrets[hoard].lane;
      expect(run.course.lanes[lane].kind).toBe("shortcut");
   });
});

const submitted = (run: CaveRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): CaveRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 240_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash && f % 9 === 0) input.actionPressed = true;
      step(run, fms, input);
   }
   return run;
}

describe("every hero against the limits", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero wins with the plain bot; with its power mashed (Riko at 30/60/144 Hz) no finish beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(submitted(plain)).toBeGreaterThanOrEqual(lim.minDurationMs);
            for (const fps of hero.id === "riko" ? [30, 60, 144] : [60]) {
               const mashed = powerRun(level, hero.id, fps, true);
               if (mashed.ended === "win") expect(submitted(mashed), `${hero.id} ${fps}`).toBeGreaterThanOrEqual(lim.minDurationMs);
            }
         }
      }, 120_000);
   }
});

describe("mutation probes: the limits read the level they claim", () => {
   it("no two levels share a row; each row is its own course's proposeLimits; meta ships them in order", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(dragonCaveRushMeta.levels![id - 1].id).toBe(id);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: a faster track (+20 %) or another timer gives another row; the bound reads the speed`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const faster = buildCourse(level, { ...LEVELS[level], speed: LEVELS[level].speed * 1.2 });
         expect(minDurationMsOf(faster)).toBeLessThan(lim.minDurationMs);
         const timer = proposeLimits(buildCourse(level, { ...LEVELS[level], durationMs: LEVELS[level].durationMs * 0.8 }));
         expect(timer.maxScore).not.toBe(lim.maxScore);
      });
   }
});
