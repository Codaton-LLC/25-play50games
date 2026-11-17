// Crystal Cave Switch rules: striking crystals (reach, order, a wrong one or a decoy resetting the
// room), the gate opening, timed rooms fading, Zuno's magnet reach, Vexa's ghost wall, the moving slab
// carrying the hero, a fall putting him back at the room's entrance, the Prism's beam and colour code,
// the bound, frame-rate independence and the honest bot's clear on every level with every hero.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { courseFor } from "./course";
import { HEROES, MAGNET_REACH } from "./heroes";
import {
   BONUS_MS,
   DEAD_MS,
   V_BOUND,
   boxOffset,
   boxSolid,
   codeFor,
   createRun,
   createStepInput,
   maxBonusMs,
   minFinishMs,
   minPathM,
   proposeLimits,
   step,
   strikable,
   submittedMs,
   vBound,
   type CaveRun,
} from "./rules";

function at(run: CaveRun, x: number, z: number, y = 0): void {
   run.hero.x = x;
   run.hero.z = z;
   run.hero.y = y;
   run.hero.vx = run.hero.vz = run.hero.vy = 0;
   step(run, 1, createStepInput());
}

function strike(run: CaveRun, id: number) {
   const s = run.course.switches[id];
   at(run, s.x + 0.6, s.z, s.base);
   return step(run, 1, { ...createStepInput(), actionPressed: true });
}

describe("crystals and gates", () => {
   it("striking a room's crystals in order lights them and opens its gate", () => {
      const run = createRun(1, 1);
      const r = run.course.rooms[0];
      const gate = run.course.boxes[r.gate];
      expect(boxSolid(run, gate)).toBe(true);
      for (const id of r.seq) expect(strike(run, id).right).toBe(true);
      expect(run.solved[0]).toBe(1);
      expect(boxSolid(run, gate)).toBe(false);
   });

   it("a wrong crystal resets the room's sequence (and counts against Flawless)", () => {
      const run = createRun(1, 1);
      const r = run.course.rooms[1];
      strike(run, r.seq[0]);
      const ev = strike(run, r.seq[2]);
      expect(ev.wrong).toBe(true);
      expect(run.progress[1]).toBe(0);
      expect(run.lit[r.seq[0]]).toBe(0);
      expect(run.wrongs).toBe(1);
   });

   it("a decoy crystal resets the room", () => {
      const run = createRun(1, 4);
      const r = run.course.rooms[0];
      const decoy = run.course.switches.find((s) => s.room === 0 && s.decoy)!;
      strike(run, r.seq[0]);
      expect(strike(run, decoy.id).wrong).toBe(true);
      expect(run.progress[0]).toBe(0);
   });

   it("a timed room's started sequence fades when its time runs out", () => {
      const run = createRun(1, 4);
      const r = run.course.rooms[0];
      strike(run, r.seq[0]);
      let faded = false;
      for (let k = 0; k < r.timerMs + 10; k++) if (step(run, 1, createStepInput()).timeout === 0) faded = true;
      expect(faded).toBe(true);
      expect(run.progress[0]).toBe(0);
   });

   it("only from beside a crystal (1.6 m); Zuno's magnet strikes from 4 m", () => {
      for (const hero of ["zuno", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         const s = run.course.switches[run.course.rooms[0].seq[0]];
         at(run, s.x, s.z + 3.4);
         expect(strikable(run)).toBe(-1);
         step(run, 1, { ...createStepInput(), actionPressed: true });
         expect(strikable(run) === s.id, hero).toBe(hero === "zuno");
      }
      expect(MAGNET_REACH).toBe(4);
   });
});

describe("the cave", () => {
   it("Vexa's phase takes her through a ghost wall; the others are stopped", () => {
      for (const hero of ["vexa", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         const w = run.course.ghostWalls[0];
         const side = Math.sign(w.crystal.x - w.x);
         at(run, w.x - side * 1.2, w.z);
         step(run, 1, { ...createStepInput(), actionPressed: true });
         const input = { ...createStepInput(), moveX: side };
         for (let k = 0; k < 500; k++) step(run, 1, input);
         expect(Math.sign(run.hero.x - w.x) === side, hero).toBe(hero === "vexa");
      }
   });

   it("the moving slab carries whoever stands on it", () => {
      const run = createRun(1, 2);
      const slab = run.course.boxes.find((b) => b.rail)!;
      const o = boxOffset(run, slab, { x: 0, z: 0 });
      at(run, (slab.minX + slab.maxX) / 2 + o.x, (slab.minZ + slab.maxZ) / 2, slab.top);
      expect(run.hero.ground).toBe(slab.id);
      const x0 = run.hero.x;
      for (let k = 0; k < 500; k++) step(run, 1, createStepInput());
      expect(Math.abs(run.hero.x - x0)).toBeGreaterThan(0.9);
   });

   it("a fall into the chasm puts him back at the room's entrance; what he lit stays lit", () => {
      const run = createRun(1, 1);
      strike(run, run.course.rooms[0].seq[0]);
      at(run, 9, -5, 0);
      for (let k = 0; k < 3000 && run.deaths === 0; k++) step(run, 1, createStepInput());
      expect(run.deaths).toBe(1);
      for (let k = 0; k < DEAD_MS + 5; k++) step(run, 1, createStepInput());
      expect(run.hero.z).toBeCloseTo(run.course.rooms[0].spawn.z, 6);
      expect(run.progress[0]).toBe(1);
   });
});

describe("the Hollow Prism", () => {
   it("its code grows with the phase and each colour differs from the last", () => {
      expect(codeFor(0, 0)).toHaveLength(1);
      expect(codeFor(2, 1)).toHaveLength(2);
      const c = codeFor(1, 2);
      expect(c).toHaveLength(3);
      for (let k = 1; k < c.length; k++) expect(c[k]).not.toBe(c[k - 1]);
   });

   it("striking the open core's code cracks it; only while it is open", () => {
      const run = createRun(1, 5);
      const spec = run.course.boss!;
      // a standing shield: the beam's stun would block the strike (tested on its own below)
      run.hero.shieldUntil = Infinity;
      at(run, 0, spec.wakeZ - 2);
      expect(run.bossAwake).toBe(true);
      // closed: nothing
      const first = run.course.switches[spec.switches[0]];
      strike(run, first.id);
      expect(run.boss!.hp).toBe(6);
      for (let k = 0; k < 20_000 && run.boss!.step !== "vulnerable"; k++) step(run, 1, createStepInput());
      const want = run.code[0];
      const id = spec.switches.find((s) => run.course.switches[s].color === want)!;
      expect(strike(run, id).bossHit).toBe(true);
      expect(run.boss!.hp).toBe(5);
   });

   it("its beam burns down the lane it painted: a hero in it is stunned, Kiro's shield passes it", () => {
      for (const shield of [false, true]) {
         const run = createRun(1, 5, "kiro");
         const spec = run.course.boss!;
         at(run, 0, spec.wakeZ - 6);
         for (let k = 0; k < 20_000 && run.boss!.step !== "telegraph"; k++) step(run, 1, createStepInput());
         if (shield) step(run, 1, { ...createStepInput(), actionPressed: true });
         for (let k = 0; k < 3000 && run.boss!.step !== "vulnerable"; k++) step(run, 1, createStepInput());
         expect(run.hurts > 0, `shield ${shield}`).toBe(!shield);
      }
   });
});

describe("the bound and the honest bot", () => {
   it("the least finish is the least path at vBound (plus the Prism's least defeat on level 5)", () => {
      const c1 = courseFor(1);
      expect(minFinishMs(c1)).toBeCloseTo((minPathM(c1) / V_BOUND) * 1000, 6);
      expect(vBound(courseFor(2))).toBe(V_BOUND + 2);
      expect(maxBonusMs(c1)).toBeGreaterThan(c1.orbs.length * BONUS_MS.orb);
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the honest bot (Vexa at 30, 60 and 144 fps), inside the bound`, () => {
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
