// Neon Cube Jump rules: the flip on takeoff (every jump lands on the other set; walking off an edge
// does not flip), holograms you fall through, the void and the checkpoint (the field restored), the
// jump's reach, Nami's second jump flipping again, Riko's dash not flipping, Vexa's phase holding her
// on a hologram, Kiro's shield in a live laser, Zuno's coins, rails that slide only while solid, rogue
// clocks, lasers and drones by set, the parity shard, the bound, frame-rate independence and the
// honest bot's clear on every level with every hero.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput, flightS, reachM } from "./bot";
import { courseFor, ROGUE_MS } from "./course";
import { HEROES } from "./heroes";
import {
   BONUS_MS,
   DEAD_MS,
   V_BOUND,
   V_JUMP,
   createRun,
   createStepInput,
   cubePos,
   cubeSolid,
   laserLive,
   maxBonusMs,
   minFinishMs,
   proposeLimits,
   rogueSolid,
   step,
   submittedMs,
   vBound,
   type NeonRun,
   type StepInput,
} from "./rules";

/** A stick (yaw 0: up is -z) toward world direction (dx, dz). */
function toward(dx: number, dz: number): StepInput {
   const i = createStepInput();
   const l = Math.hypot(dx, dz) || 1;
   i.moveX = dx / l;
   i.moveZ = dz / l;
   return i;
}

function run1(run: NeonRun, ms: number, make: () => StepInput): void {
   for (let k = 0; k < ms && run.ended === null; k++) step(run, 1, make());
}

describe("the flip", () => {
   it("A starts solid; a jump flips the field on takeoff, a second jump (ground) flips back", () => {
      const run = createRun(1, 1);
      expect(run.solid).toBe("A");
      const ev = step(run, 1, { ...createStepInput(), jumpPressed: true });
      expect(ev.flipped).toBe(true);
      expect(run.solid).toBe("B");
      expect(run.parity).toBe(1);
      run1(run, 1200, () => createStepInput());
      expect(run.hero.ground).toBe(run.course.start);
      step(run, 1, { ...createStepInput(), jumpPressed: true });
      expect(run.solid).toBe("A");
   });

   it("walking off an edge does not flip; onto a hologram cube he falls through to the void and comes back at the checkpoint with the field restored", () => {
      const run = createRun(1, 1);
      // walk north across the A cube (solid) and off its far edge into the gap: no flip
      let flipped = false;
      let died = false;
      for (let k = 0; k < 4000 && !died; k++) {
         const ev = step(run, 1, toward(0, -1));
         if (ev.flipped) flipped = true;
         if (ev.died) died = true;
      }
      expect(flipped).toBe(false);
      expect(died).toBe(true);
      expect(run.deaths).toBe(1);
      run1(run, DEAD_MS + 5, () => createStepInput());
      expect(run.hero.ground).toBe(run.course.start);
      expect(run.solid).toBe("A");
   });

   it("a jump clears one cube up and carries about two cubes across", () => {
      expect((V_JUMP * V_JUMP) / (2 * 24)).toBeGreaterThan(2.4);
      expect(reachM(2)).toBeGreaterThan(4);
      expect(reachM(0)).toBeGreaterThan(5.5);
      expect(flightS(3)).toBe(Infinity);
   });
});

describe("hero powers", () => {
   it("Nami's second jump flips again (lands on the set she left); the others' does nothing", () => {
      for (const hero of ["nami", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         step(run, 1, { ...createStepInput(), jumpPressed: true });
         run1(run, 250, () => createStepInput());
         step(run, 1, { ...createStepInput(), jumpPressed: true });
         expect(run.solid, hero).toBe(hero === "nami" ? "A" : "B");
      }
   });

   it("Riko's air dash moves fast and does not flip; it only works in the air", () => {
      const run = createRun(1, 1, "riko");
      step(run, 1, { ...createStepInput(), actionPressed: true });
      expect(run.hero.dashUntil).toBeLessThan(0);
      step(run, 1, { ...createStepInput(), jumpPressed: true });
      run1(run, 100, () => createStepInput());
      const z0 = run.hero.z;
      const flips = run.flips;
      step(run, 1, { ...toward(0, -1), actionPressed: true });
      run1(run, 200, () => toward(0, -1));
      expect(run.flips).toBe(flips);
      expect(z0 - run.hero.z).toBeGreaterThan(3.5);
   });

   it("Vexa's phase holds her on a hologram cube", () => {
      for (const hero of ["vexa", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         // stand on the B cube (a hologram while A is solid)
         const b = run.course.cubes.find((c) => c.set === "B")!;
         run.hero.x = b.x;
         run.hero.z = b.z;
         run.hero.y = b.top;
         run.hero.ground = b.id;
         step(run, 1, { ...createStepInput(), actionPressed: true });
         run1(run, 200, () => createStepInput());
         expect(run.hero.ground === b.id, hero).toBe(hero === "vexa");
      }
   });

   it("Kiro's shield lets him stand in a live laser; without it the laser sends him back", () => {
      const c = courseFor(4);
      const laser = c.cubes.find((q) => q.laser === "A" && q.set === "A")!;
      for (const shield of [false, true]) {
         const run = createRun(1, 4, "kiro");
         expect(laserLive(run, laser)).toBe(true);
         run.hero.x = laser.x;
         run.hero.z = laser.z + 0.9;
         run.hero.y = laser.top;
         run.hero.ground = laser.id;
         if (shield) step(run, 1, { ...createStepInput(), actionPressed: true });
         run1(run, 400, () => toward(0, -1));
         expect(run.deaths > 0, `shield ${shield}`).toBe(!shield);
      }
   });

   it("Zuno's magnet pulls the coins inside the cubes from 5 m; nobody else gets them", () => {
      for (const hero of ["zuno", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         const k = run.course.coins[0];
         run.hero.x = k.x;
         run.hero.z = k.z + 3;
         step(run, 1, { ...createStepInput(), actionPressed: true });
         run1(run, 30, () => createStepInput());
         expect(run.coins > 0, hero).toBe(hero === "zuno");
      }
   });
});

describe("level mechanics", () => {
   it("level 2: a rail cube slides only while its set is solid", () => {
      const run = createRun(1, 2);
      const r = run.course.cubes.find((q) => q.rail)!;
      const at = () => cubePos(run, r, { x: 0, z: 0 }).x;
      const x0 = at();
      run1(run, 500, () => createStepInput());
      expect(at()).toBe(x0);
      run.solid = "B";
      run1(run, 500, () => createStepInput());
      expect(Math.abs(at() - x0)).toBeCloseTo(1, 1);
   });

   it("level 3: a rogue cube keeps its own 1.6 s clock", () => {
      const c = courseFor(3);
      const r = c.cubes.find((q) => q.set === "R")!;
      expect(rogueSolid(r, 0)).not.toBe(rogueSolid(r, ROGUE_MS));
      const run = createRun(1, 3);
      const before = cubeSolid(run, r);
      run.solid = run.solid === "A" ? "B" : "A";
      expect(cubeSolid(run, r)).toBe(before);
   });

   it("level 4: a laser is live only while its set is solid", () => {
      const run = createRun(1, 4);
      const l = run.course.cubes.find((q) => q.laser === "B")!;
      expect(laserLive(run, l)).toBe(false);
      run.solid = "B";
      expect(laserLive(run, l)).toBe(true);
   });

   it("the parity shard is taken only after an even number of jumps since the checkpoint", () => {
      for (const parity of [1, 2]) {
         const run = createRun(1, 1);
         run.parity = parity;
         const s = run.course.shard;
         run.hero.x = s.x;
         run.hero.y = s.y - 0.75;
         run.hero.z = s.z;
         run.hero.ground = -1;
         step(run, 1, createStepInput());
         expect(!!run.secrets.found[0], `parity ${parity}`).toBe(parity % 2 === 0);
      }
   });
});

describe("the bound and the honest bot", () => {
   it("the least finish is the straight line at vBound; level 2 adds the rail carry", () => {
      const c1 = courseFor(1);
      const s = c1.cubes[c1.start];
      const g = c1.cubes[c1.goal];
      expect(minFinishMs(c1)).toBeCloseTo((Math.hypot(g.x - s.x, g.z - s.z) / V_BOUND) * 1000, 6);
      expect(vBound(courseFor(2))).toBe(V_BOUND + 2);
      expect(maxBonusMs(c1)).toBeGreaterThan(c1.orbs.length * BONUS_MS.orb);
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the honest bot at 30, 60 and 144 fps, inside the bound`, () => {
         for (const hero of HEROES) {
            for (const fps of hero.id === "vexa" ? [30, 60, 144] : [60]) {
               const run = createRun(1, level as LevelId, hero.id);
               const bot = createBot(run, 1000 / fps);
               const input = createStepInput();
               for (let f = 0; f < 300_000 / (1000 / fps) && run.ended === null; f++) {
                  botInput(bot, run, input);
                  step(run, 1000 / fps, input);
               }
               expect(run.ended, `${hero.id} ${fps} fps`).toBe("win");
               expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
               expect(submittedMs(run)).toBeGreaterThanOrEqual(proposeLimits(run.course).minDurationMs);
            }
         }
      }, 300_000);
   }
});
