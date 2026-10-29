// The rules: running round a stair climbs it (pitch per lap), the pole's spin carries or treadmills a
// standing hero, a hop needs facing and a push and never lifts you, gaps drop a lap, hazards hurt (the
// shield stops them), each hero's gated orb, the secrets, Coilstone's phases, the fixed step, the clock.
import { describe, expect, it } from "vitest";
import { TAU, courseFor, dirTo, helixTop, stairY, sweeperAngle, turnUnder } from "./course";
import {
   HOP_MS, STEP_MS, V_RUN, createRun, createStepInput, floorY, heroAngle, hopTarget, poleOmega, step,
   type Hop, type SpinRun, type StepInput,
} from "./rules";
import { COILSTONE, SECRETS } from "./progression";
import { LEVELS } from "./levels";

/** The stick that runs up the stair at the hero's angle (camera yaw 0). */
function up(run: SpinRun, input: StepInput, sign = 1): StepInput {
   const a = heroAngle(run);
   input.moveX = Math.cos(a) * sign;
   input.moveZ = -Math.sin(a) * sign;
   return input;
}

function run(level: 1 | 2 | 3 | 4 | 5, ms: number, fn: (r: SpinRun, i: StepInput) => void, r = createRun(1, level)): SpinRun {
   const input = createStepInput();
   for (let t = 0; t < ms && r.ended === null; t += STEP_MS) {
      input.jumpPressed = input.actionPressed = false;
      fn(r, input);
      step(r, STEP_MS, input);
   }
   return r;
}

const probe = (): Hop => ({ active: false, t: 0, fromX: 0, fromY: 0, fromZ: 0, helix: 0, a: 0, cap: false, capA: 0, toX: 0, toY: 0, toZ: 0 });

describe("orbit to rise", () => {
   it("running round a still stair climbs pitch / 2 pi metres a radian", () => {
      const r = run(1, 1000, (rr, i) => up(rr, i));
      const h = r.course.helices[0];
      const p = r.course.poles[h.pole];
      expect(r.hero.a).toBeCloseTo((V_RUN / p.walk) * 1, 1);
      expect(floorY(r)).toBeCloseTo(stairY(h, r.hero.a), 9);
      expect(floorY(r)).toBeCloseTo((h.pitch * r.hero.a) / TAU, 6);
   });

   it("running the other way descends, never under the stair's foot", () => {
      const r = run(1, 2000, (rr, i) => up(rr, i, -1));
      expect(r.hero.a).toBe(r.course.helices[0].a0);
      expect(floorY(r)).toBe(0);
   });

   it("the spin drags a standing hero: up on a pole turning with him, down against", () => {
      const withRun = createRun(1, 1);
      withRun.hero.helix = 1;
      withRun.hero.a = withRun.course.helices[1].a0 + 2;
      const a0 = withRun.hero.a;
      run(1, 1000, () => {}, withRun);
      expect(withRun.hero.a - a0).toBeCloseTo(withRun.course.poles[1].spin.omega, 2);
      const against = createRun(1, 1);
      against.hero.helix = 2;
      against.hero.a = against.course.helices[2].a0 + 3;
      const b0 = against.hero.a;
      run(1, 1000, () => {}, against);
      expect(against.hero.a).toBeLessThan(b0);
   });

   it("up on the stick is camera-relative: at yaw pi the same screen push runs the other way", () => {
      const a = run(1, 500, (r, i) => {
         i.moveX = 1;
         i.yaw = 0;
      });
      const b = run(1, 500, (r, i) => {
         i.moveX = 1;
         i.yaw = Math.PI;
      });
      expect(a.hero.a).toBeGreaterThan(0.5);
      expect(b.hero.a).toBe(0);
   });

   it("reaching the goal cap wins", () => {
      const r = createRun(1, 1);
      const d = r.course.helices[3];
      r.hero.helix = 3;
      r.hero.a = d.a0 + d.laps * TAU - 0.05;
      run(1, 500, (rr, i) => up(rr, i), r);
      expect(r.ended).toBe("win");
      expect(floorY(r)).toBe(helixTop(d));
   });
});

describe("hops", () => {
   it("a hop needs the hero facing the neighbour and pushing at it, and lands at a turn no higher", () => {
      const r = createRun(1, 1);
      const c = r.course;
      // A's top cap faces B
      r.hero.helix = 0;
      r.hero.cap = true;
      r.hero.a = c.helices[0].a0 + 2 * TAU;
      const d = dirTo(c.poles[0], c.poles[1].x, c.poles[1].z);
      r.hero.capA = d;
      const out = probe();
      expect(hopTarget(r, Math.sin(d), Math.cos(d), out)).toBe(true);
      expect(out.helix).toBe(1);
      expect(stairY(c.helices[1], out.a)).toBeLessThanOrEqual(floorY(r) + 1e-9);
      // facing away: nothing
      r.hero.capA = d + Math.PI;
      expect(hopTarget(r, Math.sin(d), Math.cos(d), out)).toBe(false);
      // facing, but pushing the other way: nothing
      r.hero.capA = d;
      expect(hopTarget(r, -Math.sin(d), -Math.cos(d), out)).toBe(false);
   });

   it("Jump + push carries the hero across in HOP_MS and onto the other stair", () => {
      const r = createRun(1, 1);
      const c = r.course;
      r.hero.helix = 0;
      r.hero.cap = true;
      r.hero.a = c.helices[0].a0 + 2 * TAU;
      const d = dirTo(c.poles[0], c.poles[1].x, c.poles[1].z);
      r.hero.capA = d;
      const input = createStepInput();
      input.moveX = Math.sin(d);
      input.moveZ = Math.cos(d);
      input.jumpPressed = true;
      step(r, STEP_MS, input);
      expect(r.hero.hop.active).toBe(true);
      input.jumpPressed = false;
      input.moveX = input.moveZ = 0;
      for (let t = 0; t < HOP_MS + 50; t += STEP_MS) step(r, STEP_MS, input);
      expect(r.hero.helix).toBe(1);
      expect(floorY(r)).toBeCloseTo(6, 1);
   });

   it("the ghost pole takes only a phased hero", () => {
      const r = createRun(1, 1, "vexa");
      const c = r.course;
      const g = c.poles.findIndex((p) => p.ghost);
      const a0 = c.helices[0];
      const d = dirTo(c.poles[0], c.poles[g].x, c.poles[g].z);
      r.hero.helix = 0;
      r.hero.a = turnUnder(a0, d, 99);
      const out = probe();
      expect(hopTarget(r, Math.sin(d), Math.cos(d), out)).toBe(false);
      r.phaseUntil = r.simMs + 2000;
      expect(hopTarget(r, Math.sin(d), Math.cos(d), out)).toBe(true);
      expect(c.poles[c.helices[out.helix].pole].ghost).toBe(true);
   });

   it("on the wide tower, pushing in hops onto the next stair at a turn no higher", () => {
      const r = createRun(1, 4);
      r.hero.a = 4;
      const out = probe();
      const a = heroAngle(r);
      expect(hopTarget(r, -Math.sin(a), -Math.cos(a), out)).toBe(true);
      expect(out.helix).toBe(1);
      expect(stairY(r.course.helices[1], out.a)).toBeLessThanOrEqual(floorY(r) + 1e-9);
   });
});

describe("hazards", () => {
   it("walking into a gap drops a lap and counts a hit", () => {
      const r = createRun(1, 1);
      const g = r.course.gaps[0];
      r.hero.helix = g.helix;
      r.hero.a = g.from - 0.05;
      const before = floorY(r);
      run(1, 800, (rr, i) => up(rr, i), r);
      expect(r.hits).toBe(1);
      expect(floorY(r)).toBeLessThan(before);
   });

   it("a sweeper at body height hurts; the shield stops it", () => {
      for (const shield of [false, true]) {
         const r = createRun(1, 2, "kiro");
         const s = r.course.sweepers[0];
         const h = r.course.helices[0];
         // stand where the stair is just under the bar, at the angle the bar sweeps through next
         const a = h.a0 + ((s.y - 0.6) / h.pitch) * TAU;
         r.hero.a = a;
         if (shield) r.shieldUntil = 99_999;
         const before = r.hits;
         for (let t = 0; t < 6000 && r.hits === before; t += STEP_MS) {
            r.hero.a = a;
            step(r, STEP_MS, createStepInput());
            void sweeperAngle;
         }
         expect(r.hits - before, `shield ${shield}`).toBe(shield ? 0 : 1);
      }
   });

   it("spikes hurt a grounded hero only", () => {
      const r = createRun(1, 4);
      const s = r.course.spikes[0];
      r.hero.helix = s.helix;
      r.hero.a = (s.from + s.to) / 2;
      step(r, STEP_MS, createStepInput());
      expect(r.hits).toBe(1);
      const air = createRun(1, 4);
      air.hero.helix = s.helix;
      air.hero.a = (s.from + s.to) / 2;
      air.hero.grounded = false;
      air.hero.air = 0.8;
      air.hero.vAir = 2;
      step(air, STEP_MS, createStepInput());
      expect(air.hits).toBe(0);
   });
});

describe("hero orbs", () => {
   const orbOf = (level: 1, gate: string) => courseFor(level).orbs.findIndex((o) => o.gate === gate);

   it("Riko's urn breaks to a dash only", () => {
      for (const [hero, dash] of [["riko", true], ["kiro", false]] as const) {
         const r = createRun(1, 1, hero);
         const i = orbOf(1, "riko");
         const o = r.course.orbs[i];
         r.hero.a = o.at - 0.4;
         run(1, 500, (rr, inp) => {
            up(rr, inp);
            if (dash && rr.simMs < 20) inp.actionPressed = true;
         }, r);
         expect(r.orbTaken[i], hero).toBe(dash);
      }
   });

   it("the veiled orb is Kiro's with the shield; the veil hurts nobody", () => {
      for (const shield of [false, true]) {
         const r = createRun(1, 1, "kiro");
         const i = orbOf(1, "kiro");
         const o = r.course.orbs[i];
         r.hero.helix = o.helix;
         r.hero.a = o.at - 0.6;
         run(1, 600, (rr, inp) => {
            up(rr, inp);
            if (shield && rr.simMs < 20) inp.actionPressed = true;
         }, r);
         expect(r.orbTaken[i]).toBe(shield);
         expect(r.hits).toBe(0);
      }
   });

   it("Nami's orb floats out of a single jump's reach", () => {
      for (const hero of ["nami", "kiro"] as const) {
         const r = createRun(1, 1, hero);
         const i = orbOf(1, "nami");
         const o = r.course.orbs[i];
         r.hero.helix = o.helix;
         r.hero.a = o.at - 0.55;
         let t = 0;
         run(1, 900, (rr, inp) => {
            up(rr, inp);
            t += STEP_MS;
            if (t < 10 || (t > 240 && t < 250)) inp.jumpPressed = true;
         }, r);
         expect(r.orbTaken[i], hero).toBe(hero === "nami");
      }
   });

   it("Zuno's magnet pulls the orb out of the hollow pole", () => {
      const r = createRun(1, 1, "zuno");
      const i = orbOf(1, "zuno");
      const o = r.course.orbs[i];
      r.hero.helix = o.helix;
      r.hero.a = o.at;
      run(1, 100, (_rr, inp) => {
         inp.actionPressed = true;
      }, r);
      expect(r.orbTaken[i]).toBe(true);
   });
});

describe("secrets", () => {
   it("the ghost pole's cap holds Vexa's shard", () => {
      const r = createRun(1, 1, "vexa");
      const g = r.course.helices.find((h) => r.course.poles[h.pole].ghost)!;
      r.hero.helix = g.id;
      r.hero.a = g.a0 + g.laps * TAU - 0.05;
      run(1, 300, (rr, i) => up(rr, i), r);
      const idx = SECRETS[1].findIndex((s) => s.id === "ghost-pole");
      expect(r.secrets.found[idx]).toBeTruthy();
   });

   it("the spin disc turns every pole your way for 10 s", () => {
      const r = createRun(1, 1);
      const disc = r.course.disc!;
      r.hero.helix = disc.helix;
      r.hero.cap = true;
      r.hero.a = r.course.helices[disc.helix].a0 + r.course.helices[disc.helix].laps * TAU;
      r.hero.capA = disc.at;
      step(r, STEP_MS, createStepInput());
      expect(r.discUntil).toBeGreaterThan(r.simMs);
      expect(poleOmega(r, 2)).toBeGreaterThan(0);
   });

   it("Against the Grain: climbing the against pole from its foot without a hop", () => {
      const r = createRun(1, 1);
      r.hero.helix = 2;
      r.hero.a = r.course.helices[2].a0;
      r.grain = 2;
      run(1, 20_000, (rr, i) => up(rr, i), r);
      const idx = SECRETS[1].findIndex((s) => s.id === "against-the-grain");
      expect(r.secrets.found[idx]).toBeTruthy();
      expect(r.ended).toBe("win");
   });
});

describe("Coilstone", () => {
   it("phase 1: a landing on the plated segment while it is open is a hit", () => {
      const r = createRun(1, 5);
      const b = r.boss!;
      // skip to the first vulnerable window
      while (b.step !== "vulnerable") step(r, STEP_MS, createStepInput());
      expect(Number.isNaN(r.plateA)).toBe(false);
      r.hero.a = r.plateA;
      r.hero.grounded = false;
      r.hero.air = 0.001;
      r.hero.vAir = -3;
      step(r, STEP_MS, createStepInput());
      expect(b.hp).toBe(COILSTONE.maxHp - 1);
   });

   it("phase 1: the sliding coil hurts a hero standing in its way", () => {
      const r = createRun(1, 5);
      const b = r.boss!;
      while (b.step !== "attack") step(r, STEP_MS, createStepInput());
      r.hero.a = r.coilA;
      step(r, STEP_MS, createStepInput());
      expect(r.hits).toBe(1);
   });
});

describe("the step", () => {
   it("is frame-rate independent for the same held input", () => {
      const at = (fms: number) => {
         const r = createRun(1, 1);
         const input = createStepInput();
         for (let t = 0; t < 4000; t += fms) {
            up(r, input);
            step(r, fms, input);
         }
         return r.hero.a;
      };
      expect(at(1000 / 30)).toBeCloseTo(at(1000 / 144), 1);
   });

   it("the level's time cap ends the run, unranked", () => {
      const r = createRun(1, 1);
      for (let t = 0; t <= LEVELS[1].durationMs + 100 && r.ended === null; t += 50) step(r, 50, createStepInput());
      expect(r.ended).toBe("timeup");
   });
});
