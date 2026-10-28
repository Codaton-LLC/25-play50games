// The hero roles (the card): one action press each (keyboard E/Enter and the touch Power button both
// set actionPressed, the same timing), and what each power opens in the drowned temple: Riko dashes
// through cracked brick, Nami's breach jump leaps 4 m out of the water to the orb nests, Kiro's
// shield walks through steam jets and whirlpools, Zuno's magnet pulls buried orbs out of a drained
// floor, Vexa phases through ghost panels to the stickers.
import { describe, expect, it } from "vitest";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { BREACH_HEIGHT, DEFAULT_HERO, HEROES, MAGNET_REACH, POWER_MS } from "./heroes";
import { FLOAT_DEPTH, H_JUMP, courseFor, createRun, createStepInput, step, zoneLevel, type RuinRun, type StepInput } from "./rules";

function hold(run: RuinRun, ms: number, input: StepInput): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(16, left);
      step(run, d, input);
      input.actionPressed = false;
      input.jumpPressed = false;
      left -= d;
   }
}

/** Standing at rest on block `i` at (x, z). */
function standOn(run: RuinRun, i: number, x: number, z: number): void {
   const top = run.course.supports[i].top;
   Object.assign(run.hero, { x, y: top, z, vx: 0, vz: 0, vy: 0, grounded: true, swim: false, support: i, lastTop: top, arcStart: run.simMs, arcY0: top, arcV: 0 });
}

/** Swimming at rest at (x, y, z). */
function swimAt(run: RuinRun, x: number, y: number, z: number): void {
   Object.assign(run.hero, { x, y, z, vx: 0, vz: 0, vy: 0, grounded: false, swim: true, support: -1, lastTop: y });
}

const find = (level: 1 | 2 | 3 | 4 | 5, pred: (s: ReturnType<typeof courseFor>["supports"][number]) => boolean) => courseFor(level).supports.findIndex(pred);

describe("the five heroes", () => {
   it("lists the powers and the plan's cooldowns; Nami (World 2's lead) is the rules' and the picker's default", () => {
      expect(HEROES.map((h) => h.power)).toEqual(["dash", "doubleJump", "shield", "magnet", "phase"]);
      expect(HEROES.map((h) => h.cooldownMs)).toEqual([15_000, 10_000, 20_000, 20_000, 20_000]);
      expect(DEFAULT_HERO).toBe("nami");
      expect(createRun(1).heroId).toBe("nami");
      expect(defaultHeroFor("flooded-ruins-escape", null)).toBe("nami");
      expect(BREACH_HEIGHT).toBe(4);
   });
});

describe("Riko: the dash breaks cracked brick (level 2's plug into the cistern tunnel)", () => {
   it("a dash at the plug breaks it and Riko runs into the tunnel (the cistern shard); anyone else is stopped by it", () => {
      const floor = find(2, (s) => s.kind === "floor");
      const crack = find(2, (s) => s.crack);
      expect(crack).toBeGreaterThanOrEqual(0);
      const go = (hero: "riko" | "nami"): RuinRun => {
         const run = createRun(1, 2, hero);
         standOn(run, floor, 0, -13);
         const input = createStepInput();
         input.moveZ = -1;
         input.actionPressed = true;
         hold(run, 1200, input);
         return run;
      };
      const riko = go("riko");
      expect(riko.broken[crack]).toBe(1);
      expect(riko.hero.z).toBeLessThan(-15.6);
      expect(riko.secrets.found[1]).toBe(1);
      const nami = go("nami");
      expect(nami.broken[crack]).toBe(0);
      expect(nami.hero.z).toBeGreaterThan(-15.0);
      expect(nami.secrets.found[1]).toBe(0);
   });
});

describe("Nami: the breach jump out of the water", () => {
   it("from the surface her power leaps BREACH_HEIGHT (4 m) onto level 1's orb nest; a plain leap (H_JUMP) falls short", () => {
      const nest = find(1, (s) => s.kind === "ledge" && s.top === 5.8);
      expect(nest).toBeGreaterThanOrEqual(0);
      const c = courseFor(1);
      const zB = 1;
      const surface = zoneLevel(createRun(1, 1).water, zB, 0);
      expect(surface).toBe(2.6);
      expect(surface - FLOAT_DEPTH + H_JUMP).toBeLessThan(c.supports[nest].top);
      expect(surface - FLOAT_DEPTH + BREACH_HEIGHT).toBeGreaterThan(c.supports[nest].top);
      const leap = (hero: "nami" | "riko", power: boolean): RuinRun => {
         const run = createRun(1, 1, hero);
         swimAt(run, 1.2, surface - FLOAT_DEPTH, -30.4);
         const input = createStepInput();
         input.moveX = 0.3;
         if (power) input.actionPressed = true;
         else input.jumpPressed = true;
         let landed = -1;
         for (let t = 0; t < 1500 && run.ended === null && landed < 0; t += 16) {
            step(run, 16, input);
            input.actionPressed = false;
            input.jumpPressed = false;
            if (run.events.landedOn >= 0) landed = run.events.landedOn;
            if (run.hero.swim && t > 100) break;
         }
         return Object.assign(run, { landedNest: landed === nest });
      };
      const nami = leap("nami", true) as RuinRun & { landedNest: boolean };
      expect(nami.landedNest).toBe(true);
      expect(nami.orbs).toBe(2);
      const riko = leap("riko", false) as RuinRun & { landedNest: boolean };
      expect(riko.landedNest).toBe(false);
      expect(riko.orbs).toBe(0);
      // Nami's plain leap (Jump, not the power) falls short too
      const plain = leap("nami", false) as RuinRun & { landedNest: boolean };
      expect(plain.landedNest).toBe(false);
   });

   it("in the air her power is the capped double jump: it never rises past the flight's apex", () => {
      const run = createRun(1, 1, "nami");
      const start = run.course.checkpoints[0];
      standOn(run, start, 0, 1.5);
      const input = createStepInput();
      input.jumpPressed = true;
      hold(run, 300, input);
      const cap = run.hero.apexCap;
      input.actionPressed = true;
      let top = -Infinity;
      for (let t = 0; t < 1500; t += 4) {
         step(run, 4, input);
         input.actionPressed = false;
         top = Math.max(top, run.hero.y);
      }
      expect(top).toBeLessThanOrEqual(cap + 1e-6);
   });
});

describe("Kiro: the shield through steam jets and whirlpools", () => {
   it("level 3's rim jet drops anyone in it at once, but not a shielded Kiro until the shield ends", () => {
      const ledge = find(3, (s) => s.kind === "ledge" && s.top === 18.5);
      const jet = courseFor(3).jets[0];
      const sit = (hero: "kiro" | "riko"): RuinRun => {
         const run = createRun(1, 3, hero);
         standOn(run, ledge, jet.x, jet.z);
         const input = createStepInput();
         input.actionPressed = true;
         hold(run, 2300, input);
         return run;
      };
      const riko = sit("riko");
      expect(riko.hits).toBeGreaterThan(0);
      expect(riko.hero.lostCause).toBe("jet");
      const kiro = sit("kiro");
      expect(kiro.hits).toBe(0);
      expect(POWER_MS.shield).toBe(2500);
      // the shield is bounded: the jet's next burst after it gets him
      hold(kiro, 1500, createStepInput());
      expect(kiro.hits).toBe(1);
   });

   it("level 4's whirlpool core drags a swimmer under; a shielded Kiro swims in it unhurt", () => {
      const wh = courseFor(4).whirls[0];
      const swim = (hero: "kiro" | "zuno"): RuinRun => {
         const run = createRun(1, 4, hero);
         swimAt(run, wh.x, 0, wh.z);
         const input = createStepInput();
         input.actionPressed = true;
         hold(run, 2000, input);
         return run;
      };
      const zuno = swim("zuno");
      expect(zuno.hero.lostCause).toBe("whirl");
      expect(zuno.hits).toBeGreaterThan(0);
      expect(swim("kiro").hits).toBe(0);
   });
});

describe("Zuno: the magnet pulls buried orbs out of a drained floor", () => {
   it("level 1's buried trail: no one picks it up by walking over it; Zuno's magnet pulls all three from MAGNET_REACH, only while the trench is dry", () => {
      const floor = find(1, (s) => s.kind === "floor");
      const c = courseFor(1);
      const buried = c.orbs.filter((o) => o.buried >= 0);
      expect(buried).toHaveLength(3);
      expect(MAGNET_REACH).toBe(4.2);
      const walk = (hero: "zuno" | "vexa", flood = false): RuinRun => {
         const run = createRun(1, 1, hero);
         standOn(run, floor, -1.6, -9);
         if (flood) {
            // the trench flooded over the floor
            run.water.fromY[0] = 2.4;
            run.water.target[0] = 2.4;
            swimAt(run, -1.6, 1.85, -9);
         }
         const input = createStepInput();
         input.actionPressed = true;
         hold(run, 400, input);
         return run;
      };
      const dug = (run: RuinRun) => c.orbs.reduce((n, o, i) => n + (o.buried >= 0 && run.collected[i] ? 1 : 0), 0);
      expect(dug(walk("vexa"))).toBe(0);
      expect(dug(walk("zuno"))).toBe(3);
      expect(dug(walk("zuno", true))).toBe(0);
   });
});

describe("Vexa: the phase through ghost panels", () => {
   it("level 1's ghost panel beside the switchback checkpoint stops everyone; Vexa phases through it to the niche sticker", () => {
      const cp = find(1, (s) => s.kind === "checkpoint" && s.top === 5.2);
      const ghost = find(1, (s) => s.ghost);
      expect(ghost).toBeGreaterThanOrEqual(0);
      const go = (hero: "vexa" | "kiro"): RuinRun => {
         const run = createRun(1, 1, hero);
         standOn(run, cp, -2.5, -45);
         const input = createStepInput();
         input.moveX = -0.6;
         input.actionPressed = true;
         hold(run, 900, input);
         return run;
      };
      const vexa = go("vexa");
      expect(vexa.hero.x).toBeLessThan(-3.5);
      expect(vexa.secrets.found[1]).toBe(1);
      const kiro = go("kiro");
      expect(kiro.hero.x).toBeGreaterThan(-3.0);
      expect(kiro.secrets.found[1]).toBe(0);
   });
});

describe("Vexa: the hidden spiral niche (level 3)", () => {
   it("the sill by slot 8 ends at a ghost panel in the shaft wall: only Vexa's phase reaches the sticker behind it", () => {
      const sill = find(3, (s) => s.kind === "floor" && s.top === 6.5);
      expect(sill).toBeGreaterThanOrEqual(0);
      const go = (hero: "vexa" | "riko"): RuinRun => {
         const run = createRun(1, 3, hero);
         standOn(run, sill, 0, -22.0);
         const input = createStepInput();
         input.moveZ = -0.5;
         input.actionPressed = true;
         hold(run, 900, input);
         return run;
      };
      expect(go("vexa").secrets.found[1]).toBe(1);
      expect(go("riko").secrets.found[1]).toBe(0);
   });
});

describe("one press, one timing", () => {
   it("every power fires on actionPressed alone (a jump press never fires it) and starts its own cooldown", () => {
      for (const h of HEROES) {
         const run = createRun(1, 1, h.id);
         const input = createStepInput();
         input.jumpPressed = true;
         step(run, 16, input);
         expect(run.powerReadyAt, `${h.id} jump`).toBe(0);
         if (h.power === "doubleJump") {
            // Nami's power needs the air (or the water's surface): in the air it fires
            hold(run, 100, createStepInput());
         }
         const p = createStepInput();
         p.actionPressed = true;
         step(run, 16, p);
         expect(run.events.powered || run.powerReadyAt > 0, `${h.id} power`).toBe(true);
         expect(run.powerReadyAt).toBeGreaterThan(run.simMs);
         expect(run.powerReadyAt).toBeLessThanOrEqual(run.simMs + h.cooldownMs);
         const ready = run.powerReadyAt;
         step(run, 16, p);
         expect(run.powerReadyAt).toBe(ready);
      }
   });
});
