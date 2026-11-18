// The hero roles (the card): one action press each (keyboard E/Enter and the touch Power button both
// set actionPressed, the same timing), and what each power opens on the cloud sea.
import { afterEach, describe, expect, it } from "vitest";
import { DASH_GLIDE_MS, DEFAULT_HERO, HEROES, MAGNET_REACH, POWER_MS, V_DASH, pickedHero, selectHero } from "./heroes";
import { ORB, V_JUMP, courseFor, createRun, createStepInput, step, type CloudRun, type StepInput } from "./rules";

function hold(run: CloudRun, ms: number, input: StepInput): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(16, left);
      step(run, d, input);
      left -= d;
   }
}

/** In the air at (x, y, z), at rest, with this much glide. */
function airborne(run: CloudRun, x: number, y: number, z: number, glideMs = 0): void {
   Object.assign(run.hero, { x, y, z, vx: 0, vz: 0, grounded: false, support: -1, arcStart: run.simMs, arcY0: y, arcV: 0, lastTop: y, glideMs, gliding: false });
}

const press = (): StepInput => ({ ...createStepInput(), actionPressed: true });

afterEach(() => selectHero(DEFAULT_HERO));

describe("the five heroes", () => {
   it("lists the powers and this game's cooldowns; Nami (World 2's lead) is preselected", () => {
      expect(HEROES.map((h) => h.power)).toEqual(["dash", "doubleJump", "shield", "magnet", "phase"]);
      expect(HEROES.map((h) => h.cooldownMs)).toEqual([8000, 2500, 15000, 15000, 12000]);
      expect(DEFAULT_HERO).toBe("nami");
      expect(pickedHero()).toBe("nami");
      expect(createRun(1).heroId).toBe("nami");
      selectHero("vexa");
      expect(pickedHero()).toBe("vexa");
   });
});

describe("Riko: the air dash", () => {
   it("does nothing on a cloud or without a second of glide; in the air it bursts 6 m in 500 ms for 1 s of glide, once a flight", () => {
      const ground = createRun(1, 1, "riko");
      step(ground, 1, press());
      expect(ground.events.powered).toBe(false);
      const empty = createRun(1, 1, "riko");
      airborne(empty, 0, 40, -10, 500);
      step(empty, 1, press());
      expect(empty.events.powered).toBe(false);
      const run = createRun(1, 1, "riko");
      airborne(run, 0, 40, -10, 3000);
      const input = press();
      input.moveZ = -1;
      step(run, 1, input);
      expect(run.events.dashed).toBe(true);
      expect(run.hero.glideMs).toBe(3000 - DASH_GLIDE_MS);
      const z0 = run.hero.z;
      const y0 = run.hero.y;
      input.actionPressed = false;
      hold(run, POWER_MS.dash, input);
      expect(z0 - run.hero.z).toBeCloseTo((V_DASH * POWER_MS.dash) / 1000, 1);
      expect(run.hero.y).toBeCloseTo(y0, 6);
      // a second dash in the same flight does not fire, even off cooldown
      run.powerReadyAt = 0;
      step(run, 1, press());
      expect(run.events.dashed).toBe(false);
   });

   it("crashes through a storm-cloud wall that stops everyone else", () => {
      const c = courseFor(1);
      const wi = c.walls.findIndex((w) => w.kind === "storm");
      expect(wi).toBeGreaterThanOrEqual(0);
      const w = c.walls[wi];
      const midZ = (w.z0 + w.z1) / 2;
      const outside = w.side > 0 ? w.x0 - 1.2 : w.x1 + 1.2;
      const dir = w.side > 0 ? 1 : -1;
      for (const hero of ["riko", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         airborne(run, outside, w.y0 + 3, midZ, 3000);
         const input = hero === "riko" ? press() : createStepInput();
         input.moveX = dir;
         hold(run, 400, input);
         if (hero === "riko") {
            expect(run.broken[wi]).toBe(1);
            expect((run.hero.x - outside) * dir).toBeGreaterThan(2);
         } else {
            expect(run.broken[wi]).toBe(0);
            expect((run.hero.x - outside) * dir).toBeLessThan(1.2);
         }
      }
   });
});

describe("Nami: the air jump, refreshed by a glide", () => {
   it("a second jump in the air at full V_JUMP; spent until a glide refreshes it once that flight", () => {
      const run = createRun(1, 1, "nami");
      airborne(run, 0, 40, -10, 4000);
      step(run, 1, press());
      expect(run.events.airJumped).toBe(true);
      expect(run.hero.arcV).toBe(V_JUMP);
      run.powerReadyAt = 0;
      hold(run, 300, createStepInput());
      step(run, 1, press());
      expect(run.events.airJumped).toBe(false);
      // past the apex, a glide re-arms it (once)
      const g = createStepInput();
      g.jumpHeld = true;
      hold(run, 700, g);
      expect(run.hero.gliding).toBe(true);
      run.powerReadyAt = 0;
      step(run, 1, { ...press(), jumpHeld: true });
      expect(run.events.airJumped).toBe(true);
      hold(run, 700, g);
      run.powerReadyAt = 0;
      step(run, 1, { ...press(), jumpHeld: true });
      expect(run.events.airJumped).toBe(false);
   });
});

describe("Kiro: the shield through thunderheads", () => {
   it("a thunderhead drops anyone who touches it, but not a shielded Kiro", () => {
      const c = courseFor(4);
      const t = c.thunder[0];
      for (const shield of [false, true]) {
         const run = createRun(1, 4, "kiro");
         airborne(run, t.x, t.y - ORB.centerY + 3, t.z, 4000);
         if (shield) step(run, 1, press());
         run.hero.y = t.y - ORB.centerY;
         run.hero.arcY0 = run.hero.y;
         run.hero.arcStart = run.simMs;
         step(run, 2, createStepInput());
         expect(run.hero.state === "lost", `shield ${shield}`).toBe(!shield);
      }
   });
});

describe("Zuno: the magnet", () => {
   it("draws feathers and orbs from 6 m, and only the magnet shows and takes the rain column's hidden orbs", () => {
      const c = courseFor(1);
      const hi = c.orbs.findIndex((o) => o.hidden);
      expect(hi).toBeGreaterThanOrEqual(0);
      const o = c.orbs[hi];
      for (const magnet of [false, true]) {
         const run = createRun(1, 1, "zuno");
         airborne(run, o.x - 3, o.y - ORB.centerY, o.z, 4000);
         if (magnet) step(run, 1, press());
         const g = createStepInput();
         g.jumpHeld = true;
         step(run, 2, g);
         expect(run.collected[hi], `magnet ${magnet}`).toBe(magnet ? 1 : 0);
      }
      // the plain reach on an orb right beside the hero: 1 m, the magnet's 6 m
      expect(MAGNET_REACH).toBe(6);
      const f = c.feathers[1];
      const run = createRun(1, 1, "zuno");
      airborne(run, f.x + 5, f.y - ORB.centerY, f.z, 0);
      step(run, 1, press());
      step(run, 1, createStepInput());
      expect(run.hero.glideMs).toBeGreaterThan(0);
   });
});

describe("Vexa: the phase through ghost veils", () => {
   it("a ghost veil stops anyone from the main side, lets Vexa through while she phases, and lets anyone back out", () => {
      const c = courseFor(1);
      const wi = c.walls.findIndex((w) => w.kind === "ghost");
      const w = c.walls[wi];
      const midZ = (w.z0 + w.z1) / 2;
      // the main side is w.side (sign of x - the wall's middle)
      const mid = (w.x0 + w.x1) / 2;
      const mainX = w.side > 0 ? w.x1 + 1 : w.x0 - 1;
      const dir = -w.side;
      for (const phase of [false, true]) {
         const run = createRun(1, 1, "vexa");
         airborne(run, mainX, w.y0 + 3, midZ, 4000);
         if (phase) step(run, 1, press());
         const input = createStepInput();
         input.moveX = dir;
         input.jumpHeld = true;
         hold(run, 500, input);
         const crossed = (run.hero.x - mid) * w.side < 0;
         expect(crossed, `phase ${phase}`).toBe(phase);
      }
      // from the night side, the veil lets you out
      const back = createRun(1, 1, "kiro");
      airborne(back, w.side > 0 ? w.x0 - 1 : w.x1 + 1, w.y0 + 3, midZ, 4000);
      const input = createStepInput();
      input.moveX = w.side;
      input.jumpHeld = true;
      hold(back, 500, input);
      expect((back.hero.x - mid) * w.side).toBeGreaterThan(0);
   });
});

describe("one press, one timing", () => {
   it("every power fires on actionPressed alone (a jump press never fires it) and starts its own cooldown", () => {
      for (const h of HEROES) {
         const run = createRun(1, 1, h.id);
         airborne(run, 0, 40, -10, 4000);
         step(run, 1, { ...createStepInput(), jumpPressed: true });
         expect(run.events.powered).toBe(false);
         step(run, 1, press());
         expect(run.events.powered, h.id).toBe(true);
         expect(run.powerReadyAt).toBe(run.simMs + h.cooldownMs);
      }
   });
});
