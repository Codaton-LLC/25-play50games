// Disc Target Throw rules: the throw (hold, aim along the camera, hook), the flight (range, banks off
// stone with the speed loss, wood stops it, ghost walls and Vexa's phase, the lob over the palisade), the
// bank multiplier, the three-hit cap, the return arc and the catch (clean, catch, drop and fetch), the
// colour order and the Triple Glyph, the monkeys, the thorn zone and Kiro's shield, Mother Snapper's
// windows, and the clear. Frame-rate independence and the honest bot's clear on every level.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { buildCourse, courseFor, targetPos, type Course } from "./course";
import { CATCH, CONTACT, DISC, HOLD_MS, PTS, bankMult, bossMinMs, createRun, createStepInput, flyMs, launchDisc, maxScoreOf, minFinishMs, step, type DiscRun, type StepInput } from "./rules";
import { SNAPPER } from "./progression";

/** Holds Throw with the camera aimed along `heading` (rad) for `ms`, then lets go (1 ms steps). */
function throwAt(run: DiscRun, heading: number, hook = 0, holdMs = HOLD_MS + 10): void {
   const input: StepInput = { ...createStepInput(), throwHeld: true, yaw: heading - Math.PI, moveX: hook };
   for (let i = 0; i < holdMs; i++) step(run, 1, input);
   input.throwHeld = false;
   input.moveX = 0;
   step(run, 1, input);
}

function idle(run: DiscRun, ms: number): void {
   const input = createStepInput();
   for (let i = 0; i < ms && run.ended === null; i++) step(run, 1, input);
}

const hay = (id: number, x: number, z: number) => ({ id, kind: "hay" as const, x, z, r: 0.8, base: 100, required: true, colour: 0, rail: null });

/** A bare course: the perimeter walls and the given targets / columns only. */
function bare(level: LevelId, edit: (c: Course) => void): Course {
   const c = buildCourse(level);
   c.targets = [];
   c.columns = [];
   c.boxes = c.boxes.filter((b) => b.kind === "stone");
   c.thorns = null;
   c.monkeys = [];
   edit(c);
   // a far corner target nothing in a test reaches, so a bare yard is not cleared at once
   if (!c.targets.some((t) => t.required)) c.targets.push(hay(c.targets.length, 10, 5));
   c.required = c.targets.filter((t) => t.required).length;
   c.orbCount = c.targets.filter((t) => t.kind === "orb").length;
   return c;
}

describe("the throw", () => {
   it("a tap does not throw; a hold of HOLD_MS does, along the camera's view", () => {
      const run = createRun(1, 1);
      throwAt(run, Math.PI, 0, HOLD_MS - 20);
      expect(run.disc.mode).toBe("hand");
      throwAt(run, Math.PI, 0);
      expect(run.disc.mode).toBe("out");
      expect(run.throws).toBe(1);
      expect(run.disc.vz).toBeLessThan(-14);
      expect(Math.abs(run.disc.vx)).toBeLessThan(1e-6);
   });

   it("the hero stands while aiming; the stick sideways sets the hook (a 35 deg bend at full)", () => {
      const run = createRun(1, 1);
      const x0 = run.hero.x;
      const input: StepInput = { ...createStepInput(), throwHeld: true, yaw: 0, moveX: 1 };
      for (let i = 0; i < 300; i++) step(run, 1, input);
      expect(run.hero.x).toBeCloseTo(x0, 6);
      const d = { ...run.disc };
      launchDisc(d, 0, 3, Math.PI, 1, false, false);
      const c = bare(1, () => {});
      for (let i = 0; i < 1200; i++) flyMs(c, d, null, false);
      const bend = Math.abs(Math.atan2(d.vx, -d.vz));
      expect(bend * (180 / Math.PI)).toBeGreaterThan(33);
      expect(bend * (180 / Math.PI)).toBeLessThan(37);
   });
});

describe("the flight", () => {
   it("flies DISC.range metres, then swings back to the throw spot in DISC.returnMs", () => {
      const c = bare(1, () => {});
      const run = createRun(1, 1, "kiro", c);
      throwAt(run, Math.PI);
      let out = 0;
      while (run.disc.mode === "out" && out < 5000) {
         step(run, 1, createStepInput());
         out++;
      }
      expect(out).toBeGreaterThan(1150);
      expect(out).toBeLessThan(1250);
      let back = 0;
      while (run.disc.mode === "back" && back < 5000) {
         step(run, 1, createStepInput());
         back++;
      }
      expect(back).toBe(DISC.returnMs);
      expect(run.disc.mode).toBe("hand");
      expect(run.cleans).toBe(1);
   });

   it("stone banks with a reflection and a 15 % speed loss; a fourth contact ends the outbound", () => {
      const c = bare(1, (k) => {
         k.columns = [{ x: 0, z: -2, r: 0.5 }];
      });
      const d = { ...createRun(1, 1, "kiro", c).disc };
      launchDisc(d, 0, 3, Math.PI, 0, false, false);
      let code = 0;
      for (let i = 0; i < 1000 && code === CONTACT.none; i++) code = flyMs(c, d, null, false);
      expect(code).toBe(CONTACT.bank);
      expect(d.vz).toBeGreaterThan(0);
      const run = createRun(1, 1, "kiro", c);
      throwAt(run, Math.PI);
      for (let i = 0; i < 400 && run.disc.banks === 0; i++) step(run, 1, createStepInput());
      expect(run.disc.banks).toBe(1);
      expect(run.disc.speed).toBeCloseTo(DISC.speed * DISC.keep, 6);
   });

   it("wood stops the disc; a lob flies over it; a ghost wall stops it unless Vexa's phase is armed", () => {
      const wood = bare(1, (k) => {
         k.boxes.push({ minX: -2, maxX: 2, minZ: -3, maxZ: -2.6, kind: "wood", h: 1.8 });
      });
      const run = createRun(1, 1, "kiro", wood);
      throwAt(run, Math.PI);
      for (let i = 0; i < 600 && run.disc.mode === "out"; i++) step(run, 1, createStepInput());
      expect(run.disc.mode).toBe("back");
      expect(run.disc.travelled).toBeLessThan(7);
      const nami = createRun(1, 1, "nami", wood);
      step(nami, 1, { ...createStepInput(), actionPressed: true });
      expect(nami.hero.lobArmed).toBe(true);
      throwAt(nami, Math.PI);
      for (let i = 0; i < 700 && nami.disc.mode === "out"; i++) step(nami, 1, createStepInput());
      expect(nami.disc.travelled).toBeGreaterThan(7);
      const ghost = bare(1, (k) => {
         k.boxes.push({ minX: -2, maxX: 2, minZ: -3, maxZ: -2.6, kind: "ghost", h: 2 });
      });
      const plain = createRun(1, 1, "kiro", ghost);
      throwAt(plain, Math.PI);
      for (let i = 0; i < 700 && plain.disc.mode === "out"; i++) step(plain, 1, createStepInput());
      expect(plain.disc.travelled).toBeLessThan(7);
      const vexa = createRun(1, 1, "vexa", ghost);
      step(vexa, 1, { ...createStepInput(), actionPressed: true });
      throwAt(vexa, Math.PI);
      for (let i = 0; i < 700 && vexa.disc.mode === "out"; i++) step(vexa, 1, createStepInput());
      expect(vexa.disc.travelled).toBeGreaterThan(7);
   });
});

describe("hits and points", () => {
   it("bank multiplier x1 / x2 / x3; a throw hits at most three things", () => {
      expect([0, 1, 2, 3].map(bankMult)).toEqual([1, 2, 3, 3]);
      const c = bare(1, (k) => {
         k.targets = [hay(0, 0, -1), hay(1, 0, -3.2), hay(2, 0, -5.4), hay(3, 0, -7.6)];
      });
      const run = createRun(1, 1, "kiro", c);
      throwAt(run, Math.PI);
      idle(run, 900);
      expect(run.hit.slice(0, 3)).toEqual(new Uint8Array([1, 1, 1]));
      expect(run.hit[3]).toBe(0);
      expect(run.parts.targets).toBe(300);
   });

   it("a banked hit pays double", () => {
      const c = bare(1, (k) => {
         k.columns = [{ x: 0, z: -2, r: 0.5 }];
         k.targets = [hay(0, 0, 4.8)];
      });
      const run = createRun(1, 1, "kiro", c);
      run.hero.z = 1;
      throwAt(run, Math.PI);
      idle(run, 700);
      expect(run.hit[0]).toBe(1);
      expect(run.parts.targets).toBe(200);
   });

   it("the clear: every required target down ends the run with the speed bonus", () => {
      const c = bare(1, (k) => {
         k.targets = [hay(0, 0, -2)];
      });
      const run = createRun(1, 1, "kiro", c);
      throwAt(run, Math.PI);
      idle(run, 400);
      expect(run.ended).toBe("win");
      expect(run.timeBonus).toBeGreaterThan(0);
      expect(run.score).toBe(100 + run.timeBonus);
   });
});

describe("the catch", () => {
   it("on the spot: clean (the combo and +50 after a scoring throw); 1.6 m off: a catch; farther: a drop and a 1.5 s fetch", () => {
      for (const [off, want] of [[0.3, "clean"], [1.2, "catch"], [2.5, "drop"]] as const) {
         const c = bare(1, (k) => {
            k.targets = [hay(0, -6, -6), hay(1, 6, -6)];
         });
         const run = createRun(1, 1, "kiro", c);
         run.course.targets.push();
         throwAt(run, Math.PI + 0.6);
         // stand `off` metres from the throw spot for the return
         run.hero.x = run.disc.fromX + off;
         const input = createStepInput();
         let caught: string | null = null;
         for (let i = 0; i < 4000 && run.disc.mode !== "hand" && run.disc.mode !== "ground"; i++) {
            const ev = step(run, 1, input);
            if (ev.caught) caught = ev.caught;
            if (ev.dropped) caught = "drop";
         }
         expect(caught).toBe(want);
         if (want === "drop") {
            expect(run.drops).toBe(1);
            const t0 = run.simMs;
            while (run.disc.mode === "ground") step(run, 1, input);
            expect(run.simMs - t0).toBeGreaterThanOrEqual(CATCH.fetchMs - 2);
         }
      }
   });

   it("Zuno's magnet catches from 3 m off the spot (clean)", () => {
      const c = bare(1, () => {});
      const zuno = createRun(1, 1, "zuno", c);
      throwAt(zuno, Math.PI);
      zuno.hero.x += 2.5;
      while (zuno.disc.mode === "out") step(zuno, 1, createStepInput());
      step(zuno, 1, { ...createStepInput(), actionPressed: true });
      while (zuno.disc.mode === "back") step(zuno, 1, createStepInput());
      expect(zuno.disc.mode).toBe("hand");
      expect(zuno.cleans).toBe(1);
   });
});

describe("level mechanics", () => {
   it("level 3: idols in colour order pay double; three in a row in one throw is a Triple Glyph", () => {
      const c = bare(3, (k) => {
         k.targets = [0, 1, 2].map((colour, i) => ({ id: i, kind: "idol" as const, x: 0, z: -1.5 - i * 2.2, r: 0.7, base: 150, required: true, colour, rail: null }));
      });
      const run = createRun(1, 3, "kiro", c);
      throwAt(run, Math.PI);
      idle(run, 600);
      expect(run.parts.targets).toBe(900);
      expect(run.parts.triples).toBe(PTS.triple);
   });

   it("rail targets slide; a free monkey snatches a returning disc near the throw spot", () => {
      const c = courseFor(2);
      const t = c.targets.find((q) => q.rail)!;
      const a = targetPos(t, 0, { x: 0, z: 0 });
      const ax = a.x;
      const b = targetPos(t, 1000, { x: 0, z: 0 });
      expect(Math.hypot(b.x - ax, b.z - a.z)).toBeGreaterThan(0.5);
      const m = bare(4, (k) => {
         k.monkeys = [{ x: 0, z: 4.2, ax: 0, az: 1, amp: 0, omega: 0 }];
         k.raft = null;
      });
      const run = createRun(1, 4, "kiro", m);
      run.hero.z = 3;
      throwAt(run, Math.PI + 1.2);
      let snatched = false;
      for (let i = 0; i < 4000 && run.disc.mode !== "hand" && run.disc.mode !== "ground"; i++) if (step(run, 1, createStepInput()).snatched) snatched = true;
      expect(snatched).toBe(true);
      expect(run.drops).toBe(1);
   });

   it("the thorn zone stuns a hero in it while it bursts; Kiro's shield blocks it", () => {
      const c = courseFor(1);
      const th = c.thorns!;
      for (const shield of [false, true]) {
         const run = createRun(1, 1, "kiro");
         run.hero.x = th.x;
         run.hero.z = th.z;
         if (shield) step(run, 1, { ...createStepInput(), actionPressed: true });
         idle(run, 2900);
         expect(run.hits > 0).toBe(!shield);
      }
   });

   it("level 5: Mother Snapper can be hit only in an open window; her least defeat time is the proof's floor", () => {
      const ms = bossMinMs();
      expect(ms).toBeGreaterThan(SNAPPER.introMs);
      expect(minFinishMs(courseFor(5))).toBe(ms);
      const run = createRun(1, 5, "kiro");
      expect(run.boss!.hp).toBe(9);
      run.hero.x = 0;
      run.hero.z = -3;
      throwAt(run, Math.PI);
      idle(run, 600);
      expect(run.boss!.hp).toBe(9);
   });
});

describe("the bound and the honest bot", () => {
   it("the least finish: ceil(required / 3) throws, each after HOLD_MS of aim and the disc's return", () => {
      const c = courseFor(1);
      expect(minFinishMs(c)).toBe(HOLD_MS + (Math.ceil(c.required / 3) - 1) * (DISC.returnMs + HOLD_MS));
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot clears at 30, 60 and 144 fps inside the bound`, () => {
         for (const fps of [30, 60, 144]) {
            const run = createRun(1, level);
            const bot = createBot(run, 1000 / fps);
            const input = createStepInput();
            for (let f = 0; f < 400_000 / (1000 / fps) && run.ended === null; f++) {
               botInput(bot, run, input);
               step(run, 1000 / fps, input);
            }
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.score).toBeLessThanOrEqual(maxScoreOf(run.course));
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
         }
      }, 400_000);
   }
});
