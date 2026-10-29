// The card's hero roles on every level: each hero opens its own pocket of bonus orbs (the all-orbs star
// counts the main orbs only, so any hero earns every star). Runs start late in the clock so the proof's
// reach bound never moves a teleported hero.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { DEFAULT_HERO, HEROES, MAGNET_REACH, POWER_MS, type HeroId } from "./heroes";
import { G, KICK_UP, ORB, V_JUMP, createRun, createStepInput, insideHull, step, type WallRun } from "./rules";

function at(level: LevelId, hero: HeroId, x: number, y: number, z: number): WallRun {
   const run = createRun(1, level, hero);
   run.simMs = 100_000;
   const h = run.hero;
   h.mode = "air";
   h.x = x;
   h.y = y;
   h.z = z;
   h.vx = h.vy = h.vz = 0;
   return run;
}

function powered(level: LevelId, hero: HeroId, x: number, y: number, z: number): WallRun {
   const run = at(level, hero, run0(level).x, 40, run0(level).z);
   const press = createStepInput();
   press.actionPressed = true;
   expect(step(run, 16, press).powered, `${hero} power`).toBe(true);
   const h = run.hero;
   h.x = x;
   h.y = y;
   h.z = z;
   h.vx = h.vy = h.vz = 0;
   return run;
}

function run0(level: LevelId) {
   return createRun(1, level).course.pads[0];
}

const apex = (v: number) => (v * v) / (2 * G);

describe("hero roles", () => {
   it("five powers, Kiro preselected (World 3's lead), the world's shield: 3 s on a 20 s cooldown", () => {
      expect(HEROES.map((h) => h.power)).toEqual(["dash", "doubleJump", "shield", "magnet", "phase"]);
      expect(DEFAULT_HERO).toBe("kiro");
      expect(POWER_MS.shield).toBe(3000);
      expect(HEROES[2].cooldownMs).toBe(20_000);
      expect(MAGNET_REACH).toBe(6);
   });

   for (const level of LEVEL_IDS) {
      describe(`level ${level}`, () => {
         const course = createRun(1, level).course;

         it("Riko: a cracked panel with orbs packed inside; only the dash breaks in", () => {
            const b = course.blocks.find((x) => x.kind === "cracked")!;
            expect(b).toBeTruthy();
            const cx = (b.x0 + b.x1) / 2;
            const cz = (b.z0 + b.z1) / 2;
            const inside = course.orbs.filter((o) => o.kind === "bonus" && o.x > b.x0 && o.x < b.x1 && o.z > b.z0 && o.z < b.z1);
            expect(inside.length).toBe(2);
            const kiro = at(level, "kiro", b.x0 - 0.3, b.y0 + 0.4, cz);
            kiro.hero.mode = "ground";
            kiro.hero.support = course.pads.findIndex((p) => Math.abs(p.x - cx) <= p.r && Math.abs(p.z - cz) <= p.r);
            for (let i = 0; i < 20; i++) step(kiro, 16, createStepInput());
            expect(kiro.orbs).toBe(0);
            const riko = powered(level, "riko", b.x0 - 0.6, b.y0 + 0.4, cz);
            riko.hero.dashUntil = riko.simMs + POWER_MS.dash;
            riko.hero.dashX = 1;
            riko.hero.dashZ = 0;
            let smashed = false;
            for (let i = 0; i < 10; i++) smashed = step(riko, 16, createStepInput()).smashed >= 0 || smashed;
            expect(smashed).toBe(true);
            riko.hero.x = cx;
            riko.hero.y = b.y0 + 0.4;
            riko.hero.z = cz;
            step(riko, 16, createStepInput());
            expect(riko.orbs).toBeGreaterThanOrEqual(1);
         });

         it("Nami: an upper wall tier over a pad, above a jump and a kick, inside a kick plus a double jump", () => {
            const w = course.walls.find((x) => x.kind === "upper")!;
            expect(w).toBeTruthy();
            const pad = course.pads.find((p) => w.y0 - p.y > 3 && w.y0 - p.y < 3.6 && Math.abs((w.axis === "x" ? p.x : p.z) - (w.a0 + w.a1) / 2) < 2)!;
            expect(pad).toBeTruthy();
            // a run line sits about 1.5 m over the pad; one kick lifts it KICK_UP²/2G
            expect(pad.y + 1.5 + apex(KICK_UP)).toBeLessThan(w.y0);
            expect(pad.y + 1.5 + apex(KICK_UP) + apex(V_JUMP)).toBeGreaterThan(w.y0 + 0.3);
            const orbs = course.orbs.filter((o) => {
               const al = w.axis === "x" ? o.x : o.z;
               const ac = w.axis === "x" ? o.z : o.x;
               return o.kind === "bonus" && o.y > w.y0 && o.y < w.y1 && al >= w.a0 && al <= w.a1 && Math.abs(ac - w.c) < 1;
            });
            expect(orbs.length).toBe(4);
         });

         it("Kiro: a dart-vent line with orbs threaded through it; the shield rides through", () => {
            const d = course.darts[0];
            expect(course.darts.length).toBeGreaterThanOrEqual(3);
            const bare = at(level, "nami", d.x, d.y - 0.6, d.z);
            expect(step(bare, 16, createStepInput()).lost).toBe(true);
            const kiro = powered(level, "kiro", d.x, d.y - 0.7, d.z);
            const ev = step(kiro, 16, createStepInput());
            expect(ev.lost).toBe(false);
            expect(kiro.orbs).toBeGreaterThanOrEqual(1);
         });

         it("Zuno: gold ring orbs in the cliff face behind a wall, past any hand; the magnet pulls them", () => {
            const gold = course.orbs.filter((o) => o.kind === "magnet");
            expect(gold.length).toBe(4);
            const o = gold[1];
            // the nearest a wall-runner gets: on the face of the wall in front of it
            const w = course.walls.find((x) => {
               const al = x.axis === "x" ? o.x : o.z;
               const ac = x.axis === "x" ? o.z : o.x;
               return al >= x.a0 && al <= x.a1 && Math.abs(ac - x.c) < 3 && (ac - x.c) * x.n < 0;
            })!;
            expect(w).toBeTruthy();
            const runner = { x: w.axis === "x" ? o.x : w.c + w.n * 0.4, z: w.axis === "x" ? w.c + w.n * 0.4 : o.z };
            expect(Math.hypot(runner.x - o.x, runner.z - o.z)).toBeGreaterThan(ORB.pickup + 1);
            const zuno = powered(level, "zuno", runner.x, o.y - 0.7, runner.z);
            step(zuno, 16, createStepInput());
            expect(zuno.orbs).toBeGreaterThanOrEqual(2);
         });

         it("Vexa: a ghost room beside a pad; she phases in for the orbs and the shard, the others bounce off", () => {
            const hull = course.hulls[0];
            const cx = (hull.x0 + hull.x1) / 2;
            const cz = (hull.z0 + hull.z1) / 2;
            const y = hull.y0 + 1.2;
            const nami = at(level, "nami", hull.x0 - 0.3, y, cz);
            for (let i = 0; i < 6; i++) step(nami, 16, createStepInput());
            expect(insideHull(course, nami.hero.x, nami.hero.y + 0.6, nami.hero.z)).toBe(false);
            const vexa = powered(level, "vexa", cx, y, cz);
            let secret = false;
            for (let i = 0; i < 8; i++) secret = step(vexa, 16, createStepInput()).secretCount > 0 || secret;
            expect(vexa.orbs).toBeGreaterThanOrEqual(1);
            expect(secret).toBe(true);
         });
      });
   }
});
