// The five hero roles (the card) and the gates the proof relies on (maxOrbs: another hero's route orbs
// are out of reach without its power), every hero against the limits (plain and with its power mashed).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { DIRS, SPEED_GAP, courseFor, halfAlong, dirBetween, type Plat } from "./course";
import { APEX, DASH_DV, ICE_ACCEL, PROPOSED_LEVEL_LIMITS, V_ICE, createRun, createStepInput, launchReach, runTimeMs, step, type PeakRun, type StepInput } from "./rules";

function frames(run: PeakRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

function press(run: PeakRun, f: (i: StepInput) => void): void {
   const i = createStepInput();
   f(i);
   step(run, 1000 / 60, i);
}

function standOn(run: PeakRun, p: Plat): void {
   const h = run.hero;
   h.x = p.x;
   h.z = p.z;
   h.y = p.y;
   h.vx = h.vy = h.vz = 0;
   h.ground = p.id;
}

describe("hero roles", () => {
   it("Riko: the dash adds 4 m/s on ice at once (never past 13 m/s), cut back to 9 m/s after its 0.5 s; it smashes the mitten cube", () => {
      const run = createRun(1, 1, "riko");
      const sheet = run.course.plats[run.course.route[1]];
      standOn(run, sheet);
      run.hero.vz = -5;
      press(run, (i) => (i.actionPressed = true));
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeCloseTo(5 + DASH_DV, 1);
      frames(run, 40);
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeLessThanOrEqual(V_ICE + 1e-6);
      // the mitten cube: dash into it
      const run2 = createRun(1, 1, "riko");
      const cubeI = run2.course.walls.findIndex((w) => w.kind === "cube");
      const cube = run2.course.walls[cubeI];
      const p = run2.course.plats.find((q) => Math.abs(cube.x - q.x) <= q.hx && Math.abs(cube.z - q.z) <= q.hz)!;
      expect(p.surface).toBe("ice");
      run2.hero.x = cube.x - 3;
      run2.hero.z = cube.z;
      run2.hero.y = p.y;
      run2.hero.ground = p.id;
      run2.hero.vx = 4;
      press(run2, (i) => (i.actionPressed = true));
      frames(run2, 20);
      expect(run2.broken[cubeI]).toBe(1);
   });

   it("Riko's speed ledges are out of reach at 9 m/s and in reach with the dash", () => {
      expect(launchReach(V_ICE, 0.4)).toBeLessThan(SPEED_GAP + 0.3);
      // dash at the edge: 13 m/s for its window, then 9 m/s
      const t = 0.75;
      expect((V_ICE + DASH_DV) * 0.5 + V_ICE * (t - 0.5)).toBeGreaterThan(SPEED_GAP + 0.3);
   });

   it("Nami: a second jump in the air re-aims along the stick and rises again; her cornices are higher than one jump", () => {
      const run = createRun(1, 1, "nami");
      press(run, (i) => (i.jumpPressed = true));
      frames(run, 20);
      const vy0 = run.hero.vy;
      press(run, (i) => {
         i.jumpPressed = true;
         i.moveX = 1;
      });
      expect(run.hero.vy).toBeGreaterThan(vy0);
      expect(run.hero.vx).toBeGreaterThan(3);
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const o of c.orbs.filter((q) => q.bonus === "nami")) {
            const p = c.plats.find((q) => Math.abs(o.x - q.x) <= q.hx && Math.abs(o.z - q.z) <= q.hz)!;
            const below = Math.max(...c.plats.filter((q) => q.id !== p.id && q.kind !== "boss" && Math.abs(q.x - p.x) < q.hx + p.hx + 1 && Math.abs(q.z - p.z) < q.hz + p.hz + 1 && q.y < p.y).map((q) => q.y));
            expect(p.y - below, `L${id}`).toBeGreaterThan(APEX);
            expect(p.y - below).toBeLessThan(2 * APEX);
         }
      }
   });

   it("Kiro: the shield crosses the icicle chute; anyone else is hit in it", () => {
      for (const hero of ["kiro", "zuno"] as HeroId[]) {
         const run = createRun(1, 2, hero);
         const ch = run.course.chutes[0];
         const p = run.course.plats.find((q) => Math.abs(ch.x - q.x) < 0.01 && Math.abs(ch.z - q.z) < 0.01)!;
         if (hero === "kiro") press(run, (i) => (i.actionPressed = true));
         standOn(run, p);
         frames(run, 30);
         expect(run.hits, hero).toBe(hero === "kiro" ? 0 : 1);
      }
   });

   it("Zuno: the frozen coin trails only come out to his magnet", () => {
      for (const magnet of [true, false]) {
         const run = createRun(1, 1, "zuno");
         const trail = run.course.walls.find((w) => w.kind === "trail")!;
         const p = run.course.plats.find((q) => q.kind === "main" && Math.hypot(q.x - trail.x, q.z - trail.z) < 6)!;
         standOn(run, p);
         if (magnet) press(run, (i) => (i.actionPressed = true));
         frames(run, 10);
         const got = run.course.orbs.filter((o, i) => o.magnet && run.collected[i]).length;
         if (magnet) expect(got).toBeGreaterThan(0);
         else expect(got).toBe(0);
      }
   });

   it("Vexa: ghost ice is solid to everyone but her while she phases", () => {
      for (const hero of ["vexa", "riko"] as HeroId[]) {
         const run = createRun(1, 2, hero);
         const gi = run.course.walls.findIndex((w) => w.kind === "ghost");
         const w = run.course.walls[gi];
         const from = run.course.plats.find((q) => q.kind === "main" && Math.abs(w.x - q.x) <= q.hx + 0.3 && Math.abs(w.z - q.z) <= q.hz + 0.3)!;
         standOn(run, from);
         const d = DIRS[dirBetween(from, { x: w.x, z: w.z })];
         if (hero === "vexa") press(run, (i) => (i.actionPressed = true));
         // walk / slide into the wall
         run.hero.x = w.x - d.x * 1.0;
         run.hero.z = w.z - d.z * 1.0;
         const go = createStepInput();
         go.yaw = 0;
         go.moveX = d.x;
         go.moveZ = d.z;
         frames(run, 50, go);
         const past = (run.hero.x - w.x) * d.x + (run.hero.z - w.z) * d.z;
         if (hero === "vexa") expect(past).toBeGreaterThan(0);
         else expect(past).toBeLessThan(0);
      }
   });

   it("the hidden ledge takes a launch of 8.5 m/s and up", () => {
      for (const id of [1, 4, 5] as LevelId[]) {
         const c = courseFor(id);
         const i = c.plats.findIndex((p) => p.kind === "side" && p.hx === 1.6);
         expect(i).toBeGreaterThanOrEqual(0);
      }
      expect(launchReach(8.5, 0.2)).toBeLessThan(launchReach(V_ICE, 0.2));
      expect(Math.sqrt(2 * ICE_ACCEL * 8)).toBeGreaterThan(8.5);
      void halfAlong;
   });
});

const submitted = (run: PeakRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): PeakRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 300_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash && f % 9 === 0) input.actionPressed = true;
      step(run, fms, input);
   }
   return run;
}

describe("every hero against the limits", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero wins with the plain bot; with its power mashed no finish beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(submitted(plain)).toBeGreaterThanOrEqual(lim.minDurationMs);
            const mashed = powerRun(level, hero.id, 60, true);
            if (mashed.ended === "win") expect(submitted(mashed), `${hero.id} mashed`).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 180_000);
   }
});
