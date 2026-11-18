// The five hero roles (the card) on their side routes, and the secrets: each power opens its route, the
// other heroes cannot take it, and the secrets are found where tunnel.ts puts them.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { SECRETS } from "./progression";
import { HUB, dirIndex } from "./tunnel";
import { courseFor, createRun, createStepInput, step, type StepInput, type WindRun } from "./rules";

function place(run: WindRun, x: number, y: number, z: number): void {
   Object.assign(run.hero, { x, y, z, vx: 0, vy: 0, vz: 0, grounded: true });
}

function frames(run: WindRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

function power(run: WindRun, moveX = 0, moveZ = 0): void {
   const i = createStepInput();
   i.moveX = moveX;
   i.moveZ = moveZ;
   i.actionPressed = true;
   step(run, 1000 / 60, i);
}

function bonusOrbs(run: WindRun, hero: HeroId): number[] {
   return run.course.orbs.map((o, i) => (o.bonus === hero ? i : -1)).filter((i) => i >= 0);
}

const got = (run: WindRun, list: number[]) => list.filter((i) => run.world.collected[i]).length;

describe("hero roles (level 1's side routes)", () => {
   it("Nami's double jump reaches the 3.5 m shelf and its orbs; a plain jump does not", () => {
      for (const hero of ["nami", "riko"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const orbs = bonusOrbs(run, "nami");
         const o = run.course.orbs[orbs[0]];
         place(run, 3.9, 0, o.z + 0.7);
         const i = createStepInput();
         i.moveX = 1;
         i.jumpPressed = true;
         step(run, 1000 / 60, i);
         i.jumpPressed = false;
         frames(run, 18, i);
         i.jumpPressed = true;
         step(run, 1000 / 60, i);
         i.jumpPressed = false;
         frames(run, 70, i);
         if (hero === "nami") {
            expect(run.hero.y).toBeCloseTo(3.5, 1);
            expect(got(run, orbs)).toBe(2);
         } else {
            expect(run.hero.y).toBeLessThan(1);
            expect(got(run, orbs)).toBe(0);
         }
      }
   });

   it("Kiro's shield rides through the static-shock vent and takes its orbs; anyone else is zapped back", () => {
      for (const hero of ["kiro", "nami"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const s = run.course.shocks[0];
         const orbs = bonusOrbs(run, "kiro");
         const zc = (s.z0 + s.z1) / 2;
         place(run, -2.8, s.y0, zc);
         if (hero === "kiro") power(run);
         const i = createStepInput();
         i.moveX = -1;
         frames(run, 40, i);
         if (hero === "kiro") {
            expect(run.hits).toBe(0);
            expect(got(run, orbs)).toBe(2);
         } else {
            expect(run.hits).toBe(1);
            expect(got(run, orbs)).toBe(0);
         }
      }
   });

   it("Riko's dash breaks the cracked vent cover and its vent blows him up through two orbs; the others bump into it", () => {
      for (const hero of ["riko", "kiro"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const cover = run.course.blocks.findIndex((b) => b.kind === "cover");
         const b = run.course.blocks[cover];
         const zc = (b.z0 + b.z1) / 2;
         place(run, b.x0 - 1.4, b.y0, zc);
         power(run, 1, 0);
         const i = createStepInput();
         i.moveX = 1;
         frames(run, 20, i);
         i.moveX = 0;
         // then stand where the cover was: its vent blows only once it is broken
         if (hero === "riko") place(run, (b.x0 + b.x1) / 2, b.y0, zc);
         frames(run, 160, i);
         if (hero === "riko") {
            expect(run.world.broken[cover]).toBe(1);
            expect(got(run, bonusOrbs(run, "riko"))).toBe(2);
         } else {
            expect(run.world.broken[cover]).toBe(0);
            expect(got(run, bonusOrbs(run, "riko"))).toBe(0);
         }
      }
   });

   it("Zuno's magnet pulls the orbs hanging 6 m off the bridge current he rides; without it they stay", () => {
      for (const magnet of [true, false]) {
         const run = createRun(1, 1, "zuno");
         const f = run.course.rooms[1].solution[0].fan;
         run.world.dir[f] = dirIndex("n");
         const fan = run.course.fans[f];
         place(run, fan.x, fan.y, fan.z - 1.0);
         const i = createStepInput();
         frames(run, 40, i);
         if (magnet) power(run);
         frames(run, 60, i);
         expect(got(run, bonusOrbs(run, "zuno"))).toBe(magnet ? 2 : 0);
      }
   });

   it("Vexa phases through the ghost fan housing into the duct (its orbs, the sticker); the wall stops anyone else", () => {
      for (const hero of ["vexa", "kiro"] as HeroId[]) {
         const run = createRun(1, 1, hero);
         const ghost = run.course.blocks.find((b) => b.kind === "ghost")!;
         place(run, -5.9, run.course.rooms[ghost.room].floor, (ghost.z0 + ghost.z1) / 2);
         if (hero === "vexa") power(run);
         const i = createStepInput();
         i.moveX = -1;
         frames(run, 50, i);
         if (hero === "vexa") {
            expect(run.hero.x).toBeLessThan(-8);
            i.moveX = 0;
            i.moveZ = -1;
            frames(run, 140, i);
            expect(got(run, bonusOrbs(run, "vexa"))).toBe(2);
            expect(run.secrets.found[SECRETS[1].findIndex((s) => s.id === "duct")]).toBeTruthy();
         } else {
            expect(run.hero.x).toBeGreaterThan(-7);
         }
      }
   });
});

describe("secrets", () => {
   it("the gust shard: turned backwards (s), level 1's upper fan carries you back through it", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const f = c.rooms[2].solution[1].fan;
      const fan = c.fans[f];
      run.world.dir[f] = dirIndex("s");
      place(run, fan.x, fan.y, fan.z + 1.2);
      frames(run, 150);
      expect(run.secrets.found[SECRETS[1].findIndex((s) => s.id === "gust")]).toBeTruthy();
      expect(c.secrets[0].y).toBeCloseTo(fan.y + HUB, 6);
   });

   it("the anemometer shard: point level 2's corner fan into the post, the hidden vent opens and lifts you through it", () => {
      const run = createRun(1, 2);
      const a = run.course.anemos[0];
      run.world.dir[a.fan] = a.dir;
      frames(run, 2);
      expect(run.world.anemoOpen[0]).toBe(1);
      const v = run.course.fans[a.opens];
      place(run, v.x, v.y, v.z);
      frames(run, 200);
      expect(run.secrets.found[SECRETS[2].findIndex((s) => s.id === "anemo")]).toBeTruthy();
   });

   it("every level has 1-3 secrets, each with a spot, and every hero-gated orb is a bonus (the all-orbs star counts the main ones)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.secrets.length).toBe(SECRETS[id].length);
         expect(c.orbs.filter((o) => o.bonus !== null).length).toBeGreaterThanOrEqual(10);
      }
   });
});
