// The card's hero roles, on every level: each hero opens its own pocket of bonus orbs (the all-orbs
// star counts the main orbs only, so any hero earns every star). The runs start late in the clock so
// the proof's reach bound (x <= startX + V_X_CAP * t) never moves the teleported hero.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { DEFAULT_HERO, HEROES, MAGNET_REACH, POWER_MS, V_DASH, type HeroId } from "./heroes";
import { G, L_MAX, ORB, V_JUMP, createRun, createStepInput, insideHull, step, type SwingRun } from "./rules";

function at(level: LevelId, hero: HeroId, x: number, y: number, z: number): SwingRun {
   const run = createRun(1, level, hero);
   run.simMs = 60_000;
   const h = run.hero;
   h.mode = "air";
   h.grounded = false;
   h.x = x;
   h.y = y;
   h.z = z;
   h.vx = h.vy = h.vz = 0;
   return run;
}

function press(): ReturnType<typeof createStepInput> {
   const input = createStepInput();
   input.actionPressed = true;
   return input;
}

/** fire the power high over the start, then put the hero at (x, y, z) */
function powered(level: LevelId, hero: HeroId, x: number, y: number, z: number): SwingRun {
   const run = at(level, hero, 0, 30, 0);
   expect(step(run, 16, press()).powered, `${hero} power`).toBe(true);
   const h = run.hero;
   h.x = x;
   h.y = y;
   h.z = z;
   h.vx = h.vy = h.vz = 0;
   return run;
}

const apex = (V_JUMP * V_JUMP) / (2 * G);

describe("hero roles", () => {
   it("lists the five powers and preselects Nami", () => {
      expect(HEROES.map((h) => h.power)).toEqual(["dash", "doubleJump", "shield", "magnet", "phase"]);
      expect(DEFAULT_HERO).toBe("nami");
      expect(V_DASH * (POWER_MS.dash / 1000)).toBeCloseTo(6, 5);
      expect(MAGNET_REACH).toBe(6);
   });

   for (const level of LEVEL_IDS) {
      describe(`level ${level}`, () => {
         const course = createRun(1, level).course;

         it("Riko: a crate stack with orbs packed inside; only the dash breaks in", () => {
            const crates = course.blocks.filter((b) => b.kind === "crate");
            expect(crates.length).toBeGreaterThanOrEqual(1);
            const c = crates[0];
            const cx = (c.x0 + c.x1) / 2;
            const cz = (c.z0 + c.z1) / 2;
            const inside = course.orbs.filter((o) => o.kind === "bonus" && o.x > c.x0 && o.x < c.x1 && o.z > c.z0 && o.z < c.z1 && o.y > c.y0 && o.y < c.y1);
            expect(inside.length).toBeGreaterThanOrEqual(2);
            // Nami pressed against it from the side gets nothing
            const nami = at(level, "nami", c.x0 - 0.3, c.y0 + 0.4, cz);
            for (let i = 0; i < 20; i++) step(nami, 16, createStepInput());
            expect(nami.orbs).toBe(0);
            // Riko dashes in from the side, the stack breaks and the orbs are his
            const riko = powered(level, "riko", c.x0 - 0.6, c.y0 + 0.4, cz);
            riko.hero.dashUntil = riko.simMs + POWER_MS.dash;
            riko.hero.dashX = 1;
            riko.hero.dashZ = 0;
            let smashed = false;
            for (let i = 0; i < 12; i++) smashed = step(riko, 16, createStepInput()).smashed >= 0 || smashed;
            expect(smashed).toBe(true);
            riko.hero.x = cx;
            riko.hero.y = c.y0 + 0.4;
            riko.hero.z = cz;
            step(riko, 16, createStepInput());
            expect(riko.orbs).toBeGreaterThanOrEqual(1);
         });

         it("Kiro: a spark or smoke line with orbs strung on it; the shield rides through", () => {
            expect(course.hazards.length).toBeGreaterThanOrEqual(3);
            const z = course.hazards[0];
            const strung = course.orbs.filter((o) => o.kind === "bonus" && Math.hypot(o.x - z.x, o.y - z.y, o.z - z.z) < z.r);
            expect(strung.length).toBeGreaterThanOrEqual(1);
            const bare = at(level, "nami", z.x, z.y - 0.6, z.z);
            expect(step(bare, 16, createStepInput()).lost).toBe(true);
            const kiro = powered(level, "kiro", z.x, z.y - 0.7, z.z);
            const ev = step(kiro, 16, createStepInput());
            expect(ev.lost).toBe(false);
            expect(kiro.orbs).toBeGreaterThanOrEqual(1);
         });

         it("Zuno: an orb string under the clouds, below any swing's lowest point; the magnet pulls it", () => {
            const string = course.orbs.filter((o) => o.kind === "magnet");
            expect(string.length).toBeGreaterThanOrEqual(4);
            const o = string[1];
            // the lowest a rope can carry a hero there: the lowest ring overhead, at full length
            let lowest = Infinity;
            for (const a of course.anchors) if (Math.abs(a.x - o.x) < 6 && a.kind !== "drone") lowest = Math.min(lowest, a.y - L_MAX);
            expect(lowest + 0.7 - o.y).toBeGreaterThan(ORB.pickup);
            const zuno = powered(level, "zuno", o.x, o.y + 4.6, o.z);
            step(zuno, 16, createStepInput());
            expect(zuno.orbs).toBeGreaterThanOrEqual(2);
         });

         it("Nami: a high ledge beside a rest deck, over one jump and under a double jump, an orb loop on it", () => {
            const ledges = course.islands.filter((s) => s.kind === "deck" && course.islands.some((d) => d.cp && d.x === s.x && s.y - d.y > apex + 0.3 && s.y - d.y < 2 * apex - 0.3));
            expect(ledges.length).toBeGreaterThanOrEqual(1);
            const l = ledges[0];
            const loop = course.orbs.filter((o) => o.kind === "bonus" && Math.abs(o.z - l.z) < 0.01 && Math.abs(o.x - l.x) < 1.5);
            expect(loop.length).toBe(5);
         });

         it("Vexa: a ghost hull round a hidden deck; she phases in and walks back out, the others bounce off", () => {
            expect(course.hulls.length).toBeGreaterThanOrEqual(1);
            const hull = course.hulls[0];
            const cx = (hull.x0 + hull.x1) / 2;
            const cz = (hull.z0 + hull.z1) / 2;
            const y = hull.y0 + 1.2;
            const edge = hull.x0 - 0.25;
            const nami = at(level, "nami", edge, y, cz);
            for (let i = 0; i < 6; i++) step(nami, 16, createStepInput());
            expect(insideHull(course, nami.hero.x, nami.hero.y + 0.55, nami.hero.z)).toBe(false);
            const vexa = powered(level, "vexa", cx, y, cz);
            for (let i = 0; i < 6; i++) step(vexa, 16, createStepInput());
            expect(vexa.orbs).toBeGreaterThanOrEqual(1);
            // the phase runs out inside: the panels still let her out
            vexa.hero.phaseUntil = -1;
            vexa.hero.x = hull.x1 - 0.2;
            vexa.hero.y = y;
            vexa.hero.vx = 4;
            vexa.hero.mode = "air";
            for (let i = 0; i < 10; i++) step(vexa, 16, createStepInput());
            expect(vexa.hero.x).toBeGreaterThan(hull.x1 + 0.3);
         });
      });
   }
});
